import { SCREENING_CONFIG } from '../constants/screeningConfig.js';
import { COVER_TEST_VERDICTS, DATA_QUALITY_STATUS } from '../constants/binocularScreeningConfig.js';
import { aggregateEyeMeasurements } from './coverTestMeasurementService.js';

export const COVER_QUALITY_REASONS = Object.freeze({
  NO_FACE: 'NO_FACE', INVALID_IRIS: 'INVALID_IRIS', INVALID_EYE_WIDTH: 'INVALID_EYE_WIDTH',
  BASELINE_UNSTABLE: 'BASELINE_UNSTABLE', HEAD_MOTION: 'HEAD_MOTION', INSUFFICIENT_SAMPLES: 'INSUFFICIENT_SAMPLES',
  TRACKING_LOST: 'TRACKING_LOST', POSITION_UNSTABLE: 'POSITION_UNSTABLE', TIMEOUT: 'TIMEOUT', SESSION_INVALIDATED: 'SESSION_INVALIDATED',
});

const finitePoint = (x, y) => Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1;

export function createCoverFrame(features, quality, eye, timestamp, elapsed) {
  if (!quality?.faceDetected) return { frame: null, reason: COVER_QUALITY_REASONS.NO_FACE };
  if (quality.headPoseValid === false) return { frame: null, reason: COVER_QUALITY_REASONS.HEAD_MOTION };
  const eyeDetected = eye === 'left' ? quality.leftEyeDetected : quality.rightEyeDetected;
  if (!quality.irisValid || !eyeDetected || !features?.raw) return { frame: null, reason: COVER_QUALITY_REASONS.INVALID_IRIS };
  const x = eye === 'left' ? features.raw.leftIrisX : features.raw.rightIrisX;
  const y = eye === 'left' ? features.raw.leftIrisY : features.raw.rightIrisY;
  const eyeWidth = eye === 'left' ? features.leftEyeWidth : features.rightEyeWidth;
  const normalizedX = eye === 'left' ? features.leftHorizontalRatio : features.rightHorizontalRatio;
  if (!finitePoint(x, y) || !Number.isFinite(normalizedX)) return { frame: null, reason: COVER_QUALITY_REASONS.INVALID_IRIS };
  if (!Number.isFinite(eyeWidth) || eyeWidth < SCREENING_CONFIG.EYE_WIDTH_MIN_RATIO || eyeWidth > SCREENING_CONFIG.EYE_WIDTH_MAX_RATIO) return { frame: null, reason: COVER_QUALITY_REASONS.INVALID_EYE_WIDTH };
  return { frame: { timestamp, t: elapsed, x, y, normalizedX, normalizedY: y, eyeWidth, quality: { isValid: true } }, reason: null };
}

export function validateBaselinePair(baselines) {
  const left = baselines?.leftBaseline; const right = baselines?.rightBaseline;
  if (!left || !right) return { isValid: false, reason: COVER_QUALITY_REASONS.BASELINE_UNSTABLE };
  if (left.sampleCount < SCREENING_CONFIG.MIN_VALID_SAMPLES_BASELINE || right.sampleCount < SCREENING_CONFIG.MIN_VALID_SAMPLES_BASELINE) return { isValid: false, reason: COVER_QUALITY_REASONS.INSUFFICIENT_SAMPLES };
  if (!left.isStable || !right.isStable) return { isValid: false, reason: COVER_QUALITY_REASONS.BASELINE_UNSTABLE };
  return { isValid: true, reason: null };
}

export function inconclusiveCycle(cycleIndex, reason, baseline = null, rawTrajectory = [], summary = null, datasetQuality = null) {
  const cycleCoveredEye = cycleIndex % 2 === 1 ? 'LEFT' : 'RIGHT';
  const cycleTrackedEye = cycleIndex % 2 === 1 ? 'RIGHT' : 'LEFT';
  return {
    cycle: cycleIndex,
    cycleNumber: cycleIndex,
    cycleIndex,
    status: 'INCONCLUSIVE',
    coveredEye: cycleCoveredEye,
    trackedEye: cycleTrackedEye,
    coveredEyeSequence: ['left', 'right'],
    trackedEyeSequence: ['right', 'left'],
    baseline,
    rightEye: null,
    leftEye: null,
    samples: rawTrajectory || [],
    sampleCount: rawTrajectory?.length || 0,
    rawTrajectory: rawTrajectory || [],
    summary: summary || null,
    datasetQuality: datasetQuality || null,
    horizontalDisplacement: null,
    verticalDisplacement: null,
    normalizedHorizontal: null,
    normalizedVertical: null,
    peakVelocity: null,
    trajectoryStability: null,
    isRefixationNotable: false,
    valid: false,
    quality: {
      isValid: false,
      status: DATA_QUALITY_STATUS.INCONCLUSIVE,
      reason,
    },
    occlusionMethod: 'manual_instruction',
    occlusionVerified: null,
  };
}

