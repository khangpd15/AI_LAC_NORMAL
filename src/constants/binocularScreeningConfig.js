/**
 * BINOCULAR VISION SCREENING CONFIGURATION
 * Defines state machines, distance estimation thresholds, target bead geometry,
 * quality gate reasons, and neutral screening interpretation constants.
 * 
 * STRICT CLINICAL SAFETY RULE:
 * All distance and displacement values are relative engineering estimates.
 * They are NOT calibrated physical values and MUST NOT be used for clinical diagnosis.
 */

// Global Screening State Machine
export const BINOCULAR_SCREENING_STATES = {
  IDLE: 'IDLE',
  CAMERA_PERMISSION: 'CAMERA_PERMISSION',
  // Backward compatibility alias
  POSITION_CHECK: 'COVER_TEST_POSITION_CHECK',
  POSITION_READY: 'POSITION_READY',

  // Gaze 4 Directions Flow (15–20 cm)
  GAZE_POSITION_CHECK: 'GAZE_POSITION_CHECK',
  GAZE_4_DIRECTIONS: 'GAZE_4_DIRECTIONS',

  // Cover Test Flow
  COVER_TEST_POSITION_CHECK: 'COVER_TEST_POSITION_CHECK',
  COVER_TEST_INTRO: 'COVER_TEST_INTRO',
  COVER_TEST_RUNNING: 'COVER_TEST_RUNNING',
  COVER_TEST_RESULT: 'COVER_TEST_RESULT',

  // Brock String Flow
  BROCK_STRING_POSITION_CHECK: 'BROCK_STRING_POSITION_CHECK',
  BROCK_STRING_INTRO: 'BROCK_STRING_INTRO',
  BROCK_STRING_RUNNING: 'BROCK_STRING_RUNNING',
  BROCK_STRING_RESULT: 'BROCK_STRING_RESULT',

  // Summary & Completion
  SCREENING_SUMMARY: 'SCREENING_SUMMARY',
  COMPLETED: 'COMPLETED',
};

// Position Status Enum
export const POSITION_STATUS = {
  INITIALIZING: 'INITIALIZING',
  NO_FACE: 'NO_FACE',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  TOO_CLOSE: 'TOO_CLOSE',
  TOO_FAR: 'TOO_FAR',
  READY: 'READY',
};

