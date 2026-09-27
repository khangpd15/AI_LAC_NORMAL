/**
 * FUSION & DECISION SUPPORT SERVICE
 * Refactored architecture for Digital Cover Test Measurement:
 * 
 * 1. Primary Signal: Cover Test Physical Measurement (Refixation Saccade Displacement & Velocity)
 * 2. Supporting Signal: AI Static Geometric Inference (Secondary Morphological Check)
 * 3. Gating Reliability: Biometric Tracking & Data Quality
 * 
 * NOTE: The previous CV 60% / AI 40% weighting is superseded. AI cannot override
 * the physical absence of refixation saccades, and serves solely as assistive context.
 */

import { SCREENING_VERDICT } from '../constants/screeningConfig';

/**
 * Evaluates a single cycle by fusing the primary Cover Test measurement with supporting AI signals
 * @param {Object} params
 * @param {Object} params.measurement - Digital Cover Test measurement from analyzeUncoverTrajectory
 * @param {Object} params.aiSignal - { normalScore, strabismusScore, confidence }
 * @param {Object} params.dataQuality - { isValid, faceDetected, leftEyeDetected, rightEyeDetected }
 * @param {string} params.eye - 'left' | 'right'
 * @param {number} params.cycle - cycle number (1..3)
 * @returns {Object} Fused cycle screening assessment
 */
export function fuseScreeningSignals({
  measurement = {},
  aiSignal = {},
  dataQuality = {},
  eye = 'right',
  cycle = 1,
}) {
  // 1. Data Quality Gate (Hard Reliability Gate)
  if (!dataQuality || !dataQuality.isValid || (measurement.dataQuality && !measurement.dataQuality.isValid)) {
    const reason =
      dataQuality?.reason ||
      measurement.dataQuality?.reason ||
      'Dữ liệu theo dõi không đủ tin cậy do mất dấu khuôn mặt hoặc mắt';

    return {
      eye,
      cycle,
      verdict: SCREENING_VERDICT.INCONCLUSIVE,
      label: reason,
      primaryMeasurement: measurement,
      supportingAI: aiSignal,
      concordance: 'INCONCLUSIVE',
      clinicalNotes: 'Bài kiểm tra không thu thập đủ số lượng khung hình hoặc mất dấu mống mắt.',
    };
  }

  // 2. Primary Clinical Signal: Cover Test Measurement
  const isMovementNotable = !!measurement.isNotableMovement;
  const displacement = measurement.normalizedDisplacement || 0;
  const peakVelocity = measurement.peakVelocity || 0;

  // 3. Supporting AI Signal: Static Morphology
  const hasAISignal = typeof aiSignal.strabismusScore === 'number';
  const aiScore = hasAISignal ? aiSignal.strabismusScore : null;
  const aiConfidence = typeof aiSignal.confidence === 'number' ? aiSignal.confidence : null;
  const isAIElevated = hasAISignal && aiScore >= 0.55;

  // 4. Decision Synthesis (Primary drives verdict; AI supports)
  let verdict = SCREENING_VERDICT.NO_SIGNAL_DETECTED;
  let label = 'Không ghi nhận chuyển động tái định thị đáng chú ý trong lần sàng lọc này';
  let concordance = 'AGREEMENT_NORMAL';
  let clinicalNotes = '';

  if (isMovementNotable) {
    verdict = SCREENING_VERDICT.SIGNAL_DETECTED;
    label = 'Có ghi nhận chuyển động tái định thị đáng chú ý';

    if (!hasAISignal) {
      concordance = 'PRIMARY_ONLY';
      clinicalNotes = 'Phép đo Cover Test ghi nhận chuyển động tái định vị; không có tín hiệu AI hợp lệ trong chu kỳ này.';
    } else if (isAIElevated) {
      concordance = 'CONCORDANT_NOTABLE';
      clinicalNotes = 'Phép đo Cover Test ghi nhận chuyển động tái định vị; mô hình AI đồng thuận ghi nhận chỉ số hình thái bất đối xứng.';
    } else {
      concordance = 'PRIMARY_NOTABLE_AI_NORMAL';
      clinicalNotes = 'Phép đo Cover Test ghi nhận chuyển động tái định vị (mô hình AI tĩnh chưa ghi nhận bất thường).';
    }
  } else {
    // No physical movement detected by Cover Test
    verdict = SCREENING_VERDICT.NO_SIGNAL_DETECTED;
    label = 'Không ghi nhận chuyển động tái định thị đáng chú ý trong lần sàng lọc này';

    if (!hasAISignal) {
      concordance = 'PRIMARY_ONLY';
      clinicalNotes = 'Kết quả chu kỳ dựa trên phép đo chuyển động Cover Test; không có tín hiệu AI hợp lệ.';
    } else if (isAIElevated) {
      concordance = 'PRIMARY_NORMAL_AI_ELEVATED';
      clinicalNotes = 'Không phát hiện giật mắt tái định vị khi bỏ che; mô hình AI ghi nhận dấu hiệu hình thái tĩnh cần theo dõi thêm.';
    } else {
      concordance = 'CONCORDANT_NORMAL';
      clinicalNotes = 'Cả phép đo chuyển động mống mắt và mô hình AI đều không phát hiện tín hiệu bất thường.';
    }
  }

  return {
    eye,
    cycle,
    verdict,
    label,
    primaryMeasurement: {
      displacement,
      peakVelocity,
      timeToPeakMs: measurement.timeToPeakMs || 0,
      movementDurationMs: measurement.movementDurationMs || 0,
      isNotableMovement,
      engineeringThreshold: measurement.engineeringThreshold,
    },
    supportingAI: {
      strabismusScore: Number.isFinite(aiScore) ? Number(aiScore.toFixed(4)) : null,
      confidence: Number.isFinite(aiConfidence) ? Number(aiConfidence.toFixed(4)) : null,
      isElevated: isAIElevated,
    },
    concordance,
    clinicalNotes,
  };
}

