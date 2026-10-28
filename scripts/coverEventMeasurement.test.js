import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCoverEventMeasurementRecorder, analyzeObservedMovement, getCanthalMovementCoordinates } from '../src/services/coverTest/coverEventMeasurementService.js';
import { calculateRobustBaseline, analyzeUncoverTrajectory } from '../src/services/coverTestMeasurementService.js';
import { aggregateCoverCycles, createObservedCycleRecord, createCoverFrame } from '../src/services/coverTestProtocolService.js';
import { UncoverCaptureObserver } from '../src/services/coverTest/uncoverCaptureService.js';
import { saveCoverTestSessionApi } from '../src/api/coverTestApi.js';
import { createBinocularSession, updateCoverTestData, getSessionData } from '../src/services/binocularScreeningService.js';

const visible = { left: 'VISIBLE', right: 'VISIBLE' };
function frame(timestamp, eye, delta = 0) {
  return { timestamp, t: timestamp - 4000, x: (eye === 'left' ? 0.45 : 0.55) + delta,
    y: 0.5, normalizedX: 0.5 + delta / 0.08, normalizedY: 0.5, eyeWidth: 0.08,
    quality: { isValid: true }, qualityFlag: 'VALID_SAMPLE', isEyeValid: true };
}
function send(recorder, timestampMs, visibility = visible, deltas = {}, qualityValid = true) {
  recorder.observe({ timestampMs, frameId: timestampMs, visibility, qualityValid,
    frames: Object.fromEntries(['left', 'right'].filter(eye => visibility[eye] === 'VISIBLE')
      .map(eye => [eye, frame(timestampMs, eye, deltas[eye] || 0)])) });
}
function seeded(eye = 'left') {
  const recorder = createCoverEventMeasurementRecorder();
  for (let t = 0; t < 1000; t += 50) send(recorder, t);
  recorder.beginCover(eye, 1);
  return recorder;
}
function runLeg({ eye = 'left', fellowMotion = false, recoveryMotion = false, interrupt = null } = {}) {
  const recorder = seeded(eye);
  const opposite = eye === 'left' ? 'right' : 'left';
  for (let t = 1000; t < 2000; t += 50) send(recorder, t);
  for (let t = 2000; t < 5000; t += 50) {
    const delta = fellowMotion ? Math.min(1, Math.max(0, (t - 2100) / 100)) * 0.012 : 0;
    send(recorder, t, interrupt === t ? { left: 'UNKNOWN', right: 'UNKNOWN' }
      : { [eye]: 'OCCLUDED', [opposite]: 'VISIBLE' }, { [opposite]: delta });
  }
  for (let t = 5000; t <= 7000; t += 50) {
    const delta = recoveryMotion ? (1 - Math.min(1, Math.max(0, (t - 5100) / 100))) * 0.012 : 0;
    send(recorder, t, visible, { [eye]: delta, [opposite]: fellowMotion ? 0.012 : 0 });
  }
  return recorder.finishLeg();
}

test('delayed physical action anchors both windows to observed source frames', () => {
  const leg = runLeg({ fellowMotion: true, recoveryMotion: true });
  assert.equal(leg.evidence.procedureValid, true);
  assert.equal(leg.coverOn.eye, 'right');
  assert.equal(leg.coverOn.event.timestampMs, 2000);
  assert.deepEqual(leg.coverOn.event.onsetIntervalMs, [1950, 2000]);
  assert.equal(leg.coverOn.event.confirmedAtMs, 2150);
  assert.equal(leg.coverOn.dataQuality.isValid, true);
  assert.equal(leg.coverOn.isNotableMovement, true);
  assert.equal(leg.coverOn.initialPosition.x, 0.04);
  assert.equal(leg.coverOn.coordinateSpace, 'CANTHAL_FRAME_REFERENCE_WIDTH');
  assert.equal(leg.coverOn.temporalEvents[0].eventType, 'COVER');
  assert.equal(leg.coverOn.temporalEvents[0].timestamp, 2000);
  assert.equal(leg.uncoverRecovery.event.timestampMs, 5000);
  assert.equal(leg.uncoverRecovery.temporalEvents[0].timestamp, 5000);
  assert.equal(leg.uncoverRecovery.initialPosition.t, 0);
  assert.equal(leg.uncoverRecovery.dataQuality.isValid, true);
  assert.equal(leg.uncoverRecovery.isNotableMovement, true);
});

