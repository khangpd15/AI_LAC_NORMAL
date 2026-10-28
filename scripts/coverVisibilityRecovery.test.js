import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appearanceCorrelation, assessEyeVisibility, classifyEyeVisibility, UncoverCaptureObserver, UncoverTransition, isUncoverCaptureEligible } from '../src/services/coverTest/uncoverCaptureService.js';
import { LANDMARKS } from '../src/constants/screeningConfig.js';
import { isObservedCoverPhaseComplete } from '../src/services/coverTestTimeline.js';

const eyeShape = Array.from({ length: 48 }, (_, i) => {
  const x = i % 8, y = Math.floor(i / 8);
  return y === 2 || y === 3 ? (x === 3 || x === 4 ? 25 : 95) : 130;
});
const fingerShape = Array.from({ length: 48 }, (_, i) => i % 8 === 3 ? 25 : 130);
const frame = { canthalWidth: 60, palpebralHeight: 18 };
const baseline = { mean: 100, stdDev: 22, pupilContrast: 35, minLum: 25, dynamicRange: 120, appearance: eyeShape };
const patch = extra => ({ ...baseline, ...extra });

function calibratedObserver(times = [0, 40, 80, 120, 160], rightPatch = {}) {
  const observer = new UncoverCaptureObserver();
  const landmarks = Array.from({ length: 478 }, () => ({ x: .5, y: .5, z: 0 }));
  for (const [side, center] of [['LEFT', .35], ['RIGHT', .65]]) {
    landmarks[LANDMARKS[`${side}_INNER_CANTHUS`]] = { x: center - .1, y: .5 };
    landmarks[LANDMARKS[`${side}_OUTER_CANTHUS`]] = { x: center + .1, y: .5 };
    landmarks[LANDMARKS[`${side}_TOP_LID`]] = { x: center, y: .47 };
    landmarks[LANDMARKS[`${side}_BOTTOM_LID`]] = { x: center, y: .53 };
    landmarks[LANDMARKS[`${side}_IRIS_CENTER`]] = { x: center, y: .5 };
  }
  observer.sampler.sampleEyePatch = (_source, _x, _y, _w, _h, offset) =>
    patch({ isEyeLike: true, ...(offset === 32 ? rightPatch : {}) });
  const observe = (time, phase = 'BASELINE') => observer.observe({ width: 200, height: 200 }, landmarks, time, phase, () => null);
  times.forEach(time => observe(time));
  return { observer, observe };
}

test('appearance calibration needs both eyes, unique source samples and a real time span', () => {
  const { observer, observe } = calibratedObserver();
  assert.equal(observer.getCalibrationStatus(160).ready, true);
  observe(160);
  assert.equal(observer.baselineCounts.left, 5);
  assert.equal(calibratedObserver([0, 1, 2, 3, 4]).observer.getCalibrationStatus(4).ready, false);
  assert.equal(calibratedObserver(undefined, { isEyeLike: false }).observer.getCalibrationStatus(160).ready, false);
});

test('stale or interrupted calibration cannot start a timed cover procedure', () => {
  const { observer, observe } = calibratedObserver();
  assert.equal(observer.getCalibrationStatus(2000).ready, false);
  observe(2000);
  assert.equal(observer.baselineCounts.left, 1);
  assert.equal(observer.getCalibrationStatus(2000).ready, false);
  observer.reset();
  assert.equal(observer.getCalibrationStatus(2000).ready, false);
});

test('covered-eye phases never train the open-eye appearance baseline', () => {
  const { observer, observe } = calibratedObserver();
  const previous = structuredClone(observer.baselines);
  observe(200, 'COVER');
  assert.deepEqual(observer.baselines, previous);
  assert.equal(observer.baselineCounts.right, 5);
});

test('diagnostics distinguish missing calibration from poor image similarity', () => {
  assert.deepEqual(assessEyeVisibility(patch({}), frame, null), { visibility: 'UNKNOWN', reason: 'NO_BASELINE' });
  assert.deepEqual(assessEyeVisibility(patch({ appearance: null }), frame, baseline), { visibility: 'UNKNOWN', reason: 'MISSING_APPEARANCE' });
  assert.deepEqual(assessEyeVisibility(patch({ appearance: fingerShape }), frame, baseline), { visibility: 'UNKNOWN', reason: 'LOW_CORRELATION' });
});

test('open-looking aperture and dark pixels alone do not establish visibility', () => {
  const result = assessEyeVisibility(patch({ pupilContrast: 8 }), frame, baseline);
  assert.deepEqual(result, { visibility: 'UNKNOWN', reason: 'LOW_CONTRAST' });
});

test('spatial evidence distinguishes a dark finger crease from an open eye with similar scalar contrast', () => {
  assert.equal(appearanceCorrelation(eyeShape, eyeShape), 1);
  assert.equal(classifyEyeVisibility(patch({}), frame, baseline), 'VISIBLE');
  assert.notEqual(classifyEyeVisibility(patch({ appearance: fingerShape }), frame, baseline), 'VISIBLE');
});

