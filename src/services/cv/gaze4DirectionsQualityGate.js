/**
 * REMICARE AI - GAZE / HIRSCHBERG QUALITY GATE & AUTO-CAPTURE SERVICE
 * 
 * Evaluates real-time frame quality, anatomical landmark visibility,
 * vector gaze orientation, and temporal fixation stability (1.0–1.5s)
 * before triggering automatic capture for gaze or Hirschberg photo steps.
 */

import { LANDMARKS } from '../../constants/screeningConfig.js';

export const GAZE_QUALITY_REASONS = Object.freeze({
  NO_FACE: 'NO_FACE',
  EYES_NOT_DETECTED: 'EYES_NOT_DETECTED',
  IRIS_NOT_DETECTED: 'IRIS_NOT_DETECTED',
  DISTANCE_TOO_FAR: 'DISTANCE_TOO_FAR',
  DISTANCE_TOO_CLOSE: 'DISTANCE_TOO_CLOSE',
  DISTANCE_INVALID: 'DISTANCE_INVALID',
  GAZE_DIRECTION_MISMATCH: 'GAZE_DIRECTION_MISMATCH',
  GAZE_UNSTABLE: 'GAZE_UNSTABLE',
  BLINK_DETECTED: 'BLINK_DETECTED',
  HEAD_TILT_EXCESSIVE: 'HEAD_TILT_EXCESSIVE',
  FACE_NOT_CENTERED: 'FACE_NOT_CENTERED',
});

/**
 * Gaze/Hirschberg Evaluation & Stability Controller
 */
export class Gaze4DirectionsQualityGate {
  constructor({
    requiredStableMs = 2100,      // ~2.1s required hold (allows 1... 2... Chụp! rhythm)
    minDistanceCm = 15,
    maxDistanceCm = 20,
    directionThreshold = 0.050,   // Clear normalized iris displacement threshold
  } = {}) {
    this.requiredStableMs = requiredStableMs;
    this.minDistanceCm = minDistanceCm;
    this.maxDistanceCm = maxDistanceCm;
    this.directionThreshold = directionThreshold;

    this.stableStartTime = null;
    this.accumulatedStableMs = 0;
    this.lastFrameTime = null;
  }

  reset() {
    this.stableStartTime = null;
    this.accumulatedStableMs = 0;
    this.lastFrameTime = null;
  }

