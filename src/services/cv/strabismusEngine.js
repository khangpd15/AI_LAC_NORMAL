/**
 * REMICARE AI - STRABISMUS SIMULATION ENGINE
 * 
 * Clinical & Computer Vision Real-Time Strabismus Warping & Hirschberg Simulation
 * 
 * Capabilities:
 * - Real-time ocular warping for Esotropia, Exotropia, Hypertropia, Hypotropia, and Custom gaze
 * - Anatomical eyelid contour clipping (palpebral fissure isolation)
 * - Continuous texture deformation preserving captured sclera lighting and detail
 * - Rigid visible-iris translation with local sclera repair and lid protection
 * - Hirschberg Corneal Light Reflex simulation with clinical prism diopter calculation
 * - Biometric HUD telemetry overlay (Canthal axes, deviation vectors, iris tracking)
 * - High-resolution annotated clinical snapshot generator
 */

import { LANDMARKS } from '../../constants/screeningConfig.js';

export const STRABISMUS_TYPES = {
  ORTHOTROPIA: 'ORTHOTROPIA',   // Mắt thẳng trục (Bình thường)
  ESOTROPIA: 'ESOTROPIA',       // Lác trong (Mắt lệch vào sống mũi)
  EXOTROPIA: 'EXOTROPIA',       // Lác ngoài (Mắt lệch ra thái dương)
  HYPERTROPIA: 'HYPERTROPIA',   // Lác trên (Mắt lệch lên trên)
  HYPOTROPIA: 'HYPOTROPIA',     // Lác dưới (Mắt lệch xuống dưới)
  CUSTOM: 'CUSTOM',             // Tự do (Điều khiển bằng joystick 360°)
};

export const AFFECTED_EYE = {
  RIGHT: 'RIGHT', // Mắt Phải (OD - Oculus Dexter)
  LEFT: 'LEFT',   // Mắt Trái (OS - Oculus Sinister)
  BOTH: 'BOTH',   // Cả hai mắt
  ALTERNATING: 'ALTERNATING', // Lác luân phiên đổi mắt
};

export const LEFT_EYE_CONTOUR = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
export const RIGHT_EYE_CONTOUR = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];

/**
 * Calculates 2D Euclidean distance between two points
 */
