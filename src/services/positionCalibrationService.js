/**
 * POSITION CALIBRATION SERVICE
 * Estimates user-to-webcam distance relative to facial geometry benchmarks.
 * Supports independent target ranges for Cover Test (33–40 cm) and Brock String (20–25 cm).
 * 
 * STRICT CLINICAL SAFETY RULE:
 * Laptop webcams lack hardware depth sensors. All distance values are RELATIVE OPTICAL ESTIMATES
 * (estimatedDistanceCm / estimatedCameraToFaceDistanceCm) designed strictly to guide user posture.
 * They MUST NOT be presented as physical metric ground truth or used for clinical diagnosis.
 */

import {
  POSITION_CONFIG,
  POSITION_STATUS,
  POSITION_QUALITY_CONFIG,
  DATA_QUALITY_REASONS,
  DATA_QUALITY_STATUS,
} from '../constants/binocularScreeningConfig.js';
import { LANDMARKS } from '../constants/screeningConfig.js';

/**
 * Calculates Euclidean distance between two 2D points
 */
function dist2D(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the bounding box around the face from landmarks
 * @param {Array<{x: number, y: number}>} landmarks
 * @returns {{ xMin: number, yMin: number, width: number, height: number } | null}
 */
export function calculateBoundingBox(landmarks) {
  if (!landmarks || !Array.isArray(landmarks) || landmarks.length < 10) {
    return null;
  }

  let minX = 1.0;
  let maxX = 0.0;
  let minY = 1.0;
  let maxY = 0.0;

  // Use key outline landmarks (chin 152, forehead 10, zygions 234 and 454) or full mesh
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    if (!pt || isNaN(pt.x) || isNaN(pt.y)) continue;
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  if (minX >= maxX || minY >= maxY) return null;

  // Add small padding for pleasant visual display
  const padX = (maxX - minX) * 0.05;
  const padY = (maxY - minY) * 0.05;

  const xMin = Math.max(0, minX - padX);
  const yMin = Math.max(0, minY - padY);
  const width = Math.min(1 - xMin, (maxX - minX) + padX * 2);
  const height = Math.min(1 - yMin, (maxY - minY) + padY * 2);

  return {
    xMin: Number(xMin.toFixed(3)),
    yMin: Number(yMin.toFixed(3)),
    width: Number(width.toFixed(3)),
    height: Number(height.toFixed(3)),
  };
}

/**
 * Estimates 3D head pose angles (roll, yaw, pitch) in degrees from 2D landmarks.
 * Thresholds are engineering parameters for signal reliability, NOT clinical criteria.
 * 
 * @param {Array<{x: number, y: number, z?: number}>} landmarks
 * @returns {{ rollDeg: number, yawDeg: number, pitchDeg: number, isValid: boolean }}
 */
export function estimateHeadPose(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { rollDeg: 0, yawDeg: 0, pitchDeg: 0, isValid: false };
  }

  const leftCanthus = landmarks[LANDMARKS.LEFT_INNER_CANTHUS];
  const rightCanthus = landmarks[LANDMARKS.RIGHT_INNER_CANTHUS];
  const noseTip = landmarks[LANDMARKS.NOSE_TIP] || landmarks[1];
  const glabella = landmarks[LANDMARKS.GLABELLA] || landmarks[168];

  if (!leftCanthus || !rightCanthus || !noseTip) {
    return { rollDeg: 0, yawDeg: 0, pitchDeg: 0, isValid: false };
  }

  // 1. Roll (Head tilt left/right)
  const dy = leftCanthus.y - rightCanthus.y;
  const dx = leftCanthus.x - rightCanthus.x;
  const rollDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  // 2. Yaw (Head turn left/right)
  const midCanthusX = (leftCanthus.x + rightCanthus.x) / 2;
  const canthalDist = Math.abs(dx);
  const yawOffset = noseTip.x - midCanthusX;
  const yawDeg = canthalDist > 0.001 ? (yawOffset / canthalDist) * 60 : 0;

  // 3. Pitch (Head nod up/down)
  let pitchDeg = 0;
  if (glabella) {
    const glabellaToNoseY = noseTip.y - glabella.y;
    // Expected vertical distance between glabella and nose tip is ~0.10 normalized
    const pitchOffset = glabellaToNoseY - 0.10;
    pitchDeg = pitchOffset * 100;
  }

  const isValid =
    Math.abs(rollDeg) <= POSITION_QUALITY_CONFIG.HEAD_POSE.MAX_ROLL_DEG &&
    Math.abs(yawDeg) <= POSITION_QUALITY_CONFIG.HEAD_POSE.MAX_YAW_DEG &&
    Math.abs(pitchDeg) <= POSITION_QUALITY_CONFIG.HEAD_POSE.MAX_PITCH_DEG;

  return {
    rollDeg: Number(rollDeg.toFixed(1)),
    yawDeg: Number(yawDeg.toFixed(1)),
    pitchDeg: Number(pitchDeg.toFixed(1)),
    isValid,
  };
}

