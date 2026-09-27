/**
 * Final Screening Test Cases
 * Validates the evaluateFinalScreening decision engine with representative sessions.
 * These tests verify the quality gate + decision logic, not clinical thresholds.
 */
import { evaluateFinalScreening } from './binocularScreeningService.js';
import {
  COVER_TEST_VERDICTS,
  BROCK_STRING_VERDICTS,
  DATA_QUALITY_STATUS,
  OVERALL_SCREENING_STATUS,
} from '../constants/binocularScreeningConfig.js';

// Helper: build a minimal valid cycle with a real measurement
function validCycleRecord(cycleIndex, isRefixation = false) {
  const eyeMeasurement = {
    dataQuality: { isValid: true, reason: null },
    eyeWidth: 0.05,
    normalizedDisplacement: isRefixation ? 0.15 : 0.02,
    displacement: isRefixation ? 0.008 : 0.001,
    baselinePosition: { normalizedX: 0.49, normalizedY: 0.50, isStable: true },
    initialPosition: { normalizedX: 0.49, normalizedY: 0.50 },
    finalPosition: { normalizedX: isRefixation ? 0.56 : 0.50, normalizedY: 0.50 },
    isNotableMovement: isRefixation,
  };
  return {
    cycleIndex,
    quality: { isValid: true, status: 'GOOD' },
    isRefixationNotable: isRefixation,
    rightEye: { ...eyeMeasurement, eye: 'right' },
    leftEye: { ...eyeMeasurement, eye: 'left' },
    baseline: {
      rightBaseline: { isStable: true, normalizedBaselineX: 0.50, normalizedBaselineY: 0.50, sampleCount: 30 },
      leftBaseline: { isStable: true, normalizedBaselineX: 0.50, normalizedBaselineY: 0.50, sampleCount: 30 },
    },
  };
}

// Helper: build a complete valid Cover Test with N valid cycles
function buildCoverTest(coverStatus, numValidCycles = 3, isRefixation = false) {
  const cycles = Array.from({ length: numValidCycles }, (_, i) => validCycleRecord(i + 1, isRefixation));
  return {
    status: coverStatus,
    cycles,
    validCycles: numValidCycles,
    refixationDetected: isRefixation,
    quality: { status: DATA_QUALITY_STATUS.GOOD, score: 1.0, reasons: [] },
  };
}

// Helper: build a complete valid Brock String
function buildBrockString() {
  const targetData = (label, distanceCm) => ({
    targetId: label,
    dataQuality: { isValid: true, status: 'VALID', reason: null },
    medianVergenceRatio: 1.1,
    medianInterIrisDist: 0.12,
    fixationStabilityIqr: 0.02,
    sampleCount: 40,
    targetDistanceCm: distanceCm,
  });
  return {
    status: BROCK_STRING_VERDICTS.MEASURABLE,
    targets: {
      near20cm: targetData('NEAR', 20),
      mid50cm: targetData('MID', 50),
      far100cm: targetData('FAR', 100),
    },
    quality: { status: DATA_QUALITY_STATUS.GOOD, score: 1.0, reasons: [] },
  };
}

const position = { headPoseValid: true, irisDetected: true, bothEyesDetected: true };

export function runFinalScreeningTestCases() {
  // Case 1: SCREENING_CLEAR — valid Cover Test, no refixation
  const clearSession = {
    coverPositionCheck: position,
    brockPositionCheck: position,
    coverTest: buildCoverTest(COVER_TEST_VERDICTS.NO_SIGNIFICANT_REFIXATION, 3, false),
    brockString: buildBrockString(),
  };
  const clear = evaluateFinalScreening(clearSession);

  // Case 2: SCREENING_ATTENTION — valid Cover Test with consistent refixation signal
  const attentionSession = {
    coverPositionCheck: position,
    brockPositionCheck: position,
    coverTest: buildCoverTest(COVER_TEST_VERDICTS.REFIXATION_DETECTED, 3, true),
    brockString: buildBrockString(),
  };
  const attention = evaluateFinalScreening(attentionSession);

  // Case 3: SCREENING_INCONCLUSIVE — Cover Test has 0 valid cycles
  const inconclusiveSession = {
    coverPositionCheck: position,
    brockPositionCheck: position,
    coverTest: buildCoverTest(COVER_TEST_VERDICTS.INCONCLUSIVE, 0, false),
    brockString: buildBrockString(),
  };
  const inconclusive = evaluateFinalScreening(inconclusiveSession);

  // Case 4: SCREENING_INCONCLUSIVE — Cover Test has only 1 valid cycle (below threshold)
  const oneCycleSession = {
    coverPositionCheck: position,
    brockPositionCheck: position,
    coverTest: buildCoverTest(COVER_TEST_VERDICTS.INCONCLUSIVE, 1, false),
    brockString: buildBrockString(),
  };
  const oneCycle = evaluateFinalScreening(oneCycleSession);

  // Case 5: SCREENING_CLEAR even when Brock String is INCONCLUSIVE
  // (Brock String is supplementary only — should NOT block CLEAR)
  const brockInconclusiveSession = {
    coverPositionCheck: position,
    brockPositionCheck: position,
    coverTest: buildCoverTest(COVER_TEST_VERDICTS.NO_SIGNIFICANT_REFIXATION, 3, false),
    brockString: { status: BROCK_STRING_VERDICTS.INCONCLUSIVE, targets: {}, quality: { status: DATA_QUALITY_STATUS.INCONCLUSIVE } },
  };
  const brockInconclusive = evaluateFinalScreening(brockInconclusiveSession);

  return [
    {
      case: 1,
      description: 'Valid Cover Test, no refixation → SCREENING_CLEAR',
      expected: OVERALL_SCREENING_STATUS.SCREENING_CLEAR,
      result: clear,
      passed:
        clear.status === OVERALL_SCREENING_STATUS.SCREENING_CLEAR &&
        clear.isDiagnostic === false &&
        clear.quality !== undefined,
    },
    {
      case: 2,
      description: 'Valid Cover Test, consistent refixation signal → SCREENING_ATTENTION',
      expected: OVERALL_SCREENING_STATUS.SCREENING_ATTENTION,
      result: attention,
      passed:
        attention.status === OVERALL_SCREENING_STATUS.SCREENING_ATTENTION &&
        attention.isDiagnostic === false,
    },
    {
      case: 3,
      description: 'Cover Test 0 valid cycles → SCREENING_INCONCLUSIVE',
      expected: OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
      result: inconclusive,
      passed: inconclusive.status === OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
    },
    {
      case: 4,
      description: 'Cover Test 1 valid cycle only → SCREENING_INCONCLUSIVE',
      expected: OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
      result: oneCycle,
      passed: oneCycle.status === OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
    },
    {
      case: 5,
      description: 'Cover Test valid + Brock INCONCLUSIVE → SCREENING_CLEAR (Brock is supplementary)',
      expected: OVERALL_SCREENING_STATUS.SCREENING_CLEAR,
      result: brockInconclusive,
      passed: brockInconclusive.status === OVERALL_SCREENING_STATUS.SCREENING_CLEAR,
    },
  ];
}