function dist2D(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Normalizes a 2D vector
 */
function normalize2D(v) {
  const len = Math.hypot(v.x, v.y);
  if (len < 0.00001) return { x: 0, y: 0, len: 0 };
  return { x: v.x / len, y: v.y / len, len };
}

/**
 * Converts deviation angle in degrees to Prism Diopters (Δ)
 * Clinical rule of thumb: 1 degree ≈ 1.75 - 2.0 Prism Diopters (approx. 1 mm = 15 - 20 Δ)
 */
export function angleToPrismDiopters(angleDeg) {
  return Math.round(100 * Math.tan((angleDeg * Math.PI) / 180));
}

/**
 * Extracts anatomical landmarks and vectors for a given eye side
 */
export function getEyeAnatomicalFrame(landmarks, eyeSide, canvasW, canvasH) {
  if (!landmarks || landmarks.length < 478) return null;

  const isLeft = eyeSide === AFFECTED_EYE.LEFT;
  const contourIndices = isLeft ? LEFT_EYE_CONTOUR : RIGHT_EYE_CONTOUR;

  // Key landmarks
  const innerIdx = isLeft ? LANDMARKS.LEFT_INNER_CANTHUS : LANDMARKS.RIGHT_INNER_CANTHUS;
  const outerIdx = isLeft ? LANDMARKS.LEFT_OUTER_CANTHUS : LANDMARKS.RIGHT_OUTER_CANTHUS;
  const topIdx = isLeft ? LANDMARKS.LEFT_TOP_LID : LANDMARKS.RIGHT_TOP_LID;
  const botIdx = isLeft ? LANDMARKS.LEFT_BOTTOM_LID : LANDMARKS.RIGHT_BOTTOM_LID;
  const irisCenterIdx = isLeft ? LANDMARKS.LEFT_IRIS_CENTER : LANDMARKS.RIGHT_IRIS_CENTER;
  const irisPerimeterIndices = isLeft ? LANDMARKS.LEFT_IRIS_PERIMETER : LANDMARKS.RIGHT_IRIS_PERIMETER;

  const required = [...contourIndices, innerIdx, outerIdx, topIdx, botIdx, irisCenterIdx, ...irisPerimeterIndices];
  if (required.some(index => !Number.isFinite(landmarks[index]?.x) || !Number.isFinite(landmarks[index]?.y))) return null;
  const toPx = (pt) => ({ x: pt.x * canvasW, y: pt.y * canvasH, z: pt.z ? pt.z * canvasW : 0 });

  const pInner = toPx(landmarks[innerIdx]);
  const pOuter = toPx(landmarks[outerIdx]);
  const pTop = toPx(landmarks[topIdx]);
  const pBot = toPx(landmarks[botIdx]);
  const pIris = toPx(landmarks[irisCenterIdx]);

  if (!pInner || !pOuter || !pIris) return null;

  // Palpebral aperture height (check if eyes are closed / blinking)
  const palpebralHeight = dist2D(pTop, pBot);
  const canthalWidth = dist2D(pInner, pOuter);
  const isBlinking = canthalWidth < 4 || palpebralHeight < canthalWidth * 0.16;

  // Iris Radius calculation from perimeter landmarks
  let rIris = canthalWidth * 0.22;
  if (irisPerimeterIndices && irisPerimeterIndices.length >= 4) {
    let rSum = 0;
    for (let idx of irisPerimeterIndices) {
      if (landmarks[idx]) {
        rSum += dist2D(pIris, toPx(landmarks[idx]));
      }
    }
    if (rSum > 0) {
      rIris = Math.max(canthalWidth * 0.15, Math.min(canthalWidth * 0.35, rSum / irisPerimeterIndices.length));
    }
  }

  // Contour polygon points in pixels
  const contourPts = contourIndices.map((idx) => toPx(landmarks[idx]));

  // Anatomical directional vectors
  // Nasal: from outer canthus towards inner canthus (towards nose)
  const vecNasal = normalize2D({ x: pInner.x - pOuter.x, y: pInner.y - pOuter.y });
  // Temporal: from inner canthus towards outer canthus (towards temple)
  const vecTemporal = { x: -vecNasal.x, y: -vecNasal.y };
  // Superior (Up): vector from bottom lid to top lid (towards eyebrow)
  const vecUp = normalize2D({ x: pTop.x - pBot.x, y: pTop.y - pBot.y });
  // Inferior (Down): vector from top lid to bottom lid
  const vecDown = { x: -vecUp.x, y: -vecUp.y };

  return {
    eyeSide,
    isLeft,
    pInner,
    pOuter,
    pTop,
    pBot,
    pIris,
    rIris,
    canthalWidth,
    palpebralHeight,
    isBlinking,
    contourPts,
    vecNasal,
    vecTemporal,
    vecUp,
    vecDown,
  };
}

/**
 * Calculates the shift displacement vector in canvas pixels for a given strabismus configuration
 */
export function calculateStrabismusShift(frame, config) {
  if (!frame || frame.isBlinking) return { x: 0, y: 0, distance: 0, angleDeg: 0, prismDiopters: 0 };

  const { type, angleDeg = 24, customVector = { x: 0, y: 0 } } = config;

  if (type === STRABISMUS_TYPES.ORTHOTROPIA || angleDeg <= 0.1) {
    return { x: 0, y: 0, distance: 0, angleDeg: 0, prismDiopters: 0 };
  }

  // Project a rotating eyeball instead of pushing a flat disk to the canthus.
  const canthalW = frame.canthalWidth || frame.rIris * 4.5;
  const boundedAngle = Math.min(35, Math.max(0, angleDeg));
  let distance = canthalW * 0.56 * Math.sin(boundedAngle * Math.PI / 180);

  let dir = { x: 0, y: 0 };

  switch (type) {
    case STRABISMUS_TYPES.ESOTROPIA:
      // Lác trong: Mắt hướng về sống mũi
      dir = frame.vecNasal;
      break;

    case STRABISMUS_TYPES.EXOTROPIA:
      // Lác ngoài: Mắt hướng về thái dương
      dir = frame.vecTemporal;
      break;

    case STRABISMUS_TYPES.HYPERTROPIA:
      // Lác trên: Mắt hướng lên trên
      dir = frame.vecUp;
      break;

    case STRABISMUS_TYPES.HYPOTROPIA:
      // Lác dưới: Mắt hướng xuống dưới
      dir = frame.vecDown;
      break;

    case STRABISMUS_TYPES.CUSTOM: {
      // Custom 2D joystick coordinates (jx: -1..1 nasal/temporal, jy: -1..1 up/down)
      const jx = customVector.x || 0;
      const jy = customVector.y || 0;
      // Combine anatomical vectors
      const combinedX = frame.vecNasal.x * -jx + frame.vecDown.x * jy;
      const combinedY = frame.vecNasal.y * -jx + frame.vecDown.y * jy;
      dir = normalize2D({ x: combinedX, y: combinedY });
      distance *= Math.min(1, Math.hypot(jx, jy));
      break;
    }

    default:
      dir = { x: 0, y: 0 };
  }

  const shiftX = dir.x * distance;
  const shiftY = dir.y * distance;

  return {
    x: shiftX,
    y: shiftY,
    distance,
    angleDeg: boundedAngle,
    prismDiopters: angleToPrismDiopters(boundedAngle),
    dir,
  };
}

/** Monotone cubic inverse mapping: no folds, holes or duplicated iris edges. */
export function resampleEyeScanline(position, target, source) {
  const widths = [0, 1, 2].map(i => target[i + 1] - target[i]);
  const slopes = widths.map((width, i) => (source[i + 1] - source[i]) / width);
  const tangent = [slopes[0], 0, 0, slopes[2]];
  for (let i = 1; i < 3; i++) {
    const w1 = 2 * widths[i] + widths[i - 1];
    const w2 = widths[i] + 2 * widths[i - 1];
    tangent[i] = (w1 + w2) / (w1 / slopes[i - 1] + w2 / slopes[i]);
  }
  const segment = position < target[1] ? 0 : position < target[2] ? 1 : 2;
  // The iris is a rigid projected surface. A cubic through all four knots
  // changes pupil width across its centre as the surrounding sclera stretches.
  // Keep its inverse scale constant; ease only the sclera on either side.
  if (segment === 1) return source[1] + (position - target[1]) * slopes[1];
  tangent[1] = Math.min(slopes[1], 3 * slopes[0]);
  tangent[2] = Math.min(slopes[1], 3 * slopes[2]);
  const t = Math.max(0, Math.min(1, (position - target[segment]) / widths[segment]));
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * source[segment] + (t3 - 2 * t2 + t) * widths[segment] * tangent[segment]
    + (-2 * t3 + 3 * t2) * source[segment + 1] + (t3 - t2) * widths[segment] * tangent[segment + 1];
}

// Retain small deviations, then approach the available texture budget smoothly.
// A hard clamp varies abruptly between neighbouring rows and bends the iris.
export function limitEyeDisplacement(requested, capacity, lowAngleDistance) {
  if (capacity <= 0) return 0;
  const knee = Math.min(lowAngleDistance, capacity * 0.65);
  if (requested <= knee) return requested;
  const remaining = capacity - knee;
  return knee + remaining * -Math.expm1(-(requested - knee) / remaining);
}

export function eyeScanlineBounds(polygon, cross) {
  const crossings = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if ((a.y <= cross && b.y > cross) || (b.y <= cross && a.y > cross)) crossings.push(a.x + (b.x - a.x) * (cross - a.y) / (b.y - a.y));
  }
  return crossings.length >= 2 ? [Math.min(...crossings), Math.max(...crossings)] : null;
}

