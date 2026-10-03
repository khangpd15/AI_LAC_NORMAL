/**
 * Eye Feature Service - Feature extraction, landmark validation and saccade analysis
 */

import { LANDMARKS, SCREENING_CONFIG } from '../constants/screeningConfig.js';
import { LandmarkOneEuroFilterManager } from './cv/oneEuroFilter.js';
import { projectPointOntoSegment } from './cv/gazeTracker.js';

// Shared instance of One Euro Filter for live camera stream
export const sharedLandmarkFilter = new LandmarkOneEuroFilterManager(1.2, 0.008);

// Configurable parameters for Blink Blanking Window
// NOTE: -60ms and +120ms are clinical ophthalmology literature reference values
// (Nahass et al. 2025; Casiez et al.).
// In production/testing, these should be benchmarked against target webcams and MediaPipe tracking latency.
export const BLINK_CONFIG = Object.freeze({
  EAR_THRESHOLD: 0.18,
  PRE_BLINK_MASK_MS: 60,   // Window preceding blink onset (eyelid descending)
  POST_BLINK_MASK_MS: 120, // Window following blink offset (eyelid reopening / settling)
  MAX_HISTORY_MS: 3000,    // Buffer retention period
});

/**
 * Stateful temporal buffer for blink artifact blanking in streaming frames
 */
export class BlinkTemporalBuffer {
  constructor(config = {}) {
    this.earThreshold = config.EAR_THRESHOLD ?? BLINK_CONFIG.EAR_THRESHOLD;
    this.preMaskMs = config.PRE_BLINK_MASK_MS ?? BLINK_CONFIG.PRE_BLINK_MASK_MS;
    this.postMaskMs = config.POST_BLINK_MASK_MS ?? BLINK_CONFIG.POST_BLINK_MASK_MS;
    this.maxHistoryMs = config.MAX_HISTORY_MS ?? BLINK_CONFIG.MAX_HISTORY_MS;
    this.history = [];
  }

  reset() {
    this.history = [];
  }

  /**
   * Updates buffer with current frame measurements and evaluates temporal masking
   * @param {number} timestamp
   * @param {number} leftEar
   * @param {number} rightEar
   * @param {string|null} [coveredEye=null] - 'left' | 'right' | null
   * @returns {{
   *   isBlinkLeft: boolean,
   *   isBlinkRight: boolean,
   *   isBlinkMaskedLeft: boolean,
   *   isBlinkMaskedRight: boolean,
   *   isBlinkMasked: boolean
   * }}
   */
  update(timestamp, leftEar, rightEar, coveredEye = null) {
    const isBlinkL = leftEar < this.earThreshold;
    const isBlinkR = rightEar < this.earThreshold;

    this.history.push({
      timestamp,
      leftEar,
      rightEar,
      isBlinkL,
      isBlinkR,
    });

    const cutoff = timestamp - this.maxHistoryMs;
    while (this.history.length > 0 && this.history[0].timestamp < cutoff) {
      this.history.shift();
    }

    let isBlinkMaskedLeft = false;
    let isBlinkMaskedRight = false;

    // Edge case: In COVER phase, only mask blink for the open eye.
    // The covered eye is excluded from fellow-eye analysis and should not trigger false blink masking.
    const checkLeft = coveredEye !== 'left';
    const checkRight = coveredEye !== 'right';

    for (let i = this.history.length - 1; i >= 0; i--) {
      const entry = this.history[i];
      const dt = timestamp - entry.timestamp;

      // History entries are chronological. If dt exceeds postMaskMs, earlier entries also exceed it.
      if (dt > this.postMaskMs) {
        break;
      }

      // Check if entry was a blink and falls in [-preMaskMs, +postMaskMs] relative to timestamp
      // i.e., timestamp >= entry.timestamp - preMaskMs && timestamp <= entry.timestamp + postMaskMs
      if (dt >= -this.preMaskMs && dt <= this.postMaskMs) {
        if (checkLeft && entry.isBlinkL) {
          isBlinkMaskedLeft = true;
        }
        if (checkRight && entry.isBlinkR) {
          isBlinkMaskedRight = true;
        }
      }

      if ((!checkLeft || isBlinkMaskedLeft) && (!checkRight || isBlinkMaskedRight)) {
        break;
      }
    }

    const finalMaskL = checkLeft ? isBlinkMaskedLeft : false;
    const finalMaskR = checkRight ? isBlinkMaskedRight : false;

    return {
      isBlinkLeft: isBlinkL,
      isBlinkRight: isBlinkR,
      isBlinkMaskedLeft: finalMaskL,
      isBlinkMaskedRight: finalMaskR,
      isBlinkMasked: finalMaskL || finalMaskR,
    };
  }
}

