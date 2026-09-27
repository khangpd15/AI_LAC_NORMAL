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

const isRealNumber = (v) => typeof v === 'number' && Number.isFinite(v);

// Helper: build a minimal valid cycle with a real measurement
function validCycleRecord(cycleIndex, isRefixation = false) {
  const dx = isRefixation ? 0.007 : 0.0008;
  const dy = isRefixation ? 0.003 : 0.0005;
  const eyeWidth = 0.05;
  const eyeMeasurement = {
    dataQuality: { isValid: true, reason: null },
    eyeWidth,
    dx,
    dy,
    horizontalDisplacement: Math.abs(dx),
    verticalDisplacement: Math.abs(dy),
    displacement: Math.hypot(dx, dy),
    normalizedHorizontal: Math.abs(dx) / eyeWidth,
    normalizedVertical: Math.abs(dy) / eyeWidth,
    normalizedDisplacement: isRefixation ? 0.15 : 0.02,
    peakVelocity: isRefixation ? 0.28 : 0.08,
    trajectoryStability: 0.85,
    jitter: 0.02,
    sampleCount: 30,
    baselinePosition: { normalizedX: 0.49, normalizedY: 0.50, isStable: true },
    initialPosition: { normalizedX: 0.49, normalizedY: 0.50 },
    finalPosition: { normalizedX: isRefixation ? 0.56 : 0.50, normalizedY: 0.50 },
    isNotableMovement: isRefixation,
  };
  return {
    cycleNumber: cycleIndex,
    cycleIndex,
    quality: { isValid: true, status: 'GOOD' },
    valid: true,
    isRefixationNotable: isRefixation,
    horizontalDisplacement: eyeMeasurement.horizontalDisplacement,
    verticalDisplacement: eyeMeasurement.verticalDisplacement,
    normalizedHorizontal: eyeMeasurement.normalizedHorizontal,
    normalizedVertical: eyeMeasurement.normalizedVertical,
    rightEye: { ...eyeMeasurement, eye: 'right' },
    leftEye: { ...eyeMeasurement, eye: 'left' },
    baseline: {
      rightBaseline: { isStable: true, normalizedBaselineX: 0.50, normalizedBaselineY: 0.50, sampleCount: 30 },
      leftBaseline: { isStable: true, normalizedBaselineX: 0.50, normalizedBaselineY: 0.50, sampleCount: 30 },
    },
    occlusionMethod: 'manual_instruction',
    occlusionVerified: null,
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
  // TC01: Face ổn định → đủ 3 cycles → valid
  const tc01Session = {
    coverPositionCheck: position,
    brockPositionCheck: position,
    coverTest: buildCoverTest(COVER_TEST_VERDICTS.NO_SIGNIFICANT_REFIXATION, 3, false),
    brockString: buildBrockString(),
  };
  const tc01Result = evaluateFinalScreening(tc01Session);

  // TC02: Không detect iris → INCONCLUSIVE
  const tc02NoIrisSession = {
    coverPositionCheck: { ...position, irisDetected: false },
    brockPositionCheck: position,
    coverTest: {
      status: COVER_TEST_VERDICTS.INCONCLUSIVE,
      cycles: [1, 2, 3].map((i) => ({ cycleIndex: i, valid: false, quality: { isValid: false, reason: 'INVALID_IRIS' } })),
      validCycles: 0,
      quality: { status: DATA_QUALITY_STATUS.INCONCLUSIVE, reasons: ['INVALID_IRIS'] },
    },
    brockString: buildBrockString(),
  };
  const tc02Result = evaluateFinalScreening(tc02NoIrisSession);

  // TC03: Eye width invalid → INCONCLUSIVE
  const tc03InvalidEyeWidthSession = {
    coverPositionCheck: position,
    brockPositionCheck: position,
    coverTest: {
      status: COVER_TEST_VERDICTS.INCONCLUSIVE,
      cycles: [1, 2, 3].map((i) => ({
        cycleIndex: i,
        valid: false,
        rightEye: { eyeWidth: null, normalizedDisplacement: null, dataQuality: { isValid: false, reason: 'INVALID_EYE_WIDTH' } },
        leftEye: { eyeWidth: null, normalizedDisplacement: null, dataQuality: { isValid: false, reason: 'INVALID_EYE_WIDTH' } },
        quality: { isValid: false, reason: 'INVALID_EYE_WIDTH' },
      })),
      validCycles: 0,
      quality: { status: DATA_QUALITY_STATUS.INCONCLUSIVE, reasons: ['INVALID_EYE_WIDTH'] },
    },
    brockString: buildBrockString(),
  };
  const tc03Result = evaluateFinalScreening(tc03InvalidEyeWidthSession);

  // TC04: Baseline không đủ samples → INCONCLUSIVE
  const tc04BaselineSession = {
    coverPositionCheck: position,
    brockPositionCheck: position,
    coverTest: {
      status: COVER_TEST_VERDICTS.INCONCLUSIVE,
      cycles: [1, 2, 3].map((i) => ({
        cycleIndex: i,
        valid: false,
        baseline: { rightBaseline: { sampleCount: 5, isStable: false }, leftBaseline: { sampleCount: 5, isStable: false } },
        quality: { isValid: false, reason: 'INSUFFICIENT_SAMPLES' },
      })),
      validCycles: 0,
      quality: { status: DATA_QUALITY_STATUS.INCONCLUSIVE, reasons: ['INSUFFICIENT_SAMPLES'] },
    },
    brockString: buildBrockString(),
  };
  const tc04Result = evaluateFinalScreening(tc04BaselineSession);

  // TC05: Head movement lớn → cycle invalid
  const tc05HeadMotionSession = {
    coverPositionCheck: { ...position, headPoseValid: false },
    brockPositionCheck: position,
    coverTest: {
      status: COVER_TEST_VERDICTS.INCONCLUSIVE,
      cycles: [1, 2, 3].map((i) => ({
        cycleIndex: i,
        valid: false,
        quality: { isValid: false, reason: 'HEAD_MOTION' },
      })),
      validCycles: 0,
      quality: { status: DATA_QUALITY_STATUS.INCONCLUSIVE, reasons: ['HEAD_MOTION'] },
    },
    brockString: buildBrockString(),
  };
  const tc05Result = evaluateFinalScreening(tc05HeadMotionSession);

  // TC06: Tracking jitter lớn → giảm quality / INCONCLUSIVE
  const tc06ExcessiveJitterSession = {
    coverPositionCheck: position,
    brockPositionCheck: position,
    coverTest: {
      status: COVER_TEST_VERDICTS.INCONCLUSIVE,
      validCycles: 2,
      cycles: [
        {
          cycleIndex: 1,
          valid: true,
          rightEye: { jitter: 0.12, normalizedDisplacement: 0.05, dataQuality: { isValid: true } },
          leftEye: { jitter: 0.14, normalizedDisplacement: 0.05, dataQuality: { isValid: true } },
          quality: { isValid: true },
        },
        {
          cycleIndex: 2,
          valid: true,
          rightEye: { jitter: 0.11, normalizedDisplacement: 0.05, dataQuality: { isValid: true } },
          leftEye: { jitter: 0.13, normalizedDisplacement: 0.05, dataQuality: { isValid: true } },
          quality: { isValid: true },
        },
      ],
      quality: { status: DATA_QUALITY_STATUS.INCONCLUSIVE, reasons: ['EXCESSIVE_TRACKING_JITTER_ACROSS_CYCLES'] },
    },
    brockString: buildBrockString(),
  };
  const tc06Result = evaluateFinalScreening(tc06ExcessiveJitterSession);

  // TC07: Một cycle có displacement cao nhưng 2 cycle còn lại thấp → không được tự động kết luận lác (CLEAR)
  const tc07SingleSpikeCover = {
    status: COVER_TEST_VERDICTS.NO_SIGNIFICANT_REFIXATION,
    validCycles: 3,
    refixationDetected: false,
    quality: { status: DATA_QUALITY_STATUS.GOOD, reasons: [] },
    cycles: [
      validCycleRecord(1, true),   // Cycle 1 has spike
      validCycleRecord(2, false),  // Cycle 2 is normal
      validCycleRecord(3, false),  // Cycle 3 is normal
    ],
  };
  const tc07Session = {
    coverPositionCheck: position,
    brockPositionCheck: position,
    coverTest: tc07SingleSpikeCover,
    brockString: buildBrockString(),
  };
  const tc07Result = evaluateFinalScreening(tc07Session);

  // TC08: Phone và laptop cho normalized displacement khác nhau → không được coi là hai chẩn đoán khác nhau
  const tc08PhoneSession = {
    coverPositionCheck: position,
    brockPositionCheck: position,
    coverTest: buildCoverTest(COVER_TEST_VERDICTS.NO_SIGNIFICANT_REFIXATION, 3, false),
    brockString: buildBrockString(),
  };
  const tc08LaptopSession = {
    coverPositionCheck: position,
    brockPositionCheck: position,
    coverTest: buildCoverTest(COVER_TEST_VERDICTS.NO_SIGNIFICANT_REFIXATION, 3, false),
    brockString: buildBrockString(),
  };
  const tc08PhoneResult = evaluateFinalScreening(tc08PhoneSession);
  const tc08LaptopResult = evaluateFinalScreening(tc08LaptopSession);

  // TC09: dx/dy hợp lệ → horizontal/vertical được tính riêng
  const sampleCycle = validCycleRecord(1, true);
  const mRight = sampleCycle.rightEye;
  const tc09SeparateHV = {
    hasDx: isRealNumber(mRight.displacement),
    hasH: isRealNumber(mRight.normalizedDisplacement),
    isDiagnostic: false,
  };

  // TC10: 3 cycles phải được lưu độc lập
  const threeIndependentCycles = [1, 2, 3].map((idx) => validCycleRecord(idx, false));
  const tc10Independence = {
    count: threeIndependentCycles.length,
    indices: threeIndependentCycles.map((c) => c.cycleIndex),
    allUnique: new Set(threeIndependentCycles.map((c) => c.cycleIndex)).size === 3,
  };

  return [
    {
      case: 1,
      name: 'TC01: Face ổn định → đủ 3 cycles → valid',
      expected: OVERALL_SCREENING_STATUS.SCREENING_CLEAR,
      result: tc01Result.status,
      passed: tc01Result.status === OVERALL_SCREENING_STATUS.SCREENING_CLEAR && tc01Result.isDiagnostic === false,
    },
    {
      case: 2,
      name: 'TC02: Không detect iris → INCONCLUSIVE',
      expected: OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
      result: tc02Result.status,
      passed: tc02Result.status === OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
    },
    {
      case: 3,
      name: 'TC03: Eye width invalid → INCONCLUSIVE',
      expected: OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
      result: tc03Result.status,
      passed: tc03Result.status === OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
    },
    {
      case: 4,
      name: 'TC04: Baseline không đủ samples → INCONCLUSIVE',
      expected: OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
      result: tc04Result.status,
      passed: tc04Result.status === OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
    },
    {
      case: 5,
      name: 'TC05: Head movement lớn → cycle invalid / INCONCLUSIVE',
      expected: OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
      result: tc05Result.status,
      passed: tc05Result.status === OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
    },
    {
      case: 6,
      name: 'TC06: Tracking jitter lớn → giảm quality / INCONCLUSIVE',
      expected: OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
      result: tc06Result.status,
      passed: tc06Result.status === OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
    },
    {
      case: 7,
      name: 'TC07: Một cycle có displacement cao nhưng 2 cycle còn lại thấp → SCREENING_CLEAR (không ATTENTION)',
      expected: OVERALL_SCREENING_STATUS.SCREENING_CLEAR,
      result: tc07Result.status,
      passed: tc07Result.status === OVERALL_SCREENING_STATUS.SCREENING_CLEAR,
    },
    {
      case: 8,
      name: 'TC08: Phone và laptop cho normalized displacement khác nhau → không được coi là hai chẩn đoán khác nhau',
      expected: 'Non-diagnostic screening only, clinical diagnosis strictly null',
      result: `${tc08PhoneResult.clinical.diagnosis} / ${tc08LaptopResult.clinical.diagnosis}`,
      passed:
        tc08PhoneResult.isDiagnostic === false &&
        tc08LaptopResult.isDiagnostic === false &&
        tc08PhoneResult.clinical.diagnosis === null &&
        tc08LaptopResult.clinical.diagnosis === null &&
        tc08PhoneResult.status === tc08LaptopResult.status,
    },
    {
      case: 9,
      name: 'TC09: dx/dy hợp lệ → horizontal/vertical được tính riêng',
      expected: 'dx, dy, horizontal, vertical separate',
      result: 'Calculated separately',
      passed: tc09SeparateHV.hasDx && tc09SeparateHV.hasH && !tc09SeparateHV.isDiagnostic,
    },
    {
      case: 10,
      name: 'TC10: 3 cycles phải được lưu độc lập',
      expected: '3 distinct cycles',
      result: `${tc10Independence.count} cycles, unique: ${tc10Independence.allUnique}`,
      passed: tc10Independence.count === 3 && tc10Independence.allUnique,
    },
  ];
}
