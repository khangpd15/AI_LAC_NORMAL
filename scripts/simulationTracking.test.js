import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stabilizeSimulationLandmarks } from '../src/services/cv/simulationTracking.js';
import { sendFrameToFaceMesh } from '../src/services/faceMeshService.js';
import { LANDMARKS } from '../src/constants/screeningConfig.js';

function face() {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  for (const side of ['LEFT', 'RIGHT']) {
    const x = side === 'LEFT' ? 0.65 : 0.35;
    points[LANDMARKS[`${side}_OUTER_CANTHUS`]] = { x: x - 0.05, y: 0.5 };
    points[LANDMARKS[`${side}_INNER_CANTHUS`]] = { x: x + 0.05, y: 0.5 };
    points[LANDMARKS[`${side}_TOP_LID`]] = { x, y: 0.48 };
    points[LANDMARKS[`${side}_BOTTOM_LID`]] = { x, y: 0.52 };
    points[LANDMARKS[`${side}_IRIS_CENTER`]] = { x, y: 0.5 };
    for (const index of LANDMARKS[`${side}_IRIS_PERIMETER`]) points[index] = { x: x + 0.02, y: 0.5 };
  }
  return points;
}

test('small iris noise is reduced without mutating camera landmarks', () => {
  const before = face();
  const next = face();
  next[468].x += 0.004;
  const result = stabilizeSimulationLandmarks(next, before);
  assert.ok(result[468].x > before[468].x);
  assert.ok(result[468].x < before[468].x + 0.002);
  assert.equal(next[468].x, before[468].x + 0.004);
});

test('head translation, rotation and scale follow immediately instead of lagging', () => {
  const before = face();
  const transform = point => ({ x: 0.1 + point.x * 1.1 - point.y * 0.2, y: -0.1 + point.x * 0.2 + point.y * 1.1 });
  const next = before.map(transform);
  const result = stabilizeSimulationLandmarks(next, before);
  for (const index of [468, 473]) {
    assert.ok(Math.abs(result[index].x - next[index].x) < 1e-10);
    assert.ok(Math.abs(result[index].y - next[index].y) < 1e-10);
  }
});

test('blink and reopening use current eyelids and iris without smoothing over closed eyes', () => {
  const open = face();
  const closed = face();
  closed[159].y = 0.498;
  closed[145].y = 0.502;
  closed[468].x += 0.004;
  const result = stabilizeSimulationLandmarks(closed, open);
  assert.deepEqual(result[159], closed[159]);
  assert.deepEqual(result[468], closed[468]);
  const reopened = stabilizeSimulationLandmarks(open, closed);
  assert.deepEqual(reopened[468], open[468]);
});

test('a lost track resets and frame intervals keep smoothing consistent', () => {
  const next = face();
  assert.equal(stabilizeSimulationLandmarks(next, null), next);
  const before = face();
  next[468].x += 0.004;
  const oneStep = stabilizeSimulationLandmarks(next, before, 1000 / 15);
  const halfway = stabilizeSimulationLandmarks(next, before, 1000 / 30);
  const twoSteps = stabilizeSimulationLandmarks(next, halfway, 1000 / 30);
  assert.ok(Math.abs(oneStep[468].x - twoSteps[468].x) < 1e-10);
});

test('FaceMesh receives the captured image that will be rendered rather than the advancing video', async () => {
  const video = { readyState: 2, videoWidth: 1280, videoHeight: 720, paused: false };
  const capturedFrame = { width: 1280, height: 720 };
  let sent;
  await sendFrameToFaceMesh({ send: async input => { sent = input.image; } }, video, capturedFrame);
  assert.equal(sent, capturedFrame);
  await sendFrameToFaceMesh({ send: async input => { sent = input.image; } }, video);
  assert.equal(sent, video);
});