export function getIrisTravelCapacity(polygon, radius, allowLidOcclusion = false) {
  const middle = eyeScanlineBounds(polygon, 0);
  if (!middle) return 0;
  // Strong inward gaze may pass beneath the fixed nasal lid. Bound the centre
  // only; the destination lid mask handles the hidden part of the round iris.
  if (allowLidOcclusion) return Math.max(0, middle[1] - Math.max(1, radius * 0.12));
  const slices = [];
  // Measure visible iris area inside the actual lids. Requiring a whole circle
  // on fixed rows incorrectly blocks movement in naturally narrow eye openings.
  for (let i = 0; i < 32; i++) {
    const y = radius * (-1 + (i + 0.5) / 16);
    const bounds = eyeScanlineBounds(polygon, y);
    if (bounds) slices.push({ bounds, halfWidth: Math.sqrt(radius * radius - y * y) });
  }
  const visibleArea = shift => slices.reduce((sum, { bounds, halfWidth }) =>
    sum + Math.max(0, Math.min(bounds[1], shift + halfWidth) - Math.max(bounds[0], shift - halfWidth)), 0);
  const originalArea = visibleArea(0);
  if (originalArea <= 0) return 0;
  let low = 0;
  let high = Math.max(0, middle[1] - radius * 0.85 - Math.max(1, radius * 0.08));
  if (visibleArea(high) >= originalArea * 0.94) return high;
  for (let i = 0; i < 18; i++) {
    const mid = (low + high) / 2;
    if (visibleArea(mid) >= originalArea * 0.94) low = mid;
    else high = mid;
  }
  return low;
}

export function selectScleraSamples(candidates, irisColor) {
  const luminance = color => color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  const irisLight = luminance(irisColor);
  const clean = candidates.filter(({ color }) => {
    const light = luminance(color);
    // Visible sclera is brighter than the pupil and less red than eyelid skin.
    // All thresholds are relative to captured colours, including in dim light.
    return light > irisLight + Math.max(6, irisLight * 0.12)
      && color[0] - color[1] < Math.max(12, light * 0.18)
      && color[0] - color[2] < Math.max(28, light * 0.35);
  });
  const selected = [];
  // Trim shadows and glints independently on each side so a naturally darker
  // side keeps its lighting rather than borrowing only the brightest white.
  for (const side of [-1, 1]) {
    const group = clean.filter(({ x }) => (x < 0 ? -1 : 1) === side)
      .sort((a, b) => luminance(a.color) - luminance(b.color));
    if (!group.length) continue;
    const low = luminance(group[Math.floor((group.length - 1) * 0.55)].color);
    const high = luminance(group[Math.ceil((group.length - 1) * 0.9)].color);
    const reliable = group.filter(({ color }) => luminance(color) >= low && luminance(color) <= high);
    // Bound the per-pixel interpolation cost independently of eye resolution.
    const stride = Math.max(1, Math.ceil(reliable.length / 32));
    selected.push(...reliable.filter((_, index) => index % stride === 0));
  }
  return selected;
}

// Keep naturally narrow eyes active. Distinct close/reopen thresholds prevent
// noisy lid detections from toggling between the original and simulated eye.
export function updateSimulationBlink(frame, previous) {
  const ratio = frame.palpebralHeight / Math.max(1, frame.canthalWidth);
  const reference = previous?.openRatio ?? Math.max(0.12, ratio);
  const closeAt = Math.max(0.065, Math.min(0.11, reference * 0.55));
  const reopenAt = Math.max(closeAt + 0.025, Math.min(0.16, reference * 0.75));
  const closed = frame.canthalWidth < 4 || (previous?.closed ? ratio < reopenAt : ratio < closeAt);
  return { closed, openRatio: closed ? reference : Math.max(ratio, reference * 0.995) };
}

/** Continuous inverse warp for mobile: no donor selection or painted patches.
 * Every output pixel comes from this frame, inside the same eyelid contour.
 */
