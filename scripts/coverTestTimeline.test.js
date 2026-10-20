import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCoverCycleTiming } from '../src/services/coverTestTimeline.js';

test('three cycles match all requested cue times after the ten-second preparation', () => {
  const cycles = [1, 2, 3].map(getCoverCycleTiming);
  assert.deepEqual(cycles.flatMap(c => [c.uncoverLeftMs, c.uncoverRightMs])
    .map(ms => 10 + ms / 1000), [15, 20, 25, 30, 35, 40]);
  assert.deepEqual(cycles.map(c => 10 + c.coverLeftMs / 1000), [10, 21, 31]);
  assert.deepEqual(cycles.map(c => 10 + c.coverRightMs / 1000), [16, 26, 36]);
  for (const c of cycles) {
    assert.equal(c.coverRightMs - c.uncoverLeftMs, 1000);
    assert.equal(c.endMs - c.uncoverRightMs, 1000);
  }
  assert.equal(cycles[0].endMs, cycles[1].coverLeftMs);
  assert.equal(cycles[1].endMs, cycles[2].coverLeftMs);
});

test('invalid cycle numbers cannot extend the protocol', () => {
  for (const value of [0, 4, 1.5, NaN]) {
    assert.throws(() => getCoverCycleTiming(value), RangeError);
  }
});
