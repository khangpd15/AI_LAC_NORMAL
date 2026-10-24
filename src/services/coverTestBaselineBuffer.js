import { SCREENING_CONFIG } from '../constants/screeningConfig.js';
import { calculateRobustBaseline } from './coverTestMeasurementService.js';

export function isCoverFrameInPhase(timestamp, phase, phaseStart, baselineStart, lastTimestamp) {
  const start = phase === 'BASELINE' || phase === 'PREPARING' ? baselineStart : phaseStart;
  return Number.isFinite(timestamp) && timestamp >= start && timestamp > lastTimestamp;
}

// Keep enough recent, unique frames across instruction/phase boundaries on
// slower phones. Never reuse old measurements after tracking has been lost.
export function createCoverBaselineBuffer() {
  const frames = { left: [], right: [] };
  // Twenty unique samples need ten seconds on a 2 FPS device. Freshness is
  // still enforced independently, so a lost track cannot reuse this window.
  const windowMs = 10000;
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
