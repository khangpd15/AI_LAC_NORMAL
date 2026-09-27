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
  const validFrames = (baselineFrames || []).filter(
    (f) =>
      f &&
      f.quality?.isValid !== false &&
      Number.isFinite(f.x) &&
      Number.isFinite(f.y) &&
      Number.isFinite(f.normalizedX)
  );

  if (validFrames.length < SCREENING_CONFIG.MIN_VALID_SAMPLES_BASELINE) {
    return {
      x: null,
      y: null,
      baselineX: null,
      baselineY: null,
      normalizedBaselineX: null,
      normalizedBaselineY: null,
      iqrNormalizedX: null,
      iqrNormalizedY: null,
      isStable: false,
      sampleCount: validFrames.length,
      quality: {
        isValid: false,
        reason: `Số mẫu baseline không đủ (${validFrames.length}/${SCREENING_CONFIG.MIN_VALID_SAMPLES_BASELINE})`,
      },
      dataQuality: {
        isValid: false,
        reason: `Số mẫu baseline không đủ (${validFrames.length}/${SCREENING_CONFIG.MIN_VALID_SAMPLES_BASELINE})`,
      },
    };
  }

  const rawXList = validFrames.map((f) => f.x);
  const rawYList = validFrames.map((f) => f.y);
  const normXList = validFrames.map((f) => f.normalizedX);
  const normYList = validFrames.map((f) => f.normalizedY);

  const baselineX = median(rawXList);
  const baselineY = median(rawYList);
  const normalizedBaselineX = median(normXList);
  const normalizedBaselineY = median(normYList);

  const iqrNormX = iqr(normXList);
  const iqrNormY = iqr(normYList);

  // Stability check: if user shifted gaze wildly, IQR will exceed stability threshold
  const isStable =
    iqrNormX !== null &&
    iqrNormY !== null &&
    iqrNormX <= SCREENING_CONFIG.BASELINE_STABILITY_IQR_MAX &&
    iqrNormY <= SCREENING_CONFIG.BASELINE_STABILITY_IQR_MAX;

  return {
    x: baselineX,
    y: baselineY,
    baselineX,
    baselineY,
    normalizedBaselineX,
    normalizedBaselineY,
    iqrNormalizedX: Number(iqrNormX.toFixed(4)),
    iqrNormalizedY: Number(iqrNormY.toFixed(4)),
    isStable,
    sampleCount: validFrames.length,
    quality: {
      isValid: isStable,
      reason: isStable ? null : 'Thị giác không cố định ổn định trong pha baseline',
    },
    dataQuality: {
      isValid: isStable,
      reason: isStable ? null : 'Thị giác không cố định ổn định trong pha baseline',
    },
  };
}

