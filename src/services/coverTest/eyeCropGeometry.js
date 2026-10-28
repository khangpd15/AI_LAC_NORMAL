import { LEFT_EYE_CONTOUR, RIGHT_EYE_CONTOUR } from '../cv/strabismusEngine.js';

const finitePoint = p => Number.isFinite(p?.x) && Number.isFinite(p?.y);

// Rectangles are always in the declared source image's pixels, never preview
// pixels. No mirroring or inferred eyelid coordinates are applied here.
export function getEyeCropRegion(landmarks, eye, sourceWidth, sourceHeight) {
  if (!['left', 'right'].includes(eye) || !Number.isInteger(sourceWidth) || !Number.isInteger(sourceHeight) ||
      sourceWidth <= 0 || sourceHeight <= 0) return null;
  const indices = eye === 'left' ? LEFT_EYE_CONTOUR : RIGHT_EYE_CONTOUR;
  const [inner, outer, iris] = eye === 'left' ? [362, 263, 473] : [133, 33, 468];
  if (![inner, outer, iris].every(i => finitePoint(landmarks?.[i]))) return null;
  const a = landmarks[inner], b = landmarks[outer];
  const eyeWidth = Math.hypot((a.x - b.x) * sourceWidth, (a.y - b.y) * sourceHeight);
  if (eyeWidth < 6) return null;
  const points = indices.filter(i => finitePoint(landmarks[i])).map(i => landmarks[i]);
  // Partial contours still use observed points and canthal padding, not made-up lids.
  points.push(a, b, landmarks[iris]);
  const xs = points.map(p => p.x * sourceWidth), ys = points.map(p => p.y * sourceHeight);
  const padX = eyeWidth * 0.25;
  const padY = Math.max(eyeWidth * 0.35, (Math.max(...ys) - Math.min(...ys)) * 0.85);
  const x = Math.max(0, Math.floor(Math.min(...xs) - padX));
  const y = Math.max(0, Math.floor(Math.min(...ys) - padY));
  const right = Math.min(sourceWidth, Math.ceil(Math.max(...xs) + padX));
  const bottom = Math.min(sourceHeight, Math.ceil(Math.max(...ys) + padY));
  const width = right - x, height = bottom - y;
  return width >= 8 && height >= 8 ? { x, y, width, height } : null;
}

export function getEyePairCropRegions(landmarks, sourceWidth, sourceHeight) {
  const left = getEyeCropRegion(landmarks, 'left', sourceWidth, sourceHeight);
  const right = getEyeCropRegion(landmarks, 'right', sourceWidth, sourceHeight);
  return left && right ? { left, right } : null;
}