test('a bright occluder edge cannot pass on strong contrast and a dark pixel alone', () => {
  const spoon = patch({ mean: 170, stdDev: 58, pupilContrast: 80, dynamicRange: 200, minLum: 35 });
  assert.equal(classifyEyeVisibility(spoon, frame, baseline), 'OCCLUDED');
});

test('a source frame masked by blink cannot become the retained uncover image', () => {
  const quality = { faceDetected: true, irisValid: true, leftEyeDetected: true, rightEyeDetected: true };
  assert.equal(isUncoverCaptureEligible({}, quality), true);
  assert.equal(isUncoverCaptureEligible({ isBlinkMaskedLeft: true }, quality), false);
  assert.equal(isUncoverCaptureEligible({}, { ...quality, blinkDetected: true }), false);
  assert.equal(isUncoverCaptureEligible({}, { ...quality, rightEyeDetected: false }), false);
});

test('common exposure changes preserve appearance but a contaminated opposite eye cannot set exposure', () => {
  const bright = patch({ mean: 140, minLum: 65, appearance: eyeShape.map(v => v + 40) });
  assert.equal(classifyEyeVisibility(bright, frame, baseline, bright, frame, baseline), 'VISIBLE');
  const hidden = patch({ mean: 180, appearance: fingerShape });
  assert.notEqual(classifyEyeVisibility(bright, frame, baseline, hidden, frame, baseline), 'VISIBLE');
});

test('missing spatial evidence, flat texture and closed lids never establish visibility', () => {
  assert.notEqual(classifyEyeVisibility(patch({ appearance: null }), frame, baseline), 'VISIBLE');
  assert.notEqual(classifyEyeVisibility(patch({ appearance: Array(48).fill(120), pupilContrast: 0,
    stdDev: 0, dynamicRange: 0 }), frame, baseline), 'VISIBLE');
  assert.equal(classifyEyeVisibility(patch({}), { ...frame, palpebralHeight: 2 }, baseline), 'UNKNOWN');
});

const closed = { left: 'OCCLUDED', right: 'VISIBLE' };
const open = { left: 'VISIBLE', right: 'VISIBLE' };
const image = () => ({ id: 'first-clear-frame' });
function armed() {
  const t = new UncoverTransition(1800); t.reset('left');
  for (const timestampMs of [0, 50, 100, 150]) t.update({ timestampMs, visibility: closed, candidate: image });
  assert.equal(t.armed, true);
  return t;
}

test('two transient clear frames cannot capture; sustained confirmation retains the first source image', () => {
  const t = armed();
  assert.equal(t.update({ timestampMs: 200, visibility: open, candidate: image }), null);
  assert.equal(t.update({ timestampMs: 250, visibility: open, candidate: image }), null);
  assert.equal(t.update({ timestampMs: 300, visibility: open, candidate: image }), null);
  const event = t.update({ timestampMs: 350, visibility: open, candidate: image });
  assert.equal(event.timestampMs, 200);
  assert.equal(event.confirmedAtMs, 350);
  assert.equal(event.image.id, 'first-clear-frame');
});

test('unknown samples do not refresh lastCovered or allow a stale uncover capture', () => {
  const t = armed();
  for (const timestampMs of [200, 250, 300, 350, 400, 450]) {
    t.update({ timestampMs, visibility: { left: 'UNKNOWN', right: 'VISIBLE' }, candidate: image });
  }
  assert.equal(t.lastCovered, 150);
  assert.equal(t.armed, false);
  for (const timestampMs of [500, 550, 600, 650]) assert.equal(t.update({ timestampMs, visibility: open, candidate: image }), null);
});

test('a duplicate source timestamp cannot advance open confirmation', () => {
  const t = armed();
  for (let i = 0; i < 10; i++) assert.equal(t.update({ timestampMs: 200, visibility: open, candidate: image }), null);
  assert.equal(t.clearFrames, 1);
});

test('a missing source interval cannot create a precisely timed uncover', () => {
  const t = armed();
  for (const timestampMs of [500, 550, 600, 650]) assert.equal(t.update({ timestampMs, visibility: open, candidate: image }), null);
  assert.equal(t.armed, false);
});

test('bounded phase extension preserves a late uncover window without waiting indefinitely', () => {
  const base = { phase: 'TRACKING', phaseStartMs: 46000, durationMs: 3000, speechFinished: true,
    progress: { uncoverEvent: { timestampMs: 48433 } } };
  assert.equal(isObservedCoverPhaseComplete({ ...base, elapsedMs: 3000 }), false);
  assert.equal(isObservedCoverPhaseComplete({ ...base, elapsedMs: 3933 }), true);
  assert.equal(isObservedCoverPhaseComplete({ ...base, progress: {}, elapsedMs: 5999 }), false);
  assert.equal(isObservedCoverPhaseComplete({ ...base, progress: {}, elapsedMs: 6000 }), true);
});

test('phase extension still respects narration and the failed-audio deadline', () => {
  const base = { phase: 'TRACKING', phaseStartMs: 0, durationMs: 3000, speechFinished: false,
    progress: { uncoverEvent: { timestampMs: 1000 } } };
  assert.equal(isObservedCoverPhaseComplete({ ...base, elapsedMs: 4000 }), false);
  assert.equal(isObservedCoverPhaseComplete({ ...base, elapsedMs: 11000 }), true);
});