export const sharedBlinkBuffer = new BlinkTemporalBuffer();

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));
const isFinitePoint = (point) => (
  point &&
  Number.isFinite(point.x) &&
  Number.isFinite(point.y) &&
  point.x >= 0 &&
  point.x <= 1 &&
  point.y >= 0 &&
  point.y <= 1
);

function scoreFrameQuality({
  faceDetected,
  leftEyeDetected,
  rightEyeDetected,
  leftIrisDetected,
  rightIrisDetected,
  headPoseStatus,
  distanceValid,
  fps,
  blinkDetected,
  occlusionDetected,
}) {
  let score = 0;
  if (faceDetected) score += 20;
  if (leftEyeDetected && rightEyeDetected) score += 20;
  if (leftIrisDetected && rightIrisDetected) score += 20;
  if (headPoseStatus === 'GOOD') score += 10;
  else if (headPoseStatus === 'WARNING') score += 6;
  if (distanceValid !== false) score += 10;
  if (!Number.isFinite(fps) || fps >= 20) score += 10;
  else if (fps >= 12) score += 5;
  if (!blinkDetected) score += 5;
  if (!occlusionDetected) score += 5;
  return clampNumber(Math.round(score), 0, 100);
}

function resolveCompactStatus(gate) {
  if (!gate.faceDetected) return { label: 'Đưa mặt vào giữa', voice: 'Đưa mặt vào giữa.' };
  if (!gate.leftEyeDetected || !gate.rightEyeDetected || !gate.leftIrisDetected || !gate.rightIrisDetected) {
    return { label: 'Mắt chưa rõ', voice: 'Mở mắt và nhìn thẳng.' };
  }
  if (gate.blinkDetected) return { label: 'Mở mắt', voice: 'Mở mắt và nhìn thẳng.' };
  if (gate.distanceHint === 'TOO_FAR') return { label: 'Gần hơn', voice: 'Gần hơn một chút.' };
  if (gate.distanceHint === 'TOO_CLOSE') return { label: 'Xa hơn', voice: 'Xa hơn một chút.' };
  if (gate.headPoseStatus === 'WARNING' || gate.headPoseStatus === 'INVALID' || gate.fpsLow) {
    return { label: 'Giữ yên', voice: 'Giữ yên.' };
  }
  return { label: 'Ổn', voice: null };
}

/**
 * QUALITY GATE
 * Merges landmark visibility, blink, occlusion, distance, FPS, and phase context
 * into one permissive frame contract. Bad frames are dropped by consumers; a
 * single bad frame must never fail a full screening session.
 */
