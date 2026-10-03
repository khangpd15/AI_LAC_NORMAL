/**
 * REMICARE - CANONICAL EYE COORDINATE & ORIENTATION MAPPING
 * 
 * Provides a single source of truth for:
 * 1. Canonical Anatomical Eye representation (LEFT vs RIGHT)
 * 2. Camera mirror coordinate transformations (mirrored = true vs false)
 * 3. Screen display mapping (screen-left vs screen-right)
 * 4. Dataset & sampling eye labels
 */

export const ANATOMICAL_EYE = Object.freeze({
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
});

/**
 * Normalizes any eye identifier string (e.g. 'left', 'Left', 'LEFT') to canonical ANATOMICAL_EYE.
 * @param {string|null} eye
 * @returns {'LEFT'|'RIGHT'|null}
 */
export function toCanonicalEye(eye) {
  if (!eye) return null;
  const upper = String(eye).trim().toUpperCase();
  if (upper === 'LEFT' || upper === 'L') return ANATOMICAL_EYE.LEFT;
  if (upper === 'RIGHT' || upper === 'R') return ANATOMICAL_EYE.RIGHT;
  return null;
}

/**
 * Determines the opposite anatomical eye.
 * @param {'LEFT'|'RIGHT'|string} eye
 * @returns {'LEFT'|'RIGHT'|null}
 */
export function getOppositeEye(eye) {
  const canonical = toCanonicalEye(eye);
  if (!canonical) return null;
  return canonical === ANATOMICAL_EYE.LEFT ? ANATOMICAL_EYE.RIGHT : ANATOMICAL_EYE.LEFT;
}

/**
 * Projects 2D point `pt` onto the line segment `start -> end` and returns scalar ratio.
 * Invariant to 2D in-plane head tilt (canthal roll).
 * 
 * @param {{x: number, y: number}} pt
 * @param {{x: number, y: number}} start
 * @param {{x: number, y: number}} end
 * @returns {number} Normalized projection ratio (nominally ~0.5 at center)
 */
export function projectPointOntoSegment(pt, start, end) {
  if (!pt || !start || !end) return 0.5;

  const lineDx = end.x - start.x;
  const lineDy = end.y - start.y;
  const ptDx = pt.x - start.x;
  const ptDy = pt.y - start.y;

  const lineLenSq = lineDx * lineDx + lineDy * lineDy;
  if (lineLenSq < 1e-8) return 0.5;

  const projection = (ptDx * lineDx + ptDy * lineDy) / lineLenSq;
  return Number.isFinite(projection) ? projection : 0.5;
}

/**
 * Maps an anatomical eye to its horizontal screen position class based on camera mirroring.
 * 
 * Coordinate transformation geometry:
 * 1. User anatomical position:
 *    - User's LEFT eye is on user's left side.
 *    - User's RIGHT eye is on user's right side.
 * 
 * 2. Unmirrored Camera Sensor (camera facing user):
 *    - User's LEFT eye appears at camera frame-right (x > 0.5, screen right if unmirrored).
 *    - User's RIGHT eye appears at camera frame-left (x < 0.5, screen left if unmirrored).
 * 
 * 3. Mirrored Display (scaleX(-1), standard selfie webcam mode):
 *    - Horizontally flips the camera stream.
 *    - User's LEFT eye appears at screen-left (CSS left: 0).
 *    - User's RIGHT eye appears at screen-right (CSS right: 0).
 *    - This matches looking in a mirror: raising your left hand moves the left side of the screen.
 * 
 * @param {'LEFT'|'RIGHT'|string} anatomicalEye
 * @param {boolean} [isMirrored=true] - Whether camera video feed has scaleX(-1) applied
 * @returns {'screen-left'|'screen-right'}
 */
export function getEyeScreenPosition(anatomicalEye, isMirrored = true) {
  const canonical = toCanonicalEye(anatomicalEye);
  if (!canonical) return 'screen-left';

  if (isMirrored) {
    // In mirrored mode (scaleX(-1)):
    // Anatomical LEFT -> screen-left (left side of display)
    // Anatomical RIGHT -> screen-right (right side of display)
    return canonical === ANATOMICAL_EYE.LEFT ? 'screen-left' : 'screen-right';
  } else {
    // In non-mirrored mode:
    // Anatomical LEFT -> screen-right
    // Anatomical RIGHT -> screen-left
    return canonical === ANATOMICAL_EYE.LEFT ? 'screen-right' : 'screen-left';
  }
}

/**
 * Returns CSS class for camera occluder overlay.
 * @param {'LEFT'|'RIGHT'|string} coveredEye
 * @param {boolean} [isMirrored=true]
 * @returns {'occluder-screen-left'|'occluder-screen-right'}
 */
export function getOccluderScreenClass(coveredEye, isMirrored = true) {
  const pos = getEyeScreenPosition(coveredEye, isMirrored);
  return pos === 'screen-left' ? 'occluder-screen-left' : 'occluder-screen-right';
}

/**
 * Returns CSS class for camera tracked indicator reticle.
 * @param {'LEFT'|'RIGHT'|string} trackedEye
 * @param {boolean} [isMirrored=true]
 * @returns {'target-screen-left'|'target-screen-right'}
 */
export function getTrackedEyeScreenClass(trackedEye, isMirrored = true) {
  const pos = getEyeScreenPosition(trackedEye, isMirrored);
  return pos === 'screen-left' ? 'target-screen-left' : 'target-screen-right';
}

/**
 * Standardized eye label for sampling datasets and AI research.
 * @param {'LEFT'|'RIGHT'|string} eye
 * @returns {'LEFT'|'RIGHT'|null}
 */
export function getSamplingEyeLabel(eye) {
  return toCanonicalEye(eye);
}

/**
 * Returns localized Vietnamese user instruction for covering an eye.
 * @param {'LEFT'|'RIGHT'|string} coveredEye
 * @returns {{ title: string, text: string, subtext: string, speechText: string }}
 */
export function getCoverInstruction(coveredEye) {
  const canonical = toCanonicalEye(coveredEye);
  if (canonical === ANATOMICAL_EYE.LEFT) {
    return {
      title: 'Che mắt trái',
      text: 'Dùng tay che kín mắt trái của bạn.',
      subtext: 'Mắt phải tiếp tục nhìn thẳng vào chấm tròn đỏ ở giữa.',
      speechText: 'Che mắt trái nghen.',
    };
  }
  return {
    title: 'Che mắt phải',
    text: 'Dùng tay che kín mắt phải của bạn.',
    subtext: 'Mắt trái tiếp tục nhìn thẳng vào chấm tròn đỏ ở giữa.',
    speechText: 'Che mắt phải nghen.',
  };
}