export function createCycleRecord(
  cycleIndex,
  baselines,
  rightEye,
  leftEye,
  rawTrajectory = [],
  summary = null,
  datasetQuality = null
) {
  const valid = Boolean(rightEye?.dataQuality?.isValid && leftEye?.dataQuality?.isValid);
  const reason = valid
    ? null
    : rightEye?.dataQuality?.reason || leftEye?.dataQuality?.reason || COVER_QUALITY_REASONS.INSUFFICIENT_SAMPLES;

  const totalSamples = (rightEye?.sampleCount ?? 0) + (leftEye?.sampleCount ?? 0);

  // Maximum directional excursion across both eyes in this cycle
  const maxRawH = Math.max(
    rightEye?.horizontalDisplacement ?? 0,
    leftEye?.horizontalDisplacement ?? 0
  );
  const maxRawV = Math.max(
    rightEye?.verticalDisplacement ?? 0,
    leftEye?.verticalDisplacement ?? 0
  );
  const maxNormH = Math.max(
    rightEye?.normalizedHorizontal ?? 0,
    leftEye?.normalizedHorizontal ?? 0
  );
  const maxNormV = Math.max(
    rightEye?.normalizedVertical ?? 0,
    leftEye?.normalizedVertical ?? 0
  );
  const maxPeakVel = Math.max(
    rightEye?.peakVelocity ?? 0,
    leftEye?.peakVelocity ?? 0
  );
  const minTrajStab = Math.min(
    rightEye?.trajectoryStability ?? 1,
    leftEye?.trajectoryStability ?? 1
  );

  const isRefixationNotable = valid && Boolean(rightEye?.isNotableMovement || leftEye?.isNotableMovement);

  const cycleCoveredEye = cycleIndex % 2 === 1 ? 'LEFT' : 'RIGHT';
  const cycleTrackedEye = cycleIndex % 2 === 1 ? 'RIGHT' : 'LEFT';

  return {
    cycle: cycleIndex,
    cycleNumber: cycleIndex,
    cycleIndex,
    status: valid ? 'COMPLETE' : 'INCONCLUSIVE',
    coveredEye: cycleCoveredEye,
    trackedEye: cycleTrackedEye,
    coveredEyeSequence: ['left', 'right'],
    trackedEyeSequence: ['right', 'left'],
    baseline: baselines,
    rightEye,
    leftEye,
    samples: rawTrajectory || [],
    sampleCount: rawTrajectory?.length || totalSamples,
    rawTrajectory: rawTrajectory || [],
    summary: summary || null,
    datasetQuality: datasetQuality || null,
    horizontalDisplacement: valid ? Number(maxRawH.toFixed(4)) : null,
    verticalDisplacement: valid ? Number(maxRawV.toFixed(4)) : null,
    normalizedHorizontal: valid ? Number(maxNormH.toFixed(4)) : null,
    normalizedVertical: valid ? Number(maxNormV.toFixed(4)) : null,
    peakVelocity: valid ? Number(maxPeakVel.toFixed(4)) : null,
    trajectoryStability: valid ? Number(minTrajStab.toFixed(4)) : null,
    isRefixationNotable,
    valid,
    quality: {
      isValid: valid,
      status: valid ? DATA_QUALITY_STATUS.GOOD : DATA_QUALITY_STATUS.INCONCLUSIVE,
      reason,
    },
    occlusionMethod: 'manual_instruction',
    occlusionVerified: null,
  };
}

