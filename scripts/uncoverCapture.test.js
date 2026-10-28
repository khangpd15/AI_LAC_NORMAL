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
test('confirm sustained visibility but retain first frame and timestamp at 30 FPS', () => {
  const machine = new UncoverTransition();
  arm(machine);
  const image = { frameId: 8 };
  const update = timestampMs => machine.update({ timestampMs, visibility: { left: 'VISIBLE', right: 'VISIBLE' }, candidate: () => image });
  assert.equal(update(8000 / 30), null);
  assert.equal(update(8000 / 30), null);
  for (const t of [300, 1000 / 3, 1100 / 3]) assert.equal(update(t), null);
  const event = update(400);
  assert.equal(event.image, image);
  assert.equal(event.timestampMs, 8000 / 30);
  assert.equal(event.confirmedAtMs, 400);
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
  const baseline = { pupilContrast: 30, dynamicRange: 100, stdDev: 30, mean: 110, minLum: 30, appearance: Array.from({length:48}, (_,i)=>i%3===0?30:140) };
  const frame = { canthalWidth: 50, palpebralHeight: 16 };
  for (const mean of [170, 20]) assert.equal(classifyEyeVisibility({
    pupilContrast: 2, dynamicRange: 10, stdDev: 3, mean, minLum: 15,
  }, frame, baseline), 'OCCLUDED');
  assert.equal(classifyEyeVisibility(baseline, frame, baseline), 'VISIBLE');
  assert.equal(classifyEyeVisibility(baseline, { ...frame, palpebralHeight: 2 }, baseline), 'UNKNOWN');
  assert.equal(classifyEyeVisibility(baseline, frame, null), 'UNKNOWN');
  assert.equal(classifyEyeVisibility({ pupilContrast: 2, dynamicRange: 10, stdDev: 3, mean: 170, minLum: 15 },
    { ...frame, palpebralHeight: 2 }, baseline), 'UNKNOWN');
});