export function buildFrameQualityGate(baseQuality, features, options = {}) {
  const coveredEye = options.coveredEye || null;
  const trackedEye = options.trackedEye || null;
  const fps = Number.isFinite(options.fps) ? options.fps : null;
  const leftIrisDetected = Boolean(baseQuality?.leftIrisDetected ?? baseQuality?.leftEyeDetected);
  const rightIrisDetected = Boolean(baseQuality?.rightIrisDetected ?? baseQuality?.rightEyeDetected);
  const blinkDetected = Boolean(features?.isBlinkMasked || features?.isBlinking);
  const leftBlink = Boolean(features?.isBlinkMaskedLeft || features?.isBlinkLeft);
  const rightBlink = Boolean(features?.isBlinkMaskedRight || features?.isBlinkRight);
  const leftExpectedCovered = coveredEye === 'left';
  const rightExpectedCovered = coveredEye === 'right';
  const leftUnexpectedOcclusion = !leftExpectedCovered && baseQuality?.eyeVisibility?.left === 'LOST';
  const rightUnexpectedOcclusion = !rightExpectedCovered && baseQuality?.eyeVisibility?.right === 'LOST';
  const occlusionDetected = Boolean(leftUnexpectedOcclusion || rightUnexpectedOcclusion);

  const distanceCm = features?.estimatedDistanceCm;
  let distanceHint = null;
  if (Number.isFinite(distanceCm)) {
    if (distanceCm > 90) distanceHint = 'TOO_FAR';
    else if (distanceCm < 25) distanceHint = 'TOO_CLOSE';
  }
  const distanceValid = distanceHint === null;

  const requiresLeft = trackedEye === 'left' || (!trackedEye && !leftExpectedCovered);
  const requiresRight = trackedEye === 'right' || (!trackedEye && !rightExpectedCovered);
  const requiredEyesValid =
    (!requiresLeft || (baseQuality?.leftEyeDetected && leftIrisDetected && !leftBlink)) &&
    (!requiresRight || (baseQuality?.rightEyeDetected && rightIrisDetected && !rightBlink));
  const fpsLow = Number.isFinite(fps) && fps < 12;

  const qualityScore = scoreFrameQuality({
    faceDetected: Boolean(baseQuality?.faceDetected),
    leftEyeDetected: Boolean(baseQuality?.leftEyeDetected),
    rightEyeDetected: Boolean(baseQuality?.rightEyeDetected),
    leftIrisDetected,
    rightIrisDetected,
    headPoseStatus: baseQuality?.headPoseStatus || (baseQuality?.headPoseValid === false ? 'INVALID' : 'GOOD'),
    distanceValid,
    fps,
    blinkDetected,
    occlusionDetected,
  });

  const frameValid = Boolean(
    baseQuality?.faceDetected &&
      requiredEyesValid &&
      baseQuality?.headPoseStatus !== 'INVALID' &&
      !blinkDetected &&
      !occlusionDetected
  );

  const enriched = {
    ...baseQuality,
    leftIrisDetected,
    rightIrisDetected,
    blinkDetected,
    occlusionDetected,
    distanceValid,
    distanceHint,
    estimatedDistanceCm: Number.isFinite(distanceCm) ? distanceCm : null,
    fps,
    fpsLow,
    trackingConfidence: typeof baseQuality?.score === 'number' ? baseQuality.score : 0,
    qualityScore,
    score: typeof baseQuality?.score === 'number' ? baseQuality.score : qualityScore / 100,
    isValid: frameValid,
    frameValid,
    aiFrameEligible: Boolean(
      frameValid &&
        baseQuality?.leftEyeDetected &&
        baseQuality?.rightEyeDetected &&
        leftIrisDetected &&
        rightIrisDetected &&
        !coveredEye
    ),
  };
  const compact = resolveCompactStatus(enriched);
  return {
    ...enriched,
    uiStatus: compact.label,
    voicePrompt: compact.voice,
  };
}

/**
 * Post-processing helper that applies full retrospective Blink Blanking Window
 * to a trajectory array of recorded frames.
 * Eliminates false peak velocity spikes around blinks.
 * 
 * @param {Array<any>} frames - Array of trajectory frames with { t/timestamp, leftEar, rightEar, ... }
 * @param {Object} [options]
 * @param {string|null} [options.coveredEye=null]
 * @param {number} [options.preMaskMs=60]
 * @param {number} [options.postMaskMs=120]
 * @param {number} [options.earThreshold=0.18]
 * @returns {Array<any>} New array of frames with isBlinkMasked, isBlinkMaskedLeft, isBlinkMaskedRight annotated
 */