  /**
   * Evaluates current frame against the Quality Gate for target direction.
   * 
   * @param {Object} params
   * @param {Array<Object>} params.landmarks - 468/478 MediaPipe face landmarks
   * @param {string} params.targetDirection - 'left' | 'right' | 'up' | 'straight' | 'down'
   * @param {number|null} params.distanceCm - Current estimated distance in cm
   * @param {number} [params.timestampMs=performance.now()]
   * @returns {{
   *   isReadyToCapture: boolean,
   *   isPassing: boolean,
   *   progressRatio: number, // 0.0 to 1.0
   *   stableMs: number,
   *   activeReason: string | null,
   *   feedbackText: string,
   *   gazeOffsets: { meanDx: number, meanDy: number },
   *   qualityScore: number,
   * }}
   */
  evaluate({
    landmarks,
    targetDirection,
    distanceCm,
    timestampMs = performance.now(),
  }) {
    const now = timestampMs;
    const dt = this.lastFrameTime ? Math.min(100, Math.max(0, now - this.lastFrameTime)) : 16;
    this.lastFrameTime = now;

    // 1. Face detected check
    if (!landmarks || !Array.isArray(landmarks) || landmarks.length < 468) {
      this.reset();
      return {
        isReadyToCapture: false,
        isPassing: false,
        progressRatio: 0,
        stableMs: 0,
        activeReason: GAZE_QUALITY_REASONS.NO_FACE,
        feedbackText: 'Không phát hiện khuôn mặt. Hãy hướng mặt vào camera.',
        gazeOffsets: { meanDx: 0, meanDy: 0 },
        qualityScore: 0,
      };
    }

    // Key anatomical landmarks
    const leftIris = landmarks[LANDMARKS.LEFT_IRIS_CENTER];    // 473 (anatomical left iris)
    const rightIris = landmarks[LANDMARKS.RIGHT_IRIS_CENTER];  // 468 (anatomical right iris)
    const leftInner = landmarks[LANDMARKS.LEFT_INNER_CORNER];  // 362
    const leftOuter = landmarks[LANDMARKS.LEFT_OUTER_CORNER];  // 263
    const rightInner = landmarks[LANDMARKS.RIGHT_INNER_CORNER];// 133
    const rightOuter = landmarks[LANDMARKS.RIGHT_OUTER_CORNER];// 33
    const leftTop = landmarks[LANDMARKS.LEFT_TOP_LID];         // 386
    const leftBot = landmarks[LANDMARKS.LEFT_BOTTOM_LID];      // 374
    const rightTop = landmarks[LANDMARKS.RIGHT_TOP_LID];       // 159
    const rightBot = landmarks[LANDMARKS.RIGHT_BOTTOM_LID];    // 145
    const nose = landmarks[LANDMARKS.NOSE_TIP] || landmarks[1];

    // 2. Both eyes detected check
    if (!leftInner || !leftOuter || !rightInner || !rightOuter || !leftTop || !leftBot || !rightTop || !rightBot) {
      this.reset();
      return {
        isReadyToCapture: false,
        isPassing: false,
        progressRatio: 0,
        stableMs: 0,
        activeReason: GAZE_QUALITY_REASONS.EYES_NOT_DETECTED,
        feedbackText: 'Đang tìm hai mắt... Đưa mặt rõ hơn trước camera.',
        gazeOffsets: { meanDx: 0, meanDy: 0 },
        qualityScore: 0,
      };
    }

    // 3. Iris landmarks detected check
    if (!leftIris || !rightIris || isNaN(leftIris.x) || isNaN(rightIris.x)) {
      this.reset();
      return {
        isReadyToCapture: false,
        isPassing: false,
        progressRatio: 0,
        stableMs: 0,
        activeReason: GAZE_QUALITY_REASONS.IRIS_NOT_DETECTED,
        feedbackText: 'Đang nhận diện mống mắt... Giữ mắt mở tự nhiên.',
        gazeOffsets: { meanDx: 0, meanDy: 0 },
        qualityScore: 0,
      };
    }

    // 4. Distance gate (with generous 1.5cm engineering tolerance)
    const dist = distanceCm;
    const rangeLabel = `${this.minDistanceCm}–${this.maxDistanceCm} cm`;
    if (dist !== null && Number.isFinite(dist)) {
      if (dist > this.maxDistanceCm + 1.5) {
        this.reset();
        return {
          isReadyToCapture: false,
          isPassing: false,
          progressRatio: 0,
          stableMs: 0,
          activeReason: GAZE_QUALITY_REASONS.DISTANCE_TOO_FAR,
          feedbackText: `Đưa mặt lại gần camera một chút (${rangeLabel}).`,
          gazeOffsets: { meanDx: 0, meanDy: 0 },
          qualityScore: 0.5,
        };
      }
      if (dist < this.minDistanceCm - 1.5) {
        this.reset();
        return {
          isReadyToCapture: false,
          isPassing: false,
          progressRatio: 0,
          stableMs: 0,
          activeReason: GAZE_QUALITY_REASONS.DISTANCE_TOO_CLOSE,
          feedbackText: `Lùi ra xa camera một chút (${rangeLabel}).`,
          gazeOffsets: { meanDx: 0, meanDy: 0 },
          qualityScore: 0.5,
        };
      }
    }

    // 5. Eye Aspect Ratio (Blink Gate)
    const lHeight = Math.hypot(leftTop.x - leftBot.x, leftTop.y - leftBot.y);
    const lWidth = Math.max(0.001, Math.hypot(leftOuter.x - leftInner.x, leftOuter.y - leftInner.y));
    const leftEar = lHeight / lWidth;

    const rHeight = Math.hypot(rightTop.x - rightBot.x, rightTop.y - rightBot.y);
    const rWidth = Math.max(0.001, Math.hypot(rightOuter.x - rightInner.x, rightOuter.y - rightInner.y));
    const rightEar = rHeight / rWidth;

    if (leftEar < 0.16 || rightEar < 0.16) {
      this.reset();
      return {
        isReadyToCapture: false,
        isPassing: false,
        progressRatio: 0,
        stableMs: 0,
        activeReason: GAZE_QUALITY_REASONS.BLINK_DETECTED,
        feedbackText: 'Chớp mắt phát hiện. Giữ mắt mở nhìn vào mục tiêu.',
        gazeOffsets: { meanDx: 0, meanDy: 0 },
        qualityScore: 0.6,
      };
    }

    // 6. Gaze Displacement Calculation
    // Eye anatomical centers
    const lCenter = { x: (leftInner.x + leftOuter.x) / 2, y: (leftTop.y + leftBot.y) / 2 };
    const rCenter = { x: (rightInner.x + rightOuter.x) / 2, y: (rightTop.y + rightBot.y) / 2 };

    // Horizontal & vertical displacement normalized by eye dimensions
    const dxL = (leftIris.x - lCenter.x) / lWidth;
    const dxR = (rightIris.x - rCenter.x) / rWidth;
    const meanDx = (dxL + dxR) / 2;

    const dyL = (leftIris.y - lCenter.y) / lHeight;
    const dyR = (rightIris.y - rCenter.y) / rHeight;
    const meanDy = (dyL + dyR) / 2;

    // 7. Evaluate Gaze Direction
    // Remember: Mirror camera mode (scaleX(-1)):
    // Looking at screen LEFT: user eyes turn to user's left (meanDx > +threshold in raw webcam frame).
    // Looking at screen RIGHT: user eyes turn to user's right (meanDx < -threshold in raw webcam frame).
    // Looking UP: meanDy < -threshold (towards forehead).
    // Looking DOWN: meanDy > +threshold (towards chin).
    let isDirectionCorrect = false;
    let directionHint = '';

    const thresh = this.directionThreshold;

    switch (targetDirection) {
      case 'left':
        isDirectionCorrect = meanDx > thresh;
        directionHint = 'Nhìn thẳng sang trái nghen.';
        break;
      case 'right':
        isDirectionCorrect = meanDx < -thresh;
        directionHint = 'Nhìn thẳng sang phải nghen.';
        break;
      case 'up':
        // Looking UP: meanDy < -0.042
        isDirectionCorrect = meanDy < -(thresh * 0.85);
        directionHint = 'Nhìn thẳng lên trên nghen.';
        break;
      case 'straight':
      case 'center':
        // Looking STRAIGHT: User faces camera naturally
        // Wide forward bounds: ensures natural head/eye alignment without getting stuck
        isDirectionCorrect = Math.abs(meanDx) <= (thresh * 1.4) && meanDy >= -(thresh * 1.4) && meanDy <= (thresh * 1.6);
        directionHint = 'Nhìn thẳng vào giữa màn hình nghen.';
        break;
      case 'down':
        // Looking DOWN: meanDy > +0.055 (Fallback)
        isDirectionCorrect = meanDy > (thresh * 1.1);
        directionHint = 'Nhìn thẳng xuống dưới nghen.';
        break;
      default:
        isDirectionCorrect = false;
    }

    if (!isDirectionCorrect) {
      this.reset();
      return {
        isReadyToCapture: false,
        isPassing: false,
        countdownPhase: null,
        progressRatio: 0,
        stableMs: 0,
        activeReason: GAZE_QUALITY_REASONS.GAZE_DIRECTION_MISMATCH,
        feedbackText: directionHint,
        gazeOffsets: { meanDx: Number(meanDx.toFixed(3)), meanDy: Number(meanDy.toFixed(3)) },
        qualityScore: 0.7,
      };
    }

    // 8. Head Pose Stability (No extreme head rotation)
    const noseOffset = nose ? nose.x - (leftInner.x + rightInner.x) / 2 : 0;
    if (Math.abs(noseOffset) > 0.08) {
      this.reset();
      return {
        isReadyToCapture: false,
        isPassing: false,
        countdownPhase: null,
        progressRatio: 0,
        stableMs: 0,
        activeReason: GAZE_QUALITY_REASONS.HEAD_TILT_EXCESSIVE,
        feedbackText: 'Giữ đầu thẳng, chỉ di chuyển hướng mắt nhìn mục tiêu.',
        gazeOffsets: { meanDx: Number(meanDx.toFixed(3)), meanDy: Number(meanDy.toFixed(3)) },
        qualityScore: 0.75,
      };
    }

    // 9. Frame passes all checks -> Accumulate Stability
    const isStraightGaze = targetDirection === 'straight' || targetDirection === 'center';
    // For 'straight' gaze, AI auto-captures fast (350ms ~ 10 frames) so it snaps immediately
    const targetStableMs = isStraightGaze ? 350 : this.requiredStableMs;

    this.accumulatedStableMs += dt;
    const progressRatio = Math.min(1.0, this.accumulatedStableMs / targetStableMs);
    const isReadyToCapture = this.accumulatedStableMs >= targetStableMs;

    // Calculate rhythm countdown phase (1... 2... Chụp!)
    let countdownPhase = null;
    let feedbackText = 'Giữ yên mắt hướng về mục tiêu...';

    if (isStraightGaze) {
      if (this.accumulatedStableMs >= 250) {
        countdownPhase = 'snap';
        feedbackText = '📸 Chụp ngay!';
      } else {
        feedbackText = 'Đã nhận diện mắt thẳng...';
      }
    } else {
      if (this.accumulatedStableMs >= 2000) {
        countdownPhase = 'snap';
        feedbackText = '📸 Chụp!';
      } else if (this.accumulatedStableMs >= 1350) {
        countdownPhase = '2';
        feedbackText = 'Đang đếm: 2... Giữ yên mắt!';
      } else if (this.accumulatedStableMs >= 650) {
        countdownPhase = '1';
        feedbackText = 'Đang đếm: 1... Giữ yên mắt!';
      }
    }

    return {
      isReadyToCapture,
      isPassing: true,
      countdownPhase,
      progressRatio: Number(progressRatio.toFixed(3)),
      stableMs: this.accumulatedStableMs,
      activeReason: null,
      feedbackText: isReadyToCapture ? '✓ Đã chụp!' : feedbackText,
      gazeOffsets: { meanDx: Number(meanDx.toFixed(3)), meanDy: Number(meanDy.toFixed(3)) },
      qualityScore: Number((0.9 + progressRatio * 0.08).toFixed(2)),
    };
  }
}

