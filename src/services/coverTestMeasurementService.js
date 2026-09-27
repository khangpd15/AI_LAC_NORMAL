/**
 * COVER TEST MEASUREMENT SERVICE
 * Pure mathematical & biometric measurement service for Digital Cover Test.
 * Digitizes clinical Cover-Uncover and Alternate Cover Test protocols.
 * Zero UI logic. All thresholds are annotated as engineering parameters.
 */

import { SCREENING_CONFIG, SCREENING_VERDICT } from '../constants/screeningConfig.js';

/**
 * Helper: Computes the median of an array of numbers
 * @param {number[]} values
 * @returns {number}
 */
export function median(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Helper: Computes Interquartile Range (IQR) for dispersion assessment
 * @param {number[]} values
 * @returns {number}
 */
export function iqr(values) {
  if (!values || values.length < 4) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  return Math.max(0, q3 - q1);
}

/**
 * Computes robust baseline iris position from multi-frame fixation baseline
 * @param {Array<{t: number, x: number, y: number, normalizedX: number, normalizedY: number}>} baselineFrames
 * @returns {{
 *   baselineX: number,
 *   baselineY: number,
 *   normalizedBaselineX: number,
 *   normalizedBaselineY: number,
 *   iqrNormalizedX: number,
 *   iqrNormalizedY: number,
 *   isStable: boolean,
 *   sampleCount: number,
 *   dataQuality: { isValid: boolean, reason: string | null }
 * }}
 */
export function calculateRobustBaseline(baselineFrames) {
  if (!baselineFrames || baselineFrames.length < SCREENING_CONFIG.MIN_VALID_SAMPLES_BASELINE) {
    return {
      baselineX: null,
      baselineY: null,
      normalizedBaselineX: null,
      normalizedBaselineY: null,
      iqrNormalizedX: null,
      iqrNormalizedY: null,
      isStable: false,
      sampleCount: baselineFrames ? baselineFrames.length : 0,
      dataQuality: {
        isValid: false,
        reason: `Số mẫu baseline không đủ (${baselineFrames ? baselineFrames.length : 0}/${SCREENING_CONFIG.MIN_VALID_SAMPLES_BASELINE})`,
      },
    };
  }

  const rawXList = baselineFrames.map((f) => f.x);
  const rawYList = baselineFrames.map((f) => f.y);
  const normXList = baselineFrames.map((f) => f.normalizedX);
  const normYList = baselineFrames.map((f) => f.normalizedY);

  const baselineX = median(rawXList);
  const baselineY = median(rawYList);
  const normalizedBaselineX = median(normXList);
  const normalizedBaselineY = median(normYList);

  const iqrNormX = iqr(normXList);
  const iqrNormY = iqr(normYList);

  // Stability check: if user shifted gaze wildly, IQR will exceed stability threshold
  const isStable =
    iqrNormX <= SCREENING_CONFIG.BASELINE_STABILITY_IQR_MAX &&
    iqrNormY <= SCREENING_CONFIG.BASELINE_STABILITY_IQR_MAX;

  return {
    baselineX,
    baselineY,
    normalizedBaselineX,
    normalizedBaselineY,
    iqrNormalizedX: Number(iqrNormX.toFixed(4)),
    iqrNormalizedY: Number(iqrNormY.toFixed(4)),
    isStable,
    sampleCount: baselineFrames.length,
    dataQuality: {
      isValid: isStable,
      reason: isStable ? null : 'Thị giác không cố định ổn định trong pha baseline',
    },
  };
}

/**
 * Analyzes uncover trajectory against robust baseline and early refixation window
 * @param {Array<{timestamp: number, t: number, x: number, y: number, normalizedX: number, normalizedY: number, quality?: any}>} uncoverFrames
 * @param {Object} baseline - Output of calculateRobustBaseline()
 * @param {string} eye - 'left' | 'right'
 * @param {number} cycle - Cycle index (1..3)
 * @param {number} referenceEyeWidth - Eye corner-to-corner span in image coordinates
 * @param {Object} [options]
 * @param {number} [options.earlyWindowMs=500] - Ophthalmology refixation analysis window
 * @param {number} [options.displacementThreshold] - Engineering parameter
 * @returns {Object} Comprehensive Digital Cover Test Measurement
 */
export function analyzeUncoverTrajectory(
  uncoverFrames,
  baseline,
  eye = 'right',
  cycle = 1,
  referenceEyeWidth = 0.05,
  options = {}
) {
  const earlyWindowMs = options.earlyWindowMs || SCREENING_CONFIG.EARLY_ANALYSIS_WINDOW_MS;
  const displacementThreshold = options.displacementThreshold || SCREENING_CONFIG.DISPLACEMENT_THRESHOLD;
  const safeEyeWidth = Number.isFinite(referenceEyeWidth) ? referenceEyeWidth : null;

  // 1. Data Quality Checks
  if (!uncoverFrames || uncoverFrames.length < SCREENING_CONFIG.MIN_VALID_SAMPLES_UNCOVER) {
    return {
      eye,
      cycle,
      dataQuality: {
        isValid: false,
        reason: `Số mẫu mở mắt không đủ (${uncoverFrames ? uncoverFrames.length : 0}/${SCREENING_CONFIG.MIN_VALID_SAMPLES_UNCOVER})`,
      },
      baselinePosition: baseline || null,
      initialPosition: null,
      finalPosition: null,
      peakPosition: null,
      normalizedDisplacement: null,
      maximumDisplacement: null,
      displacementFromBaseline: null,
      peakVelocity: null,
      timeToPeakMs: null,
      meanVelocity: null,
      movementDurationMs: null,
      trajectoryStability: null,
      sampleCount: uncoverFrames ? uncoverFrames.length : 0,
      isNotableMovement: false,
      engineeringThreshold: displacementThreshold,
    };
  }

  if (!baseline?.dataQuality?.isValid || !baseline.isStable) {
    return { eye, cycle, dataQuality: { isValid: false, reason: 'BASELINE_UNSTABLE' }, baselinePosition: baseline || null, initialPosition: null, finalPosition: null, peakPosition: null, normalizedDisplacement: null, maximumDisplacement: null, displacementFromBaseline: null, peakVelocity: null, timeToPeakMs: null, meanVelocity: null, movementDurationMs: null, trajectoryStability: null, sampleCount: uncoverFrames.length, isNotableMovement: false, engineeringThreshold: displacementThreshold };
  }

  if (!Number.isFinite(safeEyeWidth) || safeEyeWidth < SCREENING_CONFIG.EYE_WIDTH_MIN_RATIO || safeEyeWidth > SCREENING_CONFIG.EYE_WIDTH_MAX_RATIO) {
    return { eye, cycle, dataQuality: { isValid: false, reason: 'INVALID_EYE_WIDTH' }, baselinePosition: baseline, initialPosition: null, finalPosition: null, peakPosition: null, normalizedDisplacement: null, maximumDisplacement: null, displacementFromBaseline: null, peakVelocity: null, timeToPeakMs: null, meanVelocity: null, movementDurationMs: null, trajectoryStability: null, sampleCount: uncoverFrames.length, isNotableMovement: false, engineeringThreshold: displacementThreshold };
  }

  // 2. Filter early window frames (0 - 500 ms) and full trajectory
  const earlyFrames = uncoverFrames.filter((f) => f.t <= earlyWindowMs);
  const firstFrame = uncoverFrames[0];
  const lastEarlyFrame = earlyFrames.length > 0 ? earlyFrames[earlyFrames.length - 1] : firstFrame;
  const lastFullFrame = uncoverFrames[uncoverFrames.length - 1];

  // 3. Initial Position (t ~ 0ms) - robust mean of first 3 frames or first frame
  const initSlice = uncoverFrames.slice(0, Math.min(3, uncoverFrames.length));
  const initialX = initSlice.reduce((sum, f) => sum + f.normalizedX, 0) / initSlice.length;
  const initialY = initSlice.reduce((sum, f) => sum + f.normalizedY, 0) / initSlice.length;
  const initialRawX = initSlice.reduce((sum, f) => sum + f.x, 0) / initSlice.length;
  const initialRawY = initSlice.reduce((sum, f) => sum + f.y, 0) / initSlice.length;

  // 4. Final Position (at end of recording) - robust mean of last 3 frames
  const finalSlice = uncoverFrames.slice(-Math.min(3, uncoverFrames.length));
  const finalX = finalSlice.reduce((sum, f) => sum + f.normalizedX, 0) / finalSlice.length;
  const finalY = finalSlice.reduce((sum, f) => sum + f.normalizedY, 0) / finalSlice.length;

  // 5. Early window net displacement & vector
  const earlyDx = lastEarlyFrame.x - initialRawX;
  const earlyDy = lastEarlyFrame.y - initialRawY;
  const earlyRawDistance = Math.hypot(earlyDx, earlyDy);
  const normalizedDisplacement = earlyRawDistance / safeEyeWidth;

  // 6. Displacement relative to baseline (if baseline is valid)
  let displacementFromBaseline = 0;
  if (baseline && baseline.dataQuality?.isValid) {
    const rawDistFromBaseline = Math.hypot(
      initialRawX - baseline.baselineX,
      initialRawY - baseline.baselineY
    );
    displacementFromBaseline = rawDistFromBaseline / safeEyeWidth;
  }

  // 7. Instantaneous velocity, peak tracking, and directional vector
  let peakVel = 0;
  let timeToPeakMs = 0;
  let maxDisplacement = 0;
  let peakFrame = firstFrame;

  for (let i = 1; i < uncoverFrames.length; i++) {
    const prev = uncoverFrames[i - 1];
    const curr = uncoverFrames[i];

    // Distance from initial position
    const distFromInit = Math.hypot(curr.x - initialRawX, curr.y - initialRawY) / safeEyeWidth;
    if (distFromInit > maxDisplacement) {
      maxDisplacement = distFromInit;
      peakFrame = curr;
    }

    // Instantaneous velocity (normalized eye width per second)
    const dt = Math.max(1, curr.t - prev.t) / 1000;
    const stepDistance = Math.hypot(curr.x - prev.x, curr.y - prev.y) / safeEyeWidth;
    const vel = stepDistance / dt;

    if (vel > peakVel) {
      peakVel = vel;
      timeToPeakMs = curr.t;
    }
  }

  // 8. Direction analysis (Nasal, Temporal, Superior, Inferior)
  const peakDx = peakFrame.x - initialRawX;
  const peakDy = peakFrame.y - initialRawY;
  let horizontalDirection = 'NONE';
  if (Math.abs(peakDx) > 0.02 * safeEyeWidth) {
    if (eye === 'left') {
      // Left eye in MediaPipe image: higher x is temporal (ear), lower x is nasal (nose)
      horizontalDirection = peakDx > 0 ? 'TEMPORAL' : 'NASAL';
    } else {
      // Right eye in MediaPipe image: higher x is nasal (nose), lower x is temporal (ear)
      horizontalDirection = peakDx > 0 ? 'NASAL' : 'TEMPORAL';
    }
  }
  let verticalDirection = 'NONE';
  if (Math.abs(peakDy) > 0.02 * safeEyeWidth) {
    verticalDirection = peakDy < 0 ? 'SUPERIOR' : 'INFERIOR';
  }
  const movementDirection =
    horizontalDirection !== 'NONE' && verticalDirection !== 'NONE'
      ? `${horizontalDirection}_${verticalDirection}`
      : horizontalDirection !== 'NONE'
      ? horizontalDirection
      : verticalDirection;

  // 9. Mean velocity during early refixation window
  const earlyDurationSec = Math.max(0.01, (lastEarlyFrame.t - firstFrame.t) / 1000);
  const meanVelocity = normalizedDisplacement / earlyDurationSec;

  // 10. Movement duration: time when velocity returns toward baseline (< 25% of peak velocity)
  let movementDurationMs = earlyWindowMs;
  const settlingThreshold = Math.max(0.05, peakVel * 0.25);
  for (let i = 1; i < uncoverFrames.length; i++) {
    if (uncoverFrames[i].t > timeToPeakMs) {
      const prev = uncoverFrames[i - 1];
      const curr = uncoverFrames[i];
      const dt = Math.max(1, curr.t - prev.t) / 1000;
      const v = (Math.hypot(curr.x - prev.x, curr.y - prev.y) / safeEyeWidth) / dt;
      if (v < settlingThreshold) {
        movementDurationMs = curr.t;
        break;
      }
    }
  }

  // 11. Trajectory stability in final settling segment (last 1000ms)
  const settlingFrames = uncoverFrames.filter((f) => f.t >= SCREENING_CONFIG.RECORD_MS - 1000);
  let trajectoryStability = 1.0;
  if (settlingFrames.length >= 5) {
    const settlingNormX = settlingFrames.map((f) => f.normalizedX);
    const varX = iqr(settlingNormX);
    trajectoryStability = Math.max(0, 1.0 - varX * 10);
  }

  // 12. Temporal Events Array (UNCOVER = 0 ms Anchor)
  const baseTimestamp = firstFrame.timestamp || performance.now();
  const temporalEvents = [
    {
      eventType: 'UNCOVER',
      timestamp: baseTimestamp,
      t: 0,
      cycleId: cycle,
      trackedEye: eye,
    },
    {
      eventType: 'PEAK_MOVEMENT',
      timestamp: peakFrame.timestamp || baseTimestamp + peakFrame.t,
      t: peakFrame.t,
      cycleId: cycle,
      trackedEye: eye,
      displacement: Number(maxDisplacement.toFixed(4)),
    },
    {
      eventType: 'RECOVERY',
      timestamp: baseTimestamp + movementDurationMs,
      t: movementDurationMs,
      cycleId: cycle,
      trackedEye: eye,
    },
    {
      eventType: 'END',
      timestamp: lastFullFrame.timestamp || baseTimestamp + lastFullFrame.t,
      t: lastFullFrame.t,
      cycleId: cycle,
      trackedEye: eye,
    },
  ];

  // 13. Confidence in measurement quality (0.0 to 1.0)
  const sampleCoverage = Math.min(1.0, uncoverFrames.length / (SCREENING_CONFIG.RECORD_MS / 33));
  const baselineConfidence = baseline && baseline.isStable ? 1.0 : 0.6;
  const measurementConfidence = Number((sampleCoverage * 0.4 + trajectoryStability * 0.3 + baselineConfidence * 0.3).toFixed(2));

  // 14. Engineering evaluation (not clinical diagnosis)
  const isNotableMovement = normalizedDisplacement >= displacementThreshold;

  return {
    eye,
    cycle,
    baselinePosition: {
      normalizedX: baseline ? baseline.normalizedBaselineX : 0.5,
      normalizedY: baseline ? baseline.normalizedBaselineY : 0.5,
      sampleCount: baseline ? baseline.sampleCount : 0,
      isStable: baseline ? baseline.isStable : false,
    },
    initialPosition: {
      normalizedX: Number(initialX.toFixed(4)),
      normalizedY: Number(initialY.toFixed(4)),
      t: firstFrame.t,
    },
    finalPosition: {
      normalizedX: Number(finalX.toFixed(4)),
      normalizedY: Number(finalY.toFixed(4)),
      t: lastFullFrame.t,
    },
    peakPosition: {
      normalizedX: Number(peakFrame.normalizedX.toFixed(4)),
      normalizedY: Number(peakFrame.normalizedY.toFixed(4)),
      t: peakFrame.t,
    },
    displacement: Number(earlyRawDistance.toFixed(4)),
    normalizedDisplacement: Number(normalizedDisplacement.toFixed(4)),
    maximumDisplacement: Number(maxDisplacement.toFixed(4)),
    displacementFromBaseline: Number(displacementFromBaseline.toFixed(4)),
    movementDirection,
    horizontalDirection,
    verticalDirection,
    peakVelocity: Number(peakVel.toFixed(4)),
    timeToPeakMs,
    meanVelocity: Number(meanVelocity.toFixed(4)),
    movementDurationMs,
    trajectoryStability: Number(trajectoryStability.toFixed(4)),
    eyeWidth: safeEyeWidth != null ? Number(safeEyeWidth.toFixed(4)) : null,
    temporalEvents,
    confidence: measurementConfidence,
    sampleCount: uncoverFrames.length,
    calibration: {
      status: 'NOT_CALIBRATED',
      value: null,
      prismDiopters: null,
      note: 'Chưa có hiệu chuẩn thực nghiệm với PACT; không suy diễn độ lăng kính khi chưa có kiểm định.',
    },
    dataQuality: {
      isValid: true,
      reason: null,
      sampleCount: uncoverFrames.length,
      stabilityScore: Number(trajectoryStability.toFixed(4)),
    },
    isNotableMovement,
    engineeringThreshold: displacementThreshold,
  };
}

/**
 * Aggregates multiple measurement cycles for an eye using robust statistical methods
 * @param {Array<Object>} cycleMeasurements - Array of measurement objects from analyzeUncoverTrajectory
 * @param {string} eye - 'left' | 'right'
 * @returns {Object} Multi-cycle aggregated measurement
 */
export function aggregateEyeMeasurements(cycleMeasurements, eye = 'right') {
  const eyeCycles = (cycleMeasurements || []).filter((m) => m && m.eye === eye);

  if (eyeCycles.length === 0) {
    return {
      eye,
      validCycles: 0,
      medianDisplacement: null,
      meanDisplacement: null,
      medianPeakVelocity: null,
      notableMovementCycles: 0,
      verdict: SCREENING_VERDICT.INCONCLUSIVE,
      verdictLabel: 'Không có dữ liệu đo lường cho mắt này',
      dataQuality: { isValid: false, reason: 'Không có chu kỳ đo hợp lệ' },
      cycles: [],
    };
  }

  const validCycles = eyeCycles.filter((c) => c.dataQuality && c.dataQuality.isValid);

  if (validCycles.length < 2) {
    return {
      eye,
      validCycles: validCycles.length,
      medianDisplacement: null,
      meanDisplacement: null,
      medianPeakVelocity: null,
      notableMovementCycles: 0,
      verdict: SCREENING_VERDICT.INCONCLUSIVE,
      verdictLabel: 'Số chu kỳ đạt chất lượng không đủ để đánh giá (cần tối thiểu 2/3 chu kỳ)',
      dataQuality: { isValid: false, reason: 'Chất lượng đo lường không đạt đa số chu kỳ' },
      cycles: eyeCycles,
    };
  }

  const displacements = validCycles.map((c) => c.normalizedDisplacement);
  const peakVelocities = validCycles.map((c) => c.peakVelocity);
  const notableCount = validCycles.filter((c) => c.isNotableMovement).length;

  const medianDisp = median(displacements);
  const meanDisp = displacements.reduce((a, b) => a + b, 0) / displacements.length;
  const medianPeakVel = median(peakVelocities);

  // Majority rule across valid cycles
  const hasNotableSignal = notableCount >= Math.ceil(validCycles.length / 2);

  const verdict = hasNotableSignal
    ? SCREENING_VERDICT.SIGNAL_DETECTED
    : SCREENING_VERDICT.NO_SIGNAL_DETECTED;

  const verdictLabel = hasNotableSignal
    ? 'Có ghi nhận chuyển động tái định thị đáng chú ý'
    : 'Không ghi nhận chuyển động tái định thị đáng chú ý trong lần sàng lọc này';

  return {
    eye,
    validCycles: validCycles.length,
    totalCycles: eyeCycles.length,
    medianDisplacement: Number(medianDisp.toFixed(4)),
    meanDisplacement: Number(meanDisp.toFixed(4)),
    medianPeakVelocity: Number(medianPeakVel.toFixed(4)),
    notableMovementCycles: notableCount,
    verdict,
    verdictLabel,
    dataQuality: { isValid: true, reason: null },
    cycles: eyeCycles,
  };
}