export function renderContinuousEye(ctx, frame, shift, options = {}) {
  if (!frame || frame.isBlinking) return;
  const { pIris, rIris, contourPts } = frame;
  const magnitude = Math.hypot(shift.x, shift.y);
  if (!Number.isFinite(magnitude) || magnitude < 0.1 || rIris < 1) {
    if (options.showHirschberg) renderHirschbergLightReflex(ctx, frame, shift, pIris.x, pIris.y);
    return;
  }
  const direction = { x: shift.x / magnitude, y: shift.y / magnitude };
  const normal = { x: -direction.y, y: direction.x };
  const local = point => ({ x: (point.x - pIris.x) * direction.x + (point.y - pIris.y) * direction.y, y: (point.x - pIris.x) * normal.x + (point.y - pIris.y) * normal.y });
  const polygon = contourPts.map(local);
  const middle = eyeScanlineBounds(polygon, 0);
  if (!middle) return;
  const displacement = limitEyeDisplacement(magnitude, Math.max(0, middle[1] - rIris * 0.3), frame.canthalWidth * 0.1);
  if (displacement < 0.1) return;
  const minX = Math.max(0, Math.floor(Math.min(...contourPts.map(point => point.x)) - 1));
  const minY = Math.max(0, Math.floor(Math.min(...contourPts.map(point => point.y)) - 1));
  const maxX = Math.min(ctx.canvas.width, Math.ceil(Math.max(...contourPts.map(point => point.x)) + 1));
  const maxY = Math.min(ctx.canvas.height, Math.ceil(Math.max(...contourPts.map(point => point.y)) + 1));
  const width = maxX - minX, height = maxY - minY;
  if (width < 3 || height < 3) return;
  const image = ctx.getImageData(minX, minY, width, height);
  const original = new Uint8ClampedArray(image.data);
  const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const point = local({ x: minX + col, y: minY + row });
      const bounds = eyeScanlineBounds(polygon, point.y);
      if (!bounds || point.x <= bounds[0] || point.x >= bounds[1]) continue;
      const left = bounds[0], right = bounds[1];
      const sourceLeft = Math.max(left, -rIris), sourceRight = Math.min(right, rIris);
      if (sourceRight - sourceLeft < 0.5) continue;
      const targetLeft = sourceLeft + displacement, targetRight = sourceRight + displacement;
      let sourceX;
      if (point.x < targetLeft) {
        const t = smooth((point.x - left) / Math.max(0.001, targetLeft - left));
        sourceX = left + (sourceLeft - left) * t;
      } else if (point.x <= targetRight) {
        sourceX = point.x - displacement;
      } else {
        const t = smooth((point.x - targetRight) / Math.max(0.001, right - targetRight));
        sourceX = sourceRight + (right - sourceRight) * t;
      }
      const px = Math.max(0, Math.min(width - 1.001, pIris.x + sourceX * direction.x + point.y * normal.x - minX));
      const py = Math.max(0, Math.min(height - 1.001, pIris.y + sourceX * direction.y + point.y * normal.y - minY));
      const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
      // Feather at the actual lids and corners rather than moving their edges.
      let lidDistance = Infinity;
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
        const dx = b.x - a.x, dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / Math.max(0.0001, dx * dx + dy * dy)));
        lidDistance = Math.min(lidDistance, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
      }
      // Leave an untouched inner rim as landmark estimates can include lashes
      // and skin at the lid boundary, especially at the nasal corner.
      const inset = Math.max(0.75, frame.canthalWidth * 0.012);
      const blend = smooth((lidDistance - inset) / Math.max(1, rIris * 0.18));
      const index = (row * width + col) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const sample = (x, y) => original[(y * width + x) * 4 + channel];
        const color = sample(ix, iy) * (1 - fx) * (1 - fy) + sample(ix + 1, iy) * fx * (1 - fy)
          + sample(ix, iy + 1) * (1 - fx) * fy + sample(ix + 1, iy + 1) * fx * fy;
        image.data[index + channel] = original[index + channel] + (color - original[index + channel]) * blend;
      }
    }
  }
  ctx.putImageData(image, minX, minY);
  if (options.showHirschberg) renderHirschbergLightReflex(ctx, frame, shift, pIris.x + direction.x * displacement, pIris.y + direction.y * displacement);
}

/**
 * Work on the small eye ROI only. Keep camera pixels around the lids and
 * corners fixed while resampling the original iris AND sclera together.
 * Repair only the exposed iris footprint and translate its visible texture.
 * Both layers use captured texture and stay inside the original lid contour.
 */