/**
 * Calculates rolling median and stability metrics for distance estimates
 * @param {number[]} history
 * @param {number} currentEst
 * @returns {{ stableDistanceCm: number, isStable: boolean, stdDev: number, updatedHistory: number[] }}
 */
function calculateStability(history, currentEst) {
  const updatedHistory = [...history, currentEst].slice(-POSITION_QUALITY_CONFIG.STABILITY.BUFFER_SIZE);

  if (updatedHistory.length === 0) {
    return { stableDistanceCm: currentEst, isStable: false, stdDev: 0, updatedHistory };
  }

  // Calculate rolling median
  const sorted = [...updatedHistory].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const stableDistanceCm = Number(median.toFixed(1));

  // Calculate standard deviation across buffer
  const mean = updatedHistory.reduce((acc, v) => acc + v, 0) / updatedHistory.length;
  const variance = updatedHistory.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / updatedHistory.length;
  const stdDev = Number(Math.sqrt(variance).toFixed(2));

  // Stable condition: enough consecutive samples AND low jitter
  const hasEnoughSamples = updatedHistory.length >= POSITION_QUALITY_CONFIG.STABILITY.REQUIRED_STABLE_FRAMES;
  const isJitterLow = stdDev <= POSITION_QUALITY_CONFIG.STABILITY.MAX_JITTER_STD_DEV_CM;
  const isStable = hasEnoughSamples && isJitterLow;

  return {
    stableDistanceCm,
    isStable,
    stdDev,
    updatedHistory,
  };
}

/**
 * Estimates relative camera-to-face distance and validates position for a specific test type.
 * Target ranges:
 * - COVER_TEST: 33–40 cm
 * - BROCK_STRING: 20–25 cm
 * 
 * @param {Array<{x: number, y: number, z?: number}>} landmarks - MediaPipe 478 landmarks
 * @param {number} [_videoWidth=640] - Optional video frame width
 * @param {number} [_videoHeight=480] - Optional video frame height
 * @param {string} [testType='COVER_TEST'] - 'COVER_TEST' | 'BROCK_STRING'
 * @param {number[]} [history=[]] - Buffer of previous distance estimates for stability analysis
 * @returns {{
 *   testType: string,
 *   estimatedDistanceCm: number | null,
 *   stableDistanceCm: number | null,
 *   minDistanceCm: number,
 *   maxDistanceCm: number,
 *   status: string,
 *   confidence: number,
 *   faceDetected: boolean,
 *   checks: {
 *     faceDetected: boolean,
 *     faceCentered: boolean,
 *     bothEyesDetected: boolean,
 *     irisDetected: boolean,
 *     distanceValid: boolean,
 *     headPoseValid: boolean,
 *     isStable: boolean,
 *   },
 *   feedbackMessage: string,
 *   headPose: { rollDeg: number, yawDeg: number, pitchDeg: number, isValid: boolean },
 *   quality: { status: string, score: number, reasons: string[] },
 *   boundingBox: { xMin: number, yMin: number, width: number, height: number } | null,
 *   faceCentering: { centerX: number, centerY: number, offsetX: number, offsetY: number, isCentered: boolean } | null,
 *   history: number[],
 *   timestamp: number,
 *   validRange: { min: number, max: number, optimal: number }, // For backwards compatibility
 *   isDistanceValid: boolean, // For backwards compatibility
 * }}
 */
