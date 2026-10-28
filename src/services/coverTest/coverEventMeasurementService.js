import { SCREENING_CONFIG } from '../../constants/screeningConfig.js';
import { analyzeUncoverTrajectory, calculateRobustBaseline } from '../coverTestMeasurementService.js';

// Engineering limits for observable transitions, not clinical cutoffs.
export const COVER_EVENT_LIMITS = Object.freeze({
  minCoverMs: 120,
  minOpenMs: 120,
  minOpenFrames: 3,
  maxGapMs: 250,
  baselineWindowMs: 2000,
  analysisMs: 1500,
  minEarlySamples: 5,
  minEarlySpanMs: 300,
  minAnalysisSpanMs: 1000,
  minSettlingSamples: 5,
  minSettlingSpanMs: 200,
  settlingWindowMs: 500,
  minSettlingStability: 0.60,
});

const otherEye = eye => eye === 'left' ? 'right' : 'left';
const invalid = (eye, cycle, kind, reason, event = null) => ({
  eye, cycle, measurementKind: kind, event,
  isNotableMovement: false,
  dataQuality: { isValid: false, reason },
});

// Source-pixel geometry avoids portrait aspect-ratio distortion. Both axes use
// canthal width; eyelid opening is never used as a movement scale.
export function getCanthalMovementCoordinates(frame) {
  if (!frame || !Number.isFinite(frame.canthalWidth) || frame.canthalWidth < 6) return null;
  const { pInner, pOuter, pIris, canthalWidth: width } = frame;
  if (![pInner, pOuter, pIris].every(p => Number.isFinite(p?.x) && Number.isFinite(p?.y))) return null;
  const sign = pOuter.x >= pInner.x ? 1 : -1;
  const ux = sign * (pOuter.x - pInner.x) / width;
  const uy = sign * (pOuter.y - pInner.y) / width;
  const dx = pIris.x - (pInner.x + pOuter.x) / 2;
  const dy = pIris.y - (pInner.y + pOuter.y) / 2;
  return { normalizedX: 0.5 + (dx * ux + dy * uy) / width,
    normalizedY: 0.5 + (-dx * uy + dy * ux) / width };
}

