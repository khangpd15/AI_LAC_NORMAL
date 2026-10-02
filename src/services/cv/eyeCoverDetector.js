/**
 * EYE COVER DETECTOR (Nhận diện tự động bàn tay che mắt)
 * 
 * Sử dụng kết hợp đa đặc trưng:
 * 1. Độ tương phản con ngươi - củng mạc (Pupil-to-Sclera Radial Contrast):
 *    Mắt thật mở luôn có con ngươi tối ở giữa (minLum < 80) và củng mạc sáng hai bên (sidesLum > 115).
 *    Khi bàn tay (da/ngón tay) che mắt, tương phản này sụt giảm mạnh (< 9).
 * 2. Phân bố sắc tố da tay (Skin Chrominance): Da người có tỷ lệ R > G > B và (R - B) > 18.
 * 3. So sánh độ bất đối xứng (Asymmetry) giữa 2 mắt:
 *    Mắt khỏe mở to rõ ràng, trong khi mắt bị che mất con ngươi / phủ da tay.
 * 4. Tỷ lệ mở mí mắt (EAR - Eye Aspect Ratio): Khi tay áp vào hoặc nhắm mắt sau tay.
 * 5. Bộ lọc trễ thời gian (Hysteresis):
 *    - Che 1 mắt: 2 frames (~60ms) phản hồi siêu nhạy (< 100ms), không bị ảnh hưởng bởi chớp mắt hai bên.
 *    - Che cả 2 mắt / mặt: 3 frames (~90ms) lọc trọn vẹn chớp mắt tự nhiên.
 *    - Mở mắt: 2 frames (~60ms) lập tức sáng rõ trở lại khi hạ tay.
 */

import { LANDMARKS } from '../../constants/screeningConfig.js';

