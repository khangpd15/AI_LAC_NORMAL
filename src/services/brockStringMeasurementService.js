/**
 * BROCK STRING MEASUREMENT SERVICE
 * Pure mathematical & biometric measurement service for Brock String protocol.
 * Tracks binocular eye movements and vergence-related indicators across configurable target beads.
 * 
 * STRICT CLINICAL SAFETY RULE:
 * This service measures physical optical axis convergence indicators.
 * It DOES NOT provide a clinical diagnosis of strabismus, phoria, or convergence insufficiency.
 * All calibration fields strictly return NOT_CALIBRATED without validated clinical paired data.
 */

import {
  LANDMARKS,
  BROCK_STRING_TARGETS,
  QUALITY_STATUS,
  QUALITY_REASONS,
  BINOCULAR_VERDICT,
  CALIBRATION_STATUS,
} from '../constants/screeningConfig.js';
import { median, iqr } from './coverTestMeasurementService.js';

/**
 * Validates tracking quality of landmarks for Brock String binocular test
 * Checks face detection, both eyes, both irises, plausible eye width, and head pose tilt.
 * 
 * @param {Array<any>} multiFaceLandmarks
 * @param {Object} [options]
 * @returns {{
 *   isValid: boolean,
 *   status: string,
 *   reason: string | null,
 *   headPose: { yaw: number, pitch: number, roll: number, isAcceptable: boolean },
 *   details: Object
 * }}
 */