export function applyBlinkBlankingToTrajectory(frames, options = {}) {
  if (!Array.isArray(frames) || frames.length === 0) return [];

  const preMaskMs = options.preMaskMs ?? BLINK_CONFIG.PRE_BLINK_MASK_MS;
  const postMaskMs = options.postMaskMs ?? BLINK_CONFIG.POST_BLINK_MASK_MS;
  const earThreshold = options.earThreshold ?? BLINK_CONFIG.EAR_THRESHOLD;
  const coveredEye = options.coveredEye ?? null;

  // Identify all blink timestamps
  const blinkEvents = [];
  for (const f of frames) {
    const t = f.timestamp ?? f.t ?? 0;
    const leftEar = f.leftEar ?? f.features?.leftEar ?? 0.3;
    const rightEar = f.rightEar ?? f.features?.rightEar ?? 0.3;
    const isBlinkL = (f.isBlinkLeft ?? f.features?.isBlinkLeft) || (leftEar < earThreshold);
    const isBlinkR = (f.isBlinkRight ?? f.features?.isBlinkRight) || (rightEar < earThreshold);

    if (isBlinkL || isBlinkR) {
      blinkEvents.push({ t, isBlinkL, isBlinkR });
    }
  }

  const checkLeft = coveredEye !== 'left';
  const checkRight = coveredEye !== 'right';

  return frames.map((f) => {
    const t = f.timestamp ?? f.t ?? 0;
    let maskedL = false;
    let maskedR = false;

    for (const b of blinkEvents) {
      if (t >= b.t - preMaskMs && t <= b.t + postMaskMs) {
        if (checkLeft && b.isBlinkL) maskedL = true;
        if (checkRight && b.isBlinkR) maskedR = true;
        if ((!checkLeft || maskedL) && (!checkRight || maskedR)) break;
      }
    }

    const isBlinkMaskedLeft = checkLeft ? maskedL : false;
    const isBlinkMaskedRight = checkRight ? maskedR : false;
    const isBlinkMasked = isBlinkMaskedLeft || isBlinkMaskedRight;

    return {
      ...f,
      isBlinkMaskedLeft,
      isBlinkMaskedRight,
      isBlinkMasked,
    };
  });
}

/**
 * Validates tracking quality of landmarks
 * @param {Array<any>} multiFaceLandmarks
 * @param {boolean} requireBothEyes
 * @returns {{
 *   isValid: boolean,
 *   reason: string | null,
 *   faceDetected: boolean,
 *   leftEyeDetected: boolean,
 *   rightEyeDetected: boolean,
 *   irisValid: boolean
 * }}
 */
