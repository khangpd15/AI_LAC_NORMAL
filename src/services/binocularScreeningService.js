/**
 * BINOCULAR SCREENING SERVICE
 * Manages the unified session lifecycle across:
 * 1. Position Check
 * 2. Cover Test
 * 3. Brock String
 * 4. Screening Summary
 * 
 * STRICT CLINICAL SAFETY RULE:
 * This service aggregates objective, non-diagnostic screening signals.
 * It NEVER combines tests into a diagnostic probability or overrides measurement data.
 */

import {
  BINOCULAR_SCREENING_STATES,
  COVER_TEST_VERDICTS,
  BROCK_STRING_VERDICTS,
  DATA_QUALITY_STATUS,
  SCREENING_EVENTS,
  OVERALL_SCREENING_STATUS,
} from '../constants/binocularScreeningConfig.js';
import { beginScreeningSample, generateSampleId } from './screeningDatasetService.js';
import { validateScreeningData } from './screeningQualityGate.js';

// In-memory active screening sessions store (Client-side only)
const sessionsMap = new Map();

/**
 * Creates a unique session identifier
 * @returns {string}
 */
export function generateSessionId() {
  return generateSampleId();
}

/**
 * Creates and initializes a new Binocular Vision Screening Session
 * @returns {Object} Initialized session state
 */
export function createBinocularSession() {
  const sessionId = generateSessionId();
  beginScreeningSample(sessionId);
  const session = {
    sessionId,
    sampleId: sessionId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    currentState: BINOCULAR_SCREENING_STATES.IDLE,

    gazePositionCheck: null,
    gazeTracking: null,
    coverPositionCheck: null,
    brockPositionCheck: null,
    positionCheck: {
      testType: 'COVER_TEST',
      estimatedDistanceCm: null,
      stableDistanceCm: null,
      minDistanceCm: 33,
      maxDistanceCm: 40,
      confidence: 0,
      faceDetected: false,
      bothEyesDetected: false,
      irisDetected: false,
      headPoseValid: false,
      quality: {
        status: DATA_QUALITY_STATUS.INCONCLUSIVE,
        score: 0,
        reasons: [],
      },
    },

    coverTest: {
      status: COVER_TEST_VERDICTS.INCONCLUSIVE,
      cycles: [],
      validCycles: 0,
      refixationDetected: false,
      consistency: 'PENDING',
      quality: {
        status: DATA_QUALITY_STATUS.INCONCLUSIVE,
        score: 0,
        reasons: [],
      },
    },

    brockString: {
      status: BROCK_STRING_VERDICTS.INCONCLUSIVE,
      targets: {
        near20cm: null,
        mid50cm: null,
        far100cm: null,
      },
      quality: {
        status: DATA_QUALITY_STATUS.INCONCLUSIVE,
        score: 0,
        reasons: [],
      },
    },

    aiSupportingSignal: {
      enabled: false,
      meanNormalScore: null,
      meanStrabismusScore: null,
      confidence: null,
      note: 'AI là tín hiệu hỗ trợ nghiên cứu hình thái học tĩnh. Không thay thế đo lường cơ năng.',
    },

    events: [],

    summary: {
      coverTestStatus: COVER_TEST_VERDICTS.INCONCLUSIVE,
      brockStringStatus: BROCK_STRING_VERDICTS.INCONCLUSIVE,
      overallDataQuality: DATA_QUALITY_STATUS.INCONCLUSIVE,
      screeningStatus: OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE,
      title: 'Chưa đủ dữ liệu để đánh giá',
      description: 'Dữ liệu trong lần kiểm tra này chưa đủ ổn định. Bạn có thể thực hiện lại bài sàng lọc.',
      disclaimer: 'Kết quả này chỉ mang tính chất sàng lọc và không thay thế việc khám mắt chuyên khoa.',
    },
  };

  sessionsMap.set(sessionId, session);
  logScreeningEvent(sessionId, SCREENING_EVENTS.POSITION_CHECK_START, {
    info: 'Session initialized',
  });

  return session;
}

/**
 * Logs a discrete screening lifecycle event for session auditing
 * @param {string} sessionId
 * @param {string} eventType
 * @param {Object} [details={}]
 */