export class EyeCoverDetector {
  constructor() {
    // Canvas phụ 64x48 để trích xuất pixel nhanh gọn (< 1ms), không hao GPU/CPU
    this.canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (this.canvas) {
      this.canvas.width = 64;
      this.canvas.height = 48;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    this.isCovered = false;
    this.coveredSide = null;
    this.consecutiveCoverCount = 0;
    this.consecutiveUncoverCount = 0;
    this.lastFaceSeenTime = 0;
    this.faceSeenFrames = 0;
    this.lastLeftIris = null;
    this.lastRightIris = null;
  }

  /**
   * Reset toàn bộ trạng thái detector
   */
  reset() {
    this.isCovered = false;
    this.coveredSide = null;
    this.consecutiveCoverCount = 0;
    this.consecutiveUncoverCount = 0;
    this.lastFaceSeenTime = 0;
    this.faceSeenFrames = 0;
    this.lastLeftIris = null;
    this.lastRightIris = null;
  }

  /**
   * Trích xuất thống kê pixel (độ tương phản con ngươi - củng mạc, min/max lum, skin ratio)
   * Vùng mắt người luôn có:
   * - Con ngươi (pupil/iris) ở giữa: màu tối (minLum < 75..80, centerLum thấp)
   * - Củng mạc (sclera - lòng trắng) hai bên: màu sáng phản xạ ánh sáng (sidesLum > 115..160)
   * - pupilContrast = sidesLum - centerLum luôn cao (> 12..35).
   * Khi bàn tay (ngón tay, lòng bàn tay) che mắt:
   * - Mất hoàn toàn con ngươi tối và lòng trắng: pupilContrast < 9.
   * - Sắc tố da tay chiếm phần lớn diện tích (skinRatio > 0.70).
   */
  sampleEyePatch(video, cx, cy, width, height, destX, destY, destW, destH) {
    if (!this.ctx || !video || video.readyState < 2) {
      return {
        mean: 120,
        stdDev: 0,
        dynamicRange: 0,
        minLum: 255,
        maxLum: 0,
        pupilContrast: 0,
        centerLum: 120,
        sidesLum: 120,
        skinRatio: 0,
        isEyeLike: false,
      };
    }

    const vW = video.videoWidth;
    const vH = video.videoHeight;
    if (!vW || !vH) {
      return {
        mean: 120,
        stdDev: 0,
        dynamicRange: 0,
        minLum: 255,
        maxLum: 0,
        pupilContrast: 0,
        centerLum: 120,
        sidesLum: 120,
        skinRatio: 0,
        isEyeLike: false,
      };
    }

    const sx = Math.max(0, Math.min(vW - width, cx - width / 2));
    const sy = Math.max(0, Math.min(vH - height, cy - height / 2));
    const sw = Math.min(width, vW - sx);
    const sh = Math.min(height, vH - sy);

    if (sw <= 2 || sh <= 2) {
      return {
        mean: 120,
        stdDev: 0,
        dynamicRange: 0,
        minLum: 255,
        maxLum: 0,
        pupilContrast: 0,
        centerLum: 120,
        sidesLum: 120,
        skinRatio: 0,
        isEyeLike: false,
      };
    }

    try {
      this.ctx.drawImage(video, sx, sy, sw, sh, destX, destY, destW, destH);
      const imgData = this.ctx.getImageData(destX, destY, destW, destH).data;

      let sum = 0;
      let sumSq = 0;
      let minLum = 255;
      let maxLum = 0;

      let centerLumSum = 0;
      let centerCount = 0;
      let leftScleraSum = 0;
      let leftScleraCount = 0;
      let rightScleraSum = 0;
      let rightScleraCount = 0;
      let skinPixelCount = 0;

      const totalPixels = destW * destH;

      for (let py = 0; py < destH; py++) {
        for (let px = 0; px < destW; px++) {
          const idx = (py * destW + px) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];
          // Độ chói Luminance ITU-R BT.601
          const lum = r * 0.299 + g * 0.587 + b * 0.114;

          sum += lum;
          sumSq += lum * lum;
          if (lum < minLum) minLum = lum;
          if (lum > maxLum) maxLum = lum;

          // Nhận diện sắc thái da tay (R > G > B, chênh lệch đỏ - xanh > 18)
          if (r > g && g > b && (r - b) > 18 && lum > 45) {
            skinPixelCount++;
          }

          // Vùng con ngươi trung tâm (x: 11..20, y: 6..17 trên patch 32x24)
          if (px >= 11 && px <= 20 && py >= 6 && py <= 17) {
            centerLumSum += lum;
            centerCount++;
          }
          // Vùng củng mạc bên trái (x: 2..9, y: 7..16)
          else if (px >= 2 && px <= 9 && py >= 7 && py <= 16) {
            leftScleraSum += lum;
            leftScleraCount++;
          }
          // Vùng củng mạc bên phải (x: 22..29, y: 7..16)
          else if (px >= 22 && px <= 29 && py >= 7 && py <= 16) {
            rightScleraSum += lum;
            rightScleraCount++;
          }
        }
      }

      const mean = sum / totalPixels;
      const variance = Math.max(0, sumSq / totalPixels - mean * mean);
      const stdDev = Math.sqrt(variance);
      const dynamicRange = maxLum - minLum;

      const centerLum = centerCount > 0 ? centerLumSum / centerCount : mean;
      const leftScleraLum = leftScleraCount > 0 ? leftScleraSum / leftScleraCount : mean;
      const rightScleraLum = rightScleraCount > 0 ? rightScleraSum / rightScleraCount : mean;
      const sidesLum = Math.max(leftScleraLum, rightScleraLum);

      // Độ tương phản giữa lòng trắng và con ngươi
      const pupilContrast = Math.max(0, sidesLum - centerLum);
      const skinRatio = skinPixelCount / totalPixels;

      // Đặc trưng mắt thật mở rõ
      const isEyeLike = pupilContrast >= 12 && minLum < 85 && dynamicRange >= 28;

      return {
        mean,
        stdDev,
        dynamicRange,
        minLum,
        maxLum,
        pupilContrast,
        centerLum,
        sidesLum,
        skinRatio,
        isEyeLike,
      };
    } catch {
      return {
        mean: 120,
        stdDev: 0,
        dynamicRange: 0,
        minLum: 255,
        maxLum: 0,
        pupilContrast: 0,
        centerLum: 120,
        sidesLum: 120,
        skinRatio: 0,
        isEyeLike: false,
      };
    }
  }

