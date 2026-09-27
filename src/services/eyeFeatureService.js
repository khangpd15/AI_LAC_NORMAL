/**
 * Eye Feature Service - Feature extraction, landmark validation and saccade analysis
 */

import { LANDMARKS, SCREENING_CONFIG } from '../constants/screeningConfig';

/**
 * Validates tracking quality of landmarks
 * @param {Array<any>} multiFaceLandmarks
 * @returns {{
 *   isValid: boolean,
 *   reason: string | null,
 *   faceDetected: boolean,
 *   leftEyeDetected: boolean,
 *   rightEyeDetected: boolean,
 *   irisValid: boolean
 * }}
 */
export function validateEyeTrackingQuality(multiFaceLandmarks, requireBothEyes = false) {
  if (!multiFaceLandmarks || multiFaceLandmarks.length === 0) {
    return {
      isValid: false,
      reason: 'Không phát hiện khuôn mặt',
      faceDetected: false,
      leftEyeDetected: false,
      rightEyeDetected: false,
      irisValid: false,
    };
  }

  const lm = multiFaceLandmarks[0];
  if (!lm) {
    return {
      isValid: false,
      reason: 'Không nhận diện được khuôn mặt',
      faceDetected: false,
      leftEyeDetected: false,
      rightEyeDetected: false,
      irisValid: false,
    };
  }

  // Check left eye landmarks (362, 263, 468)
  const leftEyeOk = Boolean(
    lm[LANDMARKS.LEFT_INNER_CORNER] &&
    lm[LANDMARKS.LEFT_OUTER_CORNER] &&
    lm[LANDMARKS.LEFT_IRIS_CENTER] &&
    Number.isFinite(lm[LANDMARKS.LEFT_IRIS_CENTER].x) &&
    Number.isFinite(lm[LANDMARKS.LEFT_IRIS_CENTER].y)
  );

  // Check right eye landmarks (133, 33, 473)
  const rightEyeOk = Boolean(
    lm[LANDMARKS.RIGHT_INNER_CORNER] &&
    lm[LANDMARKS.RIGHT_OUTER_CORNER] &&
    lm[LANDMARKS.RIGHT_IRIS_CENTER] &&
    Number.isFinite(lm[LANDMARKS.RIGHT_IRIS_CENTER].x) &&
    Number.isFinite(lm[LANDMARKS.RIGHT_IRIS_CENTER].y)
  );

  const isOk = requireBothEyes ? (leftEyeOk && rightEyeOk) : (leftEyeOk || rightEyeOk);

  if (!isOk) {
    return {
      isValid: false,
      reason: 'Đang nhận diện mống mắt... Đưa khuôn mặt vào giữa khung hình.',
      faceDetected: true,
      leftEyeDetected: leftEyeOk,
      rightEyeDetected: rightEyeOk,
      irisValid: false,
    };
  }

  // Engineering head-motion gate for live Cover Test sampling.
  const leftEar = lm[LANDMARKS.LEFT_EAR_TRAGUS];
  const rightEar = lm[LANDMARKS.RIGHT_EAR_TRAGUS];
  const nose = lm[LANDMARKS.NOSE_TIP];
  let headPoseValid = true;
  let headRollDeg = null;
  let headYawDeg = null;
  if (leftEar && rightEar && nose) {
    headRollDeg = Math.atan2(rightEar.y - leftEar.y, rightEar.x - leftEar.x) * 180 / Math.PI;
    const earMidX = (leftEar.x + rightEar.x) / 2;
    headYawDeg = (nose.x - earMidX) * 100;
    headPoseValid = Math.abs(headRollDeg) <= 12 && Math.abs(headYawDeg) <= 15;
  }

  if (!headPoseValid) {
    return { isValid: false, reason: 'HEAD_MOTION', faceDetected: true, leftEyeDetected: leftEyeOk, rightEyeDetected: rightEyeOk, irisValid: leftEyeOk || rightEyeOk, headPoseValid, headRollDeg, headYawDeg };
  }

  return {
    isValid: true,
    reason: null,
    faceDetected: true,
    leftEyeDetected: leftEyeOk,
    rightEyeDetected: rightEyeOk,
    irisValid: leftEyeOk || rightEyeOk,
    headPoseValid,
    headRollDeg,
    headYawDeg,
  };
}

/**
 * Extracts normalized eye geometric features from face mesh landmarks
 * @param {Array<{x:number, y:number, z?:number}>} landmarks
 * @param {number} timestamp
 * @returns {{
 *   timestamp: number,
 *   leftIrisX: number,
 *   leftIrisY: number,
 *   rightIrisX: number,
 *   rightIrisY: number,
 *   leftEyeWidth: number,
 *   rightEyeWidth: number,
 *   leftHorizontalRatio: number,
 *   rightHorizontalRatio: number,
 *   leftVerticalRatio: number,
 *   rightVerticalRatio: number,
 *   interocularDistance: number
 * }}
 */