export function logScreeningEvent(sessionId, eventType, details = {}) {
  const session = sessionsMap.get(sessionId);
  if (!session) return;

  const eventRecord = {
    timestamp: new Date().toISOString(),
    sessionId,
    step: session.currentState,
    eventType,
    quality: details.quality || session.positionCheck.quality?.status || 'UNKNOWN',
    details,
  };

  session.events.push(eventRecord);
}

/**
 * Updates Position Check telemetry in the session for a specific test type
 * @param {string} sessionId
 * @param {Object} positionData
 * @param {string} [testType] - 'COVER_TEST' | 'BROCK_STRING'
 */
export function updatePositionCheckData(sessionId, positionData, testType = null) {
  const session = sessionsMap.get(sessionId);
  if (!session) return;

  const resolvedTestType = testType || positionData?.testType || 'COVER_TEST';

  const record = {
    testType: resolvedTestType,
    estimatedDistanceCm: positionData.estimatedDistanceCm,
    stableDistanceCm: positionData.stableDistanceCm ?? positionData.estimatedDistanceCm,
    minDistanceCm: positionData.minDistanceCm ?? (resolvedTestType === 'COVER_TEST' ? 33 : 20),
    maxDistanceCm: positionData.maxDistanceCm ?? (resolvedTestType === 'COVER_TEST' ? 40 : 25),
    status: positionData.status,
    confidence: positionData.confidence,
    faceDetected: positionData.checks?.faceDetected ?? positionData.faceDetected ?? false,
    bothEyesDetected: positionData.checks?.bothEyesDetected ?? false,
    irisDetected: positionData.checks?.irisDetected ?? false,
    headPoseValid: positionData.checks?.headPoseValid ?? false,
    quality: positionData.quality || {
      status: DATA_QUALITY_STATUS.GOOD,
      score: 1.0,
      reasons: [],
    },
    timestamp: positionData.timestamp || Date.now(),
  };

  if (resolvedTestType === 'GAZE_4_DIRECTIONS') {
    session.gazePositionCheck = record;
  } else if (resolvedTestType === 'COVER_TEST') {
    session.coverPositionCheck = record;
  } else if (resolvedTestType === 'BROCK_STRING') {
    session.brockPositionCheck = record;
  }

  // Keep latest record for backwards compatibility
  session.positionCheck = record;

  if (positionData.status === 'READY' || (positionData.isDistanceValid && positionData.checks?.headPoseValid)) {
    logScreeningEvent(sessionId, SCREENING_EVENTS.POSITION_CHECK_READY, {
      testType: resolvedTestType,
      estimatedDistanceCm: positionData.estimatedDistanceCm,
      stableDistanceCm: positionData.stableDistanceCm,
    });
  } else {
    logScreeningEvent(sessionId, SCREENING_EVENTS.POSITION_CHECK_FAILED, {
      testType: resolvedTestType,
      reasons: positionData.quality?.reasons,
    });
  }
}

export function updateGazePositionCheckData(sessionId, positionData) {
  return updatePositionCheckData(sessionId, positionData, 'GAZE_4_DIRECTIONS');
}

export function updateGazeTrackingData(sessionId, gazeData) {
  const session = sessionsMap.get(sessionId);
  if (!session) return;
  session.gazeTracking = gazeData;
  if (gazeData?.strabismusResult) {
    session.strabismusResult = gazeData.strabismusResult;
  }
  logScreeningEvent(sessionId, 'GAZE_4_DIRECTIONS_COMPLETE', {
    distanceCm: gazeData.distanceCm,
    directions: Object.keys(gazeData.captures || {}),
  });
}

export function updateCoverPositionCheckData(sessionId, positionData) {
  return updatePositionCheckData(sessionId, positionData, 'COVER_TEST');
}

export function updateBrockPositionCheckData(sessionId, positionData) {
  return updatePositionCheckData(sessionId, positionData, 'BROCK_STRING');
}

/**
 * Updates Cover Test measurement data in the session
 * @param {string} sessionId
 * @param {Object} coverData
 */