export function renderSimulatedEye(ctx, frame, shift, options = {}) {
  if (!frame || frame.isBlinking) return;
  const { pIris, rIris, contourPts } = frame;
  if (shift.distance < 0.1) {
    if (options.showHirschberg) renderHirschbergLightReflex(ctx, frame, shift, pIris.x, pIris.y);
    return;
  }
  const minX = Math.max(0, Math.floor(Math.min(...contourPts.map(p => p.x)) - 2));
  const minY = Math.max(0, Math.floor(Math.min(...contourPts.map(p => p.y)) - 2));
  const maxX = Math.min(ctx.canvas.width, Math.ceil(Math.max(...contourPts.map(p => p.x)) + 2));
  const maxY = Math.min(ctx.canvas.height, Math.ceil(Math.max(...contourPts.map(p => p.y)) + 2));
  const width = maxX - minX, height = maxY - minY;
  if (width < 3 || height < 3 || rIris < 2) return;
  const image = ctx.getImageData(minX, minY, width, height);
  const original = new Uint8ClampedArray(image.data);
  const magnitude = Math.hypot(shift.x, shift.y);
  if (!Number.isFinite(magnitude) || magnitude < 0.1) return;
  const direction = { x: shift.x / magnitude, y: shift.y / magnitude };
  const normal = { x: -direction.y, y: direction.x };
  const local = point => ({ x: (point.x - pIris.x) * direction.x + (point.y - pIris.y) * direction.y, y: (point.x - pIris.x) * normal.x + (point.y - pIris.y) * normal.y });
  const polygon = contourPts.map(local);
  function aperture(cross) {
    return eyeScanlineBounds(polygon, cross);
  }
  function sample(x, y, channel) {
    const px = Math.max(0, Math.min(width - 1.001, pIris.x + x * direction.x + y * normal.x - minX));
    const py = Math.max(0, Math.min(height - 1.001, pIris.y + x * direction.y + y * normal.y - minY));
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
    const at = (xx, yy) => original[(yy * width + xx) * 4 + channel];
    return at(ix, iy) * (1 - fx) * (1 - fy) + at(ix + 1, iy) * fx * (1 - fy) + at(ix, iy + 1) * (1 - fx) * fy + at(ix + 1, iy + 1) * fx * fy;
  }
  const smooth = value => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
  const centreBounds = aperture(0);
  if (!centreBounds) return;
  const lowAngleDistance = (frame.canthalWidth || rIris * 4.5) * 0.56 * Math.sin(10 * Math.PI / 180);
  // One centre for the entire iris. Row-dependent shifts bend a circular iris
  // into a wedge even if every individual row has a linear texture map.
  const inward = options.type === STRABISMUS_TYPES.ESOTROPIA;
  const highAngleWeight = smooth(((shift.angleDeg || 0) - 10) / 25);
  const irisShift = limitEyeDisplacement(magnitude, getIrisTravelCapacity(polygon, rIris, inward), lowAngleDistance);
  if (irisShift < 0.1) return;
  const safeSource = (x, y) => {
    const bounds = aperture(y);
    return bounds && x > bounds[0] + 1 && x < bounds[1] - 1;
  };
  function lidDistance(point) {
    let distance = Infinity;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / Math.max(0.0001, dx * dx + dy * dy)));
      distance = Math.min(distance, Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy));
    }
    return distance;
  }
  // Reconstruct a continuous local illumination field. Picking the brighter
  // side independently on each row creates a white wedge and horizontal seams,
  // particularly when outward gaze exposes the darker nasal side of an eye.
  const candidates = [];
  const eyeLow = Math.min(...polygon.map(point => point.x));
  const eyeHigh = Math.max(...polygon.map(point => point.x));
  const sampleStep = Math.max(1, rIris * 0.18);
  // Search the actual visible sclera, not just a ring that can intersect the
  // limbus or lid shadows when the iris estimate is a little too small.
  for (let y = -rIris * 0.65; y <= rIris * 0.65; y += sampleStep) {
    for (let x = eyeLow; x <= eyeHigh; x += sampleStep) {
      if (Math.hypot(x, y) < rIris * 1.2 || !safeSource(x, y)) continue;
      if (lidDistance({ x, y }) < Math.max(1.5, rIris * 0.14)) continue;
      const color = [0, 1, 2].map(channel => sample(x, y, channel));
      candidates.push({ x, y, color });
    }
  }
  const irisColor = [0, 1, 2].map(channel => sample(0, 0, channel));
  const scleraSamples = selectScleraSamples(candidates, irisColor);
  if (!scleraSamples.length) return;
  function scleraColor(x, y) {
    let weightSum = 0;
    const color = [0, 0, 0];
    for (const donor of scleraSamples) {
      const weight = 1 / ((x - donor.x) ** 2 + (y - donor.y) ** 2 + rIris * rIris * 0.08);
      weightSum += weight;
      for (let channel = 0; channel < 3; channel++) color[channel] += donor.color[channel] * weight;
    }
    return color.map(value => value / weightSum);
  }
  function scleraTexture(x, y) {
    // Stretch a coherent strip of real sclera on the exposed side of the iris.
    // Averaging donor RGB alone erases all texture and paints a grey disk.
    // Prefer the same camera row to retain its natural shading under the lid.
    const reference = scleraColor(x, y);
    const irisLight = irisColor[0] * 0.2126 + irisColor[1] * 0.7152 + irisColor[2] * 0.0722;
    const fraction = Math.max(0, Math.min(1, (x / rIris + 1.4) / 2.8));
    for (const side of [-1, 1]) {
      for (const scale of [1, 0.85, 0.65, 0.4, 0]) {
        const sourceY = y * scale;
        const bounds = aperture(sourceY);
        if (!bounds) continue;
        const rim = Math.sqrt(Math.max(0, (rIris * 1.2) ** 2 - sourceY * sourceY));
        const margin = Math.max(1.5, rIris * 0.14);
        const low = side < 0 ? bounds[0] + margin : rim + 0.5;
        const high = side < 0 ? -rim - 0.5 : bounds[1] - margin;
        if (high - low < 1) continue;
        const sourceX = low + (high - low) * (0.15 + fraction * 0.7);
        if (lidDistance({ x: sourceX, y: sourceY }) < margin) continue;
        const captured = [0, 1, 2].map(channel => sample(sourceX, sourceY, channel));
        const light = captured[0] * 0.2126 + captured[1] * 0.7152 + captured[2] * 0.0722;
        if (light <= irisLight + Math.max(6, irisLight * 0.12)
          || captured[0] - captured[1] >= Math.max(12, light * 0.18)
          || captured[0] - captured[2] >= Math.max(28, light * 0.35)) continue;
        // Keep the actual camera texture dominant; the colour reference only
        // softens its transition into the surrounding sclera.
        const textureWeight = 0.85 * (1 - smooth((Math.hypot(x, y) / rIris - 0.8) / 0.4));
        return captured.map((value, channel) => reference[channel] + (value - reference[channel]) * textureWeight);
      }
    }
    // If the exposed side is fully covered, copy a visible reliable patch
    // instead of reverting to a featureless average colour.
    const donor = scleraSamples.reduce((best, next) => {
      const distance = point => (point.x - x) ** 2 + (point.y - y) ** 2;
      return distance(next) < distance(best) ? next : best;
    });
    return donor.color;
  }
  // Carry the real lid shadow into the repaired area. A copied strip alone
  // still looks like a flat patch because its lighting belongs to another spot.
  const background = new Float32Array(width * height * 3);
  const guide = new Float32Array(background.length);
  const repairPixels = [];
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const pixel = row * width + col;
      for (let c = 0; c < 3; c++) background[pixel * 3 + c] = original[pixel * 4 + c];
      const point = local({ x: minX + col, y: minY + row });
      const bounds = aperture(point.y);
      if (!bounds || point.x <= bounds[0] || point.x >= bounds[1]) continue;
      const radial = Math.hypot(point.x, point.y) / rIris;
      if (radial >= 1.4 || lidDistance(point) <= 0.75) continue;
      const texture = scleraTexture(point.x, point.y);
      const feather = 1 - smooth((radial - 1.18) / 0.22);
      for (let c = 0; c < 3; c++) background[pixel * 3 + c] += (texture[c] - background[pixel * 3 + c]) * feather;
      if (row > 0 && row < height - 1 && col > 0 && col < width - 1 && radial < 1.18) repairPixels.push(pixel);
    }
  }
  guide.set(background);
  for (let iteration = 0; iteration < 28; iteration++) {
    // Alternating sweep directions avoid directional bias in the small ROI.
    for (let i = 0; i < repairPixels.length; i++) {
      const pixel = repairPixels[iteration % 2 ? repairPixels.length - 1 - i : i];
      for (let c = 0; c < 3; c++) {
        const index = pixel * 3 + c;
        const sum = background[index - 3] + background[index + 3]
          + background[index - width * 3] + background[index + width * 3];
        background[index] = (sum + guide[index] * 0.08) / 4.08;
      }
    }
  }
  // Restore small captured texture variations after propagating the shading.
  for (const pixel of repairPixels) {
    for (let c = 0; c < 3; c++) {
      const index = pixel * 3 + c;
      const neighbours = (guide[index - 3] + guide[index + 3]
        + guide[index - width * 3] + guide[index + width * 3]) / 4;
      const detail = guide[index] - neighbours;
      if (Math.abs(detail) < 10) background[index] += detail * 0.6;
    }
  }
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      // Integer pixel centres match Canvas ImageData sampling coordinates.
      const point = local({ x: minX + col, y: minY + row });
      const bounds = aperture(point.y);
      if (!bounds || point.x <= bounds[0] || point.x >= bounds[1]) continue;
      // Keep all surrounding camera pixels fixed. Only repair the original
      // iris footprint and translate its genuinely visible texture.
      const irisX = point.x - irisShift;
      const irisRadius = Math.hypot(irisX, point.y);
      const irisTexture = { x: irisX, y: point.y };
      const sourceVisibility = safeSource(irisX, point.y)
        ? smooth(lidDistance(irisTexture) / Math.max(1, rIris * 0.1)) : 0;
      const irisBlend = (1 - smooth((irisRadius - rIris * 0.96) / Math.max(0.75, rIris * 0.08))) * sourceVisibility;
      // Preserve the true lid margin at both the source and destination.
      const lidFeather = 0.14 + (inward ? 0.03 * highAngleWeight : 0);
      const inset = Math.max(0.75, frame.canthalWidth * 0.012);
      const blend = smooth((lidDistance(point) - inset) / Math.max(1, rIris * lidFeather));
      const idx = (row * width + col) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const base = background[(row * width + col) * 3 + channel];
        // A small white lift only in the repaired sclera, before iris blending.
        // Keep the captured texture and lid shading rather than filling white.
        const repairWeight = 1 - smooth((Math.hypot(point.x, point.y) / rIris - 1.18) / 0.22);
        const repaired = base + (255 - base) * 0.035 * repairWeight;
        const color = irisBlend > 0 ? repaired + (sample(irisTexture.x, irisTexture.y, channel) - repaired) * irisBlend : repaired;
        image.data[idx + channel] = original[idx + channel] + (color - original[idx + channel]) * blend;
      }
    }
  }
  ctx.putImageData(image, minX, minY);
  if (options.showHirschberg) renderHirschbergLightReflex(ctx, frame, shift, pIris.x + direction.x * irisShift, pIris.y + direction.y * irisShift);
}

