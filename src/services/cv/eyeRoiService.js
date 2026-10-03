/**
 * REMICARE AI - EYE REGION OF INTEREST (ROI) & ALIGNMENT SERVICE
 * 
 * Computes tight, anatomical eye ROIs and roll-aligned ocular crops:
 * - Based strictly on inner canthus, outer canthus, upper lid, lower lid, and iris center.
 * - Does NOT use whole-face bounding box for eye isolation.
 * - Canthal axis roll angle: theta = atan2(outerY - innerY, outerX - innerX).
 * - Affine rotation centered on the anatomical eye center without clipping corners.
 */

import { LANDMARKS } from '../../constants/screeningConfig.js';

/**
 * Computes canthal roll angle theta = atan2(dy, dx) in radians.
 * @param {{x: number, y: number}} pInner
 * @param {{x: number, y: number}} pOuter
 * @returns {number}
 */
export function calculateCanthalRollAngle(pInner, pOuter) {
  if (!pInner || !pOuter) return 0.0;
  const dx = pOuter.x - pInner.x;
  const dy = pOuter.y - pInner.y;
  return Math.atan2(dy, dx);
}

/**
 * Computes anatomical ocular ROI metadata for an eye ('LEFT' or 'RIGHT').
 * 
 * @param {Array<{x: number, y: number}>} landmarks - MediaPipe 478 landmarks
 * @param {'LEFT'|'RIGHT'} eyeSide - 'LEFT' (Subject OS) or 'RIGHT' (Subject OD)
 * @param {number} [expansionX=1.7] - Horizontal padding factor relative to palpebral width
 * @param {number} [expansionY=2.0] - Vertical padding factor relative to palpebral fissure
 * @returns {{
 *   eyeSide: 'LEFT'|'RIGHT',
 *   cx: number,
 *   cy: number,
 *   canthalWidth: number,
 *   palpebralHeight: number,
 *   roiWidth: number,
 *   roiHeight: number,
 *   rollAngleRad: number,
 *   rollAngleDeg: number,
 *   bboxNorm: { xMin: number, yMin: number, width: number, height: number },
 *   irisNorm: { x: number, y: number } | null,
 *   isValid: boolean
 * } | null}
 */
export function calculateEyeRoi(landmarks, eyeSide = 'LEFT', expansionX = 1.7, expansionY = 2.0) {
  if (!landmarks || landmarks.length < 478) return null;

  const isLeft = eyeSide === 'LEFT';

  // Left Eye: Inner = 362, Outer = 263, Top = 386, Bot = 374, Iris = 473
  // Right Eye: Inner = 133, Outer = 33, Top = 159, Bot = 145, Iris = 468
  const innerIdx = isLeft ? LANDMARKS.LEFT_INNER_CORNER : LANDMARKS.RIGHT_INNER_CORNER;
  const outerIdx = isLeft ? LANDMARKS.LEFT_OUTER_CORNER : LANDMARKS.RIGHT_OUTER_CORNER;
  const topIdx = isLeft ? LANDMARKS.LEFT_TOP_LID : LANDMARKS.RIGHT_TOP_LID;
  const botIdx = isLeft ? LANDMARKS.LEFT_BOTTOM_LID : LANDMARKS.RIGHT_BOTTOM_LID;
  const irisIdx = isLeft ? LANDMARKS.LEFT_IRIS_CENTER : LANDMARKS.RIGHT_IRIS_CENTER;

  const pInner = landmarks[innerIdx];
  const pOuter = landmarks[outerIdx];
  const pTop = landmarks[topIdx];
  const pBot = landmarks[botIdx];
  const pIris = landmarks[irisIdx];

  if (!pInner || !pOuter || !Number.isFinite(pInner.x) || !Number.isFinite(pOuter.x)) {
    return null;
  }

  // 1. Anatomical Eye Center (midpoint of medial and lateral canthi)
  const cx = (pInner.x + pOuter.x) / 2.0;
  const cy = (pInner.y + pOuter.y) / 2.0;

  // 2. Canthal width & roll angle
  // Vector from inner canthus to outer canthus
  const dx = pOuter.x - pInner.x;
  const dy = pOuter.y - pInner.y;
  const canthalWidth = Math.max(0.015, Math.hypot(dx, dy));

  let rollAngleRad = Math.atan2(dy, dx);
  // For subject's right eye, outer is to the temple (dx < 0 in unmirrored camera coordinates)
  if (!isLeft && dx < 0) {
    rollAngleRad = Math.atan2(-dy, -dx);
  }
  const rollAngleDeg = (rollAngleRad * 180.0) / Math.PI;

  // 3. Palpebral fissure height
  const palpebralHeight = (pTop && pBot && Number.isFinite(pTop.y) && Number.isFinite(pBot.y))
    ? Math.max(0.005, Math.abs(pBot.y - pTop.y))
    : canthalWidth * 0.35;

  // 4. ROI Box dimensions with expansion padding
  const roiWidth = Math.min(0.40, canthalWidth * expansionX);
  const roiHeight = Math.min(0.30, Math.max(canthalWidth * 0.5, palpebralHeight * expansionY));

  // 5. Bounding box in normalized coordinates (clamped to [0, 1])
  const xMin = Math.max(0.0, cx - roiWidth / 2.0);
  const yMin = Math.max(0.0, cy - roiHeight / 2.0);
  const actualW = Math.min(1.0 - xMin, roiWidth);
  const actualH = Math.min(1.0 - yMin, roiHeight);

  const isValid = canthalWidth >= 0.02 && actualW > 0.03 && actualH > 0.02;

  return {
    eyeSide,
    cx: Number(cx.toFixed(4)),
    cy: Number(cy.toFixed(4)),
    canthalWidth: Number(canthalWidth.toFixed(4)),
    palpebralHeight: Number(palpebralHeight.toFixed(4)),
    roiWidth: Number(roiWidth.toFixed(4)),
    roiHeight: Number(roiHeight.toFixed(4)),
    rollAngleRad: Number(rollAngleRad.toFixed(4)),
    rollAngleDeg: Number(rollAngleDeg.toFixed(2)),
    bboxNorm: {
      xMin: Number(xMin.toFixed(4)),
      yMin: Number(yMin.toFixed(4)),
      width: Number(actualW.toFixed(4)),
      height: Number(actualH.toFixed(4)),
    },
    irisNorm: pIris && Number.isFinite(pIris.x) ? { x: pIris.x, y: pIris.y } : null,
    isValid,
  };
}