test('slow phone confirms a real cover and keeps first clear frame through brief hand transition', () => {
  for (const interval of [150, 200]) {
    const machine = new UncoverTransition();
    machine.reset('left');
    const update = (t, left) => machine.update({ timestampMs: t,
      visibility: { left, right: 'VISIBLE' }, candidate: () => ({ frameId: t }) });
    update(0, 'OCCLUDED'); update(interval, 'OCCLUDED');
    assert.equal(update(interval * 2, 'VISIBLE'), null);
    assert.equal(update(interval * 3, 'VISIBLE'), null);
    const event = update(interval * 4, 'VISIBLE');
    assert.equal(event.timestampMs, interval * 2);
    assert.equal(event.lastCoveredMs, interval);
  }
  const machine = new UncoverTransition();
  arm(machine);
  machine.update({ timestampMs: 260, visibility: { left: 'UNKNOWN', right: 'VISIBLE' }, candidate: () => null });
  machine.update({ timestampMs: 300, visibility: { left: 'VISIBLE', right: 'VISIBLE' }, candidate: () => ({}) });
  for (const t of [333, 366, 400]) assert.equal(machine.update({ timestampMs: t, visibility: { left: 'VISIBLE', right: 'VISIBLE' }, candidate: () => ({}) }), null);
  assert.ok(machine.update({ timestampMs: 433, visibility: { left: 'VISIBLE', right: 'VISIBLE' }, candidate: () => ({}) }));
});
test('encoding both crops does not replace capture timestamp with encoding completion', async () => {
  const canvas = { width: 32, height: 16, toBlob: cb => setTimeout(() => cb(new Blob(['jpeg'], { type: 'image/jpeg' })), 5) };
  const result = await encodeEyePair({ image: { frame: { frameId: 9, timestampEpochMs: 1234, timestampMs: 300, sourceWidth: 100, sourceHeight: 80 }, eyes: {
    left: { canvas, cropRegion: { x: 1, y: 1, width: 32, height: 16 } }, right: { canvas, cropRegion: { x: 40, y: 1, width: 32, height: 16 } },
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

test('createCoverFrame rejects occluded/covered eye and avoids recording hand coordinates', async () => {
  const { createCoverFrame, COVER_QUALITY_REASONS } = await import('../src/services/coverTestProtocolService.js');
  const validFeatures = {
    timestamp: 100,
    raw: { leftIrisX: 0.35, leftIrisY: 0.45, rightIrisX: 0.65, rightIrisY: 0.45 },
    leftEyeWidth: 0.08,
    rightEyeWidth: 0.08,
    leftHorizontalRatio: 0.5,
    rightHorizontalRatio: 0.5,
    observedVisibility: { left: 'OCCLUDED', right: 'VISIBLE' },
  };
  const quality = {
    faceDetected: true,
    headPoseValid: true,
    irisValid: true,
    leftEyeDetected: true,
    rightEyeDetected: true,
    eyeVisibility: { left: 'OCCLUDED', right: 'VISIBLE' },
  };

  const leftResult = createCoverFrame(validFeatures, quality, 'left', 100, 50);
  assert.equal(leftResult.frame, null);
  assert.equal(leftResult.reason, COVER_QUALITY_REASONS.OCCLUDED);

  const rightResult = createCoverFrame(validFeatures, quality, 'right', 100, 50);
  assert.ok(rightResult.frame);
  assert.equal(rightResult.reason, null);
});

test('UncoverTransition remains armed across 7-second cover phase while eye is covered', () => {
  const machine = new UncoverTransition();
  machine.reset('left');
  // Initial arming
  for (let t = 0; t <= 150; t += 33) {
    machine.update({ timestampMs: t, visibility: { left: 'OCCLUDED', right: 'VISIBLE' }, candidate: () => null });
  }
  assert.equal(machine.armed, true);

  // User holds hand over eye for full 7 seconds (7000ms), with occasional lighting/hand jitter (UNKNOWN)
  for (let t = 200; t <= 7000; t += 100) {
    const isGlitch = t % 1200 === 0;
    machine.update({
      timestampMs: t,
      visibility: { left: isGlitch ? 'UNKNOWN' : 'OCCLUDED', right: 'VISIBLE' },
      candidate: () => null,
    });
  }
  assert.equal(machine.armed, true, 'Machine must remain armed throughout the entire 7s cover duration');

  // Now user uncovers at 7033ms
  machine.update({ timestampMs: 7033, visibility: { left: 'VISIBLE', right: 'VISIBLE' }, candidate: () => ({ frameId: 'uncover_frame' }) });
  for (const t of [7066, 7099, 7132]) assert.equal(machine.update({ timestampMs: t, visibility: { left: 'VISIBLE', right: 'VISIBLE' }, candidate: () => ({}) }), null);
  const event = machine.update({ timestampMs: 7166, visibility: { left: 'VISIBLE', right: 'VISIBLE' }, candidate: () => ({}) });
  assert.ok(event, 'Must confirm sustained opening while retaining the first source frame');
  assert.equal(event.image.frameId, 'uncover_frame');
  assert.equal(event.uncoveredEye, 'left');
});

test('Chống chụp nhầm mí mắt: mí mắt he hé/nhắm tuyệt đối không được VISIBLE; chỉ mắt mở thật mới chụp', () => {
  const appearance = Array.from({length:48},(_,i)=>i%3===0?30:140);
  const baseline = { pupilContrast: 25, dynamicRange: 90, stdDev: 25, mean: 110, minLum: 65, appearance };
  const frameWide = { canthalWidth: 50, palpebralHeight: 12 }; // aperture = 0.24 (mắt mở thật)
  const frameSquint = { canthalWidth: 50, palpebralHeight: 6 }; // aperture = 0.12 (mí mắt he hé)
  const frameClosed = { canthalWidth: 50, palpebralHeight: 2 }; // aperture = 0.04 (mí mắt nhắm)

  const openPatch = { pupilContrast: 20, dynamicRange: 80, stdDev: 22, mean: 110, minLum: 72, skinRatio: 0.18, appearance };
  const eyelidPatch = { pupilContrast: 6, dynamicRange: 20, stdDev: 8, mean: 115, minLum: 95, skinRatio: 0.32 };
  const handPatch = { pupilContrast: 3, dynamicRange: 15, stdDev: 5, mean: 135, minLum: 120, skinRatio: 0.48 };

  // 1. Hình học mí quá hẹp: giữ UNKNOWN, không coi là mắt mở.
  assert.equal(classifyEyeVisibility(handPatch, frameClosed, baseline), 'UNKNOWN');

  // 2. Mí mắt nhắm / he hé -> TUYỆT ĐỐI KHÔNG ĐƯỢC VISIBLE
  assert.notEqual(classifyEyeVisibility(eyelidPatch, frameSquint, baseline), 'VISIBLE');
  assert.equal(classifyEyeVisibility(openPatch, frameSquint, baseline), 'UNKNOWN');
  assert.equal(classifyEyeVisibility(openPatch, frameClosed, baseline), 'UNKNOWN');

  // 3. Mắt mở thật sự -> VISIBLE
  assert.equal(classifyEyeVisibility(openPatch, frameWide, baseline), 'VISIBLE');

  // 4. Kịch bản Uncover: khi hạ tay qua giai đoạn mí mắt rồi mở thật
  const machine = new UncoverTransition();
  machine.reset('left');
  // Che mắt 150ms
  machine.update({ timestampMs: 0, visibility: { left: 'OCCLUDED', right: 'VISIBLE' }, candidate: () => null });
  machine.update({ timestampMs: 150, visibility: { left: 'OCCLUDED', right: 'VISIBLE' }, candidate: () => null });
  assert.equal(machine.armed, true);

  // Hạ tay nhưng mắt còn nheo/mí mắt (UNKNOWN) -> KHÔNG ĐƯỢC CHỤP
  assert.equal(machine.update({ timestampMs: 250, visibility: { left: 'UNKNOWN', right: 'VISIBLE' }, candidate: () => ({ frameId: 'eyelid' }) }), null);
  assert.equal(machine.candidate, null, 'Không được lưu candidate khi mắt mới chỉ là mí mắt nheo');

  // Mắt mở thật: xác nhận đủ thời gian nhưng giữ ảnh rõ đầu tiên.
  machine.update({ timestampMs: 300, visibility: { left: 'VISIBLE', right: 'VISIBLE' }, candidate: () => ({ frameId: 'real_open_eye' }) });
  for (const t of [333, 366, 400]) assert.equal(machine.update({ timestampMs: t, visibility: { left: 'VISIBLE', right: 'VISIBLE' }, candidate: () => ({}) }), null);
  const capturedEvent = machine.update({ timestampMs: 433, visibility: { left: 'VISIBLE', right: 'VISIBLE' }, candidate: () => ({}) });
  assert.ok(capturedEvent, 'Phải chụp ngay khi mắt mở to');
  assert.equal(capturedEvent.image.frameId, 'real_open_eye', 'Ảnh chụp phải là lúc mắt đã mở thật');
});