/**
 * Analyzes uncover trajectory against robust baseline and early refixation window.
 * Strictly separates horizontal and vertical displacements.
 * Analyzes time-series kinematics (velocity, latency, settling, jitter) rather than single-frame thresholds.
 *
 * NOTE: normalizedDisplacement = sqrt(dx² + dy²) / eyeWidth is an engineering feature only.
 * It is NOT a clinical deviation angle or Prism Diopter.
 *
 * Limitation note: Horizontal eye width (inner to outer canthus) is used for normalization.
 * Vertical palpebral aperture (eye height) is not fabricated to avoid anatomical artifacts.
 *
 * @param {Array<{timestamp: number, t: number, x: number, y: number, normalizedX: number, normalizedY: number, quality?: any}>} uncoverFrames
 * @param {Object} baseline - Output of calculateRobustBaseline()
 * @param {string} eye - 'left' | 'right'
 * @param {number} cycle - Cycle index (1..3)
 * @param {number|null} referenceEyeWidth - Eye corner-to-corner span in image coordinates
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
  referenceEyeWidth = null,
  options = {}
) {
  const earlyWindowMs = options.earlyWindowMs || SCREENING_CONFIG.EARLY_ANALYSIS_WINDOW_MS;
  const displacementThreshold = options.displacementThreshold || SCREENING_CONFIG.DISPLACEMENT_THRESHOLD;
  const safeEyeWidth =
    typeof referenceEyeWidth === 'number' && Number.isFinite(referenceEyeWidth) && referenceEyeWidth > 0
      ? referenceEyeWidth
      : null;

  // 1. Data Quality Checks: Sample Count
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
      dx: null,
      dy: null,
      horizontalDisplacement: null,
      verticalDisplacement: null,
      displacement: null,
      normalizedHorizontal: null,
      normalizedVertical: null,
      normalizedDisplacement: null,
      maximumDisplacement: null,
      horizontalPeak: null,
      verticalPeak: null,
      peakDisplacement: null,
      meanDisplacement: null,
      displacementFromBaseline: null,
      dxFromBaseline: null,
      dyFromBaseline: null,
      horizontalDisplacementFromBaseline: null,
      verticalDisplacementFromBaseline: null,
      peakVelocity: null,
      velocity: null,
      timeToPeakMs: null,
      meanVelocity: null,
      movementDurationMs: null,
      trajectoryStability: null,
      jitter: null,
      validSampleRatio: 0,
      trackingDurationMs: 0,
      sampleCount: uncoverFrames ? uncoverFrames.length : 0,
      isNotableMovement: false,
      engineeringThreshold: displacementThreshold,
      eyeWidth: safeEyeWidth,
    };
  }

  // 2. Data Quality Checks: Baseline Stability (No fake/sentinel baselines permitted)
  if (!baseline?.dataQuality?.isValid || !baseline.isStable || baseline.normalizedBaselineX == null) {
    return {
      eye,
      cycle,
      dataQuality: { isValid: false, reason: 'BASELINE_UNSTABLE' },
      baselinePosition: baseline || null,
      initialPosition: null,
      finalPosition: null,
      peakPosition: null,
      dx: null,
      dy: null,
      horizontalDisplacement: null,
      verticalDisplacement: null,
      displacement: null,
      normalizedHorizontal: null,
      normalizedVertical: null,
      normalizedDisplacement: null,
      maximumDisplacement: null,
      horizontalPeak: null,
      verticalPeak: null,
      peakDisplacement: null,
      meanDisplacement: null,
      displacementFromBaseline: null,
      dxFromBaseline: null,
      dyFromBaseline: null,
      horizontalDisplacementFromBaseline: null,
      verticalDisplacementFromBaseline: null,
      peakVelocity: null,
      velocity: null,
      timeToPeakMs: null,
      meanVelocity: null,
      movementDurationMs: null,
      trajectoryStability: null,
      jitter: null,
      validSampleRatio: 0,
      trackingDurationMs: 0,
      sampleCount: uncoverFrames.length,
      isNotableMovement: false,
      engineeringThreshold: displacementThreshold,
      eyeWidth: safeEyeWidth,
    };
  }

  // 3. Data Quality Checks: Eye Width Validation
  if (
    !safeEyeWidth ||
    safeEyeWidth < SCREENING_CONFIG.EYE_WIDTH_MIN_RATIO ||
    safeEyeWidth > SCREENING_CONFIG.EYE_WIDTH_MAX_RATIO
  ) {
    return {
      eye,
      cycle,
      dataQuality: { isValid: false, reason: 'INVALID_EYE_WIDTH' },
      baselinePosition: baseline,
      initialPosition: null,
      finalPosition: null,
      peakPosition: null,
      dx: null,
      dy: null,
      horizontalDisplacement: null,
      verticalDisplacement: null,
      displacement: null,
      normalizedHorizontal: null,
      normalizedVertical: null,
      normalizedDisplacement: null,
      maximumDisplacement: null,
      horizontalPeak: null,
      verticalPeak: null,
      peakDisplacement: null,
      meanDisplacement: null,
      displacementFromBaseline: null,
      dxFromBaseline: null,
      dyFromBaseline: null,
      horizontalDisplacementFromBaseline: null,
      verticalDisplacementFromBaseline: null,
      peakVelocity: null,
      velocity: null,
      timeToPeakMs: null,
      meanVelocity: null,
      movementDurationMs: null,
      trajectoryStability: null,
      jitter: null,
      validSampleRatio: 0,
      trackingDurationMs: 0,
      sampleCount: uncoverFrames.length,
      isNotableMovement: false,
      engineeringThreshold: displacementThreshold,
      eyeWidth: null,
    };
  }

  // 4. Filter early window frames (0 - 500 ms) and full trajectory
  const earlyFrames = uncoverFrames.filter((f) => f.t <= earlyWindowMs);
  const firstFrame = uncoverFrames[0];
  const lastEarlyFrame = earlyFrames.length > 0 ? earlyFrames[earlyFrames.length - 1] : firstFrame;
  const lastFullFrame = uncoverFrames[uncoverFrames.length - 1];

  // 5. Initial Position (t ~ 0ms) - robust mean of first 3 frames
  const initSlice = uncoverFrames.slice(0, Math.min(3, uncoverFrames.length));
  const initialX = initSlice.reduce((sum, f) => sum + f.normalizedX, 0) / initSlice.length;
  const initialY = initSlice.reduce((sum, f) => sum + f.normalizedY, 0) / initSlice.length;
  const initialRawX = initSlice.reduce((sum, f) => sum + f.x, 0) / initSlice.length;
  const initialRawY = initSlice.reduce((sum, f) => sum + f.y, 0) / initSlice.length;

  // 6. Final Position (at end of recording) - robust mean of last 3 frames
  const finalSlice = uncoverFrames.slice(-Math.min(3, uncoverFrames.length));
  const finalX = finalSlice.reduce((sum, f) => sum + f.normalizedX, 0) / finalSlice.length;
  const finalY = finalSlice.reduce((sum, f) => sum + f.normalizedY, 0) / finalSlice.length;
  const finalRawX = finalSlice.reduce((sum, f) => sum + f.x, 0) / finalSlice.length;
  const finalRawY = finalSlice.reduce((sum, f) => sum + f.y, 0) / finalSlice.length;

  // 7. SEPARATE HORIZONTAL AND VERTICAL DISPLACEMENTS (Section 5)
  const earlyDx = lastEarlyFrame.x - initialRawX;
  const earlyDy = lastEarlyFrame.y - initialRawY;
  const horizontalDisplacement = Math.abs(earlyDx);
  const verticalDisplacement = Math.abs(earlyDy);
  const earlyRawDistance = Math.hypot(earlyDx, earlyDy);

  const normalizedHorizontal = horizontalDisplacement / safeEyeWidth;
  const normalizedVertical = verticalDisplacement / safeEyeWidth;
  const normalizedDisplacement = earlyRawDistance / safeEyeWidth;

  // 8. Displacement relative to robust baseline
  const dxFromBaseline = initialRawX - baseline.baselineX;
  const dyFromBaseline = initialRawY - baseline.baselineY;
  const horizontalDisplacementFromBaseline = Math.abs(dxFromBaseline);
  const verticalDisplacementFromBaseline = Math.abs(dyFromBaseline);
  const rawDistFromBaseline = Math.hypot(dxFromBaseline, dyFromBaseline);
  const displacementFromBaseline = rawDistFromBaseline / safeEyeWidth;

  // 9. Time-series analysis: instantaneous velocity, peak tracking, step jitter
  let peakVel = 0;
  let timeToPeakMs = 0;
  let maxDisplacement = 0;
  let peakFrame = firstFrame;
  let horizontalPeakRaw = 0;
  let verticalPeakRaw = 0;
  const stepDistances = [];
  let sumDistances = 0;

  for (let i = 1; i < uncoverFrames.length; i++) {
    const prev = uncoverFrames[i - 1];
    const curr = uncoverFrames[i];

    // Excursion from initial position
    const curDx = Math.abs(curr.x - initialRawX);
    const curDy = Math.abs(curr.y - initialRawY);
    if (curDx > horizontalPeakRaw) horizontalPeakRaw = curDx;
    if (curDy > verticalPeakRaw) verticalPeakRaw = curDy;

    const distFromInit = Math.hypot(curr.x - initialRawX, curr.y - initialRawY) / safeEyeWidth;
    sumDistances += distFromInit;
    if (distFromInit > maxDisplacement) {
      maxDisplacement = distFromInit;
      peakFrame = curr;
    }

    // Step-by-step distance for tracking jitter evaluation
    const stepDist = Math.hypot(curr.x - prev.x, curr.y - prev.y) / safeEyeWidth;
    stepDistances.push(stepDist);

    // Instantaneous velocity (normalized eye width per second)
    const dt = Math.max(1, curr.t - prev.t) / 1000;
    const vel = stepDist / dt;

    if (vel > peakVel) {
      peakVel = vel;
      timeToPeakMs = curr.t;
    }
  }

  const horizontalPeak = horizontalPeakRaw / safeEyeWidth;
  const verticalPeak = verticalPeakRaw / safeEyeWidth;
  const meanDisplacement = uncoverFrames.length > 1 ? sumDistances / (uncoverFrames.length - 1) : 0;
  const jitter = stepDistances.length > 0 ? median(stepDistances) : 0;

  // 10. Direction analysis (Nasal, Temporal, Superior, Inferior)
  const peakDx = peakFrame.x - initialRawX;
  const peakDy = peakFrame.y - initialRawY;
  let horizontalDirection = 'NONE';
  if (Math.abs(peakDx) > 0.02 * safeEyeWidth) {
    if (eye === 'left') {
      horizontalDirection = peakDx > 0 ? 'TEMPORAL' : 'NASAL';
    } else {
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

  // 11. Mean velocity during early refixation window
  const earlyDurationSec = Math.max(0.01, (lastEarlyFrame.t - firstFrame.t) / 1000);
  const meanVelocity = normalizedDisplacement / earlyDurationSec;

  // 12. Movement duration: time when velocity returns toward baseline (< 25% of peak velocity)
  let movementDurationMs = earlyWindowMs;
  const settlingThreshold = Math.max(0.05, peakVel * 0.25);
  for (let i = 1; i < uncoverFrames.length; i++) {
    if (uncoverFrames[i].t > timeToPeakMs) {
      const prev = uncoverFrames[i - 1];
      const curr = uncoverFrames[i];
      const dt = Math.max(1, curr.t - prev.t) / 1000;
      const v = Math.hypot(curr.x - prev.x, curr.y - prev.y) / safeEyeWidth / dt;
      if (v < settlingThreshold) {
        movementDurationMs = curr.t;
        break;
      }
    }
  }

  // 13. Trajectory stability in final settling segment (last 1000ms)
  const settlingFrames = uncoverFrames.filter((f) => f.t >= SCREENING_CONFIG.RECORD_MS - 1000);
  let trajectoryStability = 1.0;
  if (settlingFrames.length >= 5) {
    const settlingNormX = settlingFrames.map((f) => f.normalizedX);
    const varX = iqr(settlingNormX);
    trajectoryStability = Math.max(0, 1.0 - (varX ?? 0) * 10);
  }

  // 14. Sample coverage and ratio
  const expectedFrames = Math.max(1, (SCREENING_CONFIG.RECORD_MS / 33.3));
  const validSampleRatio = Math.min(1.0, uncoverFrames.length / expectedFrames);
  const sampleCoverage = validSampleRatio;
  const baselineConfidence = baseline && baseline.isStable ? 1.0 : 0.6;
  const measurementConfidence = Number(
    (sampleCoverage * 0.4 + trajectoryStability * 0.3 + baselineConfidence * 0.3).toFixed(2)
  );

  // 15. TIME-SERIES REFIXATION SACCADE EVALUATION (Sections 10, 11, 12)
  // Replaces the naive `normalizedDisplacement >= 0.10` single threshold.
  // Requires:
  //   a) Excursion: either horizontal or vertical normalized displacement >= 0.08 (or combined >= 0.10)
  //   b) Velocity: peak velocity >= 0.20 norm/s (true saccade kinematics)
  //   c) Latency: peak occurs in early window (60ms - 600ms)
  //   d) Jitter floor: peak excursion is at least 2.0x higher than step jitter
  //   e) Stability: eye settles cleanly after movement (stability >= 0.60)
  //   f) Jitter acceptable: step jitter <= 0.05 (not overwhelmed by tracking noise)
  const hasExcursion =
    normalizedHorizontal >= 0.08 ||
    normalizedVertical >= 0.08 ||
    normalizedDisplacement >= displacementThreshold;
  const hasSaccadicVelocity = peakVel >= SCREENING_CONFIG.VELOCITY_THRESHOLD * 0.8;
  const hasPlausibleLatency = timeToPeakMs >= 60 && timeToPeakMs <= 700;
  const hasLowJitter = jitter <= 0.05;
  const hasSettled = trajectoryStability >= 0.60;
  const exceedsJitterFloor = jitter > 0 ? normalizedDisplacement >= 2.0 * jitter : true;

  const isNotableMovement = Boolean(
    hasExcursion &&
      hasSaccadicVelocity &&
      hasPlausibleLatency &&
      hasLowJitter &&
      hasSettled &&
      exceedsJitterFloor
  );

  // 16. Temporal Events Array (UNCOVER = 0 ms Anchor)
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

  return {
    eye,
    cycle,
    baselinePosition: {
      x: baseline.baselineX,
      y: baseline.baselineY,
      normalizedX: baseline.normalizedBaselineX,
      normalizedY: baseline.normalizedBaselineY,
      sampleCount: baseline.sampleCount,
      isStable: baseline.isStable,
    },
    initialPosition: {
      x: Number(initialRawX.toFixed(4)),
      y: Number(initialRawY.toFixed(4)),
      normalizedX: Number(initialX.toFixed(4)),
      normalizedY: Number(initialY.toFixed(4)),
      t: firstFrame.t,
    },
    finalPosition: {
      x: Number(finalRawX.toFixed(4)),
      y: Number(finalRawY.toFixed(4)),
      normalizedX: Number(finalX.toFixed(4)),
      normalizedY: Number(finalY.toFixed(4)),
      t: lastFullFrame.t,
    },
    peakPosition: {
      x: Number(peakFrame.x.toFixed(4)),
      y: Number(peakFrame.y.toFixed(4)),
      normalizedX: Number(peakFrame.normalizedX.toFixed(4)),
      normalizedY: Number(peakFrame.normalizedY.toFixed(4)),
      t: peakFrame.t,
    },
    dx: Number(earlyDx.toFixed(4)),
    dy: Number(earlyDy.toFixed(4)),
    horizontalDisplacement: Number(horizontalDisplacement.toFixed(4)),
    verticalDisplacement: Number(verticalDisplacement.toFixed(4)),
    displacement: Number(earlyRawDistance.toFixed(4)),
    normalizedHorizontal: Number(normalizedHorizontal.toFixed(4)),
    normalizedVertical: Number(normalizedVertical.toFixed(4)),
    normalizedDisplacement: Number(normalizedDisplacement.toFixed(4)),
    maximumDisplacement: Number(maxDisplacement.toFixed(4)),
    horizontalPeak: Number(horizontalPeak.toFixed(4)),
    verticalPeak: Number(verticalPeak.toFixed(4)),
    peakDisplacement: Number(maxDisplacement.toFixed(4)),
    meanDisplacement: Number(meanDisplacement.toFixed(4)),
    dxFromBaseline: Number(dxFromBaseline.toFixed(4)),
    dyFromBaseline: Number(dyFromBaseline.toFixed(4)),
    horizontalDisplacementFromBaseline: Number(horizontalDisplacementFromBaseline.toFixed(4)),
    verticalDisplacementFromBaseline: Number(verticalDisplacementFromBaseline.toFixed(4)),
    displacementFromBaseline: Number(displacementFromBaseline.toFixed(4)),
    movementDirection,
    horizontalDirection,
    verticalDirection,
    velocity: Number(meanVelocity.toFixed(4)),
    peakVelocity: Number(peakVel.toFixed(4)),
    timeToPeakMs,
    meanVelocity: Number(meanVelocity.toFixed(4)),
    movementDurationMs,
    trajectoryStability: Number(trajectoryStability.toFixed(4)),
    jitter: Number(jitter.toFixed(4)),
    validSampleRatio: Number(validSampleRatio.toFixed(4)),
    trackingDurationMs: Math.round(lastFullFrame.t - firstFrame.t),
    eyeWidth: Number(safeEyeWidth.toFixed(4)),
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
      jitter: Number(jitter.toFixed(4)),
      validSampleRatio: Number(validSampleRatio.toFixed(4)),
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

  const displacements = validCycles.map((c) => c.normalizedDisplacement).filter((v) => typeof v === 'number');
  const horizontalDisplacements = validCycles.map((c) => c.normalizedHorizontal).filter((v) => typeof v === 'number');
  const verticalDisplacements = validCycles.map((c) => c.normalizedVertical).filter((v) => typeof v === 'number');
  const peakVelocities = validCycles.map((c) => c.peakVelocity).filter((v) => typeof v === 'number');
  const notableCount = validCycles.filter((c) => c.isNotableMovement).length;

  const medianDisp = median(displacements);
  const meanDisp = displacements.length > 0 ? displacements.reduce((a, b) => a + b, 0) / displacements.length : null;
  const medianH = median(horizontalDisplacements);
  const meanH = horizontalDisplacements.length > 0 ? horizontalDisplacements.reduce((a, b) => a + b, 0) / horizontalDisplacements.length : null;
  const medianV = median(verticalDisplacements);
  const meanV = verticalDisplacements.length > 0 ? verticalDisplacements.reduce((a, b) => a + b, 0) / verticalDisplacements.length : null;
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
    medianDisplacement: medianDisp != null ? Number(medianDisp.toFixed(4)) : null,
    meanDisplacement: meanDisp != null ? Number(meanDisp.toFixed(4)) : null,
    medianHorizontal: medianH != null ? Number(medianH.toFixed(4)) : null,
    meanHorizontal: meanH != null ? Number(meanH.toFixed(4)) : null,
    medianVertical: medianV != null ? Number(medianV.toFixed(4)) : null,
    meanVertical: meanV != null ? Number(meanV.toFixed(4)) : null,
    medianPeakVelocity: medianPeakVel != null ? Number(medianPeakVel.toFixed(4)) : null,
    notableMovementCycles: notableCount,
    verdict,
    verdictLabel,
    dataQuality: { isValid: true, reason: null },
    cycles: eyeCycles,
  };
}
