/**
 * COVER TEST TIME-SERIES SERVICE
 * High-performance 15 Hz dataset trajectory sampler and feature summarizer.
 * 
 * Clinical & Engineering Design:
 * 1. Realtime MediaPipe processing remains at native FPS (30 - 60 FPS) for landmark tracking,
 *    robust baseline estimation, and saccade kinematic analysis.
 * 2. Dataset persistence is downsampled to 15 Hz (interval ~66.7ms) based on real elapsed time
 *    (performance.now()), preventing huge JSON bloat while retaining high-fidelity trajectory for ML.
 * 3. Preserves signed movements (signedDx, signedDy, relativeX, relativeY).
 * 4. Filters non-finite or missing iris frames with strict quality statistics tracking.
 */

import { COVER_TEST_CONFIG } from '../constants/screeningConfig.js';
import { median } from './coverTestMeasurementService.js';
import { toCanonicalEye } from '../utils/eyeCoordinateMapping.js';

const isRealNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Creates an instance of the 15 Hz time-series recorder for a cycle.
 * Mutable in-memory buffer avoids array allocations and re-renders in the realtime loop.
 * 
 * @param {number} [initialStartTime] - performance.now() of cycle start
 * @returns {Object} Recorder controller
 */
export function createTimeSeriesRecorder(initialStartTime = performance.now()) {
  let cycleStartTime = initialStartTime;
  let lastSampleTime = -Infinity;
  const samples = [];

  let totalFrames = 0;
  let savedSamples = 0;
  let validSamples = 0;

  // Realtime FPS tracking
  let lastFrameTime = performance.now();
  const frameTimeWindow = [];
  let realtimeFps = 0;

  /**
   * Resets recorder for a new cycle
   * @param {number} [newStartTime]
   */
  const reset = (newStartTime = performance.now()) => {
    cycleStartTime = newStartTime;
    lastSampleTime = -Infinity;
    samples.length = 0;
    totalFrames = 0;
    savedSamples = 0;
    validSamples = 0;
    frameTimeWindow.length = 0;
    realtimeFps = 0;
    lastFrameTime = newStartTime;
  };

  /**
   * Processes a single MediaPipe frame in realtime (30 - 60 FPS).
   * Only stores sample if elapsed time since last sample >= datasetSampleIntervalMs.
   * 
   * @param {number} now - performance.now()
   * @param {string} phase - 'BASELINE' | 'COVER' | 'UNCOVER' | 'TRACKING'
   * @param {Object} features - Extracted eye features from extractEyeFeatures()
   * @param {Object} quality - Current tracking quality status
   * @param {Object} [baseline] - Active baseline { leftBaseline, rightBaseline }
   * @param {string} [trackEye] - 'left' | 'right' | null
   * @param {string} [coverEye] - 'left' | 'right' | null
   * @returns {boolean} True if a sample was saved in this tick
   */
  const processFrame = (
    now,
    phase,
    features,
    quality,
    baseline = null,
    trackEye = null,
    coverEye = null
  ) => {
    totalFrames += 1;

    // Measure realtime FPS over sliding window of native frames (30 - 60 FPS)
    const dt = now - lastFrameTime;
    lastFrameTime = now;
    if (dt > 0 && dt < 1000) {
      frameTimeWindow.push(1000 / dt);
      if (frameTimeWindow.length > 30) frameTimeWindow.shift();
      realtimeFps = Math.round(
        frameTimeWindow.reduce((a, b) => a + b, 0) / frameTimeWindow.length
      );
    }

    // Dataset Sampling Check: 15 Hz based strictly on real elapsed time, NOT frame counter (Section 2 & 16)
    const intervalMs = COVER_TEST_CONFIG.datasetSampleIntervalMs;
    const isFirstSample = lastSampleTime === -Infinity;
    const timeSinceLastSample = now - lastSampleTime;

    if (!isFirstSample && timeSinceLastSample < intervalMs) {
      return false; // Realtime processing continues at native 30 - 60 FPS, storage skipped
    }

    // Quality gate for saving sample (Section 8)
    // Reject sample if face missing, iris completely invalid, or coordinates are NaN/Infinity
    if (!quality || quality.faceDetected === false) {
      return false;
    }

    if (quality.irisValid === false) {
      return false;
    }

    const raw = features?.raw;
    const leftX = raw?.leftIrisX ?? features?.leftIrisX;
    const leftY = raw?.leftIrisY ?? features?.leftIrisY;
    const rightX = raw?.rightIrisX ?? features?.rightIrisX;
    const rightY = raw?.rightIrisY ?? features?.rightIrisY;
    const leftWidth = features?.leftEyeWidth;
    const rightWidth = features?.rightEyeWidth;

    // Check for NaN or Infinity
    if (
      (leftX != null && !Number.isFinite(leftX)) ||
      (leftY != null && !Number.isFinite(leftY)) ||
      (rightX != null && !Number.isFinite(rightX)) ||
      (rightY != null && !Number.isFinite(rightY))
    ) {
      return false;
    }

    const leftCoordsValid = isRealNumber(leftX) && isRealNumber(leftY) && leftX >= 0 && leftX <= 1 && leftY >= 0 && leftY <= 1;
    const rightCoordsValid = isRealNumber(rightX) && isRealNumber(rightY) && rightX >= 0 && rightX <= 1 && rightY >= 0 && rightY <= 1;
    const leftWidthValid = isRealNumber(leftWidth) && leftWidth > 0;
    const rightWidthValid = isRealNumber(rightWidth) && rightWidth > 0;

    // Determine target eye for the active phase
    const effectiveTrackEye = trackEye || (coverEye === 'left' ? 'right' : coverEye === 'right' ? 'left' : null);

    // Phase-specific validity validation
    let hasRequiredEyeData = false;
    let isFullyValidSample = false;

    if (phase === 'BASELINE') {
      // Baseline requires both eyes with valid coordinates and widths
      hasRequiredEyeData = leftCoordsValid && rightCoordsValid && leftWidthValid && rightWidthValid;
      isFullyValidSample = hasRequiredEyeData && quality.isValid !== false;
    } else if (phase === 'COVER') {
      // In COVER phase, the uncovered eye must be tracked and valid
      if (coverEye === 'left') {
        hasRequiredEyeData = rightCoordsValid && rightWidthValid;
        isFullyValidSample = hasRequiredEyeData && quality.rightEyeDetected !== false;
      } else if (coverEye === 'right') {
        hasRequiredEyeData = leftCoordsValid && leftWidthValid;
        isFullyValidSample = hasRequiredEyeData && quality.leftEyeDetected !== false;
      } else {
        hasRequiredEyeData = (leftCoordsValid && leftWidthValid) || (rightCoordsValid && rightWidthValid);
        isFullyValidSample = hasRequiredEyeData;
      }
    } else if (phase === 'TRACKING' || phase === 'UNCOVER') {
      // In TRACKING/UNCOVER, the tracked eye must be valid
      if (effectiveTrackEye === 'right') {
        hasRequiredEyeData = rightCoordsValid && rightWidthValid;
        isFullyValidSample = hasRequiredEyeData && quality.rightEyeDetected !== false;
      } else if (effectiveTrackEye === 'left') {
        hasRequiredEyeData = leftCoordsValid && leftWidthValid;
        isFullyValidSample = hasRequiredEyeData && quality.leftEyeDetected !== false;
      } else {
        hasRequiredEyeData = (leftCoordsValid && leftWidthValid) || (rightCoordsValid && rightWidthValid);
        isFullyValidSample = hasRequiredEyeData;
      }
    } else {
      // General fallback
      hasRequiredEyeData = (leftCoordsValid && leftWidthValid) || (rightCoordsValid && rightWidthValid);
      isFullyValidSample = hasRequiredEyeData && quality.isValid !== false;
    }

    // Do NOT save if required eye data for this phase is missing (Section 8)
    if (!hasRequiredEyeData) {
      return false;
    }

    lastSampleTime = now;
    savedSamples += 1;
    if (isFullyValidSample) {
      validSamples += 1;
    }

    // Relative displacement between irises (relativeX, relativeY) when both available
    const relativeX = leftCoordsValid && rightCoordsValid
      ? Number((rightX - leftX).toFixed(4))
      : null;
    const relativeY = leftCoordsValid && rightCoordsValid
      ? Number((rightY - leftY).toFixed(4))
      : null;

    // Signed movement calculation relative to baseline (Section 7)
    let signedDx = null;
    let signedDy = null;

    if (effectiveTrackEye === 'right' && baseline?.rightBaseline?.baselineX != null && rightCoordsValid) {
      signedDx = Number((rightX - baseline.rightBaseline.baselineX).toFixed(4));
      signedDy = Number((rightY - baseline.rightBaseline.baselineY).toFixed(4));
    } else if (effectiveTrackEye === 'left' && baseline?.leftBaseline?.baselineX != null && leftCoordsValid) {
      signedDx = Number((leftX - baseline.leftBaseline.baselineX).toFixed(4));
      signedDy = Number((leftY - baseline.leftBaseline.baselineY).toFixed(4));
    } else if (phase === 'BASELINE') {
      signedDx = 0;
      signedDy = 0;
    }

    // Relative timestamp from cycle start in milliseconds (Section 5 & 10: strictly non-decreasing)
    const rawT = Math.max(0, Math.round(now - cycleStartTime));
    const lastSampleT = samples.length > 0 ? samples[samples.length - 1].t : 0;
    const t = Math.max(lastSampleT, rawT);

    const trackingQuality = quality.isValid
      ? (typeof quality.score === 'number' ? Number(quality.score.toFixed(2)) : 0.95)
      : (isFullyValidSample ? 0.85 : 0.50);

    const isBlinkL = Boolean(features?.isBlinkLeft);
    const isBlinkR = Boolean(features?.isBlinkRight);
    const leftValid = Boolean(leftCoordsValid && coverEye !== 'left' && !isBlinkL);
    const rightValid = Boolean(rightCoordsValid && coverEye !== 'right' && !isBlinkR);

    const canonicalCoveredEye = coverEye ? toCanonicalEye(coverEye) : null;
    const epochTimestamp = Date.now();

    // Standardized Sample Schema (Section 8: index, timestamp, t, phase, coveredEye, leftEye, rightEye, trackingQuality...)
    const sample = {
      index: samples.length,
      timestamp: epochTimestamp,
      t,
      phase,
      coveredEye: canonicalCoveredEye,
      leftX: leftCoordsValid ? Number(leftX.toFixed(4)) : null,
      leftY: leftCoordsValid ? Number(leftY.toFixed(4)) : null,
      leftValid,
      rightX: rightCoordsValid ? Number(rightX.toFixed(4)) : null,
      rightY: rightCoordsValid ? Number(rightY.toFixed(4)) : null,
      rightValid,
      trackingQuality,

      leftEye: {
        x: leftCoordsValid ? Number(leftX.toFixed(4)) : null,
        y: leftCoordsValid ? Number(leftY.toFixed(4)) : null,
        valid: leftValid,
      },
      rightEye: {
        x: rightCoordsValid ? Number(rightX.toFixed(4)) : null,
        y: rightCoordsValid ? Number(rightY.toFixed(4)) : null,
        valid: rightValid,
      },

      // Supplementary properties for ML kinematics & backward compatibility
      left: {
        x: leftCoordsValid ? Number(leftX.toFixed(4)) : null,
        y: leftCoordsValid ? Number(leftY.toFixed(4)) : null,
        valid: leftValid,
      },
      right: {
        x: rightCoordsValid ? Number(rightX.toFixed(4)) : null,
        y: rightCoordsValid ? Number(rightY.toFixed(4)) : null,
        valid: rightValid,
      },
      relativeX,
      relativeY,
      signedDx,
      signedDy,
    };

    samples.push(sample);
    return true;
  };

  /**
   * Returns copy of saved samples
   */
  const getSamples = () => [...samples];

  /**
   * Returns current quality statistics (Section 8)
   */
  const getQuality = () => ({
    totalFrames,
    totalFrameCount: totalFrames,
    savedSamples,
    validSamples,
    validSampleCount: validSamples,
    validSampleRatio: savedSamples > 0 ? Number((validSamples / savedSamples).toFixed(3)) : 0,
  });

  /**
   * Returns live telemetry for Dev Debug Panel (Section 13)
   */
  const getTelemetry = () => ({
    realtimeFps,
    datasetSampleRateHz: COVER_TEST_CONFIG.datasetSampleRateHz,
    totalFrames,
    savedSamples,
    validSamples,
  });

  /**
   * Computes comprehensive cycle summary features (Section 10)
   * @param {Object} [cycleRecord] - Optional cycle record with analysis metrics
   * @returns {Object} Complete summary
   */
  const finalizeCycleSummary = (cycleRecord = null) => {
    const validRatio = savedSamples > 0 ? validSamples / savedSamples : 0;
    const durationMs = samples.length > 1 ? (samples.at(-1).t - samples[0].t) : 0;

    const dxList = samples.map((s) => s.signedDx).filter(isRealNumber);
    const dyList = samples.map((s) => s.signedDy).filter(isRealNumber);

    const medianSignedDx = median(dxList);
    const medianSignedDy = median(dyList);
    const meanSignedDx = dxList.length > 0 ? dxList.reduce((a, b) => a + b, 0) / dxList.length : 0;
    const meanSignedDy = dyList.length > 0 ? dyList.reduce((a, b) => a + b, 0) / dyList.length : 0;

    const peakAbsoluteDx = dxList.length > 0 ? Math.max(...dxList.map(Math.abs)) : 0;
    const peakAbsoluteDy = dyList.length > 0 ? Math.max(...dyList.map(Math.abs)) : 0;

    // Step-to-step jitter from consecutive recorded trajectory points
    const stepDiffs = [];
    for (let i = 1; i < dxList.length; i++) {
      stepDiffs.push(Math.abs(dxList[i] - dxList[i - 1]));
    }
    const internalJitter = stepDiffs.length > 0 ? median(stepDiffs) : 0;

    // Direction consistency check: are non-zero dx excursions predominantly unidirectional?
    let directionConsistency = 'STABLE_FIXATION';
    const nonZeroDx = dxList.filter((v) => Math.abs(v) > 0.002);
    if (nonZeroDx.length >= 3) {
      const positiveCount = nonZeroDx.filter((v) => v > 0).length;
      const posRatio = positiveCount / nonZeroDx.length;
      if (posRatio >= 0.75 || posRatio <= 0.25) {
        directionConsistency = 'CONSISTENT_UNIDIRECTIONAL';
      } else {
        directionConsistency = 'VARIABLE';
      }
    }

    const recordedJitter = cycleRecord?.rightEye?.jitter ?? cycleRecord?.leftEye?.jitter;
    const resolvedJitter = recordedJitter != null ? recordedJitter : (internalJitter > 0 ? Number(internalJitter.toFixed(4)) : null);

    return {
      sampleCount: samples.length,
      durationMs,
      medianSignedDx: medianSignedDx != null ? Number(medianSignedDx.toFixed(4)) : null,
      medianSignedDy: medianSignedDy != null ? Number(medianSignedDy.toFixed(4)) : null,
      meanSignedDx: Number(meanSignedDx.toFixed(4)),
      meanSignedDy: Number(meanSignedDy.toFixed(4)),
      peakAbsoluteDx: Number(peakAbsoluteDx.toFixed(4)),
      peakAbsoluteDy: Number(peakAbsoluteDy.toFixed(4)),
      normalizedHorizontal: cycleRecord?.normalizedHorizontal ?? null,
      normalizedVertical: cycleRecord?.normalizedVertical ?? null,
      peakVelocity: cycleRecord?.peakVelocity ?? null,
      timeToPeak: cycleRecord?.rightEye?.timeToPeakMs ?? cycleRecord?.leftEye?.timeToPeakMs ?? null,
      jitter: resolvedJitter,
      trajectoryStability: cycleRecord?.trajectoryStability ?? null,
      directionConsistency,
      validSampleRatio: Number(validRatio.toFixed(3)),
    };
  };

  return {
    reset,
    processFrame,
    getSamples,
    getQuality,
    getTelemetry,
    finalizeCycleSummary,
  };
}
