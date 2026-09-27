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
  const test = (name, fn) => {
    try {
      fn();
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
  test('COVER_TEST_CONFIG specifies 15 Hz and ~66.67ms interval', () => {
    assert(COVER_TEST_CONFIG.datasetSampleRateHz === 15, 'Expected 15 Hz');
    assert(
      Math.abs(COVER_TEST_CONFIG.datasetSampleIntervalMs - 1000 / 15) < 0.001,
      'Expected interval ~66.67ms'
    );
  });

  // Test 2: 60 FPS input -> ~15 samples per second
  test('60 FPS input yields ~15 samples per second', () => {
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
  test('30 FPS input yields ~15 samples per second', () => {
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
  test('Dropped frames sampled based strictly on elapsed time, not frame counter', () => {
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
  test('Sample schema is compact, contains signed movements, relative coords, and no bloat', () => {
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
  test('Quality gating rejects NaN, Infinity, missing face, and invalid eye width', () => {
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
  test('finalizeCycleSummary outputs all 16 required summary fields', () => {
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
  test('Recorder reset reinitializes buffer without memory leak', () => {
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

  return {
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    results,
  };
}