/**
 * Captures clean frame directly from HTMLVideoElement as JPEG data URL.
 * 
 * @param {HTMLVideoElement} video
 * @returns {string|null} Base64 JPEG data URL or null if video not ready
 */
export function captureGazeFrameDataUrl(video) {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch (err) {
    console.error('[Gaze4DirectionsQualityGate] Capture frame error:', err);
    return null;
  }
}

/**
 * Anatomical landmark indices defining the bilateral eye and supra/infra-orbital region.
 * Covers both eyes, inner/outer canthi, eyebrows, upper nasal bridge, and infraorbital margin.
 * Excludes forehead, hair, lower nose, mouth, chin, and ambient background.
 */
const BILATERAL_EYE_LANDMARKS = Object.freeze([
  // Right eye & brow (anatomical right, camera left):
  33, 133, 159, 145, 70, 63, 105, 66, 107, 55, 111, 117,
  // Left eye & brow (anatomical left, camera right):
  362, 263, 386, 374, 300, 293, 334, 296, 336, 285, 340, 346,
  // Sellion & upper nasal bridge:
  6, 168, 197,
]);

/**
 * Extracts a normalized 224x224 Bilateral Eye ROI matching the model training distribution.
 * 
 * @param {HTMLVideoElement} video
 * @param {Array<Object>} landmarks - MediaPipe FaceMesh landmarks (468/478 items with normalized x, y)
 * @param {Object} [options]
 * @param {number} [options.targetWidth=224]
 * @param {number} [options.targetHeight=224]
 * @returns {{
 *   dataUrl: string|null,
 *   roiBox: { x: number, y: number, width: number, height: number }|null,
 *   aspectRatio: number,
 *   bothEyesDetected: boolean,
 *   reason?: string
 * }}
 */