export function updateCoverTestData(sessionId, coverData) {
  const session = sessionsMap.get(sessionId);
  if (!session) return;

  const cycles = coverData.cycles || [];
  const validCycles = cycles.filter((c) => c?.quality?.isValid !== false).length;

  let refixationDetected = false;
  if (coverData.verdict === COVER_TEST_VERDICTS.REFIXATION_DETECTED) {
    refixationDetected = true;
  } else if (cycles.some((c) => c?.isRefixationNotable)) {
    refixationDetected = true;
  }

  session.coverTest = {
    status: coverData.verdict || (refixationDetected ? COVER_TEST_VERDICTS.REFIXATION_DETECTED : COVER_TEST_VERDICTS.NO_SIGNIFICANT_REFIXATION),
    cycles,
    validCycles,
    refixationDetected,
    consistency: validCycles >= 2 ? (refixationDetected ? 'CONSISTENT_MOVEMENT' : 'CONSISTENT_STABLE') : 'LOW_CYCLES',
    quality: coverData.quality || {
      status: validCycles >= 2 ? DATA_QUALITY_STATUS.GOOD : DATA_QUALITY_STATUS.DEGRADED,
      score: validCycles / 3,
      reasons: [],
    },
  };

  logScreeningEvent(sessionId, SCREENING_EVENTS.COVER_TEST_COMPLETE, {
    validCycles,
    refixationDetected,
  });
}

/**
 * Updates Brock String measurement data in the session
 * @param {string} sessionId
 * @param {Object} brockData
 */
export function updateBrockStringData(sessionId, brockData) {
  const session = sessionsMap.get(sessionId);
  if (!session) return;

  const targets = brockData.targets || {};
  const near = targets.NEAR || targets.near20cm || null;
  const mid = targets.MID || targets.mid50cm || null;
  const far = targets.FAR || targets.far100cm || null;

  // analyzeTargetFixation owns the engineering sample/stability gates. Do not
  // create a second, looser threshold in the summary aggregation layer.
  const validCount = [near, mid, far].filter((t) => t?.dataQuality?.isValid === true).length;

  session.brockString = {
    status: validCount >= 2 ? BROCK_STRING_VERDICTS.MEASURABLE : BROCK_STRING_VERDICTS.INCONCLUSIVE,
    targets: {
      near20cm: near,
      mid50cm: mid,
      far100cm: far,
    },
    quality: brockData.dataQuality || brockData.quality || {
      status: validCount === 3 ? DATA_QUALITY_STATUS.GOOD : validCount >= 2 ? DATA_QUALITY_STATUS.FAIR : DATA_QUALITY_STATUS.INCONCLUSIVE,
      score: validCount / 3,
      reasons: validCount < 2 ? ['INSUFFICIENT_TARGETS'] : [],
    },
  };

  logScreeningEvent(sessionId, SCREENING_EVENTS.BROCK_STRING_COMPLETE, {
    validTargets: validCount,
    status: session.brockString.status,
  });
}

/**
 * Quality-first, non-diagnostic screening rule engine.
 *
 * DECISION LOGIC:
 *  Cover Test = PRIMARY signal.
 *  Brock String = SUPPLEMENTARY signal (fixation/vergence quality context only).
 *  Brock String NEVER overrides Cover Test verdict.
 *  Three possible outcomes:
 *    SCREENING_INCONCLUSIVE — Cover Test data insufficient or invalid
 *    SCREENING_ATTENTION    — Cover Test valid + consistent refixation signal
 *    SCREENING_CLEAR        — Cover Test valid + no consistent refixation signal
 *
 * CLINICAL SAFETY RULES:
 *  - No strabismus diagnosis is produced.
 *  - No prism diopter conversion is performed.
 *  - No percentage probability is computed.
 *  - All signal labels are neutral (signal detected / not detected).
 *
 * @param {Object} session - Full binocular screening session
 * @returns {{
 *   status: string,
 *   title: string,
 *   description: string,
 *   disclaimer: string,
 *   overallDataQuality: string,
 *   quality: { valid: boolean, reasons: string[], warnings: string[] },
 *   isDiagnostic: false
 * }}
 */
