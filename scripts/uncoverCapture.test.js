import assert from 'node:assert/strict';
import test from 'node:test';
import { UncoverTransition, classifyEyeVisibility, encodeEyePair } from '../src/services/coverTest/uncoverCaptureService.js';
import { createTimeSeriesRecorder } from '../src/services/coverTestTimeSeriesService.js';

function arm(machine) {
  machine.reset('left');
  for (let t = 0; t <= 7; t++) machine.update({
    timestampMs: t * 1000 / 30, visibility: { left: 'OCCLUDED', right: 'VISIBLE' },
    candidate: () => { throw Error('must not crop covered eyes'); },
  });
}
test('confirm with second visible frame but retain first frame and timestamp at 30 FPS', () => {
  const machine = new UncoverTransition();
  arm(machine);
  const image = { frameId: 8 };
  const update = timestampMs => machine.update({ timestampMs, visibility: { left: 'VISIBLE', right: 'VISIBLE' }, candidate: () => image });
  assert.equal(update(8000 / 30), null);
  assert.equal(update(8000 / 30), null);
  const event = update(9000 / 30);
  assert.equal(event.image, image);
  assert.equal(event.timestampMs, 8000 / 30);
  assert.equal(event.confirmedAtMs, 300);
  assert.equal(event.lastCoveredMs, 7000 / 30);
  assert.equal(update(10000 / 30), null);
});
test('blink, unknown face, stale gap and unarmed open eyes cannot trigger', () => {
  for (const interruption of ['UNKNOWN', 'gap']) {
    const machine = new UncoverTransition();
    arm(machine);
    machine.update({ timestampMs: interruption === 'gap' ? 900 : 260, visibility: { left: 'UNKNOWN', right: 'VISIBLE' }, candidate: () => ({}) });
    for (const t of [1000, 1033, 1066]) assert.equal(machine.update({
      timestampMs: t, visibility: { left: 'VISIBLE', right: 'VISIBLE' }, candidate: () => ({}),
    }), null);
  }
});
test('hand or dark object evidence differs from a blink or missing calibration', () => {
  const baseline = { pupilContrast: 30, dynamicRange: 100, stdDev: 30, mean: 110 };
  const frame = { canthalWidth: 50, palpebralHeight: 16 };
  for (const mean of [170, 20]) assert.equal(classifyEyeVisibility({
    pupilContrast: 2, dynamicRange: 10, stdDev: 3, mean,
  }, frame, baseline), 'OCCLUDED');
  assert.equal(classifyEyeVisibility(baseline, frame, baseline), 'VISIBLE');
  assert.equal(classifyEyeVisibility(baseline, { ...frame, palpebralHeight: 2 }, baseline), 'UNKNOWN');
  assert.equal(classifyEyeVisibility(baseline, frame, null), 'UNKNOWN');
});
test('encoding both crops does not replace capture timestamp with encoding completion', async () => {
  const canvas = { width: 32, height: 16, toBlob: cb => setTimeout(() => cb(new Blob(['jpeg'], { type: 'image/jpeg' })), 5) };
  const result = await encodeEyePair({ image: { frame: { frameId: 9, timestampEpochMs: 1234 }, eyes: {
    left: { canvas, cropRegion: { x: 1 } }, right: { canvas, cropRegion: { x: 40 } },
  } }, timestampMs: 300, lastCoveredMs: 266, confirmedAtMs: 333, uncoveredEye: 'left' }, 1, 100);
  assert.equal(result.metadata.timestampMs, 300);
  assert.equal(result.metadata.t, 200);
  assert.equal(result.metadata.frameId, 9);
  assert.equal(Object.keys(result.images).length, 2);
});
test('full rate recorder retains 30 unique frames and their exact source timestamps', () => {
  const recorder = createTimeSeriesRecorder(0, { fullRate: true });
  for (let i = 0; i < 30; i++) {
    const timestamp = i * 1000 / 30;
    const features = { timestamp, raw: { leftIrisX: .4, leftIrisY: .5, rightIrisX: .6, rightIrisY: .5 },
      leftEyeWidth: .1, rightEyeWidth: .1, frameMetadata: { frameId: i + 1, timestampEpochMs: 1700000000000 + timestamp } };
    assert.equal(recorder.processFrame(timestamp + 50, 'BASELINE', features, { faceDetected: true, irisValid: true, isValid: true }), true);
    assert.equal(recorder.processFrame(timestamp + 66, 'BASELINE', features, { faceDetected: true, irisValid: true }), false);
  }
  const samples = recorder.getSamples();
  assert.equal(samples.length, 30);
  assert.equal(samples[1].timestampMs, 1000 / 30);
  assert.equal(samples[1].frameId, 2);
  assert.equal(samples[1].timestampEpochMs, 1700000000000 + 1000 / 30);
});