export function validateBrockStringQuality(multiFaceLandmarks, options = {}) {
  const maxHeadRoll = options.maxHeadRoll || 15; // degrees
  const maxHeadPitch = options.maxHeadPitch || 18;
  const maxHeadYaw = options.maxHeadYaw || 18;

  if (!multiFaceLandmarks || multiFaceLandmarks.length === 0) {
    return {
      isValid: false,
      status: QUALITY_STATUS.INCONCLUSIVE,
      reason: QUALITY_REASONS.NO_FACE,
      displayMessage: 'Không phát hiện khuôn mặt trong khung hình.',
      headPose: { yaw: 0, pitch: 0, roll: 0, isAcceptable: false },
      details: { faceDetected: false, leftEye: false, rightEye: false, iris: false },
    };
  }

  const lm = multiFaceLandmarks[0];
  if (!lm) {
    return {
      isValid: false,
      status: QUALITY_STATUS.INCONCLUSIVE,
      reason: QUALITY_REASONS.NO_FACE,
      displayMessage: 'Dữ liệu khuôn mặt bị gián đoạn.',
      headPose: { yaw: 0, pitch: 0, roll: 0, isAcceptable: false },
      details: { faceDetected: false, leftEye: false, rightEye: false, iris: false },
    };
  }

  // Check left eye landmarks
  const leftCornerOk = lm[LANDMARKS.LEFT_INNER_CORNER] && lm[LANDMARKS.LEFT_OUTER_CORNER];
  const leftIrisOk =
    lm[LANDMARKS.LEFT_IRIS_CENTER] &&
    Number.isFinite(lm[LANDMARKS.LEFT_IRIS_CENTER].x) &&
    Number.isFinite(lm[LANDMARKS.LEFT_IRIS_CENTER].y);

  // Check right eye landmarks
  const rightCornerOk = lm[LANDMARKS.RIGHT_INNER_CORNER] && lm[LANDMARKS.RIGHT_OUTER_CORNER];
  const rightIrisOk =
    lm[LANDMARKS.RIGHT_IRIS_CENTER] &&
    Number.isFinite(lm[LANDMARKS.RIGHT_IRIS_CENTER].x) &&
    Number.isFinite(lm[LANDMARKS.RIGHT_IRIS_CENTER].y);

  if (!leftCornerOk && !rightCornerOk) {
    return {
      isValid: false,
      status: QUALITY_STATUS.INCONCLUSIVE,
      reason: QUALITY_REASONS.NO_FACE,
      displayMessage: 'Không phát hiện hai mắt.',
      headPose: { yaw: 0, pitch: 0, roll: 0, isAcceptable: false },
      details: { faceDetected: true, leftEye: false, rightEye: false, iris: false },
    };
  }

  if (!leftCornerOk || !rightCornerOk) {
    return {
      isValid: false,
      status: QUALITY_STATUS.INCONCLUSIVE,
      reason: QUALITY_REASONS.ONE_EYE_MISSING,
      displayMessage: 'Chỉ nhận diện được một bên mắt. Cần thấy cả hai mắt.',
      headPose: { yaw: 0, pitch: 0, roll: 0, isAcceptable: false },
      details: { faceDetected: true, leftEye: !!leftCornerOk, rightEye: !!rightCornerOk, iris: false },
    };
  }

  if (!leftIrisOk || !rightIrisOk) {
    return {
      isValid: false,
      status: QUALITY_STATUS.INCONCLUSIVE,
      reason: QUALITY_REASONS.IRIS_MISSING,
      displayMessage: 'Đang dò tìm mống mắt (iris tracking). Giữ mắt mở rõ.',
      headPose: { yaw: 0, pitch: 0, roll: 0, isAcceptable: false },
      details: { faceDetected: true, leftEye: true, rightEye: true, iris: false },
    };
  }

  // Eye width plausibility
  const leftW = Math.hypot(
    lm[LANDMARKS.LEFT_OUTER_CORNER].x - lm[LANDMARKS.LEFT_INNER_CORNER].x,
    lm[LANDMARKS.LEFT_OUTER_CORNER].y - lm[LANDMARKS.LEFT_INNER_CORNER].y
  );
  const rightW = Math.hypot(
    lm[LANDMARKS.RIGHT_OUTER_CORNER].x - lm[LANDMARKS.RIGHT_INNER_CORNER].x,
    lm[LANDMARKS.RIGHT_OUTER_CORNER].y - lm[LANDMARKS.RIGHT_INNER_CORNER].y
  );

  if (leftW < 0.015 || leftW > 0.4 || rightW < 0.015 || rightW > 0.4) {
    return {
      isValid: false,
      status: QUALITY_STATUS.INCONCLUSIVE,
      reason: QUALITY_REASONS.INVALID_EYE_WIDTH,
      displayMessage: 'Khoảng cách camera không phù hợp. Hãy ngồi cách camera 45-70cm.',
      headPose: { yaw: 0, pitch: 0, roll: 0, isAcceptable: false },
      details: { faceDetected: true, leftEye: true, rightEye: true, iris: true, leftW, rightW },
    };
  }

  // Head pose estimation using 3D landmarks (Nose, Chin, Forehead, Ear tragus)
  const nose = lm[LANDMARKS.NOSE_TIP] || lm[1];
  const chin = lm[LANDMARKS.CHIN] || lm[152];
  const forehead = lm[LANDMARKS.FOREHEAD] || lm[10];
  const leftEar = lm[LANDMARKS.LEFT_EAR_TRAGUS] || lm[234];
  const rightEar = lm[LANDMARKS.RIGHT_EAR_TRAGUS] || lm[454];

  let rollDeg = 0;
  let pitchDeg = 0;
  let yawDeg = 0;

  if (leftEar && rightEar) {
    const dX = rightEar.x - leftEar.x;
    const dY = rightEar.y - leftEar.y;
    rollDeg = (Math.atan2(dY, dX) * 180) / Math.PI;
  }

  if (forehead && chin && nose) {
    const midY = (forehead.y + chin.y) / 2;
    pitchDeg = (nose.y - midY) * 120;
  }

  if (leftEar && rightEar && nose) {
    const earMidX = (leftEar.x + rightEar.x) / 2;
    yawDeg = (nose.x - earMidX) * 100;
  }

  const isHeadPoseAcceptable =
    Math.abs(rollDeg) <= maxHeadRoll &&
    Math.abs(pitchDeg) <= maxHeadPitch &&
    Math.abs(yawDeg) <= maxHeadYaw;

  if (!isHeadPoseAcceptable) {
    return {
      isValid: false,
      status: QUALITY_STATUS.DEGRADED,
      reason: QUALITY_REASONS.HEAD_POSE_INVALID,
      displayMessage: 'Đầu bị nghiêng hoặc xoay quá nhiều. Hãy nhìn thẳng vào camera.',
      headPose: {
        yaw: Number(yawDeg.toFixed(1)),
        pitch: Number(pitchDeg.toFixed(1)),
        roll: Number(rollDeg.toFixed(1)),
        isAcceptable: false,
      },
      details: { faceDetected: true, leftEye: true, rightEye: true, iris: true },
    };
  }

  return {
    isValid: true,
    status: QUALITY_STATUS.VALID,
    reason: null,
    displayMessage: 'Độ tracking ổn định.',
    headPose: {
      yaw: Number(yawDeg.toFixed(1)),
      pitch: Number(pitchDeg.toFixed(1)),
      roll: Number(rollDeg.toFixed(1)),
      isAcceptable: true,
    },
    details: { faceDetected: true, leftEye: true, rightEye: true, iris: true, leftW, rightW },
  };
}