export function captureBilateralEyeRoi(video, landmarks, options = {}) {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return { dataUrl: null, roiBox: null, aspectRatio: 0, bothEyesDetected: false, reason: 'VIDEO_NOT_READY' };
  }

  if (!landmarks || !Array.isArray(landmarks) || landmarks.length < 468) {
    return { dataUrl: null, roiBox: null, aspectRatio: 0, bothEyesDetected: false, reason: 'LANDMARKS_UNAVAILABLE' };
  }

  const vWidth = video.videoWidth;
  const vHeight = video.videoHeight;
  const targetW = options.targetWidth || 224;
  const targetH = options.targetHeight || 224;

  try {
    // Collect coordinates of orbital landmarks
    const xs = [];
    const ys = [];

    for (const idx of BILATERAL_EYE_LANDMARKS) {
      const pt = landmarks[idx];
      if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') {
        xs.push(pt.x * vWidth);
        ys.push(pt.y * vHeight);
      }
    }

    if (xs.length < 15) {
      return { dataUrl: null, roiBox: null, aspectRatio: 0, bothEyesDetected: false, reason: 'INSUFFICIENT_EYE_LANDMARKS' };
    }

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const eyeSpanW = maxX - minX;
    const eyeSpanH = maxY - minY;

    // Safety margins:
    // +15% on lateral sides so outer canthi are fully included with natural context
    // +15% on top to retain eyelid/eyebrow structure without including hair
    // +25% on bottom to cover infraorbital margin, excluding mouth/chin
    const padX = eyeSpanW * 0.15;
    const padTop = eyeSpanH * 0.15;
    const padBottom = eyeSpanH * 0.25;

    const cropX1 = Math.max(0, Math.round(minX - padX));
    const cropX2 = Math.min(vWidth, Math.round(maxX + padX));
    const cropY1 = Math.max(0, Math.round(minY - padTop));
    const cropY2 = Math.min(vHeight, Math.round(maxY + padBottom));

    const cropW = cropX2 - cropX1;
    const cropH = cropY2 - cropY1;

    if (cropW < 60 || cropH < 30) {
      return { dataUrl: null, roiBox: null, aspectRatio: 0, bothEyesDetected: false, reason: 'ROI_TOO_SMALL' };
    }

    const rawAspectRatio = Number((cropW / Math.max(1, cropH)).toFixed(2));

    // Render cropped sub-rectangle directly to target 224x224 canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { dataUrl: null, roiBox: null, aspectRatio: rawAspectRatio, bothEyesDetected: false, reason: 'CANVAS_CONTEXT_FAILED' };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, cropX1, cropY1, cropW, cropH, 0, 0, targetW, targetH);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const roiBox = { x: cropX1, y: cropY1, width: cropW, height: cropH };

    // Development inspection hook (transient in-memory, never persisted to production DB)
    if (typeof window !== 'undefined' && import.meta.env?.DEV) {
      window.__REMICARE_DEBUG_ROI__ = {
        timestamp: Date.now(),
        roiBox,
        aspectRatio: rawAspectRatio,
        targetDimensions: { width: targetW, height: targetH },
      };
      console.log(`[SCREENING] Bilateral Eye ROI extracted: ${cropW}x${cropH} (aspect ratio ${rawAspectRatio}) -> Resampled ${targetW}x${targetH}`);
    }

    return {
      dataUrl,
      roiBox,
      aspectRatio: rawAspectRatio,
      bothEyesDetected: true,
    };
  } catch (err) {
    console.error('[Gaze4DirectionsQualityGate] Extract Bilateral Eye ROI error:', err);
    return { dataUrl: null, roiBox: null, aspectRatio: 0, bothEyesDetected: false, reason: 'EXCEPTION' };
  }
}