export function analyzeObservedMovement(frames, baseline, event, kind, eye, cycle) {
  if (!event) return invalid(eye, cycle, kind, 'EVENT_NOT_CONFIRMED');
  const samples = frames
    .filter(f => f && f.quality?.isValid === true && f.isEyeValid !== false &&
      f.qualityFlag !== 'UNKNOWN_SAMPLE' &&
      ['timestamp', 'x', 'y', 'normalizedX', 'normalizedY', 'eyeWidth'].every(k => Number.isFinite(f[k])) &&
      f.timestamp >= event.timestampMs && f.timestamp <= event.timestampMs + COVER_EVENT_LIMITS.analysisMs)
    .map(f => ({ ...f, phaseElapsedMs: f.t, t: f.timestamp - event.timestampMs }));
  const early = samples.filter(f => f.t <= SCREENING_CONFIG.EARLY_ANALYSIS_WINDOW_MS);
  const gaps = samples.slice(1).map((f, i) => ({ startMs: samples[i].t, endMs: f.t, durationMs: f.t - samples[i].t }))
    .filter(gap => gap.durationMs > COVER_EVENT_LIMITS.maxGapMs);
  const lateGaps = gaps.filter(gap => gap.startMs >= SCREENING_CONFIG.EARLY_ANALYSIS_WINDOW_MS);
  const settlingStartMs = Math.max(SCREENING_CONFIG.EARLY_ANALYSIS_WINDOW_MS,
    (samples.at(-1)?.t ?? 0) - COVER_EVENT_LIMITS.settlingWindowMs, lateGaps.at(-1)?.endMs ?? 0);
  const settling = samples.filter(f => f.t >= settlingStartMs);
  const coverage = { validSamples: samples.length, earlyValidSamples: early.length,
    firstOffsetMs: samples[0]?.t ?? null, lastOffsetMs: samples.at(-1)?.t ?? null,
    earlySpanMs: early.length ? early.at(-1).t - early[0].t : null,
    maxGapMs: samples.length > 1 ? Math.max(...samples.slice(1).map((f, i) => f.t - samples[i].t)) : null,
    lateGaps, settlingSamples: settling.length,
    settlingSpanMs: settling.length ? settling.at(-1).t - settling[0].t : null,
    settlingStartMs };
  if (samples.length < SCREENING_CONFIG.MIN_VALID_SAMPLES_UNCOVER ||
      samples.at(-1).t < COVER_EVENT_LIMITS.minAnalysisSpanMs ||
      early.length < COVER_EVENT_LIMITS.minEarlySamples || early[0].t > COVER_EVENT_LIMITS.maxGapMs ||
      early.at(-1).t - early[0].t < COVER_EVENT_LIMITS.minEarlySpanMs ||
      gaps.some(gap => gap.startMs < SCREENING_CONFIG.EARLY_ANALYSIS_WINDOW_MS) ||
      samples.some((f, i) => i > 0 && f.t <= samples[i - 1].t)) {
    return { ...invalid(eye, cycle, kind, 'INSUFFICIENT_EVENT_COVERAGE', event), coverage };
  }
  if (settling.length < COVER_EVENT_LIMITS.minSettlingSamples ||
      settling.at(-1).t - settling[0].t < COVER_EVENT_LIMITS.minSettlingSpanMs) {
    return { ...invalid(eye, cycle, kind, 'INSUFFICIENT_SETTLING_COVERAGE', event), coverage };
  }
  // Analyze eye-local movement at a fixed reference width, not camera-space
  // translation. Original image coordinates remain in the persisted trajectory.
  const referenceWidth = samples[0].eyeWidth;
  const localSamples = samples.map(f => ({ ...f,
    x: f.normalizedX * referenceWidth, y: f.normalizedY * referenceWidth }));
  const localBaseline = baseline && { ...baseline,
    baselineX: baseline.normalizedBaselineX * referenceWidth,
    baselineY: baseline.normalizedBaselineY * referenceWidth };
  const result = analyzeUncoverTrajectory(localSamples, localBaseline, eye, cycle, referenceWidth, {
    initialFromBaseline: kind === 'cover_on_fellow_eye',
    eventType: kind === 'cover_on_fellow_eye' ? 'COVER' : 'UNCOVER',
    eventTimestampMs: event.timestampMs,
    recordMs: samples.at(-1).t,
    settlingStartMs,
    maxKinematicGapMs: COVER_EVENT_LIMITS.maxGapMs,
  });
  if (result.dataQuality.isValid && result.trajectoryStability < COVER_EVENT_LIMITS.minSettlingStability) {
    return { ...result, isNotableMovement: false, measurementKind: kind,
      coordinateSpace: 'CANTHAL_FRAME_REFERENCE_WIDTH', event, coverage,
      dataQuality: { ...result.dataQuality, isValid: false, reason: 'UNSTABLE_SETTLING' } };
  }
  return { ...result, measurementKind: kind, coordinateSpace: 'CANTHAL_FRAME_REFERENCE_WIDTH', event, coverage,
    dataQuality: { ...result.dataQuality,
      warnings: lateGaps.length ? ['LATE_GAP_EXCLUDED_FROM_KINEMATICS'] : [] } };
}

/** Continuous, bounded source-frame history. Image encoding never drives measurements.
 * UNKNOWN is not occlusion evidence; only direct opposite-eye visibility arms a leg.
 */