export function evaluateFinalScreening(session) {
  // Step 1: Run data quality gate
  const gateResult = validateScreeningData(session);

  // Step 2: Assemble structured screening evidence (Single Source of Truth)
  const coverTestEvidence = session?.coverTest || {};
  const fourDirectionsEvidence = session?.gazeTracking || {};
  const aiImageEvidence = session?.strabismusResult || session?.gazeTracking?.strabismusResult || null;

  const screeningEvidence = {
    coverTest: coverTestEvidence,
    fourDirections: fourDirectionsEvidence,
    aiImageAnalysis: aiImageEvidence,
    quality: gateResult,
  };

  let status;
  let title;
  let label;
  let description;
  let disclaimer;
  let overallDataQuality;

  // RULE 1: Quality Gate Check (Technical acquisition failure)
  if (!gateResult.coverTestValid) {
    status = OVERALL_SCREENING_STATUS.SCREENING_INCONCLUSIVE;
    label = 'Chưa đủ dữ liệu ổn định để đánh giá.';
    title = 'Chưa đủ dữ liệu ổn định để đánh giá';
    description =
      'Dữ liệu thu nhận trong lần kiểm tra này chưa đủ ổn định. Bạn có thể thực hiện lại bài sàng lọc ở môi trường đủ sáng và đúng khoảng cách.';
    disclaimer =
      'Kết quả này chỉ mang tính chất sàng lọc và không thay thế việc khám mắt chuyên khoa.';
    overallDataQuality = DATA_QUALITY_STATUS.INCONCLUSIVE;
  } else {
    // Primary Clinical Evidence: Cover Test (alternating occlusion dynamics)
    const coverVerdict = coverTestEvidence?.status;
    const coverValidCycles = coverTestEvidence?.validCycles ?? 0;
    const isCoverSuspicious = coverVerdict === COVER_TEST_VERDICTS.REFIXATION_DETECTED && coverValidCycles >= 2;

    // Secondary Functional Evidence: 4 Directions Motility
    const captures = fourDirectionsEvidence?.captures || {};
    const totalCapturedDirections = Object.values(captures).filter((c) => !!c?.image).length;
    const _isMotilityComplete = totalCapturedDirections >= 4;

    // Supporting Computational Evidence: AI Deep Learning Image Analysis
    const aiStatus = aiImageEvidence?.status; // 'NORMAL' | 'SUSPICIOUS' | 'INCONCLUSIVE' | null
    const isAiSuspicious = aiStatus === 'SUSPICIOUS';

    // RULE 2: Cover Test Suspicious (Strongest clinical signal)
    if (isCoverSuspicious) {
      status = OVERALL_SCREENING_STATUS.SCREENING_ATTENTION;
      label = 'Hệ thống ghi nhận dấu hiệu cần được kiểm tra thêm.';
      title = 'Hệ thống ghi nhận dấu hiệu cần được kiểm tra thêm';
      description =
        'Nghiệm pháp che mắt ghi nhận chuyển động bù trừ trục nhãn cầu nhất quán qua nhiều chu kỳ. ' +
        'Kết quả này là tín hiệu gợi ý sàng lọc, không phải chẩn đoán. Bạn nên được kiểm tra bởi bác sĩ chuyên khoa mắt.';
      disclaimer =
        'Kết quả này là kết quả sàng lọc sơ bộ, không thay thế khám lâm sàng chuyên khoa.';
      overallDataQuality = DATA_QUALITY_STATUS.GOOD;
    }
    // RULE 3: Cover Test Normal, but AI Image Signal or Motility requires attention
    else if (isAiSuspicious) {
      status = OVERALL_SCREENING_STATUS.SCREENING_ATTENTION;
      label = 'Có tín hiệu cần theo dõi thêm.';
      title = 'Có tín hiệu cần kiểm tra thêm';
      description =
        'Nghiệm pháp che mắt không ghi nhận bất thường vận nhãn đáng kể, tuy nhiên phép phân tích hình ảnh AI ghi nhận tín hiệu cần xem xét thêm. ' +
        'Bạn có thể thực hiện lại bài test hoặc trao đổi với chuyên viên nhãn khoa nếu có lo lắng về thị lực.';
      disclaimer =
        'Độ tự tin của mô hình thể hiện tính nhất quán toán học với mẫu ảnh, không phải xác suất mắc bệnh.';
      overallDataQuality = DATA_QUALITY_STATUS.GOOD;
    }
    // RULE 4: No notable abnormality detected across all tests
    else {
      status = OVERALL_SCREENING_STATUS.SCREENING_CLEAR;
      label = 'Chưa ghi nhận dấu hiệu bất thường đáng chú ý trong lần sàng lọc này.';
      title = 'Chưa ghi nhận dấu hiệu bất thường đáng chú ý';
      description =
        'Trong lần sàng lọc này, hệ thống chưa ghi nhận dấu hiệu bất thường đáng chú ý ở cả nghiệm pháp che mắt và hình ảnh hai mắt.';
      disclaimer =
        'Kết quả này chỉ phản ánh lần sàng lọc hiện tại và không thay thế việc khám mắt định kỳ.';
      overallDataQuality = DATA_QUALITY_STATUS.GOOD;
    }
  }

  // Structured Development Logging (Phase 13 Compliance: zero PII, zero base64)
  if (typeof window !== 'undefined' && import.meta.env?.DEV) {
    console.log(
      `[SYNTHESIS] Cover: ${coverTestEvidence?.status || 'N/A'} | ` +
      `Four Directions: ${Object.values(fourDirectionsEvidence?.captures || {}).filter((c) => !!c?.image).length}/4 | ` +
      `AI: ${aiImageEvidence?.status || 'N/A'} | ` +
      `Quality: ${gateResult?.coverTestValid ? 'PASS' : 'FAIL'} | ` +
      `Final: ${status}`
    );
  }

  // Section 22 Data Model Final
  const screening = {
    status,
    label,
    isDiagnostic: false,
  };

  const coverTest = {
    status: coverTestEvidence?.status || COVER_TEST_VERDICTS.INCONCLUSIVE,
    valid: gateResult.coverTestValid,
    validCycles: coverTestEvidence?.validCycles ?? 0,
    totalCycles: coverTestEvidence?.cycles?.length ?? 3,
    cycles: coverTestEvidence?.cycles || [],
  };

  const brockTargets = session?.brockString?.targets || {};
  const validBrockCount = Object.values(brockTargets).filter(
    (t) => t?.dataQuality?.isValid === true
  ).length;

  const brockString = {
    status: session?.brockString?.status || BROCK_STRING_VERDICTS.INCONCLUSIVE,
    valid: gateResult.brockStringValid,
    validTargets: validBrockCount,
    totalTargets: 3,
  };

  const clinical = {
    diagnosis: null,
    prismDiopter: null,
    clinicalReference: null,
  };

  const quality = {
    valid: gateResult.valid,
    reasons: gateResult.reasons,
    warnings: gateResult.warnings,
  };

  return {
    status,
    title,
    description,
    disclaimer,
    overallDataQuality,
    quality: gateResult,
    isDiagnostic: false,
    screening,
    coverTest,
    brockString,
    clinical,
    qualitySection: quality,
    evidence: screeningEvidence,
  };
}