export function validateEyeTrackingQuality(multiFaceLandmarks, options = {}) {
  const requireBothEyes = typeof options === 'boolean' ? options : Boolean(options.requireBothEyes);
  const coveredEye = typeof options === 'object' ? options.coveredEye || null : null;
  const trackedEye = typeof options === 'object' ? options.trackedEye || null : null;

  if (!multiFaceLandmarks || multiFaceLandmarks.length === 0) {
    return {
      isValid: false,
      status: 'INVALID',
      score: 0,
      reason: 'Không phát hiện khuôn mặt',
      faceDetected: false,
      leftEyeDetected: false,
      rightEyeDetected: false,
      irisValid: false,
      eyeVisibility: { left: 'LOST', right: 'LOST' },
    };
  }

  const lm = multiFaceLandmarks[0];
  if (!lm) {
    return {
      isValid: false,
      status: 'INVALID',
      score: 0,
      reason: 'Không nhận diện được khuôn mặt',
      faceDetected: false,
      leftEyeDetected: false,
      rightEyeDetected: false,
      irisValid: false,
      eyeVisibility: { left: 'LOST', right: 'LOST' },
    };
  }

  // IRIS TRACKING
  // Check left eye landmarks (362, 263, 473)
  const leftIrisDetected = isFinitePoint(lm[LANDMARKS.LEFT_IRIS_CENTER]);
  const leftEyeOk = Boolean(
    lm[LANDMARKS.LEFT_INNER_CORNER] &&
    lm[LANDMARKS.LEFT_OUTER_CORNER] &&
    leftIrisDetected
  );

  // Check right eye landmarks (133, 33, 468)
  const rightIrisDetected = isFinitePoint(lm[LANDMARKS.RIGHT_IRIS_CENTER]);
  const rightEyeOk = Boolean(
    lm[LANDMARKS.RIGHT_INNER_CORNER] &&
    lm[LANDMARKS.RIGHT_OUTER_CORNER] &&
    rightIrisDetected
  );

  const leftExpectedCovered = coveredEye === 'left';
  const rightExpectedCovered = coveredEye === 'right';
  const requiredLeftOk = trackedEye === 'left' || (requireBothEyes && !leftExpectedCovered);
  const requiredRightOk = trackedEye === 'right' || (requireBothEyes && !rightExpectedCovered);
  const hasRequiredLeft = !requiredLeftOk || leftEyeOk;
  const hasRequiredRight = !requiredRightOk || rightEyeOk;
  const hasAnyVisibleEye = leftEyeOk || rightEyeOk;
  const isOk = hasAnyVisibleEye && hasRequiredLeft && hasRequiredRight;
  const eyeVisibility = {
    left: leftExpectedCovered ? 'OCCLUDED' : (leftEyeOk ? 'VISIBLE' : 'LOST'),
    right: rightExpectedCovered ? 'OCCLUDED' : (rightEyeOk ? 'VISIBLE' : 'LOST'),
  };

  if (!isOk) {
    return {
      isValid: false,
      status: 'INVALID',
      score: hasAnyVisibleEye ? 0.45 : 0.1,
      reason: 'Đang nhận diện mống mắt... Đưa khuôn mặt vào giữa khung hình.',
      faceDetected: true,
      leftEyeDetected: leftEyeOk,
      rightEyeDetected: rightEyeOk,
      leftIrisDetected,
      rightIrisDetected,
      irisValid: false,
      eyeVisibility,
    };
  }

  // HEAD POSE
  // Engineering head-motion gate for live Cover Test sampling. Mild drift is a
  // WARNING, not an immediate session blocker.
  const leftEar = lm[LANDMARKS.LEFT_EAR_TRAGUS];
  const rightEar = lm[LANDMARKS.RIGHT_EAR_TRAGUS];
  const nose = lm[LANDMARKS.NOSE_TIP];
  let headPoseValid = true;
  let headPoseStatus = 'GOOD';
  let headRollDeg = null;
  let headYawDeg = null;
  if (leftEar && rightEar && nose) {
    headRollDeg = Math.atan2(leftEar.y - rightEar.y, leftEar.x - rightEar.x) * 180 / Math.PI;
    const earMidX = (leftEar.x + rightEar.x) / 2;
    headYawDeg = (nose.x - earMidX) * 100;
    const absRoll = Math.abs(headRollDeg);
    const absYaw = Math.abs(headYawDeg);
    if (absRoll > 24 || absYaw > 25) {
      headPoseStatus = 'INVALID';
    } else if (absRoll > 12 || absYaw > 15) {
      headPoseStatus = 'WARNING';
    }
    headPoseValid = headPoseStatus !== 'INVALID';
  }

  if (!headPoseValid) {
    return {
      isValid: false,
      status: 'INVALID',
      score: 0.35,
      reason: 'HEAD_MOTION',
      faceDetected: true,
      leftEyeDetected: leftEyeOk,
      rightEyeDetected: rightEyeOk,
      leftIrisDetected,
      rightIrisDetected,
      irisValid: leftEyeOk || rightEyeOk,
      headPoseValid,
      headPoseStatus,
      headRollDeg,
      headYawDeg,
      eyeVisibility,
    };
  }

  const bothVisible = leftEyeOk && rightEyeOk;
  const expectedCoverValid =
    !coveredEye ||
    (coveredEye === 'left' && rightEyeOk) ||
    (coveredEye === 'right' && leftEyeOk);
  const score = bothVisible ? 0.95 : expectedCoverValid ? 0.85 : 0.65;

  return {
    isValid: true,
    status: headPoseStatus === 'WARNING' || !bothVisible ? 'WARNING' : 'GOOD',
    score: headPoseStatus === 'WARNING' ? Math.min(score, 0.75) : score,
    reason: headPoseStatus === 'WARNING' ? 'HEAD_POSE_WARNING' : null,
    faceDetected: true,
    leftEyeDetected: leftEyeOk,
    rightEyeDetected: rightEyeOk,
    leftIrisDetected,
    rightIrisDetected,
    irisValid: leftEyeOk || rightEyeOk,
    headPoseValid,
    headPoseStatus,
    headRollDeg,
    headYawDeg,
    eyeVisibility,
  };
}