/**
 * Extracts normalized binocular & per-eye vergence features from face mesh landmarks
 * 
 * @param {Array<any>} landmarks
 * @param {string} targetId - 'NEAR' | 'MID' | 'FAR'
 * @param {number} targetDistanceCm - configured distance in cm (e.g. 20, 50, 100)
 * @param {number} [timestamp]
 * @returns {Object} Structured Brock String frame measurement
 */
export function extractBrockStringFrame(
  landmarks,
  targetId = 'MID',
  targetDistanceCm = 50,
  timestamp = performance.now()
) {
  const lm = landmarks;
  const leftIris = lm[LANDMARKS.LEFT_IRIS_CENTER];
  const rightIris = lm[LANDMARKS.RIGHT_IRIS_CENTER];
  const leftInner = lm[LANDMARKS.LEFT_INNER_CORNER];
  const leftOuter = lm[LANDMARKS.LEFT_OUTER_CORNER];
  const rightInner = lm[LANDMARKS.RIGHT_INNER_CORNER];
  const rightOuter = lm[LANDMARKS.RIGHT_OUTER_CORNER];

  const leftEyeWidth = Math.max(0.001, Math.hypot(leftOuter.x - leftInner.x, leftOuter.y - leftInner.y));
  const rightEyeWidth = Math.max(0.001, Math.hypot(rightOuter.x - rightInner.x, rightOuter.y - rightInner.y));

  // Horizontal ratio: iris position relative to inner canthus divided by horizontal span
  const leftDeltaX = leftOuter.x - leftInner.x;
  const leftHorizontalRatio = Math.abs(leftDeltaX) > 1e-5 ? (leftIris.x - leftInner.x) / leftDeltaX : 0.5;

  const rightDeltaX = rightOuter.x - rightInner.x;
  const rightHorizontalRatio = Math.abs(rightDeltaX) > 1e-5 ? (rightIris.x - rightInner.x) / rightDeltaX : 0.5;

  // Interocular distance (between inner canthi)
  const interocularDistance = Math.max(0.01, Math.hypot(leftInner.x - rightInner.x, leftInner.y - rightInner.y));

  // Inter-iris distance (raw distance between 468 and 473)
  const interIrisDistance = Math.hypot(leftIris.x - rightIris.x, leftIris.y - rightIris.y);

  // Vergence Ratio: Normalized distance between irises relative to interocular baseline
  // During physiological convergence (looking at NEAR target), the two irises move nasally,
  // reducing the inter-iris distance relative to the anatomical inner canthi distance.
  const vergenceRatio = interIrisDistance / interocularDistance;

  // Gaze Convergence Index: average nasal displacement ratio of both irises
  // Left eye: Nasal movement corresponds to lower ratio (toward 362).
  // Right eye: Nasal movement corresponds to lower ratio (toward 133).
  const gazeConvergence = 1.0 - (Math.min(1, Math.max(0, leftHorizontalRatio)) + Math.min(1, Math.max(0, rightHorizontalRatio))) / 2;

  const leftEyeFeature = {
    irisX: leftIris.x,
    irisY: leftIris.y,
    eyeWidth: leftEyeWidth,
    horizontalRatio: Number(leftHorizontalRatio.toFixed(4)),
  };

  const rightEyeFeature = {
    irisX: rightIris.x,
    irisY: rightIris.y,
    eyeWidth: rightEyeWidth,
    horizontalRatio: Number(rightHorizontalRatio.toFixed(4)),
  };

  const binocularFeature = {
    interIrisDistance: Number(interIrisDistance.toFixed(4)),
    interocularDistance: Number(interocularDistance.toFixed(4)),
    vergenceRatio: Number(vergenceRatio.toFixed(4)),
    gazeConvergence: Number(gazeConvergence.toFixed(4)),
    targetId,
    targetDistanceCm,
  };

  return {
    timestamp,
    targetId,
    targetDistanceCm,
    leftEyeFeature,
    rightEyeFeature,
    binocularFeature,
  };
}