export function aggregateCoverCycles(cycles = []) {
  const validCycles = (cycles || []).filter((cycle) => cycle?.quality?.isValid || cycle?.valid);

  if (validCycles.length < 2) {
    return {
      verdict: COVER_TEST_VERDICTS.INCONCLUSIVE,
      cycles,
      validCycles: validCycles.length,
      totalCycles: cycles.length,
      aggregatedRight: aggregateEyeMeasurements(validCycles.map((cycle) => cycle.rightEye).filter(Boolean), 'right'),
      aggregatedLeft: aggregateEyeMeasurements(validCycles.map((cycle) => cycle.leftEye).filter(Boolean), 'left'),
      quality: {
        status: DATA_QUALITY_STATUS.INCONCLUSIVE,
        score: validCycles.length / SCREENING_CONFIG.CYCLES,
        reasons: cycles.filter((cycle) => !cycle?.quality?.isValid && !cycle?.valid).map((cycle) => cycle?.quality?.reason).filter(Boolean),
      },
    };
  }

  // Device robustness: check jitter & stability across valid cycles (Section 12)
  const rightJitters = validCycles.map((c) => c.rightEye?.jitter).filter((v) => typeof v === 'number' && Number.isFinite(v));
  const leftJitters = validCycles.map((c) => c.leftEye?.jitter).filter((v) => typeof v === 'number' && Number.isFinite(v));
  const allJitters = [...rightJitters, ...leftJitters];
  const meanJitter = allJitters.length > 0 ? allJitters.reduce((a, b) => a + b, 0) / allJitters.length : 0;

  const rightStabilities = validCycles.map((c) => c.rightEye?.trajectoryStability).filter((v) => typeof v === 'number' && Number.isFinite(v));
  const leftStabilities = validCycles.map((c) => c.leftEye?.trajectoryStability).filter((v) => typeof v === 'number' && Number.isFinite(v));
  const allStabilities = [...rightStabilities, ...leftStabilities];
  const meanStability = allStabilities.length > 0 ? allStabilities.reduce((a, b) => a + b, 0) / allStabilities.length : 1;

  // Excessive tracking noise or instability makes the digital session inconclusive
  if (meanJitter > 0.06 || meanStability < 0.40) {
    return {
      verdict: COVER_TEST_VERDICTS.INCONCLUSIVE,
      cycles,
      validCycles: validCycles.length,
      totalCycles: cycles.length,
      aggregatedRight: aggregateEyeMeasurements(validCycles.map((c) => c.rightEye).filter(Boolean), 'right'),
      aggregatedLeft: aggregateEyeMeasurements(validCycles.map((c) => c.leftEye).filter(Boolean), 'left'),
      consistency: 'INCONCLUSIVE_HIGH_JITTER',
      quality: {
        status: DATA_QUALITY_STATUS.INCONCLUSIVE,
        score: 0.5,
        reasons: ['Chuyển động đầu hoặc độ nhiễu camera quá lớn giữa các chu kỳ'],
      },
    };
  }

  // Multi-cycle repeatability:
  // A true refixation pattern must be reproducible in the SAME eye across >= 2 valid cycles.
  // An isolated single cycle with high displacement (TC07) MUST NOT trigger REFIXATION_DETECTED.
  const rightNotableCycles = validCycles.filter((c) => c.rightEye?.isNotableMovement).length;
  const leftNotableCycles = validCycles.filter((c) => c.leftEye?.isNotableMovement).length;

  const hasConsistentRefixation = rightNotableCycles >= 2 || leftNotableCycles >= 2;

  const verdict = hasConsistentRefixation
    ? COVER_TEST_VERDICTS.REFIXATION_DETECTED
    : COVER_TEST_VERDICTS.NO_SIGNIFICANT_REFIXATION;

  return {
    verdict,
    cycles,
    validCycles: validCycles.length,
    totalCycles: cycles.length,
    aggregatedRight: aggregateEyeMeasurements(validCycles.map((cycle) => cycle.rightEye).filter(Boolean), 'right'),
    aggregatedLeft: aggregateEyeMeasurements(validCycles.map((cycle) => cycle.leftEye).filter(Boolean), 'left'),
    consistency: hasConsistentRefixation ? 'CONSISTENT_REFIXATION' : 'NO_NOTABLE_REFIXATION',
    quality: {
      status: DATA_QUALITY_STATUS.GOOD,
      score: validCycles.length / SCREENING_CONFIG.CYCLES,
      reasons: cycles.filter((cycle) => !cycle?.quality?.isValid && !cycle?.valid).map((cycle) => cycle?.quality?.reason).filter(Boolean),
    },
  };
}

export function createCoverSessionId() { return `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
export function isCoverSessionCurrent(callbackSessionId, currentSessionId, aborted = false) { return !aborted && callbackSessionId === currentSessionId; }