  /**
   * Phân tích realtime từng frame từ video và landmarks MediaPipe FaceMesh
   * @param {HTMLVideoElement} video 
   * @param {Array<Array<{x:number, y:number, z?:number}>>} multiFaceLandmarks 
   * @returns {{ isCovered: boolean, side: 'left'|'right'|'both'|null }}
   */
  detect(video, multiFaceLandmarks) {
    if (!video || video.readyState < 2) {
      return { isCovered: this.isCovered, side: this.coveredSide };
    }

    const vW = video.videoWidth;
    const vH = video.videoHeight;
    const now = performance.now();

    // =========================================================================
    // TRƯỜNG HỢP 1: MediaPipe nhận diện được khuôn mặt
    // =========================================================================
    if (multiFaceLandmarks && multiFaceLandmarks.length > 0) {
      this.lastFaceSeenTime = now;
      this.faceSeenFrames = (this.faceSeenFrames || 0) + 1;
      const lm = multiFaceLandmarks[0];

      // Mắt Trái người dùng (MediaPipe: 473 iris, 362 inner, 263 outer, 386 top, 374 bot)
      const pLeftInner = lm[LANDMARKS.LEFT_INNER_CORNER] || lm[362];
      const pLeftOuter = lm[LANDMARKS.LEFT_OUTER_CORNER] || lm[263];
      const pLeftTop = lm[LANDMARKS.LEFT_TOP_LID] || lm[386];
      const pLeftBot = lm[LANDMARKS.LEFT_BOTTOM_LID] || lm[374];
      const pLeftIris = lm[LANDMARKS.LEFT_IRIS_CENTER] || lm[473];

      // Mắt Phải người dùng (MediaPipe: 468 iris, 133 inner, 33 outer, 159 top, 145 bot)
      const pRightInner = lm[LANDMARKS.RIGHT_INNER_CORNER] || lm[133];
      const pRightOuter = lm[LANDMARKS.RIGHT_OUTER_CORNER] || lm[33];
      const pRightTop = lm[LANDMARKS.RIGHT_TOP_LID] || lm[159];
      const pRightBot = lm[LANDMARKS.RIGHT_BOTTOM_LID] || lm[145];
      const pRightIris = lm[LANDMARKS.RIGHT_IRIS_CENTER] || lm[468];

      const hasLeftLandmarks = Boolean(pLeftInner && pLeftOuter && pLeftTop && pLeftBot);
      const hasRightLandmarks = Boolean(pRightInner && pRightOuter && pRightTop && pRightBot);

      if (hasLeftLandmarks && hasRightLandmarks) {
        // 1. Tính Eye Aspect Ratio (EAR)
        const leftCanthal = Math.max(0.001, Math.hypot(pLeftOuter.x - pLeftInner.x, pLeftOuter.y - pLeftInner.y));
        const leftVertical = Math.hypot(pLeftTop.x - pLeftBot.x, pLeftTop.y - pLeftBot.y);
        const leftEAR = leftVertical / (2 * leftCanthal);

        const rightCanthal = Math.max(0.001, Math.hypot(pRightOuter.x - pRightInner.x, pRightOuter.y - pRightInner.y));
        const rightVertical = Math.hypot(pRightTop.x - pRightBot.x, pRightTop.y - pRightBot.y);
        const rightEAR = rightVertical / (2 * rightCanthal);

        // 2. Kích thước & tọa độ pixel vùng mắt
        const leftCenterX = (pLeftIris?.x ?? (pLeftInner.x + pLeftOuter.x) / 2) * vW;
        const leftCenterY = (pLeftIris?.y ?? (pLeftTop.y + pLeftBot.y) / 2) * vH;
        const leftCropW = Math.max(26, leftCanthal * 1.5 * vW);
        const leftCropH = Math.max(20, leftCropW * 0.7);

        const rightCenterX = (pRightIris?.x ?? (pRightInner.x + pRightOuter.x) / 2) * vW;
        const rightCenterY = (pRightIris?.y ?? (pRightTop.y + pRightBot.y) / 2) * vH;
        const rightCropW = Math.max(26, rightCanthal * 1.5 * vW);
        const rightCropH = Math.max(20, rightCropW * 0.7);

        // 3. Trích xuất thống kê pixel 2 vùng mắt
        const leftPatch = this.sampleEyePatch(video, leftCenterX, leftCenterY, leftCropW, leftCropH, 0, 0, 32, 24);
        const rightPatch = this.sampleEyePatch(video, rightCenterX, rightCenterY, rightCropW, rightCropH, 32, 0, 32, 24);

        // 4. Nhận diện mắt mở sáng rõ (Open Eye Signature)
        const leftIsOpen = (leftPatch.pupilContrast >= 12 && leftPatch.minLum < 85) ||
                           (leftPatch.pupilContrast >= 9 && leftEAR >= 0.15) ||
                           (leftPatch.minLum < 75 && leftEAR >= 0.14);

        const rightIsOpen = (rightPatch.pupilContrast >= 12 && rightPatch.minLum < 85) ||
                            (rightPatch.pupilContrast >= 9 && rightEAR >= 0.15) ||
                            (rightPatch.minLum < 75 && rightEAR >= 0.14);

        // 5. Kiểm tra che MỘT BÊN MẮT (Asymmetric Occlusion)
        // Khi người dùng che Mắt Trái: Mắt Phải mở rõ, Mắt Trái mất tương phản con ngươi hoặc phủ da tay
        const leftOccludedByHand = rightIsOpen && (
          (leftPatch.pupilContrast < 9) ||
          (leftPatch.pupilContrast < rightPatch.pupilContrast * 0.42) ||
          (leftPatch.minLum > rightPatch.minLum + 22) ||
          (leftPatch.skinRatio > 0.70 && leftPatch.pupilContrast < 11) ||
          (leftEAR < 0.12 && rightEAR >= 0.16) ||
          (leftPatch.stdDev < 11 && rightPatch.stdDev >= 14)
        );

        // Khi người dùng che Mắt Phải: Mắt Trái mở rõ, Mắt Phải mất tương phản con ngươi hoặc phủ da tay
        const rightOccludedByHand = leftIsOpen && (
          (rightPatch.pupilContrast < 9) ||
          (rightPatch.pupilContrast < leftPatch.pupilContrast * 0.42) ||
          (rightPatch.minLum > leftPatch.minLum + 22) ||
          (rightPatch.skinRatio > 0.70 && rightPatch.pupilContrast < 11) ||
          (rightEAR < 0.12 && leftEAR >= 0.16) ||
          (rightPatch.stdDev < 11 && leftPatch.stdDev >= 14)
        );

        // 6. Kiểm tra che CẢ HAI MẮT (Bilateral Occlusion khi FaceMesh vẫn nhận diện mặt)
        const bothLackPupil = (leftPatch.pupilContrast < 9 && rightPatch.pupilContrast < 9) &&
                              (leftPatch.minLum > 75 || rightPatch.minLum > 75);
        const bothSkinCovered = (leftPatch.skinRatio > 0.68 && rightPatch.skinRatio > 0.68 &&
                                 leftPatch.pupilContrast < 12 && rightPatch.pupilContrast < 12);
        const bothFlatTexture = (leftPatch.dynamicRange < 24 && rightPatch.dynamicRange < 24 &&
                                 leftPatch.stdDev < 12 && rightPatch.stdDev < 12);
        const bothEyesClosed = (leftEAR < 0.11 && rightEAR < 0.11);

        const bothOccluded = bothLackPupil || bothSkinCovered || bothFlatTexture;

        let frameCovered = false;
        let detectedSide = null;

        if (bothOccluded) {
          frameCovered = true;
          detectedSide = 'both';
        } else if (leftOccludedByHand && !rightOccludedByHand) {
          frameCovered = true;
          detectedSide = 'left';
        } else if (rightOccludedByHand && !leftOccludedByHand) {
          frameCovered = true;
          detectedSide = 'right';
        } else if (bothEyesClosed) {
          // Nhắm cả 2 mắt (hoặc chớp mắt): Không kích hoạt che 1 bên mắt
          frameCovered = false;
        }

        this.updateHysteresis(frameCovered, detectedSide);
        return { isCovered: this.isCovered, side: this.coveredSide };
      }
    } else {
      // =======================================================================
      // TRƯỜNG HỢP 2: MediaPipe mất landmark khuôn mặt
      // Nếu trước đó đang nhìn thẳng vào camera mà nay che cả 2 mắt / che mặt:
      // =======================================================================
      const faceWasRecentlySeen = (now - this.lastFaceSeenTime) < 3500 && (this.faceSeenFrames || 0) >= 2;
      if (faceWasRecentlySeen) {
        this.updateHysteresis(true, 'both');
      } else {
        this.updateHysteresis(false, null);
      }
      return { isCovered: this.isCovered, side: this.coveredSide };
    }

    return { isCovered: this.isCovered, side: this.coveredSide };
  }

  /**
   * Bộ lọc trễ Hysteresis:
   * - Che 1 bên mắt (trái/phải): 2 frames liên tiếp (~60ms) -> siêu nhạy, cảm nhận tức thì.
   * - Che cả 2 mắt / mặt: 3 frames liên tiếp (~90ms) -> tránh chớp mắt tự nhiên gây giật hình.
   * - Mở mắt: 2 frames liên tiếp (~60ms) -> sáng rõ trở lại ngay khi hạ tay.
   */
  updateHysteresis(frameCovered, side) {
    if (frameCovered) {
      this.consecutiveCoverCount++;
      this.consecutiveUncoverCount = 0;
      const requiredFrames = (side === 'both') ? 3 : 2;

      if (this.consecutiveCoverCount >= requiredFrames) {
        this.isCovered = true;
        this.coveredSide = side || 'one_eye';
      }
    } else {
      this.consecutiveUncoverCount++;
      this.consecutiveCoverCount = 0;
      if (this.consecutiveUncoverCount >= 2) {
        this.isCovered = false;
        this.coveredSide = null;
      }
    }
  }
}

// Singleton tiện dụng
export const eyeCoverDetector = new EyeCoverDetector();