export function estimateCameraDistance(
  landmarks,
  videoWidth = 640,
  videoHeight = 480,
  testType = 'COVER_TEST',
  history = []
) {
  const config = POSITION_CONFIG[testType] || POSITION_CONFIG.COVER_TEST;
  const { minDistanceCm, maxDistanceCm, optimalCm } = config;
  const reasons = [];

  // Initial fail-safe check: No face detected
  if (!landmarks || !Array.isArray(landmarks) || landmarks.length < 478) {
    const noFaceReport = {
      testType,
      estimatedDistanceCm: null,
      stableDistanceCm: null,
      minDistanceCm,
      maxDistanceCm,
      targetRangeLabel: config.targetRangeLabel,
      status: POSITION_STATUS.NO_FACE,
      confidence: 0,
      faceDetected: false,
      checks: {
        faceDetected: false,
        faceCentered: false,
        bothEyesDetected: false,
        irisDetected: false,
        distanceValid: false,
        headPoseValid: false,
        isStable: false,
      },
      feedbackMessage: 'Không phát hiện khuôn mặt.',
      headPose: { rollDeg: 0, yawDeg: 0, pitchDeg: 0, isValid: false },
      quality: {
        status: DATA_QUALITY_STATUS.INCONCLUSIVE,
        score: 0,
        reasons: [DATA_QUALITY_REASONS.NO_FACE],
      },
      boundingBox: null,
      faceCentering: null,
      history: [],
      timestamp: performance.now(),
      // Backwards compatibility fields
      validRange: { min: minDistanceCm, max: maxDistanceCm, optimal: optimalCm },
      isDistanceValid: false,
    };

    return noFaceReport;
  }

  // Landmark indices
  const leftIris = landmarks[LANDMARKS.LEFT_IRIS_CENTER]; // 473 (anatomical left iris)
  const rightIris = landmarks[LANDMARKS.RIGHT_IRIS_CENTER]; // 468 (anatomical right iris)
  const leftInner = landmarks[LANDMARKS.LEFT_INNER_CANTHUS]; // 362
  const leftOuter = landmarks[LANDMARKS.LEFT_OUTER_CANTHUS]; // 263
  const rightInner = landmarks[LANDMARKS.RIGHT_INNER_CANTHUS]; // 133
  const rightOuter = landmarks[LANDMARKS.RIGHT_OUTER_CANTHUS]; // 33
  const leftTemple = landmarks[454]; // Left zygion / cheek edge
  const rightTemple = landmarks[234]; // Right zygion / cheek edge

  // Calculate face bounding box for UI visualization
  const boundingBox = calculateBoundingBox(landmarks);

  // The face being detectable is not enough: its center must also be near the
  // optical center of the video frame.
  const centeringConfig = POSITION_QUALITY_CONFIG.FACE_CENTERING;
  const isPortrait = videoHeight > videoWidth;
  const maxOffsetY = isPortrait ? Math.max(centeringConfig.MAX_OFFSET_Y, 0.16) : centeringConfig.MAX_OFFSET_Y;
  const maxOffsetX = centeringConfig.MAX_OFFSET_X;

  const faceCentering = boundingBox
    ? (() => {
        const centerX = boundingBox.xMin + boundingBox.width / 2;
        const centerY = boundingBox.yMin + boundingBox.height / 2;
        const offsetX = centerX - centeringConfig.TARGET_X;
        const offsetY = centerY - centeringConfig.TARGET_Y;
        return {
          centerX: Number(centerX.toFixed(3)),
          centerY: Number(centerY.toFixed(3)),
          offsetX: Number(offsetX.toFixed(3)),
          offsetY: Number(offsetY.toFixed(3)),
          isCentered:
            Math.abs(offsetX) <= maxOffsetX &&
            Math.abs(offsetY) <= maxOffsetY,
        };
      })()
    : null;
  const faceCentered = Boolean(faceCentering?.isCentered);
  if (!faceCentered) {
    reasons.push(DATA_QUALITY_REASONS.FACE_NOT_CENTERED);
  }

  // 1. Both eyes check
  const bothEyesDetected = Boolean(leftInner && leftOuter && rightInner && rightOuter);
  if (!bothEyesDetected) {
    reasons.push(DATA_QUALITY_REASONS.ONE_EYE_MISSING);
  }

  // 2. Both irises check
  const irisDetected = Boolean(
    leftIris &&
    rightIris &&
    !isNaN(leftIris.x) &&
    !isNaN(rightIris.x) &&
    leftIris.x > 0.05 &&
    leftIris.x < 0.95 &&
    rightIris.x > 0.05 &&
    rightIris.x < 0.95
  );
  if (!irisDetected) {
    reasons.push(DATA_QUALITY_REASONS.IRIS_NOT_DETECTED);
  }

  // 3. Head pose estimation
  const headPose = estimateHeadPose(landmarks);
  if (!headPose.isValid) {
    reasons.push(DATA_QUALITY_REASONS.INVALID_HEAD_POSE);
  }

  // 4. Relative distance estimation using multi-span pinhole model
  let faceWidthSpan = 0;
  if (leftTemple && rightTemple) {
    faceWidthSpan = dist2D(leftTemple, rightTemple);
  }

  const intercanthalSpan = leftInner && rightInner ? dist2D(leftInner, rightInner) : 0;
  const ipdSpan = leftIris && rightIris ? dist2D(leftIris, rightIris) : 0;

  // Aspect ratio normalization for mobile devices (iOS / Android):
  // Baseline benchmarks were calibrated on desktop webcam where width is the dominant dimension.
  // In portrait orientation (videoHeight > videoWidth), horizontal normalized span (px / videoWidth)
  // is inflated because videoWidth is the shorter dimension.
  // Normalizing by (videoWidth / max(videoWidth, videoHeight)) scales it to the dominant dimension,
  // maintaining optical distance consistency across both mobile portrait and desktop landscape.
  const maxDim = Math.max(videoWidth, videoHeight);
  const aspectFactor = maxDim > 0 && isPortrait ? videoWidth / maxDim : 1.0;

  const normFaceSpan = faceWidthSpan * aspectFactor;
  const normIntercanthalSpan = intercanthalSpan * aspectFactor;
  const normIpdSpan = ipdSpan * aspectFactor;

  const baselineWidth = POSITION_QUALITY_CONFIG.OPTICAL_BASELINE.REFERENCE_FACE_WIDTH_AT_22_5CM;
  const baselineIntercanthal = POSITION_QUALITY_CONFIG.OPTICAL_BASELINE.REFERENCE_INTERCANTHAL_AT_22_5CM;
  const baselineCm = POSITION_QUALITY_CONFIG.OPTICAL_BASELINE.OPTIMAL_BASELINE_CM; // 22.5 cm

  let relativeScale = 1.0;
  if (normFaceSpan > 0.12) {
    relativeScale = normFaceSpan / baselineWidth;
  } else if (normIpdSpan > 0.06) {
    relativeScale = normIpdSpan / 0.18;
  } else if (normIntercanthalSpan > 0.03) {
    relativeScale = normIntercanthalSpan / baselineIntercanthal;
  } else {
    reasons.push(DATA_QUALITY_REASONS.INVALID_EYE_WIDTH);
  }

  let estimatedDistanceCm = null;
  if (relativeScale > 0.15 && relativeScale < 4.0) {
    const rawEst = baselineCm / relativeScale;
    // Optical clamp to realistic room distance bounds [10cm, 100cm]
    estimatedDistanceCm = Number(Math.max(10, Math.min(100, rawEst)).toFixed(1));
  }

  // 5. Stability & Smoothing analysis
  let stableDistanceCm = estimatedDistanceCm;
  let isStable = true;
  let updatedHistory = history;

  if (estimatedDistanceCm !== null) {
    const stability = calculateStability(history, estimatedDistanceCm);
    stableDistanceCm = stability.stableDistanceCm;
    isStable = stability.isStable;
    updatedHistory = stability.updatedHistory;
  }

  // Target evaluation value: prioritize stable distance if available
  const evalDistance = stableDistanceCm ?? estimatedDistanceCm;

  // 6. Distance range & status determination
  let status = POSITION_STATUS.LOW_CONFIDENCE;
  let feedbackMessage = '';

  if (evalDistance === null) {
    status = POSITION_STATUS.LOW_CONFIDENCE;
    feedbackMessage = 'Không thể xác định khoảng cách đủ tin cậy.';
  } else if (!bothEyesDetected || !irisDetected) {
    status = POSITION_STATUS.LOW_CONFIDENCE;
    feedbackMessage = 'Không nhận diện rõ hai mắt hoặc mống mắt.';
  } else if (!faceCentered) {
    status = POSITION_STATUS.LOW_CONFIDENCE;
    if (faceCentering?.offsetY > centeringConfig.MAX_OFFSET_Y) {
      feedbackMessage = 'Khuôn mặt đang quá thấp. Hãy nâng camera hoặc ngồi cao hơn để đưa mặt vào giữa khung hình.';
    } else if (faceCentering?.offsetY < -centeringConfig.MAX_OFFSET_Y) {
      feedbackMessage = 'Khuôn mặt đang quá cao. Hãy hạ camera hoặc ngồi thấp hơn để đưa mặt vào giữa khung hình.';
    } else {
      feedbackMessage = 'Hãy di chuyển khuôn mặt vào giữa khung hình.';
    }
  } else if (!headPose.isValid) {
    status = POSITION_STATUS.LOW_CONFIDENCE;
    feedbackMessage = 'Hãy nhìn thẳng vào camera.';
  } else if (evalDistance < minDistanceCm) {
    status = POSITION_STATUS.TOO_CLOSE;
    feedbackMessage = config.tooCloseMessage;
  } else if (evalDistance > maxDistanceCm) {
    status = POSITION_STATUS.TOO_FAR;
    feedbackMessage = config.tooFarMessage;
  } else if (!isStable) {
    // Distance is within target bounds but unstable/noisy
    status = POSITION_STATUS.LOW_CONFIDENCE;
    feedbackMessage = 'Giữ nguyên tư thế để ổn định khoảng cách...';
  } else {
    // 33 <= distance <= 40 (Cover Test) OR 20 <= distance <= 25 (Brock String)
    // AND head pose valid, irises detected, and distance stable across consecutive frames
    status = POSITION_STATUS.READY;
    feedbackMessage = config.readyMessage;
  }

  // Confidence scoring
  const confidence = Number(
    (
      0.88 *
      (headPose.isValid ? 1.0 : 0.6) *
      (irisDetected ? 1.0 : 0.5) *
      (faceCentered ? 1.0 : 0.55) *
      (isStable ? 1.0 : 0.7)
    ).toFixed(2)
  );

  let qualityStatus = DATA_QUALITY_STATUS.OPTIMAL;
  let score = 1.0;
  if (reasons.length > 0 || status !== POSITION_STATUS.READY) {
    if (status === POSITION_STATUS.TOO_CLOSE || status === POSITION_STATUS.TOO_FAR) {
      qualityStatus = DATA_QUALITY_STATUS.DEGRADED;
      score = 0.6;
    } else if (status === POSITION_STATUS.LOW_CONFIDENCE) {
      qualityStatus = DATA_QUALITY_STATUS.FAIR;
      score = 0.5;
    }
  }

  const isDistanceValid = status === POSITION_STATUS.READY;

  // Development mode logging as required by Section 30
  if (
    typeof process !== 'undefined' &&
    process.env &&
    process.env.NODE_ENV !== 'production'
  ) {
    console.debug(
      `[PositionCheck] testType=${testType} estimatedDistanceCm=${estimatedDistanceCm} stableDistanceCm=${stableDistanceCm} range=${minDistanceCm}-${maxDistanceCm} status=${status}`
    );
  }

  return {
    testType,
    estimatedDistanceCm,
    stableDistanceCm,
    minDistanceCm,
    maxDistanceCm,
    targetRangeLabel: config.targetRangeLabel,
    status,
    confidence,
    faceDetected: true,
    checks: {
      faceDetected: true,
      faceCentered,
      bothEyesDetected,
      irisDetected,
      distanceValid: isDistanceValid,
      headPoseValid: headPose.isValid,
      isStable,
    },
    feedbackMessage,
    headPose,
    quality: {
      status: qualityStatus,
      score,
      reasons,
    },
    boundingBox,
    faceCentering,
    history: updatedHistory,
    timestamp: performance.now(),
    // Backwards compatibility fields
    validRange: { min: minDistanceCm, max: maxDistanceCm, optimal: optimalCm },
    isDistanceValid,
  };
}

