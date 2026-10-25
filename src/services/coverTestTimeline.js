export const COVER_PHASE_MS = Object.freeze({ preparation: 5000, cover: 7000, uncover: 3000 });

// Wait for narration without trapping the user if mobile audio fails to settle.
export function isCoverPhaseComplete(elapsedMs, durationMs, speechFinished) {
  return elapsedMs >= durationMs && (speechFinished || elapsedMs >= durationMs + 8000);
}

// Minimum offsets for planning only; live phases run sequentially and may wait
// for narration. Never catch up by skipping an instruction after a slow frame.
export function getCoverCycleTiming(cycle) {
  if (!Number.isInteger(cycle) || cycle < 1 || cycle > 3) {
    throw new RangeError('Cover test requires cycles 1–3');
  }
  const offset = (cycle - 1) * 20000;
  return {
    coverLeftMs: offset,
    uncoverLeftMs: offset + 7000,
    coverRightMs: offset + 10000,
    uncoverRightMs: offset + 17000,
    endMs: offset + 20000,
  };
}
