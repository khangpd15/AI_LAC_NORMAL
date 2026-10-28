import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTimeSeriesRecorder } from '../src/services/coverTestTimeSeriesService.js';

test('training export retains canthal eye coordinates with the exact source timestamp', () => {
  const recorder = createTimeSeriesRecorder(1000, { fullRate: true });
  const local = {
    left: { x: 0.48, y: 0.07, valid: true },
    right: { x: null, y: null, valid: false },
  };
  const features = {
    timestamp: 1100.125,
    raw: { leftIrisX: 0.6, leftIrisY: 0.4, rightIrisX: 0.3, rightIrisY: 0.4 },
    observedVisibility: { left: 'VISIBLE', right: 'OCCLUDED' },
    observedEyeLocal: local,
    leftEyeWidth: 0.08, rightEyeWidth: 0.08,
    frameMetadata: { frameId: 13, mediaTimeMs: 100.125 },
  };
  recorder.processFrame(9999, 'COVER', features,
    { faceDetected: true, irisValid: true, isValid: true }, null, 'left', 'right');
  const [sample] = recorder.getSamples();
  assert.equal(sample.timestampMs, 1100.125);
  assert.equal(sample.frameId, 13);
  assert.equal(sample.coordinateSpace, 'CANTHAL_LOCAL_V1');
  assert.deepEqual(sample.leftEyeLocal, local.left);
  assert.deepEqual(sample.rightEyeLocal, local.right);
  assert.equal(sample.rightValid, false);
  assert.notEqual(sample.leftEyeLocal.x, sample.leftX);
});
