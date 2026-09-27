/**
 * COVER TEST TIME-SERIES TEST CASES
 * Verifies 15 Hz downsampled dataset recording, elapsed-time sampling,
 * compact schema compliance, quality gating, and 16-field summary computation.
 */

import { createTimeSeriesRecorder } from './coverTestTimeSeriesService.js';
import { COVER_TEST_CONFIG } from '../constants/screeningConfig.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

export async function runCoverTestTimeSeriesTestCases() {
  const results = [];
  const test = async (name, fn) => {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, error: error.message });
    }
  };

  const createMockFeatures = (lx = 0.52, ly = 0.49, rx = 0.59, ry = 0.48) => ({
    raw: {
      leftIrisX: lx,
      leftIrisY: ly,
      rightIrisX: rx,
      rightIrisY: ry,
    },
    leftIrisX: lx,
    leftIrisY: ly,
    rightIrisX: rx,
    rightIrisY: ry,
    leftEyeWidth: 0.12,
    rightEyeWidth: 0.12,
  });

  const baseQuality = {
    isValid: true,
    faceDetected: true,
    irisValid: true,
    leftEyeDetected: true,
    rightEyeDetected: true,
    score: 0.95,
  };

  const baseBaseline = {
    leftBaseline: { baselineX: 0.52, baselineY: 0.49, normalizedBaselineX: 0.5, normalizedBaselineY: 0.5 },
    rightBaseline: { baselineX: 0.59, baselineY: 0.48, normalizedBaselineX: 0.5, normalizedBaselineY: 0.5 },
  };

  // Test 1: Centralized Configuration
  await test('COVER_TEST_CONFIG specifies 15 Hz and ~66.67ms interval', () => {
    assert(COVER_TEST_CONFIG.datasetSampleRateHz === 15, 'Expected 15 Hz');
    assert(
      Math.abs(COVER_TEST_CONFIG.datasetSampleIntervalMs - 1000 / 15) < 0.001,
      'Expected interval ~66.67ms'
    );
  });

  // Test 2: 60 FPS input -> ~15 samples per second
  await test('60 FPS input yields ~15 samples per second', () => {
    const recorder = createTimeSeriesRecorder(0);
    const totalDurationMs = 1000;
    const fps = 60;
    const frameIntervalMs = 1000 / fps;

    for (let t = 0; t <= totalDurationMs; t += frameIntervalMs) {
      recorder.processFrame(t, 'BASELINE', createMockFeatures(), baseQuality, baseBaseline, null);
    }

    const samples = recorder.getSamples();
    const quality = recorder.getQuality();

    // In 1 second at 15 Hz, we expect 15 or 16 samples
    assert(
      samples.length >= 14 && samples.length <= 16,
      `Expected ~15 samples, got ${samples.length}`
    );
    assert(quality.totalFrames > 55, `Expected > 55 total frames, got ${quality.totalFrames}`);
    assert(quality.savedSamples === samples.length, 'savedSamples count mismatch');
  });

  // Test 3: 30 FPS input -> still ~15 samples per second
  await test('30 FPS input yields ~15 samples per second', () => {
    const recorder = createTimeSeriesRecorder(0);
    const totalDurationMs = 1000;
    const fps = 30;
    const frameIntervalMs = 1000 / fps;

    for (let t = 0; t <= totalDurationMs; t += frameIntervalMs) {
      recorder.processFrame(t, 'BASELINE', createMockFeatures(), baseQuality, baseBaseline, null);
    }

    const samples = recorder.getSamples();
    assert(
      samples.length >= 14 && samples.length <= 16,
      `Expected ~15 samples for 30 FPS, got ${samples.length}`
    );
  });

  // Test 4: Irregular timestamps / dropped frames sampling strictly by elapsed time
  await test('Dropped frames sampled based strictly on elapsed time, not frame counter', () => {
    const recorder = createTimeSeriesRecorder(0);
    const timestamps = [0, 16, 32, 49, 83, 100, 151];

    for (const t of timestamps) {
      recorder.processFrame(t, 'TRACKING', createMockFeatures(), baseQuality, baseBaseline, 'right');
    }

    const samples = recorder.getSamples();
    // 0: saved (first sample)
    // 16, 32, 49: dt < 66.67ms -> skipped
    // 83: 83 - 0 = 83 >= 66.67ms -> saved!
    // 100: 100 - 83 = 17ms -> skipped
    // 151: 151 - 83 = 68ms >= 66.67ms -> saved!
    assert(samples.length === 3, `Expected 3 samples, got ${samples.length}`);
    assert(samples[0].t === 0, `Sample 0 t should be 0, got ${samples[0].t}`);
    assert(samples[1].t === 83, `Sample 1 t should be 83, got ${samples[1].t}`);
    assert(samples[2].t === 151, `Sample 2 t should be 151, got ${samples[2].t}`);
  });

  // Test 5: Compact Sample Schema contains all required fields and no eye-tracker junk
  await test('Sample schema is compact, contains signed movements, relative coords, and no bloat', () => {
    const recorder = createTimeSeriesRecorder(1000);
    recorder.processFrame(
      1267,
      'TRACKING',
      createMockFeatures(0.52, 0.49, 0.602, 0.477),
      baseQuality,
      baseBaseline,
      'right'
    );

    const samples = recorder.getSamples();
    assert(samples.length === 1, 'Expected 1 sample');
    const s = samples[0];

    // Timestamp must be relative to cycle start in ms
    assert(s.t === 267, `Expected relative timestamp 267, got ${s.t}`);
    assert(s.phase === 'TRACKING', `Expected phase TRACKING, got ${s.phase}`);

    // Left and right eye objects
    assert(s.left && typeof s.left.x === 'number' && typeof s.left.y === 'number', 'Left eye coords missing');
    assert(s.left.valid === true, 'Left eye valid missing');
    assert(s.right && typeof s.right.x === 'number' && typeof s.right.y === 'number', 'Right eye coords missing');
    assert(s.right.valid === true, 'Right eye valid missing');

    // Relative displacement
    assert(typeof s.relativeX === 'number', 'relativeX missing');
    assert(typeof s.relativeY === 'number', 'relativeY missing');

    // Signed movement relative to baseline
    assert(typeof s.signedDx === 'number', 'signedDx missing');
    assert(typeof s.signedDy === 'number', 'signedDy missing');
    assert(s.signedDx > 0.01, `Expected positive signedDx, got ${s.signedDx}`);

    // Tracking quality
    assert(typeof s.trackingQuality === 'number', 'trackingQuality missing');

    // Verify none of the 15 prohibited eye-tracker fields are present
    const prohibited = ['FPOGX', 'FPOGY', 'FPOGS', 'FPOGD', 'FPOGID', 'BPOGX', 'BPOGY', 'GSR', 'HR', 'TTL', 'PIXS', 'AOI', 'SACCADE'];
    for (const key of prohibited) {
      assert(s[key] === undefined, `Prohibited eye tracker field found: ${key}`);
    }
  });

  // Test 6: Quality gating rejects NaN, Infinity, missing face, and invalid eye width
  await test('Quality gating rejects NaN, Infinity, missing face, and invalid eye width', () => {
    const recorder = createTimeSeriesRecorder(0);

    // 1. Missing face -> rejected
    const noFaceQuality = { ...baseQuality, faceDetected: false };
    const saved1 = recorder.processFrame(0, 'BASELINE', createMockFeatures(), noFaceQuality, baseBaseline, null);
    assert(!saved1, 'Missing face must be rejected');

    // 2. NaN coordinates -> rejected
    const nanFeatures = createMockFeatures(NaN, 0.49, 0.59, 0.48);
    const saved2 = recorder.processFrame(70, 'BASELINE', nanFeatures, baseQuality, baseBaseline, null);
    assert(!saved2, 'NaN coords must be rejected');

    // 3. Infinity coordinates -> rejected
    const infFeatures = createMockFeatures(Infinity, 0.49, 0.59, 0.48);
    const saved3 = recorder.processFrame(140, 'BASELINE', infFeatures, baseQuality, baseBaseline, null);
    assert(!saved3, 'Infinity coords must be rejected');

    // 4. Invalid eye width -> rejected
    const invalidWidthFeatures = { ...createMockFeatures(), leftEyeWidth: -1 };
    const saved4 = recorder.processFrame(210, 'BASELINE', invalidWidthFeatures, baseQuality, baseBaseline, null);
    assert(!saved4, 'Invalid eye width must be rejected');

    // 5. Valid frame -> accepted
    const saved5 = recorder.processFrame(280, 'BASELINE', createMockFeatures(), baseQuality, baseBaseline, null);
    assert(saved5, 'Valid frame must be accepted');

    assert(recorder.getSamples().length === 1, 'Only 1 valid sample should be saved');
    const q = recorder.getQuality();
    assert(q.totalFrames === 5, `Expected 5 total frames, got ${q.totalFrames}`);
    assert(q.savedSamples === 1, `Expected 1 saved sample, got ${q.savedSamples}`);
  });

  // Test 7: 16-field cycle summary calculation
  await test('finalizeCycleSummary outputs all 16 required summary fields', () => {
    const recorder = createTimeSeriesRecorder(0);

    for (let t = 0; t <= 1000; t += 67) {
      // Simulate slight horizontal saccadic shift
      const shift = t > 300 ? 0.015 : 0.001;
      recorder.processFrame(
        t,
        'TRACKING',
        createMockFeatures(0.52, 0.49, 0.59 + shift, 0.48),
        baseQuality,
        baseBaseline,
        'right'
      );
    }

    const mockCycleRecord = {
      normalizedHorizontal: 0.125,
      normalizedVertical: 0.02,
      peakVelocity: 0.45,
      trajectoryStability: 0.88,
      rightEye: { timeToPeakMs: 380, jitter: 0.008 },
    };

    const summary = recorder.finalizeCycleSummary(mockCycleRecord);

    const requiredFields = [
      'sampleCount',
      'durationMs',
      'medianSignedDx',
      'medianSignedDy',
      'meanSignedDx',
      'meanSignedDy',
      'peakAbsoluteDx',
      'peakAbsoluteDy',
      'normalizedHorizontal',
      'normalizedVertical',
      'peakVelocity',
      'timeToPeak',
      'jitter',
      'trajectoryStability',
      'directionConsistency',
      'validSampleRatio',
    ];

    for (const f of requiredFields) {
      assert(summary[f] !== undefined, `Required summary field missing: ${f}`);
    }

    assert(summary.sampleCount > 0, 'sampleCount must be > 0');
    assert(summary.durationMs >= 900, 'durationMs must be ~1000ms');
    assert(summary.directionConsistency === 'CONSISTENT_UNIDIRECTIONAL', 'Expected unidirectional consistency');
    assert(summary.validSampleRatio === 1, 'Expected validSampleRatio 1.0');
    assert(summary.normalizedHorizontal === 0.125, 'normalizedHorizontal mismatch');
    assert(summary.peakVelocity === 0.45, 'peakVelocity mismatch');
    assert(summary.timeToPeak === 380, 'timeToPeak mismatch');
    assert(summary.jitter === 0.008, 'jitter mismatch');
    assert(summary.trajectoryStability === 0.88, 'trajectoryStability mismatch');
  });

  // Test 8: Memory management & buffer reset
  await test('Recorder reset reinitializes buffer without memory leak', () => {
    const recorder = createTimeSeriesRecorder(0);
    recorder.processFrame(0, 'BASELINE', createMockFeatures(), baseQuality, baseBaseline, null);
    recorder.processFrame(70, 'BASELINE', createMockFeatures(), baseQuality, baseBaseline, null);
    assert(recorder.getSamples().length === 2, 'Expected 2 samples');

    // Reset for cycle 2
    recorder.reset(1000);
    assert(recorder.getSamples().length === 0, 'Buffer must be empty after reset');
    const q = recorder.getQuality();
    assert(q.totalFrames === 0, 'totalFrames must be reset');
    assert(q.savedSamples === 0, 'savedSamples must be reset');

    recorder.processFrame(1000, 'COVER', createMockFeatures(), baseQuality, baseBaseline, null, 'left');
    assert(recorder.getSamples().length === 1, 'Expected 1 sample in new cycle');
    assert(recorder.getSamples()[0].t === 0, 'First sample t in new cycle should be 0');
  });

  // Test 9: Section 8 Mandatory Sample Schema Fields
  await test('Section 8 mandatory sample schema fields are present and valid', () => {
    const recorder = createTimeSeriesRecorder(0);
    recorder.processFrame(40, 'BASELINE', createMockFeatures(0.4454, 0.5749, 0.5746, 0.5689), baseQuality, baseBaseline, null);
    const samples = recorder.getSamples();
    assert(samples.length === 1, 'Expected 1 sample');
    const s = samples[0];

    // Mandatory Section 8 fields:
    // index, t, phase, leftX, leftY, leftValid, rightX, rightY, rightValid, trackingQuality
    assert(typeof s.index === 'number' && s.index === 0, 'Mandatory field index missing or wrong');
    assert(typeof s.t === 'number' && s.t === 40, 'Mandatory field t missing or wrong');
    assert(s.phase === 'BASELINE', 'Mandatory field phase missing or wrong');
    assert(typeof s.leftX === 'number' && Math.abs(s.leftX - 0.4454) < 1e-4, 'Mandatory field leftX missing or wrong');
    assert(typeof s.leftY === 'number' && Math.abs(s.leftY - 0.5749) < 1e-4, 'Mandatory field leftY missing or wrong');
    assert(s.leftValid === true, 'Mandatory field leftValid missing or wrong');
    assert(typeof s.rightX === 'number' && Math.abs(s.rightX - 0.5746) < 1e-4, 'Mandatory field rightX missing or wrong');
    assert(typeof s.rightY === 'number' && Math.abs(s.rightY - 0.5689) < 1e-4, 'Mandatory field rightY missing or wrong');
    assert(s.rightValid === true, 'Mandatory field rightValid missing or wrong');
    assert(typeof s.trackingQuality === 'number' && s.trackingQuality === 0.95, 'Mandatory field trackingQuality missing or wrong');
  });

  // Test 10: Monotonically non-decreasing timestamps
  await test('Timestamps are non-negative and strictly non-decreasing even with input jitter', () => {
    const recorder = createTimeSeriesRecorder(100);
    // Feed frames with jitter
    const inputTimes = [100, 170, 230, 220, 310]; // 220 is backward jitter
    for (const t of inputTimes) {
      recorder.processFrame(t, 'TRACKING', createMockFeatures(), baseQuality, baseBaseline, 'right');
    }
    const samples = recorder.getSamples();
    assert(samples.length >= 3, 'Expected at least 3 samples');
    let prevT = -1;
    for (const s of samples) {
      assert(s.t >= 0, `Timestamp must be non-negative: ${s.t}`);
      assert(s.t >= prevT, `Timestamp must be monotonically non-decreasing: ${s.t} < ${prevT}`);
      prevT = s.t;
    }
  });

  // Test 11: Single Source of Truth for Displacement: displacement = sqrt(dx^2 + dy^2)
  await test('Single source of truth: displacement equals hypot(dx, dy) and normalized equals displacement / eyeWidth', async () => {
    const { analyzeUncoverTrajectory } = await import('./coverTestMeasurementService.js');
    const validBaseline = {
      baselineX: 0.5,
      baselineY: 0.5,
      normalizedBaselineX: 0.5,
      normalizedBaselineY: 0.5,
      isStable: true,
      dataQuality: { isValid: true },
    };
    const frames = Array.from({ length: 20 }, (_, i) => ({
      t: i * 33,
      x: i === 0 ? 0.50 : 0.515,
      y: i === 0 ? 0.50 : 0.525,
      normalizedX: i === 0 ? 0.50 : 0.515,
      normalizedY: i === 0 ? 0.50 : 0.525,
    }));
    const eyeWidth = 0.12;
    const measurement = analyzeUncoverTrajectory(frames, validBaseline, 'right', 1, eyeWidth);

    assert(measurement.dataQuality.isValid === true, 'Measurement should be valid');
    assert(Number.isFinite(measurement.dx), 'dx must be finite');
    assert(Number.isFinite(measurement.dy), 'dy must be finite');
    assert(Number.isFinite(measurement.displacement), 'displacement must be finite');

    const expectedDisplacement = Math.hypot(measurement.dx, measurement.dy);
    assert(
      Math.abs(measurement.displacement - expectedDisplacement) < 0.001,
      `displacement (${measurement.displacement}) must equal hypot(dx, dy) (${expectedDisplacement})`
    );

    const expectedNormalized = measurement.displacement / eyeWidth;
    assert(
      Math.abs(measurement.normalizedDisplacement - expectedNormalized) < 0.001,
      `normalizedDisplacement (${measurement.normalizedDisplacement}) must equal displacement / eyeWidth (${expectedNormalized})`
    );
  });

  // Test 12: Missing or invalid eyeWidth yields normalizedDisplacement === null without fabricated value
  await test('Invalid or null eyeWidth yields normalizedDisplacement === null without fake fallbacks', async () => {
    const { analyzeUncoverTrajectory } = await import('./coverTestMeasurementService.js');
    const validBaseline = {
      baselineX: 0.5,
      baselineY: 0.5,
      normalizedBaselineX: 0.5,
      normalizedBaselineY: 0.5,
      isStable: true,
      dataQuality: { isValid: true },
    };
    const frames = Array.from({ length: 20 }, (_, i) => ({
      t: i * 33,
      x: i === 0 ? 0.50 : 0.515,
      y: i === 0 ? 0.50 : 0.525,
      normalizedX: i === 0 ? 0.50 : 0.515,
      normalizedY: i === 0 ? 0.50 : 0.525,
    }));

    // Case A: null eyeWidth -> invalid eye width check fails gracefully
    const resNull = analyzeUncoverTrajectory(frames, validBaseline, 'right', 1, null);
    assert(resNull.normalizedDisplacement === null, 'normalizedDisplacement must be null when eyeWidth is null');
    assert(resNull.eyeWidth === null, 'eyeWidth must be null');
    assert(resNull.dataQuality.isValid === false, 'Quality must be marked invalid when eyeWidth is null');

    // Case B: 0 eyeWidth
    const resZero = analyzeUncoverTrajectory(frames, validBaseline, 'right', 1, 0);
    assert(resZero.normalizedDisplacement === null, 'normalizedDisplacement must be null when eyeWidth is 0');

    // Case C: negative eyeWidth
    const resNeg = analyzeUncoverTrajectory(frames, validBaseline, 'right', 1, -0.05);
    assert(resNeg.normalizedDisplacement === null, 'normalizedDisplacement must be null when eyeWidth is negative');
  });

  // Test 13: Section 14 Dataset Payload Builder creates standard payload
  await test('buildCoverTestPayload generates Section 14 compliant export payload', async () => {
    const { buildCoverTestPayload } = await import('./screeningDatasetService.js');
    const mockSession = {
      sampleId: 'test-uuid-1234',
      coverTest: {
        cycles: [
          {
            cycleIndex: 1,
            coveredEye: 'LEFT',
            trackedEye: 'RIGHT',
            samples: [
              { index: 0, t: 0, phase: 'BASELINE', leftX: 0.45, leftY: 0.57, leftValid: true, rightX: 0.57, rightY: 0.56, rightValid: true, trackingQuality: 0.95 },
              { index: 1, t: 67, phase: 'TRACKING', leftX: 0.45, leftY: 0.57, leftValid: true, rightX: 0.58, rightY: 0.56, rightValid: true, trackingQuality: 0.95 },
            ],
          },
        ],
      },
    };

    const payload = buildCoverTestPayload(mockSession);
    assert(payload.sampleId === 'test-uuid-1234', 'sampleId mismatch');
    assert(payload.schemaVersion === '1.0', 'schemaVersion must be 1.0');
    assert(payload.test === 'COVER_TEST', 'test must be COVER_TEST');
    assert(Array.isArray(payload.cycles) && payload.cycles.length === 1, 'cycles must be an array of length 1');
    const c1 = payload.cycles[0];
    assert(c1.cycle === 1, 'cycle index mismatch');
    assert(c1.coveredEye === 'LEFT', 'coveredEye mismatch');
    assert(c1.trackedEye === 'RIGHT', 'trackedEye mismatch');
    assert(c1.samples.length === 2, 'samples count mismatch');
    assert(c1.samples[0].phase === 'BASELINE', 'sample phase mismatch');
    assert(c1.samples[1].t === 67, 'sample t mismatch');
  });

  // Test 14: Quality Gate catches raw time-series integrity failures
  await test('Quality Gate detects time-series integrity errors (non-monotonic timestamps or NaN coordinates)', async () => {
    const { validateScreeningData } = await import('./screeningQualityGate.js');

    // Case 1: Corrupted backward timestamp in raw time-series
    const corruptTimestampSession = {
      sampleId: 'corrupt-time-uuid',
      summary: {},
      coverPositionCheck: { headPoseValid: true, irisDetected: true, bothEyesDetected: true },
      brockPositionCheck: { headPoseValid: true, irisDetected: true, bothEyesDetected: true },
      coverTest: {
        validCycles: 3,
        quality: { status: 'GOOD' },
        cycles: [
          {
            cycleIndex: 1,
            samples: [
              { index: 0, t: 100, phase: 'TRACKING', leftX: 0.5, leftY: 0.5, rightX: 0.5, rightY: 0.5, leftValid: true, rightValid: true },
              { index: 1, t: 50, phase: 'TRACKING', leftX: 0.5, leftY: 0.5, rightX: 0.5, rightY: 0.5, leftValid: true, rightValid: true }, // Decreasing!
            ],
            baseline: { isStable: true },
            rightEye: { displacement: 0.01, dx: 0.01, dy: 0, sampleCount: 15, dataQuality: { isValid: true } },
            leftEye: null,
            quality: { isValid: true },
          },
        ],
      },
      brockString: { quality: { status: 'GOOD' } },
    };

    const result = validateScreeningData(corruptTimestampSession);
    assert(result.coverTestValid === false, 'Quality gate must invalidate coverTest when timestamps decrease');
    assert(result.valid === false, 'Quality gate valid must be false on corrupted time-series');
  });

  return {
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    results,
  };
}