/**
 * Hirschberg Corneal Light Reflex Renderer
 * Demonstrates clinical optical displacement principle
 */
export function renderHirschbergLightReflex(ctx, frame, shift, targetIrisX, targetIrisY) {
  // In a straight eye, penlight reflex is near pupil center.
  // In a deviated eye, cornea rotates, so reflex is displaced opposite to deviation direction relative to pupil:
  // Offset = -shift * 0.8
  const reflexX = targetIrisX - shift.x * 0.78;
  const reflexY = targetIrisY - shift.y * 0.78;

  ctx.save();
  ctx.beginPath();
  frame.contourPts.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.closePath();
  ctx.clip();
  const radius = Math.max(0.7, frame.rIris * 0.11);
  // Outer subtle glow
  const glow = ctx.createRadialGradient(reflexX, reflexY, 0.5, reflexX, reflexY, radius * 2.5);
  glow.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
  glow.addColorStop(0.4, 'rgba(200, 245, 255, 0.75)');
  glow.addColorStop(1.0, 'rgba(0, 220, 255, 0.0)');

  ctx.beginPath();
  ctx.arc(reflexX, reflexY, radius * 2.5, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();

  // Sharp specular core
  ctx.beginPath();
  ctx.arc(reflexX, reflexY, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();
}

/**
 * Renders clinical HUD overlay (contours, iris tracking, deviation vector arrows)
 */
export function renderStrabismusHud(ctx, frame, shift, label, isAffected, isMirrored = false) {
  if (!frame || frame.isBlinking) return;

  const { contourPts, pIris, rIris } = frame;

  ctx.save();

  // Eyelid contour stroke
  ctx.beginPath();
  ctx.moveTo(contourPts[0].x, contourPts[0].y);
  for (let i = 1; i < contourPts.length; i++) {
    ctx.lineTo(contourPts[i].x, contourPts[i].y);
  }
  ctx.closePath();
  ctx.strokeStyle = isAffected ? 'rgba(255, 75, 75, 0.65)' : 'rgba(0, 230, 200, 0.6)';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 2]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Original Iris Center crosshair
  ctx.beginPath();
  ctx.arc(pIris.x, pIris.y, rIris, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.0;
  ctx.stroke();

  // Deviation Vector Arrow (if affected and displaced)
  const isShifted = Math.hypot(shift.x, shift.y) > 1.0;
  if (isAffected && isShifted) {
    const targetX = pIris.x + shift.x;
    const targetY = pIris.y + shift.y;

    // Vector line
    ctx.beginPath();
    ctx.moveTo(pIris.x, pIris.y);
    ctx.lineTo(targetX, targetY);
    ctx.strokeStyle = '#FF3366';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Arrowhead at target
    const angle = Math.atan2(shift.y, shift.x);
    const arrowLen = 6;
    ctx.beginPath();
    ctx.moveTo(targetX, targetY);
    ctx.lineTo(
      targetX - arrowLen * Math.cos(angle - Math.PI / 6),
      targetY - arrowLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      targetX - arrowLen * Math.cos(angle + Math.PI / 6),
      targetY - arrowLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fillStyle = '#FF3366';
    ctx.fill();

    // Target Iris Ring
    ctx.beginPath();
    ctx.arc(targetX, targetY, rIris, 0, Math.PI * 2);
    ctx.strokeStyle = '#FF3366';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Tag badge
    const badgeText = `${label}: ${shift.angleDeg}° (${shift.prismDiopters}Δ)`;
    ctx.font = '600 11px Inter, sans-serif';
    const textW = ctx.measureText(badgeText).width;
    const tagX = targetX - textW / 2;
    const tagY = targetY + rIris + 16;

    if (isMirrored) {
      // Invert text horizontally so it appears legible when whole canvas is CSS mirrored
      ctx.save();
      ctx.translate(targetX, tagY);
      ctx.scale(-1, 1);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(-textW / 2 - 5, -11, textW + 10, 16);
      ctx.strokeStyle = 'rgba(255, 51, 102, 0.7)';
      ctx.strokeRect(-textW / 2 - 5, -11, textW + 10, 16);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(badgeText, -textW / 2, 1);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(tagX - 5, tagY - 11, textW + 10, 16);
      ctx.strokeStyle = 'rgba(255, 51, 102, 0.7)';
      ctx.strokeRect(tagX - 5, tagY - 11, textW + 10, 16);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(badgeText, tagX, tagY + 1);
    }
  }

  ctx.restore();
}

/**
 * Main Master Frame Processor: draws video, calculates strabismus, warps eyes, and renders HUD
 */
export function processStrabismusFrame({
  canvas,
  videoElement,
  landmarks,
  simulationConfig,
  trackingState,
}) {
  if (!canvas || !videoElement) return;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width;
  const h = canvas.height;

  // 1. Draw live camera feed as base layer
  ctx.drawImage(videoElement, 0, 0, w, h);

  if (!landmarks || landmarks.length < 478) {
    return {
      hasFace: false,
      rightEye: null,
      leftEye: null,
    };
  }

  // 2. Extract anatomical ocular frames
  const rightFrame = getEyeAnatomicalFrame(landmarks, AFFECTED_EYE.RIGHT, w, h);
  const leftFrame = getEyeAnatomicalFrame(landmarks, AFFECTED_EYE.LEFT, w, h);

  if (!rightFrame || !leftFrame) {
    return { hasFace: false, rightEye: null, leftEye: null };
  }
  if (trackingState) {
    for (const frame of [rightFrame, leftFrame]) {
      const state = updateSimulationBlink(frame, trackingState[frame.eyeSide]);
      trackingState[frame.eyeSide] = state;
      frame.isBlinking = state.closed;
    }
  }

  // 3. Determine which eye is affected
  const { affectedEye, alternatingState } = simulationConfig;

  let isRightAffected = false;
  let isLeftAffected = false;

  if (affectedEye === AFFECTED_EYE.RIGHT) {
    isRightAffected = true;
  } else if (affectedEye === AFFECTED_EYE.LEFT) {
    isLeftAffected = true;
  } else if (affectedEye === AFFECTED_EYE.BOTH) {
    isRightAffected = true;
    isLeftAffected = true;
  } else if (affectedEye === AFFECTED_EYE.ALTERNATING) {
    // Alternating between OD and OS
    if (alternatingState === 'RIGHT') {
      isRightAffected = true;
    } else {
      isLeftAffected = true;
    }
  }

  // 4. Calculate displacements
  const zeroShift = { x: 0, y: 0, distance: 0, angleDeg: 0, prismDiopters: 0 };
  const rightShift = isRightAffected ? calculateStrabismusShift(rightFrame, simulationConfig) : zeroShift;
  const leftShift = isLeftAffected ? calculateStrabismusShift(leftFrame, simulationConfig) : zeroShift;

  // 5. Render ocular warps
  const renderEye = simulationConfig.renderMode === 'continuous' ? renderContinuousEye : renderSimulatedEye;
  if (isRightAffected) {
    renderEye(ctx, rightFrame, rightShift, simulationConfig);
  }
  if (isLeftAffected) {
    renderEye(ctx, leftFrame, leftShift, simulationConfig);
  }

  // If Hirschberg enabled on fixing eyes too, draw penlight on fixing eye
  if (simulationConfig.showHirschberg) {
    if (!isRightAffected && !rightFrame.isBlinking) {
      renderHirschbergLightReflex(ctx, rightFrame, zeroShift, rightFrame.pIris.x, rightFrame.pIris.y);
    }
    if (!isLeftAffected && !leftFrame.isBlinking) {
      renderHirschbergLightReflex(ctx, leftFrame, zeroShift, leftFrame.pIris.x, leftFrame.pIris.y);
    }
  }

  // 6. Render HUD overlays if enabled
  if (simulationConfig.showHud) {
    renderStrabismusHud(ctx, rightFrame, rightShift, 'Mắt Phải (OD)', isRightAffected, simulationConfig.isMirrored);
    renderStrabismusHud(ctx, leftFrame, leftShift, 'Mắt Trái (OS)', isLeftAffected, simulationConfig.isMirrored);
  }

  return {
    hasFace: true,
    rightEye: { frame: rightFrame, shift: rightShift, isAffected: isRightAffected },
    leftEye: { frame: leftFrame, shift: leftShift, isAffected: isLeftAffected },
  };
}

/**
 * Generates an annotated clinical image snapshot suitable for saving / sharing
 */
export async function createClinicalSnapshot({
  sourceCanvas,
  simulationConfig,
  _metadata = {},
  isMirrored = true,
}) {
  if (!sourceCanvas) return null;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const bannerH = 100;

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = w;
  exportCanvas.height = h + bannerH;
  const ctx = exportCanvas.getContext('2d');

  // Draw background image (mirroring if needed for natural selfie perspective)
  ctx.save();
  if (isMirrored) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.restore();

  // Bottom branded diagnostic card banner
  ctx.fillStyle = '#0B1519';
  ctx.fillRect(0, h, w, bannerH);

  // Top border accent
  const borderGrad = ctx.createLinearGradient(0, h, w, h);
  borderGrad.addColorStop(0, '#00AB9B');
  borderGrad.addColorStop(0.5, '#00D1B2');
  borderGrad.addColorStop(1, '#008376');
  ctx.fillStyle = borderGrad;
  ctx.fillRect(0, h, w, 3);

  // Text details
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.fillText('RemiCare AI • Mô Phỏng Mắt Lác Lé Bằng Thị Giác Máy Tính', 24, h + 30);

  ctx.fillStyle = '#00E5C9';
  ctx.font = '600 13px Inter, sans-serif';
  const typeLabels = {
    [STRABISMUS_TYPES.ESOTROPIA]: 'Lác Trong (Esotropia)',
    [STRABISMUS_TYPES.EXOTROPIA]: 'Lác Ngoài (Exotropia)',
    [STRABISMUS_TYPES.HYPERTROPIA]: 'Lác Trên (Hypertropia)',
    [STRABISMUS_TYPES.HYPOTROPIA]: 'Lác Dưới (Hypotropia)',
    [STRABISMUS_TYPES.CUSTOM]: 'Lác Tự Do 360°',
    [STRABISMUS_TYPES.ORTHOTROPIA]: 'Bình Thường (Orthotropia)',
  };

  const eyeLabels = {
    [AFFECTED_EYE.RIGHT]: 'Mắt Phải (OD)',
    [AFFECTED_EYE.LEFT]: 'Mắt Trái (OS)',
    [AFFECTED_EYE.BOTH]: 'Cả Hai Mắt',
    [AFFECTED_EYE.ALTERNATING]: 'Lác Luân Phiên',
  };

  const typeText = typeLabels[simulationConfig.type] || simulationConfig.type;
  const eyeText = eyeLabels[simulationConfig.affectedEye] || simulationConfig.affectedEye;
  const angleText = `${simulationConfig.angleDeg}° (~${angleToPrismDiopters(simulationConfig.angleDeg)}Δ)`;

  ctx.fillText(`Dạng lác: ${typeText} | Vị trí: ${eyeText} | Độ lệch: ${angleText}`, 24, h + 54);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '400 11px Inter, sans-serif';
  ctx.fillText(
    `Ngày tạo: ${new Date().toLocaleString('vi-VN')} • Xử lý 100% cục bộ trên trình duyệt • Không thay thế chẩn đoán y khoa`,
    24,
    h + 78
  );

  return exportCanvas.toDataURL('image/png');
}