/**
 * Stateful helper class to maintain consecutive distance history for a test session
 */
export class DistanceStabilityTracker {
  constructor(testType = 'COVER_TEST') {
    this.testType = testType;
    this.history = [];
  }

  reset(testType = this.testType) {
    this.testType = testType;
    this.history = [];
  }

  update(landmarks, videoWidth = 640, videoHeight = 480) {
    const result = estimateCameraDistance(
      landmarks,
      videoWidth,
      videoHeight,
      this.testType,
      this.history
    );

    if (result.estimatedDistanceCm !== null) {
      this.history = result.history;
    } else {
      this.history = [];
    }

    return result;
  }
}


/**
 * Evaluates illumination brightness and blur variance from HTMLVideoElement in realtime (<0.2ms)
 * @param {HTMLVideoElement} video
 * @returns {{ brightness: number, blurVar: number, isLightingValid: boolean, isBlurValid: boolean, status: string|null }}
 */
export function checkVideoLightingAndBlur(video) {
  if (!video || typeof document === 'undefined' || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return { brightness: 120, blurVar: 200, isLightingValid: true, isBlurValid: true, status: null };
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { brightness: 120, blurVar: 200, isLightingValid: true, isBlurValid: true, status: null };

    ctx.drawImage(video, 0, 0, 64, 48);
    const imgData = ctx.getImageData(0, 0, 64, 48).data;

    let totalLuminance = 0;
    const totalPixels = 64 * 48;
    const gray = new Float32Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
      gray[i] = lum;
      totalLuminance += lum;
    }

    const brightness = totalLuminance / totalPixels;

    // Fast discrete Laplacian variance on 64x48 grid
    let lapSum = 0;
    let lapSumSq = 0;
    let lapCount = 0;
    for (let y = 1; y < 47; y++) {
      for (let x = 1; x < 63; x++) {
        const idx = y * 64 + x;
        const val = 4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - 64] - gray[idx + 64];
        lapSum += val;
        lapSumSq += val * val;
        lapCount++;
      }
    }
    const lapMean = lapSum / Math.max(1, lapCount);
    const blurVar = (lapSumSq / Math.max(1, lapCount)) - (lapMean * lapMean);

    const isLightingValid = brightness >= 35 && brightness <= 240;
    const isBlurValid = blurVar >= 20;

    let status = null;
    if (brightness < 35) status = 'LIGHTING_TOO_DARK';
    else if (brightness > 240) status = 'LIGHTING_TOO_BRIGHT';
    else if (!isBlurValid) status = 'IMAGE_BLURRY';

    return { brightness: Number(brightness.toFixed(1)), blurVar: Number(blurVar.toFixed(1)), isLightingValid, isBlurValid, status };
  } catch {
    return { brightness: 120, blurVar: 200, isLightingValid: true, isBlurValid: true, status: null };
  }
}
