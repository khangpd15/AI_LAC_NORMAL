import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCoverCycleTiming, isCoverPhaseComplete } from '../src/services/coverTestTimeline.js';

test('each side has five seconds covered and three seconds after uncover', () => {
  const cycles = [1, 2, 3].map(getCoverCycleTiming);
  assert.deepEqual(cycles.flatMap(c => [c.uncoverLeftMs, c.uncoverRightMs])
    .map(ms => ms / 1000), [5, 13, 21, 29, 37, 45]);
  assert.deepEqual(cycles.map(c => c.coverLeftMs / 1000), [0, 16, 32]);
  assert.deepEqual(cycles.map(c => c.coverRightMs / 1000), [8, 24, 40]);
  for (const c of cycles) {
    assert.equal(c.coverRightMs - c.uncoverLeftMs, 3000);
    assert.equal(c.endMs - c.uncoverRightMs, 3000);
  }
  assert.equal(cycles[0].endMs, cycles[1].coverLeftMs);
  assert.equal(cycles[1].endMs, cycles[2].coverLeftMs);
});

test('narration can finish before changing phase, with a deadline for failed audio', () => {
  assert.equal(isCoverPhaseComplete(1000, 5000, true), false);
  assert.equal(isCoverPhaseComplete(5000, 5000, false), false);
  assert.equal(isCoverPhaseComplete(7000, 5000, true), true);
  assert.equal(isCoverPhaseComplete(13000, 5000, false), true);
  assert.equal(isCoverPhaseComplete(0, 3000, true), false);
});

test('invalid cycle numbers cannot extend the protocol', () => {
  for (const value of [0, 4, 1.5, NaN]) {
    assert.throws(() => getCoverCycleTiming(value), RangeError);
  }
});