/**
 * Aggregates multi-cycle fused results across Left Eye and Right Eye
 * @param {Array<Object>} cycleFusions - Array of fused cycle records
 * @returns {Object} Comprehensive multi-cycle screening summary
 */
export function aggregateMultiCycleFusion(cycleFusions = []) {
  if (!cycleFusions || cycleFusions.length === 0) {
    return {
      overallVerdict: SCREENING_VERDICT.INCONCLUSIVE,
      overallLabel: 'Không có dữ liệu sàng lọc hợp lệ',
      leftEye: { verdict: SCREENING_VERDICT.INCONCLUSIVE, label: 'Chưa đủ dữ liệu ổn định để đánh giá', validCycles: 0, medianDisplacement: null, medianPeakVelocity: null, meanAIScore: null, cycles: [] },
      rightEye: { verdict: SCREENING_VERDICT.INCONCLUSIVE, label: 'Chưa đủ dữ liệu ổn định để đánh giá', validCycles: 0, medianDisplacement: null, medianPeakVelocity: null, meanAIScore: null, cycles: [] },
      rawFusions: [],
    };
  }

  const leftCycles = cycleFusions.filter((f) => f.eye === 'left' && f.verdict !== SCREENING_VERDICT.INCONCLUSIVE);
  const rightCycles = cycleFusions.filter((f) => f.eye === 'right' && f.verdict !== SCREENING_VERDICT.INCONCLUSIVE);

  const aggregateEye = (cycles, eyeName) => {
    if (cycles.length < 2) {
      return {
        eye: eyeName,
        verdict: SCREENING_VERDICT.INCONCLUSIVE,
        label: 'Không đủ số chu kỳ đạt chuẩn kỹ thuật (cần ≥ 2 chu kỳ)',
        validCycles: cycles.length,
        notableCycles: 0,
        medianDisplacement: null,
        medianPeakVelocity: null,
        meanAIScore: null,
        cycles,
      };
    }

    const notableCount = cycles.filter((c) => c.verdict === SCREENING_VERDICT.SIGNAL_DETECTED).length;
    const isDetected = notableCount >= Math.ceil(cycles.length / 2);

    const displacements = cycles.map((c) => c.primaryMeasurement.displacement);
    const velocities = cycles.map((c) => c.primaryMeasurement.peakVelocity);
    const aiScores = cycles.map((c) => c.supportingAI.strabismusScore).filter(Number.isFinite);

    const sortedDisp = [...displacements].sort((a, b) => a - b);
    const medianDisp = sortedDisp[Math.floor(sortedDisp.length / 2)];

    const sortedVel = [...velocities].sort((a, b) => a - b);
    const medianVel = sortedVel[Math.floor(sortedVel.length / 2)];

    const meanAI = aiScores.length ? aiScores.reduce((a, b) => a + b, 0) / aiScores.length : null;

    return {
      eye: eyeName,
      verdict: isDetected ? SCREENING_VERDICT.SIGNAL_DETECTED : SCREENING_VERDICT.NO_SIGNAL_DETECTED,
      label: isDetected
        ? 'Có ghi nhận chuyển động tái định thị đáng chú ý'
        : 'Không ghi nhận chuyển động tái định thị đáng chú ý trong lần sàng lọc này',
      validCycles: cycles.length,
      notableCycles: notableCount,
      medianDisplacement: Number(medianDisp.toFixed(4)),
      medianPeakVelocity: Number(medianVel.toFixed(4)),
      meanAIScore: Number.isFinite(meanAI) ? Number(meanAI.toFixed(4)) : null,
      cycles,
    };
  };

  const leftSummary = aggregateEye(leftCycles, 'left');
  const rightSummary = aggregateEye(rightCycles, 'right');

  // Overall screening verdict
  let overallVerdict = SCREENING_VERDICT.NO_SIGNAL_DETECTED;
  let overallLabel = 'Không ghi nhận chuyển động tái định thị đáng chú ý trong lần sàng lọc này';

  if (
    leftSummary.verdict === SCREENING_VERDICT.SIGNAL_DETECTED ||
    rightSummary.verdict === SCREENING_VERDICT.SIGNAL_DETECTED
  ) {
    overallVerdict = SCREENING_VERDICT.SIGNAL_DETECTED;
    overallLabel = 'Có ghi nhận chuyển động tái định thị đáng chú ý';
  } else if (
    leftSummary.verdict === SCREENING_VERDICT.INCONCLUSIVE ||
    rightSummary.verdict === SCREENING_VERDICT.INCONCLUSIVE
  ) {
    overallVerdict = SCREENING_VERDICT.INCONCLUSIVE;
    overallLabel = 'Kết quả chưa đủ dữ liệu để đánh giá';
  }

  return {
    overallVerdict,
    overallLabel,
    leftEye: leftSummary,
    rightEye: rightSummary,
    rawFusions: cycleFusions,
  };
}