// Independent Position Check Configuration for each Screening Test
export const POSITION_CONFIG = {
  GAZE_4_DIRECTIONS: {
    testType: 'GAZE_4_DIRECTIONS',
    label: '4 HƯỚNG MẮT',
    title: 'Chụp 4 hướng mắt',
    subtitle: 'Kiểm tra vị trí trước khi chụp 4 hướng (15–20 cm)',
    minDistanceCm: 15,
    maxDistanceCm: 20,
    optimalCm: 17.5,
    instruction: 'Đưa mặt lại gần camera một chút (15–20 cm)',
    targetRangeLabel: '15–20 cm',
    readyMessage: '✓ Vị trí phù hợp',
    tooCloseMessage: 'Bạn đang quá gần. Hãy lùi ra khoảng 15–20 cm.',
    tooFarMessage: 'Bạn đang quá xa. Hãy đưa mặt lại gần khoảng 15–20 cm.',
    buttonLabel: 'BẮT ĐẦU CHỤP 4 HƯỚNG',
    clinicalNote: 'Khoảng cách 15–20 cm là thông số kỹ thuật cho bước chụp ảnh mắt cận cảnh, không phải tiêu chuẩn lâm sàng.',
    disclaimer: 'Khoảng cách yêu cầu: 15–20 cm',
  },

  COVER_TEST: {
    testType: 'COVER_TEST',
    label: 'COVER TEST',
    title: 'COVER TEST',
    subtitle: 'Kiểm tra vị trí trước khi thực hiện Cover Test',
    minDistanceCm: 33,
    maxDistanceCm: 40,
    optimalCm: 36.5,
    instruction: 'Đưa khuôn mặt vào khoảng 33–40 cm',
    targetRangeLabel: '33–40 cm',
    readyMessage: '✓ Vị trí phù hợp',
    tooCloseMessage: 'Bạn đang quá gần. Hãy lùi ra khoảng 33–40 cm.',
    tooFarMessage: 'Bạn đang quá xa. Hãy tiến lại gần khoảng 33–40 cm.',
    buttonLabel: 'BẮT ĐẦU COVER TEST',
    clinicalNote: '33 cm là mốc tham chiếu cho near fixation. Khoảng 33–40 cm là khoảng chấp nhận của ứng dụng.',
    disclaimer: 'Khoảng cách yêu cầu của bài kiểm tra: 33–40 cm',
  },

  BROCK_STRING: {
    testType: 'BROCK_STRING',
    label: 'BROCK STRING',
    title: 'BROCK STRING',
    subtitle: 'Kiểm tra vị trí trước khi thực hiện Brock String',
    minDistanceCm: 20,
    maxDistanceCm: 25,
    optimalCm: 22.5,
    instruction: 'Đưa khuôn mặt vào khoảng 20–25 cm',
    targetRangeLabel: '20–25 cm',
    readyMessage: '✓ Vị trí phù hợp',
    tooCloseMessage: 'Bạn đang quá gần. Hãy lùi ra khoảng 20–25 cm.',
    tooFarMessage: 'Bạn đang quá xa. Hãy tiến lại gần khoảng 20–25 cm.',
    buttonLabel: 'BẮT ĐẦU BROCK STRING',
    clinicalNote: 'Khoảng 20–25 cm là khoảng chấp nhận của ứng dụng nhằm quan sát rõ chuyển động định thị và phân ly.',
    disclaimer: 'Khoảng cách yêu cầu của bài kiểm tra: 20–25 cm',
  },
};

/**
 * Configuration for 4-Direction Gaze Fixed Targets
 * LEFT -> RIGHT -> UP -> DOWN (1 fixed non-moving target per step)
 */
export const GAZE_DIRECTIONS_CONFIG = [
  {
    id: 'left',
    direction: 'left',
    name: 'LEFT',
    label: 'TRÁI',
    stepNumber: '1/4',
    voiceText: 'Nhìn thẳng sang trái nghen.',
    targetPosition: { left: '40px', top: '50%', transform: 'translateY(-50%)' },
    arrowHint: '← Nhìn sang bên trái',
  },
  {
    id: 'right',
    direction: 'right',
    name: 'RIGHT',
    label: 'PHẢI',
    stepNumber: '2/4',
    voiceText: 'Nhìn thẳng sang phải nghen.',
    targetPosition: { right: '40px', top: '50%', transform: 'translateY(-50%)' },
    arrowHint: 'Nhìn sang bên phải →',
  },
  {
    id: 'up',
    direction: 'up',
    name: 'UP',
    label: 'LÊN TRÊN',
    stepNumber: '3/4',
    voiceText: 'Nhìn thẳng lên trên nghen.',
    targetPosition: { top: '35px', left: '50%', transform: 'translateX(-50%)' },
    arrowHint: '↑ Nhìn lên trên',
  },
  {
    id: 'straight',
    direction: 'straight',
    name: 'STRAIGHT',
    label: 'THẲNG',
    stepNumber: '4/4',
    voiceText: 'Nhìn thẳng vào giữa màn hình nghen.',
    targetPosition: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    arrowHint: '⦿ Nhìn thẳng vào giữa',
  },
];

/**
 * Quality & Stability control thresholds for Position Check.
 * NOTE: These are engineering parameters for digital signal processing,
 * NOT clinical diagnostic criteria.
 */