/**
 * Synthesizes overall screening summary from Position Check, Cover Test, and Brock String
 * @param {string} sessionId
 * @param {Object} [aiSignal=null] - Optional AI supporting signal
 * @returns {Object} Complete synthesized screening report
 */
export function generateScreeningSummary(sessionId, aiSignal = null) {
  const session = sessionsMap.get(sessionId);
  if (!session) return null;

  session.completedAt = new Date().toISOString();

  if (aiSignal) {
    session.aiSupportingSignal = {
      enabled: true,
      meanNormalScore: aiSignal.normalScore ?? null,
      meanStrabismusScore: aiSignal.strabismusScore ?? null,
      confidence: aiSignal.confidence ?? null,
      note: 'AI là tín hiệu hỗ trợ nghiên cứu hình thái học tĩnh. Tuyệt đối không tự kết luận bệnh lý.',
    };
  }

  const result = evaluateFinalScreening(session);

  session.summary = {
    coverTestStatus: session.coverTest?.status,
    gazeTracking: session.gazeTracking || null,
    strabismusResult: session.strabismusResult || null,
    overallDataQuality: result.overallDataQuality,
    screeningStatus: result.status,
    title: result.title,
    description: result.description,
    disclaimer: result.disclaimer,
    isDiagnostic: false,
    quality: result.quality || { valid: true, reasons: [], warnings: [] },
    screening: result.screening,
    coverTest: result.coverTest,
    clinical: result.clinical,
  };

  logScreeningEvent(sessionId, SCREENING_EVENTS.SCREENING_SUMMARY_GENERATED, {
    screeningStatus: result.status,
    overallDataQuality: result.overallDataQuality,
    qualityValid: result.quality?.valid ?? true,
    qualityReasons: result.quality?.reasons ?? [],
  });

  return session;
}

/**
 * Retrieves the full session payload
 * @param {string} sessionId
 * @returns {Object | null}
 */
export function getSessionData(sessionId) {
  return sessionsMap.get(sessionId) || null;
}