export function createCoverEventMeasurementRecorder() {
  let history = [];
  let lastTimestamp = null;
  let lastBothVisible = null;
  let leg = null;

  const makeEvent = (kind, first, previousMs, confirmedAtMs) => ({
    eventId: `c${leg.cycle}_${leg.eye}_${kind}`,
    eventType: kind === 'cover' ? 'COVER' : 'UNCOVER',
    coveredEye: leg.eye.toUpperCase(),
    observedEye: (kind === 'cover' ? otherEye(leg.eye) : leg.eye).toUpperCase(),
    timestampMs: first.timestampMs, frameId: first.frameId,
    confirmedAtMs, onsetIntervalMs: [previousMs, first.timestampMs],
    timingUncertaintyMs: first.timestampMs - previousMs,
    evidence: 'OBSERVED_VISIBILITY_TRANSITION',
  });
  const closeInterruption = timestampMs => {
    if (!leg || leg.uncertainSince === null) return;
    if (leg.interruptions.length < 100) leg.interruptions.push({
      startMs: leg.uncertainSince, endMs: timestampMs,
      durationMs: timestampMs - leg.uncertainSince,
      withinRecoveryLimit: timestampMs - leg.uncertainSince <= COVER_EVENT_LIMITS.maxGapMs,
    });
    leg.uncertainSince = null;
  };

  return {
    beginCover(eye, cycle) {
      if (!['left', 'right'].includes(eye)) throw new Error('INVALID_COVER_EYE');
      leg = { eye, cycle, primarySamples: [], recoverySamples: [], pendingCover: null, pendingUncover: null,
        cover: null, uncover: null, baseline: null, baselineSource: null, lastOccluded: null, coveredRunStart: null,
        coverReady: false, uncertainSince: null, interruptions: [], limitExceeded: false };
    },
    observe({ timestampMs, frameId, visibility = {}, frames = {}, qualityValid = false }) {
      if (!Number.isFinite(timestampMs) || (lastTimestamp !== null && timestampMs <= lastTimestamp)) return;
      const previousTimestamp = lastTimestamp;
      const gap = lastTimestamp !== null && timestampMs - lastTimestamp > COVER_EVENT_LIMITS.maxGapMs;
      lastTimestamp = timestampMs;
      if (gap || !qualityValid) {
        history = [];
        lastBothVisible = null;
        if (leg) {
          leg.pendingCover = null;
          leg.pendingUncover = null;
          leg.coveredRunStart = null;
          leg.coverReady = false;
          leg.uncertainSince ??= previousTimestamp ?? timestampMs;
        }
      }
      const bothVisible = Boolean(qualityValid && visibility.left === 'VISIBLE' && visibility.right === 'VISIBLE' &&
        frames.left && frames.right);
      const opposite = leg ? otherEye(leg.eye) : null;
      const covered = Boolean(leg && qualityValid && visibility[leg.eye] === 'OCCLUDED' &&
        visibility[opposite] === 'VISIBLE' && frames[opposite]);
      if (leg && qualityValid && !leg.uncover) {
        if (covered) {
          closeInterruption(timestampMs);
          leg.pendingUncover = null;
          leg.coveredRunStart ??= timestampMs;
          if (!leg.cover) {
            if (!leg.pendingCover && lastBothVisible !== null &&
                timestampMs - lastBothVisible <= COVER_EVENT_LIMITS.maxGapMs) {
              leg.pendingCover = { timestampMs, frameId, previousMs: lastBothVisible };
              leg.baseline = {
                left: calculateRobustBaseline(history.map(f => f.frames.left)),
                right: calculateRobustBaseline(history.map(f => f.frames.right)),
              };
              const source = history.at(-1);
              leg.baselineSource = source ? { frameId: source.frameId, timestampMs: source.timestampMs } : null;
            }
            if (leg.pendingCover && timestampMs - leg.pendingCover.timestampMs >= COVER_EVENT_LIMITS.minCoverMs) {
              leg.cover = makeEvent('cover', leg.pendingCover, leg.pendingCover.previousMs, timestampMs);
            }
          }
          if (timestampMs - leg.coveredRunStart >= COVER_EVENT_LIMITS.minCoverMs) leg.coverReady = true;
          leg.lastOccluded = timestampMs;
        } else if (bothVisible) {
          closeInterruption(timestampMs);
          if (leg.cover) {
            if (!leg.pendingUncover && leg.coverReady && timestampMs - leg.lastOccluded <= COVER_EVENT_LIMITS.maxGapMs) {
              leg.pendingUncover = { timestampMs, frameId, clearFrames: 1 };
            } else if (leg.pendingUncover) {
              leg.pendingUncover.clearFrames++;
              if (leg.pendingUncover.clearFrames >= COVER_EVENT_LIMITS.minOpenFrames &&
                  timestampMs - leg.pendingUncover.timestampMs >= COVER_EVENT_LIMITS.minOpenMs) {
                leg.uncover = makeEvent('uncover', leg.pendingUncover, leg.lastOccluded, timestampMs);
              }
            }
          } else leg.pendingCover = null;
          leg.coveredRunStart = null;
        } else {
          // Do not turn one rejected sample into a permanent failure. Never
          // fabricate a hidden iris or refresh lastOccluded during UNKNOWN.
          leg.uncertainSince ??= timestampMs;
          leg.pendingCover = null;
          leg.pendingUncover = null;
          leg.coveredRunStart = null;
          if (leg.lastOccluded === null || timestampMs - leg.lastOccluded > COVER_EVENT_LIMITS.maxGapMs) {
            leg.coverReady = false;
          }
        }
      }
      if (leg) {
        const coverStart = leg.cover?.timestampMs ?? leg.pendingCover?.timestampMs;
        const uncoverStart = leg.uncover?.timestampMs ?? leg.pendingUncover?.timestampMs;
        const inWindow = start => start != null && timestampMs - start <= COVER_EVENT_LIMITS.analysisMs;
        // Only the still-visible fellow eye is measured. A short uncertain
        // occlusion interval can bridge state; it contributes no inferred iris.
        const coveredOrBrieflyUncertain = covered || (qualityValid && visibility[leg.eye] === 'UNKNOWN' &&
          visibility[opposite] === 'VISIBLE' && leg.lastOccluded !== null &&
          timestampMs - leg.lastOccluded <= COVER_EVENT_LIMITS.maxGapMs);
        if (inWindow(coverStart) && !leg.uncover && coveredOrBrieflyUncertain && frames[opposite]) {
          if (leg.primarySamples.length < 2048) leg.primarySamples.push(frames[opposite]);
          else leg.limitExceeded = true;
        }
        if (inWindow(uncoverStart) && qualityValid && frames[leg.eye]) {
          if (leg.recoverySamples.length < 2048) leg.recoverySamples.push(frames[leg.eye]);
          else leg.limitExceeded = true;
        }
      }
      if (bothVisible) {
        lastBothVisible = timestampMs;
        history.push({ timestampMs, frameId, frames });
        history = history.filter(f => timestampMs - f.timestampMs <= COVER_EVENT_LIMITS.baselineWindowMs).slice(-120);
      } else history = history.filter(f => timestampMs - f.timestampMs <= COVER_EVENT_LIMITS.baselineWindowMs);
    },
    getProgress() {
      return { coverEvent: leg?.cover ?? null, uncoverEvent: leg?.uncover ?? null,
        coverReady: leg?.coverReady ?? false };
    },
    finishLeg() {
      if (!leg) return null;
      closeInterruption(lastTimestamp);
      const opposite = otherEye(leg.eye);
      const primaryProcedureValid = !leg.limitExceeded && Boolean(leg.cover);
      const procedureValid = primaryProcedureValid && Boolean(leg.uncover);
      const reason = leg.limitExceeded ? 'OBSERVATION_LIMIT_EXCEEDED'
        : !leg.cover ? 'COVER_NOT_CONFIRMED' : !leg.uncover ? 'UNCOVER_NOT_CONFIRMED' : null;
      // A later uncertain uncover must not erase a complete, independently
      // observed cover-on window. Missing recovery remains explicitly invalid.
      const coverOn = primaryProcedureValid
        ? analyzeObservedMovement(leg.primarySamples, leg.baseline?.[opposite], leg.cover,
          'cover_on_fellow_eye', opposite, leg.cycle)
        : invalid(opposite, leg.cycle, 'cover_on_fellow_eye', reason, leg.cover);
      const uncoverRecovery = procedureValid
        ? analyzeObservedMovement(leg.recoverySamples, leg.baseline?.[leg.eye], leg.uncover,
          'uncover_recovery', leg.eye, leg.cycle)
        : invalid(leg.eye, leg.cycle, 'uncover_recovery', reason, leg.uncover);
      const result = {
        coveredEye: leg.eye.toUpperCase(), coverOn, uncoverRecovery,
        evidence: { procedureValid, primaryProcedureValid, reason, coverEvent: leg.cover, uncoverEvent: leg.uncover,
          baselineSource: leg.baselineSource,
          interruptions: leg.interruptions, source: 'pixel-appearance-v2', clinicallyValidated: false },
      };
      leg = null;
      return result;
    },
  };
}
