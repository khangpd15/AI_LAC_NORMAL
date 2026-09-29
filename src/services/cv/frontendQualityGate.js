/**
 * REMICARE AI - FRONTEND REAL-TIME QUALITY GATE
 * 
 * Performs multi-dimensional frame quality evaluation in real-time:
 * 1. Face presence & landmark count
 * 2. Both eyes & iris visibility
 * 3. Blink & eyelid occlusion (dual-vertical EAR)
 * 4. Head pose (Yaw, Pitch, Roll)
 * 5. Optical distance bounds (cm via IPD)
 * 6. Face centering within optical zone
 * 7. Eye ROI validity
 * 
 * Rejects corrupt/unusable frames from AI time-series dataset.
 * Slices localized clinical guidance messages for user posture correction.
 */

import { LANDMARKS } from '../../constants/screeningConfig.js';
import { calculateEyeRoi } from './eyeRoiService.js';

export const QUALITY_GATE_REASONS = Object.freeze({
  NO_FACE: 'NO_FACE',
  ONE_EYE_MISSING: 'ONE_EYE_MISSING',
  IRIS_NOT_DETECTED: 'IRIS_NOT_DETECTED',
  BLINK_DETECTED: 'BLINK_DETECTED',
  HEAD_YAW_EXCEEDED: 'HEAD_YAW_EXCEEDED',
  HEAD_PITCH_EXCEEDED: 'HEAD_PITCH_EXCEEDED',
  HEAD_ROLL_EXCEEDED: 'HEAD_ROLL_EXCEEDED',
  FACE_NOT_CENTERED: 'FACE_NOT_CENTERED',
  DISTANCE_TOO_CLOSE: 'DISTANCE_TOO_CLOSE',
  DISTANCE_TOO_FAR: 'DISTANCE_TOO_FAR',
  LIGHTING_TOO_DARK: 'LIGHTING_TOO_DARK',
  LIGHTING_TOO_BRIGHT: 'LIGHTING_TOO_BRIGHT',
  INVALID_ROI: 'INVALID_ROI',
});

export class FrontendQualityGate {
  constructor({
    minEarBlink = 0.18,
    maxYawDeg = 15.0,
    maxPitchDeg = 15.0,
    maxRollDeg = 12.0,
    minDistanceCm = 28.0,
    maxDistanceCm = 65.0,
    centerTolerance = 0.18,
  } = {}) {
    this.minEarBlink = minEarBlink;
    this.maxYawDeg = maxYawDeg;
    this.maxPitchDeg = maxPitchDeg;
    this.maxRollDeg = maxRollDeg;
    this.minDistanceCm = minDistanceCm;
    this.maxDistanceCm = maxDistanceCm;
    this.centerTolerance = centerTolerance;
  }