export const POSITION_QUALITY_CONFIG = {
  FACE_CENTERING: {
    TARGET_X: 0.5,
    TARGET_Y: 0.5,
    MAX_OFFSET_X: 0.10, // Face center must stay within the middle 20% horizontally
    MAX_OFFSET_Y: 0.12, // Slightly looser vertically for different camera placements
  },
  HEAD_POSE: {
    MAX_ROLL_DEG: 12.0,   // Engineering tolerance for lateral tilt
    MAX_YAW_DEG: 15.0,    // Engineering tolerance for horizontal turn
    MAX_PITCH_DEG: 15.0,  // Engineering tolerance for vertical tilt
  },
  STABILITY: {
    REQUIRED_STABLE_FRAMES: 5,   // Consecutive frames required before READY
    MAX_JITTER_STD_DEV_CM: 2.2,   // Max standard deviation of distance buffer
    BUFFER_SIZE: 10,              // Frame window for rolling stats and median
    HYSTERESIS_CM: 0.5,           // Anti-flicker boundary margin
  },
  OPTICAL_BASELINE: {
    REFERENCE_FACE_WIDTH_AT_22_5CM: 0.43,
    REFERENCE_INTERCANTHAL_AT_22_5CM: 0.105,
    OPTIMAL_BASELINE_CM: 22.5,
    METHOD: 'RELATIVE_ESTIMATION',
    CONFIDENCE_DEFAULT: 0.85,
  },
};

// Backward-compatible alias for existing imports
export const POSITION_DISTANCE_CONFIG = {
  TARGET_MIN_CM: POSITION_CONFIG.BROCK_STRING.minDistanceCm,
  TARGET_MAX_CM: POSITION_CONFIG.BROCK_STRING.maxDistanceCm,
  OPTIMAL_CM: POSITION_CONFIG.BROCK_STRING.optimalCm,
  TOLERANCE_CM: 1.5,
  METHOD: POSITION_QUALITY_CONFIG.OPTICAL_BASELINE.METHOD,
  CONFIDENCE_DEFAULT: POSITION_QUALITY_CONFIG.OPTICAL_BASELINE.CONFIDENCE_DEFAULT,
  REFERENCE_FACE_WIDTH_AT_OPTIMAL: POSITION_QUALITY_CONFIG.OPTICAL_BASELINE.REFERENCE_FACE_WIDTH_AT_22_5CM,
  REFERENCE_INTERCANTHAL_AT_OPTIMAL: POSITION_QUALITY_CONFIG.OPTICAL_BASELINE.REFERENCE_INTERCANTHAL_AT_22_5CM,
};

// Head Pose Safety Limits for Position Check (Degrees) - Backward compatibility
export const HEAD_POSE_LIMITS = POSITION_QUALITY_CONFIG.HEAD_POSE;

// Fixation Target Configuration for Full-Screen Cover Test Mode
export const FIXATION_TARGET_CONFIG = {
  type: 'DOT',
  position: 'CENTER',
  sizePx: 38, // Large, high-visibility circular fixation dot for children
  color: '#F28C7B', // Warm Coral accent target
  pulseSpeedMs: 1400,
};

// Brock String Digital Visual Target Sequence Configuration (Only ONE active at a time)
// STRICT CLINICAL SAFETY RULE:
// Pixel sizes are digital UI representations for gaze fixation and vergence progression.
// They DO NOT represent physical metric distances.
export const BROCK_STRING_TARGET_CONFIG = {
  '20CM': {
    id: 'NEAR',
    distanceCm: 20,
    sizeName: 'LARGE',
    sizePx: 84, // Largest dot for nearest simulated vergence target
    color: '#00AB9B', // Mint
    label: 'Hạt gần (20 cm)',
    instruction: 'Nhìn vào chấm tròn ở giữa.',
    durationMs: 4000,
  },
  '50CM': {
    id: 'MID',
    distanceCm: 50,
    sizeName: 'MEDIUM',
    sizePx: 52, // Medium dot for mid simulated vergence target
    color: '#267A78', // Deep Green
    label: 'Hạt giữa (50 cm)',
    instruction: 'Tiếp tục nhìn vào chấm tròn.',
    durationMs: 4000,
  },
  '100CM': {
    id: 'FAR',
    distanceCm: 100,
    sizeName: 'SMALL',
    sizePx: 26, // Smallest dot for far simulated vergence target
    color: '#00545D', // Deep Teal
    label: 'Hạt xa (100 cm)',
    instruction: 'Tiếp tục nhìn vào chấm tròn.',
    durationMs: 4000,
  },
};

