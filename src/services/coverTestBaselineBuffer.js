import { SCREENING_CONFIG } from '../constants/screeningConfig.js';
import { calculateRobustBaseline } from './coverTestMeasurementService.js';

// Keep enough recent, unique frames across instruction/phase boundaries on
// slower phones. Never reuse old measurements after tracking has been lost.
export function createCoverBaselineBuffer() {
  const frames = { left: [], right: [] };
  const windowMs = 5000;
  const maxGapMs = 1500;
  function prune(eye, now) {
    const list = frames[eye];
    if (list.length && now - list.at(-1).timestamp > maxGapMs) list.length = 0;
    while (list.length && now - list[0].timestamp > windowMs) list.shift();
    return list;
  }
  return {
    add(eye, frame) {
      if (!frame) return;
      const list = prune(eye, frame.timestamp);
      if (list.length && frame.timestamp <= list.at(-1).timestamp) return;
      list.push(frame);
      if (list.length > SCREENING_CONFIG.MIN_VALID_SAMPLES_BASELINE) list.shift();
    },
    read(now) {
      return {
        leftBaseline: calculateRobustBaseline(prune('left', now)),
        rightBaseline: calculateRobustBaseline(prune('right', now)),
      };
    },
  };
}