test('covering the right eye observes the left anatomical eye', () => {
  const leg = runLeg({ eye: 'right', fellowMotion: true });
  assert.equal(leg.coverOn.eye, 'left');
  assert.equal(leg.coverOn.event.coveredEye, 'RIGHT');
  assert.equal(leg.coverOn.event.observedEye, 'LEFT');
  assert.equal(leg.uncoverRecovery.eye, 'right');
});

test('head translation, roll and scale do not become eye-local movement', () => {
  const base = { pInner: { x: 100, y: 120 }, pOuter: { x: 180, y: 120 }, pIris: { x: 144, y: 124 }, canthalWidth: 80 };
  const expected = getCanthalMovementCoordinates(base);
  const angle = 0.2; const scale = 1.3;
  const transform = p => ({ x: 75 + scale * (p.x * Math.cos(angle) - p.y * Math.sin(angle)),
    y: 35 + scale * (p.x * Math.sin(angle) + p.y * Math.cos(angle)) });
  const moved = getCanthalMovementCoordinates({ pInner: transform(base.pInner), pOuter: transform(base.pOuter),
    pIris: transform(base.pIris), canthalWidth: 80 * scale });
  assert.ok(Math.abs(moved.normalizedX - expected.normalizedX) < 1e-10);
  assert.ok(Math.abs(moved.normalizedY - expected.normalizedY) < 1e-10);
  const baseline = calculateRobustBaseline(Array.from({ length: 20 }, (_, i) => frame(i * 50, 'right')));
  const samples = Array.from({ length: 31 }, (_, i) => ({ ...frame(2000 + i * 50, 'right'), x: 0.55 + i * 0.001 }));
  const result = analyzeObservedMovement(samples, baseline, { timestampMs: 2000 }, 'cover_on_fellow_eye', 'right', 1);
  assert.equal(result.dataQuality.isValid, true);
  assert.equal(result.normalizedDisplacement, 0);
  assert.equal(result.isNotableMovement, false);
});

for (const [name, visibility] of Object.entries({
  'no cover': visible,
  'wrong side': { left: 'VISIBLE', right: 'OCCLUDED' },
  'both covered': { left: 'OCCLUDED', right: 'OCCLUDED' },
  'unknown opposite eye': { left: 'OCCLUDED', right: 'UNKNOWN' },
  'tracking loss': { left: 'UNKNOWN', right: 'UNKNOWN' },
})) {
  test(`${name} cannot verify a requested left cover`, () => {
    const recorder = seeded();
    for (let t = 1000; t < 3000; t += 50) send(recorder, t, visibility);
    for (let t = 3000; t < 5000; t += 50) send(recorder, t);
    const leg = recorder.finishLeg();
    assert.equal(leg.evidence.procedureValid, false);
    assert.equal(leg.coverOn.dataQuality.isValid, false);
    assert.equal(leg.uncoverRecovery.dataQuality.isValid, false);
  });
}

test('brief occlusion and duplicated frames cannot satisfy duration or confirmation', () => {
  const recorder = seeded();
  send(recorder, 1000, { left: 'OCCLUDED', right: 'VISIBLE' });
  send(recorder, 1000, { left: 'OCCLUDED', right: 'VISIBLE' });
  send(recorder, 1050);
  assert.equal(recorder.finishLeg().evidence.procedureValid, false);
});

test('brief unknown data can recover without invalidating the entire leg', () => {
  const leg = runLeg({ interrupt: 4900 });
  assert.equal(leg.evidence.procedureValid, true);
  assert.equal(leg.coverOn.dataQuality.isValid, true);
  assert.equal(leg.evidence.interruptions.length, 1);
  assert.equal(leg.evidence.interruptions[0].withinRecoveryLimit, true);
});