/**
 * Extracts normalized eye geometric features from face mesh landmarks
 * @param {Array<{x:number, y:number, z?:number}>} landmarks
 * @param {number} timestamp
 * @param {Object} [options]
 * @param {boolean} [options.applySmoothing=true]
 * @returns {Object|null}
 */
export function extractEyeFeatures(landmarks, timestamp = performance.now(), options = {}) {
  let lm = landmarks;
  if (!lm) {
    return null;
  }

  // Optional temporal smoothing using One Euro Filter
  const applySmoothing = options.applySmoothing ?? false;
  if (applySmoothing) {
    const keyIndices = [
      LANDMARKS.LEFT_IRIS_CENTER,
      LANDMARKS.RIGHT_IRIS_CENTER,
      LANDMARKS.LEFT_INNER_CORNER,
      LANDMARKS.LEFT_OUTER_CORNER,
      LANDMARKS.RIGHT_INNER_CORNER,
      LANDMARKS.RIGHT_OUTER_CORNER,
      LANDMARKS.LEFT_TOP_LID,
      LANDMARKS.LEFT_BOTTOM_LID,
      LANDMARKS.RIGHT_TOP_LID,
      LANDMARKS.RIGHT_BOTTOM_LID,
    ];
    lm = sharedLandmarkFilter.filterLandmarks(lm, timestamp / 1000.0, keyIndices);
  }

  const leftIris = lm[LANDMARKS.LEFT_IRIS_CENTER] || null;
  const rightIris = lm[LANDMARKS.RIGHT_IRIS_CENTER] || null;

  const leftInner = lm[LANDMARKS.LEFT_INNER_CORNER] || null;
  const leftOuter = lm[LANDMARKS.LEFT_OUTER_CORNER] || null;
  const rightInner = lm[LANDMARKS.RIGHT_INNER_CORNER] || null;
  const rightOuter = lm[LANDMARKS.RIGHT_OUTER_CORNER] || null;

  const leftTop = lm[LANDMARKS.LEFT_TOP_LID] || (leftIris ? { x: leftIris.x, y: leftIris.y - 0.02 } : null);
  const leftBottom = lm[LANDMARKS.LEFT_BOTTOM_LID] || (leftIris ? { x: leftIris.x, y: leftIris.y + 0.02 } : null);
  const rightTop = lm[LANDMARKS.RIGHT_TOP_LID] || (rightIris ? { x: rightIris.x, y: rightIris.y - 0.02 } : null);
  const rightBottom = lm[LANDMARKS.RIGHT_BOTTOM_LID] || (rightIris ? { x: rightIris.x, y: rightIris.y + 0.02 } : null);

  // Calculate eye widths safely
  const leftEyeWidth = (leftInner && leftOuter)
    ? Math.max(0.001, Math.hypot(leftOuter.x - leftInner.x, leftOuter.y - leftInner.y))
    : null;
  const rightEyeWidth = (rightInner && rightOuter)
    ? Math.max(0.001, Math.hypot(rightOuter.x - rightInner.x, rightOuter.y - rightInner.y))
    : null;

  // Vector-projected horizontal gaze ratios (roll-invariant)
  let leftHorizontalRatio = 0.5;
  if (leftIris && leftInner && leftOuter) {
    leftHorizontalRatio = projectPointOntoSegment(leftIris, leftInner, leftOuter);
  }

  let rightHorizontalRatio = 0.5;
  if (rightIris && rightInner && rightOuter) {
    rightHorizontalRatio = projectPointOntoSegment(rightIris, rightInner, rightOuter);
  }

  // Vector-projected vertical gaze ratios
  let leftVerticalRatio = 0.5;
  if (leftIris && leftTop && leftBottom) {
    leftVerticalRatio = projectPointOntoSegment(leftIris, leftTop, leftBottom);
  }

  let rightVerticalRatio = 0.5;
  if (rightIris && rightTop && rightBottom) {
    rightVerticalRatio = projectPointOntoSegment(rightIris, rightTop, rightBottom);
  }

  // Interocular distance (distance between inner canthi)
  const interocularDistance = (leftInner && rightInner)
    ? Math.hypot(leftInner.x - rightInner.x, leftInner.y - rightInner.y)
    : 0.1;
  const irisDistance = (leftIris && rightIris)
    ? Math.hypot(leftIris.x - rightIris.x, leftIris.y - rightIris.y)
    : interocularDistance;
  const irisDistanceRatio = irisDistance / Math.max(0.01, interocularDistance);

  // Estimated physical distance (cm) via D = 4095 / (irisDistance * 640)
  const irisDistancePx = irisDistance * 640.0;
  const estimatedDistanceCm = irisDistancePx > 1.0 ? Number((4095.0 / irisDistancePx).toFixed(1)) : 50.0;

  const clampedLeftH = Math.min(1.5, Math.max(-0.5, leftHorizontalRatio));
  const clampedRightH = Math.min(1.5, Math.max(-0.5, rightHorizontalRatio));
  const clampedLeftV = Math.min(1.5, Math.max(-0.5, leftVerticalRatio));
  const clampedRightV = Math.min(1.5, Math.max(-0.5, rightVerticalRatio));

  // Dual-vertical Eye Aspect Ratio (EAR) for realtime blink detection
  const l_v1_top = lm[385] || leftTop;
  const l_v1_bot = lm[380] || leftBottom;
  const l_v2_top = lm[386] || leftTop;
  const l_v2_bot = lm[374] || leftBottom;
  const r_v1_top = lm[158] || rightTop;
  const r_v1_bot = lm[153] || rightBottom;
  const r_v2_top = lm[159] || rightTop;
  const r_v2_bot = lm[145] || rightBottom;

  const leftEar = (leftInner && leftOuter && l_v1_top && l_v1_bot && l_v2_top && l_v2_bot)
    ? (Math.hypot(l_v1_top.x - l_v1_bot.x, l_v1_top.y - l_v1_bot.y) +
       Math.hypot(l_v2_top.x - l_v2_bot.x, l_v2_top.y - l_v2_bot.y)) /
      (2 * Math.max(0.001, Math.hypot(leftOuter.x - leftInner.x, leftOuter.y - leftInner.y)))
    : 0.30;

  const rightEar = (rightInner && rightOuter && r_v1_top && r_v1_bot && r_v2_top && r_v2_bot)
    ? (Math.hypot(r_v1_top.x - r_v1_bot.x, r_v1_top.y - r_v1_bot.y) +
       Math.hypot(r_v2_top.x - r_v2_bot.x, r_v2_top.y - r_v2_bot.y)) /
      (2 * Math.max(0.001, Math.hypot(rightOuter.x - rightInner.x, rightOuter.y - rightInner.y)))
    : 0.30;

  const isBlinkLeft = leftEar < BLINK_CONFIG.EAR_THRESHOLD;
  const isBlinkRight = rightEar < BLINK_CONFIG.EAR_THRESHOLD;
  const isBlinking = isBlinkLeft || isBlinkRight;

  // Temporal blink blanking window with cover eye edge case
  if (options.resetBlinkBuffer) {
    sharedBlinkBuffer.reset();
  }
  const blinkStatus = sharedBlinkBuffer.update(
    timestamp,
    leftEar,
    rightEar,
    options.coveredEye || null
  );

  const validLeftX = leftIris ? leftIris.x : null;
  const validLeftY = leftIris ? leftIris.y : null;
  const validRightX = rightIris ? rightIris.x : null;
  const validRightY = rightIris ? rightIris.y : null;

  return {
    timestamp,
    leftIrisX: validLeftX,
    leftIrisY: validLeftY,
    rightIrisX: validRightX,
    rightIrisY: validRightY,
    leftEyeWidth,
    rightEyeWidth,
    leftEar: Number(leftEar.toFixed(3)),
    rightEar: Number(rightEar.toFixed(3)),
    isBlinkLeft,
    isBlinkRight,
    isBlinking,
    isBlinkMaskedLeft: blinkStatus.isBlinkMaskedLeft,
    isBlinkMaskedRight: blinkStatus.isBlinkMaskedRight,
    isBlinkMasked: blinkStatus.isBlinkMasked,
    leftHorizontalRatio: clampedLeftH,
    rightHorizontalRatio: clampedRightH,
    leftVerticalRatio: clampedLeftV,
    rightVerticalRatio: clampedRightV,
    interocularDistance,
    horizontalRatioDiff: Math.abs(clampedLeftH - clampedRightH),
    verticalRatioDiff: Math.abs(clampedLeftV - clampedRightV),
    irisDistanceRatio,
    estimatedDistanceCm,
    raw: {
      leftIrisX: validLeftX,
      leftIrisY: validLeftY,
      rightIrisX: validRightX,
      rightIrisY: validRightY,
      landmarks: lm,
    },
  };
}

