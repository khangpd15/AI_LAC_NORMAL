import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCoverBaselineBuffer } from '../src/services/coverTestBaselineBuffer.js';
import { validateBaselinePair } from '../src/services/coverTestProtocolService.js';

const frame = timestamp => ({ timestamp, x: 0.5, y: 0.5, normalizedX: 0.5, normalizedY: 0.5 });
function feed(buffer, timestamp) {
  for (const eye of ['left', 'right']) buffer.add(eye, frame(timestamp));
}

test('5 FPS phone accumulates a valid baseline across one-second instructions', () => {
  const buffer = createCoverBaselineBuffer();
  for (let i = 0; i < 20; i++) {
    feed(buffer, i * 200);
    if (i % 5 === 4) buffer.read(i * 200);
  }
  assert.equal(validateBaselinePair(buffer.read(4000)).isValid, true);
});

test('lost tracking expires baseline and cannot carry samples into recovery', () => {
  const buffer = createCoverBaselineBuffer();
  for (let i = 0; i < 20; i++) feed(buffer, i * 200);
  assert.equal(validateBaselinePair(buffer.read(5400)).isValid, false);
  feed(buffer, 5600);
  assert.equal(buffer.read(5600).leftBaseline.sampleCount, 1);
});

test('duplicates and stale samples cannot satisfy the baseline gate', () => {
  const buffer = createCoverBaselineBuffer();
  for (let i = 0; i < 30; i++) feed(buffer, 0);
  assert.equal(buffer.read(0).leftBaseline.sampleCount, 1);
  for (let i = 1; i < 30; i++) feed(buffer, i * 400);
  assert.equal(validateBaselinePair(buffer.read(11600)).isValid, false);
});

test('one missing eye or unstable gaze still blocks measurement', () => {
  const buffer = createCoverBaselineBuffer();
  for (let i = 0; i < 20; i++) {
    buffer.add('left', frame(i * 100));
  }
  assert.equal(validateBaselinePair(buffer.read(1900)).isValid, false);
  for (let i = 0; i < 20; i++) {
    buffer.add('right', { ...frame(i * 100), normalizedX: i % 2 });
  }
  assert.equal(validateBaselinePair(buffer.read(1900)).isValid, false);
});