test('a source-frame gap cannot reuse stale pre-cover evidence', () => {
  const recorder = seeded();
  for (let t = 2000; t < 4000; t += 50) send(recorder, t, { left: 'OCCLUDED', right: 'VISIBLE' });
  for (let t = 4000; t < 6000; t += 50) send(recorder, t);
  assert.equal(recorder.finishLeg().evidence.procedureValid, false);
});

test('each leg requires a fresh stable baseline', () => {
  const recorder = createCoverEventMeasurementRecorder();
  send(recorder, 950);
  recorder.beginCover('left', 1);
  for (let t = 1000; t < 3000; t += 50) send(recorder, t, { left: 'OCCLUDED', right: 'VISIBLE' });
  for (let t = 3000; t < 5000; t += 50) send(recorder, t);
  const leg = recorder.finishLeg();
  assert.equal(leg.evidence.procedureValid, true);
  assert.equal(leg.coverOn.dataQuality.isValid, false);
  assert.equal(leg.coverOn.dataQuality.reason, 'BASELINE_UNSTABLE');
});

test('a brief rejected head sample is excluded while observed data can recover', () => {
  const recorder = seeded();
  for (let t = 1000; t < 3000; t += 50) send(recorder, t,
    { left: 'OCCLUDED', right: 'VISIBLE' }, {}, t !== 1500);
  for (let t = 3000; t < 5000; t += 50) send(recorder, t);
  const leg = recorder.finishLeg();
  assert.equal(leg.coverOn.dataQuality.isValid, true);
  assert.equal(leg.coverOn.sampleCount, 30);
});

test('a sustained head-quality failure in the critical window invalidates the measurement', () => {
  const recorder = seeded();
  for (let t = 1000; t < 3000; t += 50) send(recorder, t,
    { left: 'OCCLUDED', right: 'VISIBLE' }, {}, t < 1300 || t > 1800);
  for (let t = 3000; t < 5000; t += 50) send(recorder, t);
  const leg = recorder.finishLeg();
  assert.equal(leg.coverOn.dataQuality.isValid, false);
  assert.equal(leg.coverOn.dataQuality.reason, 'INSUFFICIENT_EVENT_COVERAGE');
});

test('a complete cover-on window survives missing uncover; UNKNOWN does not refresh event time', () => {
  const recorder = seeded();
  for (let t = 1000; t < 3000; t += 50) send(recorder, t, { left: 'OCCLUDED', right: 'VISIBLE' });
  for (let t = 3000; t < 3500; t += 50) send(recorder, t, { left: 'UNKNOWN', right: 'VISIBLE' });
  for (let t = 3500; t < 5500; t += 50) send(recorder, t);
  const leg = recorder.finishLeg();
  assert.equal(leg.evidence.primaryProcedureValid, true);
  assert.equal(leg.evidence.procedureValid, false);
  assert.equal(leg.evidence.uncoverEvent, null);
  assert.equal(leg.coverOn.dataQuality.isValid, true);
  assert.equal(leg.uncoverRecovery.dataQuality.reason, 'UNCOVER_NOT_CONFIRMED');
  const right = runLeg({ eye: 'right' });
  const cycle = createObservedCycleRecord(1, {}, leg, right);
  assert.equal(cycle.primaryOcclusionVerified, true);
  assert.equal(cycle.occlusionVerified, false);
  assert.equal(cycle.quality.isValid, true);
});

test('swapping anatomical legs cannot produce a valid observed cycle', () => {
  const cycle = createObservedCycleRecord(1, {}, runLeg({ eye: 'right' }), runLeg());
  assert.equal(cycle.quality.isValid, false);
  assert.equal(cycle.quality.reason, 'EYE_SEQUENCE_NOT_CONFIRMED');
});

test('early coverage and valid samples are required even with many late samples', () => {
  const samples = Array.from({ length: 30 }, (_, i) => frame(6000 + i * 50, 'left'));
  const baseline = calculateRobustBaseline(Array.from({ length: 20 }, (_, i) => frame(i * 50, 'left')));
  const result = analyzeObservedMovement(samples, baseline, { timestampMs: 5000 }, 'uncover_recovery', 'left', 1);
  assert.equal(result.dataQuality.reason, 'INSUFFICIENT_EVENT_COVERAGE');
  const unknownSamples = samples.map(f => ({ ...f, qualityFlag: 'UNKNOWN_SAMPLE' }));
  assert.equal(analyzeUncoverTrajectory(unknownSamples, baseline, 'left', 1, 0.08).dataQuality.isValid, false);
});