/**
 * Calculates refixation saccade displacement and velocity from recorded uncover frames
 * @param {Array<{t: number, x: number, y: number, normalizedX: number, normalizedY: number}>} frames
 * @param {number} windowMs - analysis window (300 - 500ms)
 * @param {number|null} referenceEyeWidth - eye width for normalization
 * @returns {{
 *   displacement: number|null,
 *   displaced: boolean,
 *   peakDisplacement: number|null,
 *   peakVelocity: number|null,
 *   meanVelocity: number|null
 * }}
 */
export function calculateRefixationDisplacement(
  frames,
  windowMs = SCREENING_CONFIG.UNCOVER_WINDOW_MS,
  referenceEyeWidth = null
) {
  if (!frames || frames.length < 2 || !referenceEyeWidth || referenceEyeWidth <= 0 || !Number.isFinite(referenceEyeWidth)) {
    return { displacement: null, displaced: false, peakDisplacement: null, peakVelocity: null, meanVelocity: null };
  }

  const windowFrames = frames.filter(
    (f) => f.t <= windowMs && !f.isBlink && !f.isBlinking && !f.isBlinkMasked && !f.features?.isBlinkMasked
  );
  if (windowFrames.length < 2) {
    return { displacement: 0, displaced: false, peakDisplacement: 0, peakVelocity: 0, meanVelocity: 0 };
  }

  const first = windowFrames[0];
  const last = windowFrames[windowFrames.length - 1];

  // End-to-end net displacement in window
  const netDistance = Math.hypot(last.x - first.x, last.y - first.y);
  const normalizedNet = netDistance / Math.max(0.01, referenceEyeWidth);

  // Peak displacement & velocity during the window
  let peakDist = 0;
  let peakVel = 0;

  for (let i = 1; i < windowFrames.length; i++) {
    const prev = windowFrames[i - 1];
    const curr = windowFrames[i];

    // Distance from start
    const d = Math.hypot(curr.x - first.x, curr.y - first.y);
    if (d > peakDist) peakDist = d;

    // Instantaneous velocity (normalized units per second)
    const dt = Math.max(1, curr.t - prev.t) / 1000; // in seconds
    const stepDist = Math.hypot(curr.x - prev.x, curr.y - prev.y) / Math.max(0.01, referenceEyeWidth);
    const vel = stepDist / dt;
    if (vel > peakVel) peakVel = vel;
  }

  const normalizedPeak = peakDist / Math.max(0.01, referenceEyeWidth);
  const durationSec = Math.max(0.01, (last.t - first.t) / 1000);
  const meanVel = normalizedNet / durationSec;

  const displacement = normalizedNet;
  const displaced = displacement > SCREENING_CONFIG.DISPLACEMENT_THRESHOLD;

  return {
    displacement,
    displaced,
    peakDisplacement: normalizedPeak,
    peakVelocity: peakVel,
    meanVelocity: meanVel,
  };
}