/**
 * EYE / IRIS ROI CROP
 * Public compatibility wrapper requested by the CV pipeline contract.
 * @param {Array<{x: number, y: number}>} landmarks
 * @param {'LEFT'|'RIGHT'|'left'|'right'} side
 * @returns {ReturnType<typeof calculateEyeRoi>}
 */
export function getEyeROI(landmarks, side = 'LEFT') {
  const normalizedSide = String(side).toUpperCase() === 'RIGHT' ? 'RIGHT' : 'LEFT';
  return calculateEyeRoi(landmarks, normalizedSide, 1.8, 2.0);
}

/**
 * Extracts a roll-aligned ocular crop from an active video element onto an HTML Canvas.
 * Directly applies affine rotation around the anatomical eye center without clipping.
 * 
 * @param {HTMLVideoElement} video
 * @param {Object} roiData - Return object from calculateEyeRoi
 * @param {number} [targetWidth=256]
 * @param {number} [targetHeight=128]
 * @param {HTMLCanvasElement|null} [targetCanvas=null]
 * @returns {HTMLCanvasElement|null}
 */
export function cropRollAlignedEye(
  video,
  roiData,
  targetWidth = 256,
  targetHeight = 128,
  targetCanvas = null
) {
  if (!video || video.readyState < 2 || !roiData || !roiData.isValid) {
    return null;
  }

  const vW = video.videoWidth;
  const vH = video.videoHeight;
  if (!vW || !vH) return null;

  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, targetWidth, targetHeight);

  // Eye center in pixel coordinates
  const cxPx = roiData.cx * vW;
  const cyPx = roiData.cy * vH;

  // Scaling factor: map roiWidth to targetWidth
  const roiWidthPx = Math.max(10, roiData.roiWidth * vW);
  const scale = targetWidth / roiWidthPx;

  ctx.save();
  // 1. Move origin to center of canvas
  ctx.translate(targetWidth / 2.0, targetHeight / 2.0);
  // 2. Rotate by negative roll angle to bring canthal axis strictly horizontal
  ctx.rotate(-roiData.rollAngleRad);
  // 3. Scale video to target crop size
  ctx.scale(scale, scale);
  // 4. Draw video centered at (-cxPx, -cyPx)
  ctx.drawImage(video, -cxPx, -cyPx);
  ctx.restore();

  return canvas;
}