  /**
   * Evaluates a single frame's landmarks, EAR, distance, and head pose.
   * 
   * @param {Array<{x: number, y: number, z?: number}>|null} landmarks
   * @param {Object} [options]
   * @param {number} [options.leftEar=0.3]
   * @param {number} [options.rightEar=0.3]
   * @param {number} [options.estimatedDistanceCm=null]
   * @param {number} [options.brightness=128]
   * @param {boolean} [options.requireBothEyes=false]
   * @returns {{
   *   isAcceptable: boolean,
   *   qualityScore: number,
   *   failureReasons: string[],
   *   userGuidance: string,
   *   headPose: { yaw: number, pitch: number, roll: number, isValid: boolean },
   *   isBlinking: boolean,
   *   faceCentered: boolean,
   *   distanceValid: boolean
   * }}
   */
  evaluateFrame(landmarks, {
    leftEar = 0.30,
    rightEar = 0.30,
    estimatedDistanceCm = null,
    brightness = 128,
    requireBothEyes = false,
  } = {}) {
    const reasons = [];

    // 1. Face detection check
    if (!landmarks || landmarks.length < 468) {
      return {
        isAcceptable: false,
        qualityScore: 0.0,
        failureReasons: [QUALITY_GATE_REASONS.NO_FACE],
        userGuidance: 'Đưa mặt vào giữa khung hình',
        headPose: { yaw: 0, pitch: 0, roll: 0, isValid: false },
        isBlinking: false,
        faceCentered: false,
        distanceValid: false,
      };
    }

    // 2. Anatomical Landmarks Presence
    const lIris = landmarks[LANDMARKS.LEFT_IRIS_CENTER];
    const rIris = landmarks[LANDMARKS.RIGHT_IRIS_CENTER];
    const lInner = landmarks[LANDMARKS.LEFT_INNER_CORNER];
    const lOuter = landmarks[LANDMARKS.LEFT_OUTER_CORNER];
    const rInner = landmarks[LANDMARKS.RIGHT_INNER_CORNER];
    const rOuter = landmarks[LANDMARKS.RIGHT_OUTER_CORNER];

    const leftEyeOk = Boolean(lInner && lOuter && lIris && Number.isFinite(lIris.x) && Number.isFinite(lIris.y));
    const rightEyeOk = Boolean(rInner && rOuter && rIris && Number.isFinite(rIris.x) && Number.isFinite(rIris.y));

    if (requireBothEyes) {
      if (!leftEyeOk || !rightEyeOk) {
        reasons.push(QUALITY_GATE_REASONS.ONE_EYE_MISSING);
      }
    } else {
      if (!leftEyeOk && !rightEyeOk) {
        reasons.push(QUALITY_GATE_REASONS.ONE_EYE_MISSING);
      }
    }

    // 3. Blink Detection via EAR
    const isBlinking = leftEar < this.minEarBlink || rightEar < this.minEarBlink;
    if (isBlinking) {
      reasons.push(QUALITY_GATE_REASONS.BLINK_DETECTED);
    }

    // 4. Head Pose Estimation (Roll, Yaw, Pitch)
    const nose = landmarks[LANDMARKS.NOSE_TIP] || landmarks[1];
    const glabella = landmarks[LANDMARKS.GLABELLA] || landmarks[168];
    let rollDeg = 0;
    let yawDeg = 0;
    let pitchDeg = 0;

    if (lInner && rInner && nose) {
      const dy = lInner.y - rInner.y;
      const dx = lInner.x - rInner.x;
      rollDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

      const midX = (lInner.x + rInner.x) / 2.0;
      const span = Math.abs(dx);
      yawDeg = span > 0.001 ? ((nose.x - midX) / span) * 60.0 : 0;

      if (glabella) {
        const vertDist = nose.y - glabella.y;
        pitchDeg = (vertDist - 0.10) * 100.0;
      }
    }

    const headPoseValid =
      Math.abs(rollDeg) <= this.maxRollDeg &&
      Math.abs(yawDeg) <= this.maxYawDeg &&
      Math.abs(pitchDeg) <= this.maxPitchDeg;

    if (Math.abs(rollDeg) > this.maxRollDeg) reasons.push(QUALITY_GATE_REASONS.HEAD_ROLL_EXCEEDED);
    if (Math.abs(yawDeg) > this.maxYawDeg) reasons.push(QUALITY_GATE_REASONS.HEAD_YAW_EXCEEDED);
    if (Math.abs(pitchDeg) > this.maxPitchDeg) reasons.push(QUALITY_GATE_REASONS.HEAD_PITCH_EXCEEDED);

    // 5. Face Centering Check
    let faceCentered = true;
    if (nose) {
      const offsetX = Math.abs(nose.x - 0.50);
      const offsetY = Math.abs(nose.y - 0.50);
      if (offsetX > this.centerTolerance || offsetY > this.centerTolerance) {
        faceCentered = false;
        reasons.push(QUALITY_GATE_REASONS.FACE_NOT_CENTERED);
      }
    }

    // 6. Distance Evaluation
    let distanceValid = true;
    if (estimatedDistanceCm !== null && Number.isFinite(estimatedDistanceCm)) {
      if (estimatedDistanceCm < this.minDistanceCm) {
        distanceValid = false;
        reasons.push(QUALITY_GATE_REASONS.DISTANCE_TOO_CLOSE);
      } else if (estimatedDistanceCm > this.maxDistanceCm) {
        distanceValid = false;
        reasons.push(QUALITY_GATE_REASONS.DISTANCE_TOO_FAR);
      }
    }

    // 7. Lighting bounds check
    if (brightness < 35) {
      reasons.push(QUALITY_GATE_REASONS.LIGHTING_TOO_DARK);
    } else if (brightness > 240) {
      reasons.push(QUALITY_GATE_REASONS.LIGHTING_TOO_BRIGHT);
    }

    // 8. ROI validity check
    const leftRoi = calculateEyeRoi(landmarks, 'LEFT');
    const rightRoi = calculateEyeRoi(landmarks, 'RIGHT');
    if ((requireBothEyes && (!leftRoi?.isValid || !rightRoi?.isValid)) ||
        (!requireBothEyes && !leftRoi?.isValid && !rightRoi?.isValid)) {
      reasons.push(QUALITY_GATE_REASONS.INVALID_ROI);
    }

    // Compute localized user guidance
    let userGuidance = 'Sẵn sàng';
    if (reasons.includes(QUALITY_GATE_REASONS.BLINK_DETECTED)) {
      userGuidance = 'Mở mắt';
    } else if (reasons.includes(QUALITY_GATE_REASONS.FACE_NOT_CENTERED)) {
      userGuidance = 'Đưa mặt vào giữa';
    } else if (reasons.includes(QUALITY_GATE_REASONS.DISTANCE_TOO_CLOSE)) {
      userGuidance = 'Lùi xa camera';
    } else if (reasons.includes(QUALITY_GATE_REASONS.DISTANCE_TOO_FAR)) {
      userGuidance = 'Lại gần camera';
    } else if (
      reasons.includes(QUALITY_GATE_REASONS.HEAD_YAW_EXCEEDED) ||
      reasons.includes(QUALITY_GATE_REASONS.HEAD_PITCH_EXCEEDED) ||
      reasons.includes(QUALITY_GATE_REASONS.HEAD_ROLL_EXCEEDED)
    ) {
      userGuidance = 'Giữ đầu thẳng';
    } else if (reasons.includes(QUALITY_GATE_REASONS.LIGHTING_TOO_DARK)) {
      userGuidance = 'Ánh sáng chưa đủ';
    } else if (reasons.includes(QUALITY_GATE_REASONS.ONE_EYE_MISSING)) {
      userGuidance = 'Nhìn thẳng vào camera';
    }

    const isAcceptable = reasons.length === 0;
    const qualityScore = Math.max(0.0, 1.0 - reasons.length * 0.2);

    return {
      isAcceptable,
      qualityScore: Number(qualityScore.toFixed(2)),
      failureReasons: reasons,
      userGuidance,
      headPose: {
        yaw: Number(yawDeg.toFixed(1)),
        pitch: Number(pitchDeg.toFixed(1)),
        roll: Number(rollDeg.toFixed(1)),
        isValid: headPoseValid,
      },
      isBlinking,
      faceCentered,
      distanceValid,
      leftRoi,
      rightRoi,
    };
  }
}

// Shared default instance
export const sharedFrontendQualityGate = new FrontendQualityGate();