/**
 * Evaluates steady fixation on a single Brock String target bead
 * 
 * @param {Array<Object>} targetFrames - Collection of frames recorded while user fixated on this target
 * @param {Object} targetConfig - { id, label, distanceCm }
 * @returns {Object} Target fixation measurement
 */
export function analyzeTargetFixation(targetFrames, targetConfig) {
  const minSamples = 20;

  if (!targetFrames || targetFrames.length < minSamples) {
    return {
      targetId: targetConfig.id,
      targetLabel: targetConfig.label,
      targetDistanceCm: targetConfig.distanceCm,
      sampleCount: targetFrames ? targetFrames.length : 0,
      dataQuality: {
        isValid: false,
        status: QUALITY_STATUS.INCONCLUSIVE,
        reason: QUALITY_REASONS.INSUFFICIENT_SAMPLES,
        message: `Số khung hình thu thập không đủ (${targetFrames ? targetFrames.length : 0}/${minSamples}).`,
      },
      medianVergenceRatio: null,
      medianInterIrisDist: null,
      medianLeftRatio: null,
      medianRightRatio: null,
      fixationStabilityIqr: null,
      transitionLatencyMs: null,
      isStable: false,
    };
  }

  const vergenceRatios = targetFrames.map((f) => f.binocularFeature.vergenceRatio);
  const interIrisDists = targetFrames.map((f) => f.binocularFeature.interIrisDistance);
  const leftRatios = targetFrames.map((f) => f.leftEyeFeature.horizontalRatio);
  const rightRatios = targetFrames.map((f) => f.rightEyeFeature.horizontalRatio);

  const medVergence = median(vergenceRatios);
  const medInterIris = median(interIrisDists);
  const medLeft = median(leftRatios);
  const medRight = median(rightRatios);

  // Fixation stability: dispersion (IQR) of the vergence ratio during fixation
  const stabilityIqr = iqr(vergenceRatios);
  const isStable = stabilityIqr <= 0.06;

  // Transition latency: time from first frame until vergence settles within 1 IQR of the median
  let transitionLatencyMs = null;
  const firstT = targetFrames[0].timestamp;
  for (let i = 0; i < targetFrames.length; i++) {
    const val = targetFrames[i].binocularFeature.vergenceRatio;
    if (Math.abs(val - medVergence) <= Math.max(0.02, stabilityIqr)) {
      transitionLatencyMs = Math.max(1, Math.round(targetFrames[i].timestamp - firstT));
      break;
    }
  }

  const dataQuality = {
    isValid: isStable,
    status: isStable ? QUALITY_STATUS.VALID : QUALITY_STATUS.DEGRADED,
    reason: isStable ? null : QUALITY_REASONS.EXCESSIVE_JITTER,
    message: isStable ? 'Cố định thị giác ổn định.' : 'Giao thoa hoặc rung lắc nhẹ khi cố định thị giác.',
  };

  return {
    target: targetConfig.id,
    targetId: targetConfig.id,
    targetLabel: targetConfig.label,
    targetDistanceCm: targetConfig.distanceCm,
    sampleCount: targetFrames.length,
    ratio: Number(medVergence.toFixed(4)),
    medianVergenceRatio: Number(medVergence.toFixed(4)),
    iqr: Number(stabilityIqr.toFixed(4)),
    fixationStabilityIqr: Number(stabilityIqr.toFixed(4)),
    valid: isStable,
    quality: dataQuality,
    dataQuality,
    medianInterIrisDist: Number(medInterIris.toFixed(4)),
    medianLeftRatio: Number(medLeft.toFixed(4)),
    medianRightRatio: Number(medRight.toFixed(4)),
    transitionLatencyMs,
    isStable,
  };
}

/**
 * Evaluates the full Brock String session across all evaluated targets (NEAR, MID, FAR)
 * 
 * @param {Object} targetResults - Map of targetId -> analyzeTargetFixation output
 * @returns {Object} Comprehensive Brock String Protocol Evaluation
 */