// Brock String Visual Beads Configuration - Backward compatibility alias
export const BROCK_STRING_TARGETS = {
  NEAR: BROCK_STRING_TARGET_CONFIG['20CM'],
  MID: BROCK_STRING_TARGET_CONFIG['50CM'],
  FAR: BROCK_STRING_TARGET_CONFIG['100CM'],
};

// Cover Test Refixation Verdicts (Neutral, Non-diagnostic)
export const COVER_TEST_VERDICTS = {
  REFIXATION_DETECTED: 'REFIXATION_DETECTED',
  NO_SIGNIFICANT_REFIXATION: 'NO_SIGNIFICANT_REFIXATION',
  INCONCLUSIVE: 'INCONCLUSIVE',
};

// Brock String Binocular Tracking Verdicts
export const BROCK_STRING_VERDICTS = {
  MEASURABLE: 'MEASURABLE',
  INCONCLUSIVE: 'INCONCLUSIVE',
};

// Data Quality Status
export const DATA_QUALITY_STATUS = {
  OPTIMAL: 'OPTIMAL',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  DEGRADED: 'DEGRADED',
  INCONCLUSIVE: 'INCONCLUSIVE',
};

// Data Quality Error Reasons
export const DATA_QUALITY_REASONS = {
  NO_FACE: 'NO_FACE',
  FACE_NOT_CENTERED: 'FACE_NOT_CENTERED',
  ONE_EYE_MISSING: 'ONE_EYE_MISSING',
  IRIS_NOT_DETECTED: 'IRIS_NOT_DETECTED',
  INVALID_EYE_WIDTH: 'INVALID_EYE_WIDTH',
  INVALID_HEAD_POSE: 'INVALID_HEAD_POSE',
  DISTANCE_OUT_OF_RANGE: 'DISTANCE_OUT_OF_RANGE',
  INSUFFICIENT_SAMPLES: 'INSUFFICIENT_SAMPLES',
  EXCESSIVE_JITTER: 'EXCESSIVE_JITTER',
  TRACKING_LOST: 'TRACKING_LOST',
  LOW_IMAGE_QUALITY: 'LOW_IMAGE_QUALITY',
  TARGET_NOT_DETECTED: 'TARGET_NOT_DETECTED',
};

// Telemetry & Audit Event Types
export const SCREENING_EVENTS = {
  POSITION_CHECK_START: 'POSITION_CHECK_START',
  POSITION_CHECK_READY: 'POSITION_CHECK_READY',
  POSITION_CHECK_FAILED: 'POSITION_CHECK_FAILED',
  COVER_TEST_START: 'COVER_TEST_START',
  COVER_CYCLE_START: 'COVER_CYCLE_START',
  COVER_CYCLE_END: 'COVER_CYCLE_END',
  COVER_TEST_COMPLETE: 'COVER_TEST_COMPLETE',
  BROCK_STRING_START: 'BROCK_STRING_START',
  BROCK_TARGET_START: 'BROCK_TARGET_START',
  BROCK_TARGET_END: 'BROCK_TARGET_END',
  BROCK_STRING_COMPLETE: 'BROCK_STRING_COMPLETE',
  SCREENING_SUMMARY_GENERATED: 'SCREENING_SUMMARY_GENERATED',
};

// Overall Screening Interpretation Status
export const OVERALL_SCREENING_STATUS = {
  SCREENING_CLEAR: 'SCREENING_CLEAR',
  SCREENING_ATTENTION: 'SCREENING_ATTENTION',
  SCREENING_INCONCLUSIVE: 'SCREENING_INCONCLUSIVE',
};