test('a late blink cannot erase complete early movement when a separate contiguous settling segment exists', () => {
  const baseline = calculateRobustBaseline(Array.from({ length: 20 }, (_, i) => frame(i * 50, 'right')));
  const samples = Array.from({ length: 31 }, (_, i) => {
    const t = i * 50, delta = Math.min(1, Math.max(0, (t - 100) / 100)) * 0.012;
    return frame(2000 + t, 'right', delta);
  }).filter(f => f.timestamp < 2600 || f.timestamp >= 3000);
  const result = analyzeObservedMovement(samples, baseline, { timestampMs: 2000 }, 'cover_on_fellow_eye', 'right', 1);
  assert.equal(result.dataQuality.isValid, true);
  assert.equal(result.isNotableMovement, true);
  assert.equal(result.coverage.earlyValidSamples, 11);
  assert.equal(result.coverage.lateGaps.length, 1);
  assert.ok(result.coverage.settlingSpanMs >= 200);
  assert.deepEqual(result.dataQuality.warnings, ['LATE_GAP_EXCLUDED_FROM_KINEMATICS']);
});

test('a gap crossing the early window or an insufficient stable tail remains inconclusive', () => {
  const baseline = calculateRobustBaseline(Array.from({ length: 20 }, (_, i) => frame(i * 50, 'right')));
  const samples = Array.from({ length: 31 }, (_, i) => frame(2000 + i * 50, 'right'));
  const lostEarly = samples.filter(f => f.timestamp < 2250 || f.timestamp >= 2700);
  assert.equal(analyzeObservedMovement(lostEarly, baseline, { timestampMs: 2000 }, 'cover_on_fellow_eye', 'right', 1).dataQuality.isValid, false);
  const lostTail = samples.filter(f => f.timestamp <= 2800 || f.timestamp >= 3400);
  assert.equal(analyzeObservedMovement(lostTail, baseline, { timestampMs: 2000 }, 'cover_on_fellow_eye', 'right', 1).dataQuality.reason, 'INSUFFICIENT_SETTLING_COVERAGE');
});

test('a contiguous but unstable tail cannot be used to rescue a late tracking gap', () => {
  const baseline = calculateRobustBaseline(Array.from({ length: 20 }, (_, i) => frame(i * 50, 'right')));
  const samples = Array.from({ length: 31 }, (_, i) => frame(2000 + i * 50, 'right',
    i >= 20 ? (i % 2 ? 0.02 : -0.02) : 0)).filter(f => f.timestamp < 2600 || f.timestamp >= 3000);
  const result = analyzeObservedMovement(samples, baseline, { timestampMs: 2000 }, 'cover_on_fellow_eye', 'right', 1);
  assert.equal(result.dataQuality.isValid, false);
  assert.equal(result.dataQuality.reason, 'UNSTABLE_SETTLING');
  assert.equal(result.isNotableMovement, false);
});

test('missing eye landmarks are unknown measurement evidence despite capture fallback', () => {
  const observer = new UncoverCaptureObserver();
  const lm = []; lm[1] = { x: 0.5, y: 0.5 };
  const observation = observer.observe({ width: 640, height: 480 }, lm, 0, 'BASELINE', () => null);
  assert.deepEqual(observation.measurementVisibility, { left: 'UNKNOWN', right: 'UNKNOWN' });
});

test('procedure and image status stay independent; recovery alone cannot drive the cover verdict', () => {
  const left = runLeg({ recoveryMotion: true });
  const right = runLeg({ eye: 'right', recoveryMotion: true });
  const cycles = [1, 2, 3].map(c => createObservedCycleRecord(c, {}, left, right));
  cycles.forEach(c => {
    c.imageCaptureComplete = false;
    assert.equal(c.occlusionVerified, true);
    assert.equal(c.rightEye.isNotableMovement, false);
    assert.equal(c.uncoverRecovery.leftEye.isNotableMovement, true);
  });
  assert.equal(aggregateCoverCycles(cycles).verdict, 'NO_SIGNIFICANT_REFIXATION');
  const invalid = [1, 2, 3].map(c => ({ ...createObservedCycleRecord(c, {}, null, null),
    valid: true, imageCaptureComplete: true }));
  assert.equal(aggregateCoverCycles(invalid).verdict, 'INCONCLUSIVE');
});