export function extractEyeFeatures(landmarks, timestamp = performance.now()) {
  const lm = landmarks;
  if (!lm) {
    return null;
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
    : 0.05;
  const rightEyeWidth = (rightInner && rightOuter)
    ? Math.max(0.001, Math.hypot(rightOuter.x - rightInner.x, rightOuter.y - rightInner.y))
    : 0.05;

  // Horizontal ratios safely
  let leftHorizontalRatio = 0.5;
  if (leftIris && leftInner && leftOuter) {
    const leftDeltaX = leftOuter.x - leftInner.x;
    leftHorizontalRatio = Math.abs(leftDeltaX) > 1e-5 ? (leftIris.x - leftInner.x) / leftDeltaX : 0.5;
  }

  let rightHorizontalRatio = 0.5;
  if (rightIris && rightInner && rightOuter) {
    const rightDeltaX = rightOuter.x - rightInner.x;
    rightHorizontalRatio = Math.abs(rightDeltaX) > 1e-5 ? (rightIris.x - rightInner.x) / rightDeltaX : 0.5;
  }

  // Vertical ratios safely
  let leftVerticalRatio = 0.5;
  if (leftIris && leftTop && leftBottom) {
    const leftAperture = Math.max(0.001, Math.abs(leftBottom.y - leftTop.y));
    leftVerticalRatio = (leftIris.y - leftTop.y) / leftAperture;
  }

  let rightVerticalRatio = 0.5;
  if (rightIris && rightTop && rightBottom) {
    const rightAperture = Math.max(0.001, Math.abs(rightBottom.y - rightTop.y));
    rightVerticalRatio = (rightIris.y - rightTop.y) / rightAperture;
  }

  // Interocular distance (distance between inner canthi)
  const interocularDistance = (leftInner && rightInner)
    ? Math.hypot(leftInner.x - rightInner.x, leftInner.y - rightInner.y)
    : 0.1;
  const irisDistance = (leftIris && rightIris)
    ? Math.hypot(leftIris.x - rightIris.x, leftIris.y - rightIris.y)
    : interocularDistance;
  const irisDistanceRatio = irisDistance / Math.max(0.01, interocularDistance);

  const clampedLeftH = Math.min(1.5, Math.max(-0.5, leftHorizontalRatio));
  const clampedRightH = Math.min(1.5, Math.max(-0.5, rightHorizontalRatio));
  const clampedLeftV = Math.min(1.5, Math.max(-0.5, leftVerticalRatio));
  const clampedRightV = Math.min(1.5, Math.max(-0.5, rightVerticalRatio));

  return {
    timestamp,
    leftIrisX: leftIris ? leftIris.x : 0.5,
    leftIrisY: leftIris ? leftIris.y : 0.5,
    rightIrisX: rightIris ? rightIris.x : 0.5,
    rightIrisY: rightIris ? rightIris.y : 0.5,
    leftEyeWidth,
    rightEyeWidth,
    leftHorizontalRatio: clampedLeftH,
    rightHorizontalRatio: clampedRightH,
    leftVerticalRatio: clampedLeftV,
    rightVerticalRatio: clampedRightV,
    interocularDistance,
    horizontalRatioDiff: Math.abs(clampedLeftH - clampedRightH),
    verticalRatioDiff: Math.abs(clampedLeftV - clampedRightV),
    irisDistanceRatio,
    raw: {
      leftIrisX: leftIris ? leftIris.x : 0.5,
      leftIrisY: leftIris ? leftIris.y : 0.5,
      rightIrisX: rightIris ? rightIris.x : 0.5,
      rightIrisY: rightIris ? rightIris.y : 0.5,
    },
  };
}

/**
 * Calculates refixation saccade displacement and velocity from recorded uncover frames
 * @param {Array<{t: number, x: number, y: number, normalizedX: number, normalizedY: number}>} frames
 * @param {number} windowMs - analysis window (300 - 500ms)
 * @param {number} referenceEyeWidth - eye width for normalization
 * @returns {{
 *   displacement: number,
 *   displaced: boolean,
 *   peakDisplacement: number,
 *   peakVelocity: number,
 *   meanVelocity: number
 * }}
 */
export function calculateRefixationDisplacement(
  frames,
  windowMs = SCREENING_CONFIG.UNCOVER_WINDOW_MS,
  referenceEyeWidth = 0.05
) {
  if (!frames || frames.length < 2) {
    return { displacement: 0, displaced: false, peakDisplacement: 0, peakVelocity: 0, meanVelocity: 0 };
  }

  const windowFrames = frames.filter((f) => f.t <= windowMs);
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
