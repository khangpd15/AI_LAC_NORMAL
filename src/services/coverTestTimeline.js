// Offsets from the end of the 10-second preparation / camera readiness gate.
// Each removal has a one-second observation window, including the last cue at 40s.
export function getCoverCycleTiming(cycle) {
  if (!Number.isInteger(cycle) || cycle < 1 || cycle > 3) {
    throw new RangeError('Cover test requires cycles 1–3');
  }
  const offset = (cycle - 1) * 10000;
  return {
    coverLeftMs: cycle === 1 ? 0 : offset + 1000,
    uncoverLeftMs: offset + 5000,
    coverRightMs: offset + 6000,
    uncoverRightMs: offset + 10000,
    endMs: offset + 11000,
  };
}