test('repeated fellow-eye movement reaches the primary summary with correct eye mapping', () => {
  const left = runLeg({ fellowMotion: true });
  const right = runLeg({ eye: 'right' });
  const cycles = [1, 2, 3].map(c => createObservedCycleRecord(c, {}, left, right));
  const summary = aggregateCoverCycles(cycles);
  assert.equal(summary.verdict, 'REFIXATION_DETECTED');
  assert.equal(summary.aggregatedRight.notableMovementCycles, 3);
  assert.equal(summary.aggregatedLeft.notableMovementCycles, 0);
});

test('an isolated movement stays inconclusive through the final session', () => {
  const stableLeft = runLeg(); const stableRight = runLeg({ eye: 'right' });
  const cycles = [1, 2, 3].map(c => createObservedCycleRecord(c, {},
    c === 1 ? runLeg({ fellowMotion: true }) : stableLeft, stableRight));
  const summary = aggregateCoverCycles(cycles);
  assert.equal(summary.verdict, 'INCONCLUSIVE');
  assert.equal(summary.quality.status, 'INCONCLUSIVE');
  const session = createBinocularSession();
  updateCoverTestData(session.sessionId, { ...summary, measurementProtocol: 'observed-cover-uncover-v1',
    primaryMeasurement: 'cover_on_fellow_eye' });
  const saved = getSessionData(session.sessionId).coverTest;
  assert.equal(saved.status, 'INCONCLUSIVE');
  assert.equal(saved.refixationDetected, false);
  assert.equal(saved.primaryMeasurement, 'cover_on_fellow_eye');
});

test('observed visibility can sample pre-cover eyes without treating instructions as evidence', () => {
  const quality = { faceDetected: true, irisValid: true, leftEyeDetected: true,
    coveredEye: null, eyeVisibility: visible };
  const features = { raw: { leftIrisX: 0.45, leftIrisY: 0.5 }, leftEyeWidth: 0.08,
    leftHorizontalRatio: 0.5, leftVerticalRatio: 0.5, observedVisibility: visible };
  assert.ok(createCoverFrame(features, quality, 'left', 0, 0).frame);
  assert.equal(createCoverFrame(features, { ...quality, eyeVisibility: { left: 'OCCLUDED' } }, 'left', 0, 0).reason, 'OCCLUDED');
});

test('multipart payload preserves observed measurements independently from photo events', async () => {
  const original = globalThis.fetch;
  let payload;
  let metadata;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('/ping')) return new Response(JSON.stringify({ status: 'alive' }));
    payload = JSON.parse(await options.body.get('cycle_1_raw').text());
    metadata = JSON.parse(options.body.get('session_metadata'));
    return new Response(JSON.stringify({ success: true }));
  };
  try {
    const record = createObservedCycleRecord(1, {}, runLeg(), runLeg({ eye: 'right' }));
    record.imageCaptureComplete = false;
    await saveCoverTestSessionApi({ sessionId: '11111111-1111-4111-8111-111111111111', cycles: [record] });
    assert.equal(payload.primaryMeasurement, 'cover_on_fellow_eye');
    assert.equal(payload.coverOn.rightEye.event.timestampMs, 2000);
    assert.equal(payload.uncoverRecovery.leftEye.event.timestampMs, 5000);
    assert.equal(payload.occlusionVerified, true);
    assert.equal(payload.primaryOcclusionVerified, true);
    assert.equal(payload.imageCaptureComplete, false);
    assert.equal(payload.procedureEvidence.length, 2);
    assert.equal(metadata.clientMetadata.observedCoverMeasurements[0].coverOn.rightEye.event.timestampMs, 2000);
  } finally { globalThis.fetch = original; }
});