export function evaluateBrockStringSession(targetResults = {}) {
  const targets = Object.values(targetResults);

  if (targets.length === 0) {
    return {
      protocol: 'BROCK_STRING',
      verdict: BINOCULAR_VERDICT.INCONCLUSIVE,
      verdictLabel: 'Chưa có dữ liệu kiểm tra cho nghiệm pháp Brock String.',
      dataQuality: {
        isValid: false,
        status: QUALITY_STATUS.INCONCLUSIVE,
        reason: QUALITY_REASONS.TARGET_NOT_DETECTED,
      },
      targets: {},
      convergenceTrend: null,
      calibration: {
        status: CALIBRATION_STATUS.NOT_CALIBRATED,
        value: null,
        convergenceAngleDegrees: null,
        clinicalNote: 'Hệ thống chưa có bộ dữ liệu hiệu chuẩn lâm sàng cho góc quy tụ.',
      },
    };
  }

  const validTargets = targets.filter((t) => t && t.dataQuality && t.dataQuality.isValid);

  if (validTargets.length < 2) {
    return {
      protocol: 'BROCK_STRING',
      verdict: BINOCULAR_VERDICT.INCONCLUSIVE,
      verdictLabel: 'Không đủ số lượng hạt kiểm tra đạt chuẩn (cần tối thiểu 2 hạt hợp lệ).',
      dataQuality: {
        isValid: false,
        status: QUALITY_STATUS.INCONCLUSIVE,
        reason: QUALITY_REASONS.INSUFFICIENT_SAMPLES,
      },
      targets: targetResults,
      convergenceTrend: null,
      calibration: {
        status: CALIBRATION_STATUS.NOT_CALIBRATED,
        value: null,
        convergenceAngleDegrees: null,
        clinicalNote: 'Chưa đủ mẫu đo lường để tính toán xu hướng tương quan.',
      },
    };
  }

  // Calculate physical vergence trend:
  // As target distance increases (NEAR 20cm -> MID 50cm -> FAR 100cm),
  // does the measured vergenceRatio increase (diverge towards parallel distance axes)?
  const nearTarget = targetResults[BROCK_STRING_TARGETS.NEAR.id];
  const farTarget = targetResults[BROCK_STRING_TARGETS.FAR.id];
  const midTarget = targetResults[BROCK_STRING_TARGETS.MID.id];

  let vergenceSlope = null;
  let vergencePattern = 'OBSERVED_VARIABLE';

  if (nearTarget?.medianVergenceRatio && farTarget?.medianVergenceRatio) {
    const deltaVergence = farTarget.medianVergenceRatio - nearTarget.medianVergenceRatio;
    const deltaDistance = farTarget.targetDistanceCm - nearTarget.targetDistanceCm;
    vergenceSlope = Number((deltaVergence / deltaDistance).toFixed(6));

    if (deltaVergence > 0.015) {
      vergencePattern = 'CONVERGENCE_INCREASES_ON_NEAR';
    } else if (deltaVergence < -0.015) {
      vergencePattern = 'PARADOXICAL_OR_DIVERGENT';
    } else {
      vergencePattern = 'FLAT_VERGENCE_GRADIENT';
    }
  }

  return {
    protocol: 'BROCK_STRING',
    verdict: BINOCULAR_VERDICT.MEASURABLE,
    verdictLabel: 'Đã hoàn thành ghi nhận chỉ số chuyển động hai mắt trên các hạt kiểm tra.',
    dataQuality: {
      isValid: true,
      status: QUALITY_STATUS.VALID,
      validTargetsCount: validTargets.length,
      totalTargetsCount: targets.length,
    },
    targets: targetResults,
    convergenceTrend: {
      vergenceSlope,
      pattern: vergencePattern,
      nearVergenceRatio: nearTarget?.medianVergenceRatio ?? null,
      midVergenceRatio: midTarget?.medianVergenceRatio ?? null,
      farVergenceRatio: farTarget?.medianVergenceRatio ?? null,
    },
    calibration: {
      status: CALIBRATION_STATUS.NOT_CALIBRATED,
      value: null,
      convergenceAngleDegrees: null,
      clinicalNote:
        'Hệ thống chưa hiệu chuẩn thực nghiệm với máy đo góc quy tụ synoptophore hoặc lăng kính. Kết quả phản ánh biến thiên hình học mống mắt quang học trên webcam.',
    },
  };
}
