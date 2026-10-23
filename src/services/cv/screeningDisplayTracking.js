import { stabilizeSimulationLandmarks } from './simulationTracking.js';

// Display only: never feed these coordinates back into measurement or quality gates.
export function createScreeningDisplayTracker() {
  let previous = null;
  let previousTime = null;
  return {
    reset() { previous = null; previousTime = null; },
    update(landmarks, timestamp, mobile = false) {
      if (!landmarks || !Number.isFinite(timestamp)) {
        this.reset();
        return null;
      }
      const delta = previousTime === null ? 1000 / 30 : timestamp - previousTime;
      const continuous = delta > 0 && delta < (mobile ? 700 : 250);
      previous = stabilizeSimulationLandmarks(landmarks, continuous ? previous : null, delta, { mobile });
      previousTime = timestamp;
      return previous;
    },
  };
}
