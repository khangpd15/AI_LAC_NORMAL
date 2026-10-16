import { LANDMARKS } from '../../constants/screeningConfig.js';
import { LEFT_EYE_CONTOUR, RIGHT_EYE_CONTOUR } from './strabismusEngine.js';

// Smooth eye motion in its own coordinate system. Head translation, rotation
// and scale are applied first so smoothing never leaves the effect behind it.
export function stabilizeSimulationLandmarks(next, previous, deltaMs = 1000 / 30, { mobile = false } = {}) {
  if (!next || next.length < 478 || !previous || previous.length !== next.length) return next;
  const result = next.map(point => ({ ...point }));
  for (const side of ['LEFT', 'RIGHT']) {
    const inner = LANDMARKS[`${side}_INNER_CANTHUS`];
    const outer = LANDMARKS[`${side}_OUTER_CANTHUS`];
    const top = LANDMARKS[`${side}_TOP_LID`];
    const bottom = LANDMARKS[`${side}_BOTTOM_LID`];
    const iris = LANDMARKS[`${side}_IRIS_CENTER`];
    const span = points => ({ x: points[inner].x - points[outer].x, y: points[inner].y - points[outer].y });
    const before = span(previous), after = span(next);
    const width = Math.hypot(after.x, after.y);
    const priorWidth = Math.hypot(before.x, before.y);
    const aperture = points => Math.hypot(points[top].x - points[bottom].x, points[top].y - points[bottom].y);
    if (width < 0.001 || priorWidth < 0.001 || width / priorWidth < 0.7 || width / priorWidth > 1.4) continue;
    // Do not blur an actual blink or retain iris texture over closed eyelids.
    if (aperture(next) / width < 0.2 || aperture(previous) / priorWidth < 0.2) continue;
    const denominator = priorWidth * priorWidth;
    const a = (before.x * after.x + before.y * after.y) / denominator;
    const b = (before.x * after.y - before.y * after.x) / denominator;
    const contour = side === 'LEFT' ? LEFT_EYE_CONTOUR : RIGHT_EYE_CONTOUR;
    for (const index of [...contour, iris, ...LANDMARKS[`${side}_IRIS_PERIMETER`]]) {
      const dx = previous[index].x - previous[outer].x;
      const dy = previous[index].y - previous[outer].y;
      const predicted = { x: next[outer].x + a * dx - b * dy, y: next[outer].y + b * dx + a * dy };
      const movement = Math.hypot(next[index].x - predicted.x, next[index].y - predicted.y) / width;
      const weight = movement > 0.12 ? (mobile && index >= 468 ? 0.4 : 0.7) : index >= 468 ? (mobile ? 0.2 : 0.28) : 0.6;
      // A slow mobile frame must not turn a noisy iris observation into a jump.
      const alpha = 1 - (1 - weight) ** (Math.max(8, Math.min(mobile ? 50 : 100, deltaMs)) / (1000 / 30));
      result[index].x = predicted.x + (next[index].x - predicted.x) * alpha;
      result[index].y = predicted.y + (next[index].y - predicted.y) * alpha;
    }
  }
  return result;
}

export function getSimulationProcessingSize(width, height, maxEdge = 640) {
  if (![width, height, maxEdge].every(value => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
