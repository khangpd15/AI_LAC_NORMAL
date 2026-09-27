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

export function inconclusiveCycle(cycleIndex, reason, baseline = null) {
  return { cycleIndex, status: 'INCONCLUSIVE', coveredEyeSequence: ['left', 'right'], trackedEyeSequence: ['right', 'left'], baseline, rightEye: null, leftEye: null, isRefixationNotable: false, quality: { isValid: false, status: DATA_QUALITY_STATUS.INCONCLUSIVE, reason } };
}

export function createCycleRecord(cycleIndex, baselines, rightEye, leftEye) {
  const valid = Boolean(rightEye?.dataQuality?.isValid && leftEye?.dataQuality?.isValid);
  const reason = valid ? null : rightEye?.dataQuality?.reason || leftEye?.dataQuality?.reason || COVER_QUALITY_REASONS.INSUFFICIENT_SAMPLES;
  return { cycleIndex, status: valid ? 'COMPLETE' : 'INCONCLUSIVE', coveredEyeSequence: ['left', 'right'], trackedEyeSequence: ['right', 'left'], baseline: baselines, rightEye, leftEye, isRefixationNotable: valid && Boolean(rightEye.isNotableMovement || leftEye.isNotableMovement), quality: { isValid: valid, status: valid ? DATA_QUALITY_STATUS.GOOD : DATA_QUALITY_STATUS.INCONCLUSIVE, reason } };
}

export function aggregateCoverCycles(cycles) {
  const validCycles = cycles.filter((cycle) => cycle?.quality?.isValid);
  const notableCycles = validCycles.filter((cycle) => cycle.isRefixationNotable);
  let verdict = COVER_TEST_VERDICTS.INCONCLUSIVE;
  if (validCycles.length >= 2) verdict = notableCycles.length >= 2 ? COVER_TEST_VERDICTS.REFIXATION_DETECTED : COVER_TEST_VERDICTS.NO_SIGNIFICANT_REFIXATION;
  return { verdict, cycles, validCycles: validCycles.length, aggregatedRight: aggregateEyeMeasurements(validCycles.map((cycle) => cycle.rightEye), 'right'), aggregatedLeft: aggregateEyeMeasurements(validCycles.map((cycle) => cycle.leftEye), 'left'), quality: { status: validCycles.length >= 2 ? DATA_QUALITY_STATUS.GOOD : DATA_QUALITY_STATUS.INCONCLUSIVE, score: validCycles.length / SCREENING_CONFIG.CYCLES, reasons: cycles.filter((cycle) => !cycle?.quality?.isValid).map((cycle) => cycle?.quality?.reason).filter(Boolean) } };
}

export function createCoverSessionId() { return `cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
export function isCoverSessionCurrent(callbackSessionId, currentSessionId, aborted = false) { return !aborted && callbackSessionId === currentSessionId; }
