/**
 * REMICARE AI - DIGITAL COVER TEST MEASUREMENT CONFIGURATION & CONSTANTS
 * Centralized timing, thresholds, landmark definitions, and measurement standards.
 * 
 * NOTE: Thresholds designated as "ENGINEERING PARAMETER" are algorithmic heuristics
 * for signal processing and research, and are NOT clinically validated thresholds.
 */

export const SCREENING_CONFIG = {
  // Timing parameters (in milliseconds)
  BASELINE_MS: 4500,               // Multi-frame fixation baseline duration per cycle (~4.5s)
  COVER_MS: 5000,                  // Eye occlusion duration (~5.0s)
  UNCOVER_WINDOW_MS: 500,          // Primary refixation analysis window (300 - 500ms)
  EARLY_ANALYSIS_WINDOW_MS: 500,   // Alias for early refixation analysis window (0 - 500ms)
  RECORD_MS: 4500,                 // Total tracking duration after uncover (~4.5s)
  UNCOVER_RECORD_MS: 4500,         // Alias for full post-uncover trajectory recording
  REST_MS: 3000,                   // Rest interval between cycles (~3.0s)

  // Cycle configuration
  CYCLES: 3,

  // Saccade displacement threshold (normalized by eye width)
  // Engineering parameter only. NOT a clinically validated threshold.
  // Movement > 10% of eye width within 500ms indicates notable refixation movement.
  DISPLACEMENT_THRESHOLD: 0.10,

  // Velocity threshold (normalized eye-widths per second)
  // Engineering parameter only.
  VELOCITY_THRESHOLD: 0.25,

  // Data quality gating parameters
  MIN_VALID_SAMPLES_BASELINE: 20,  // Minimum frames required during baseline
  MIN_VALID_SAMPLES_UNCOVER: 15,   // Minimum frames required during uncover window
  BASELINE_STABILITY_IQR_MAX: 0.06,// Maximum interquartile range for stable baseline (normalized)
  EYE_WIDTH_MIN_RATIO: 0.015,      // Minimum plausible eye width relative to face
  EYE_WIDTH_MAX_RATIO: 0.35,       // Maximum plausible eye width relative to face

  // Static mode parameters
  STATIC_HISTORY_MAX: 60,
  STATIC_STABLE_MIN: 30,
  STATIC_DIFF_ALERT_THRESHOLD: 0.18,

  // Brock String parameters (Engineering defaults; configurable via UI)
  BROCK_NEAR_DISTANCE_CM: 20,
  BROCK_MID_DISTANCE_CM: 50,
  BROCK_FAR_DISTANCE_CM: 100,
  BROCK_TARGET_DURATION_MS: 4000,
  BROCK_MIN_VALID_SAMPLES_PER_TARGET: 25,
  BROCK_STABILITY_IQR_MAX: 0.05,
  BROCK_MAX_HEAD_YAW_DEG: 15,
  BROCK_MAX_HEAD_PITCH_DEG: 15,
  BROCK_MAX_HEAD_ROLL_DEG: 12,
};

export const PROTOCOLS = {
  STATIC_EYE: 'STATIC_EYE',
  COVER_TEST: 'COVER_TEST',
  BROCK_STRING: 'BROCK_STRING',
};

export const QUALITY_STATUS = {
  VALID: 'VALID',
  DEGRADED: 'DEGRADED',
  INCONCLUSIVE: 'INCONCLUSIVE',
};

export const QUALITY_REASONS = {
  NO_FACE: 'NO_FACE',
  ONE_EYE_MISSING: 'ONE_EYE_MISSING',
  IRIS_MISSING: 'IRIS_MISSING',
  INVALID_EYE_WIDTH: 'INVALID_EYE_WIDTH',
  HEAD_POSE_INVALID: 'HEAD_POSE_INVALID',
  INSUFFICIENT_SAMPLES: 'INSUFFICIENT_SAMPLES',
  EXCESSIVE_JITTER: 'EXCESSIVE_JITTER',
  TARGET_NOT_DETECTED: 'TARGET_NOT_DETECTED',
};

export const TEMPORAL_EVENT_TYPES = {
  BASELINE: 'BASELINE',
  COVER: 'COVER',
  UNCOVER: 'UNCOVER',
  MOVEMENT_START: 'MOVEMENT_START',
  PEAK_MOVEMENT: 'PEAK_MOVEMENT',
  RECOVERY: 'RECOVERY',
  END: 'END',
};

export const BINOCULAR_VERDICT = {
  MEASURABLE: 'MEASURABLE',
  NOT_DETECTED: 'NOT_DETECTED',
  INCONCLUSIVE: 'INCONCLUSIVE',
};

export const BROCK_STRING_TARGETS = {
  NEAR: {
    id: 'NEAR',
    label: 'Hạt Gần (Near)',
    defaultDistanceCm: 20,
    color: '#06b6d4', // Cyan
  },
  MID: {
    id: 'MID',
    label: 'Hạt Giữa (Mid)',
    defaultDistanceCm: 50,
    color: '#f59e0b', // Amber
  },
  FAR: {
    id: 'FAR',
    label: 'Hạt Xa (Far)',
    defaultDistanceCm: 100,
    color: '#8b5cf6', // Purple
  },
};

export const CALIBRATION_STATUS = {
  NOT_CALIBRATED: 'NOT_CALIBRATED',
  CALIBRATION_PENDING: 'CALIBRATION_PENDING',
  CALIBRATED: 'CALIBRATED',
};

export const SCREENING_VERDICT = {
  SIGNAL_DETECTED: 'SIGNAL_DETECTED',
  NO_SIGNAL_DETECTED: 'NO_SIGNAL_DETECTED',
  INCONCLUSIVE: 'INCONCLUSIVE',
  MEASURABLE: 'MEASURABLE',
};

export const COVER_TEST_STATES = {
  INTRO: 'INTRO',
  BASELINE: 'BASELINE',
  COVER_LEFT: 'COVER_LEFT',
  UNCOVER_LEFT: 'UNCOVER_LEFT',
  COVER_RIGHT: 'COVER_RIGHT',
  UNCOVER_RIGHT: 'UNCOVER_RIGHT',
  COMPLETE: 'COMPLETE',
  CANCELLED: 'CANCELLED',
};

// MediaPipe 468-point Face Mesh indices
export const LANDMARKS = {
  // Iris centers (available when refineLandmarks: true)
  LEFT_IRIS_CENTER: 468,
  RIGHT_IRIS_CENTER: 473,

  // Eye corners (Nasal = Inner, Temporal = Outer)
  LEFT_INNER_CORNER: 362,
  LEFT_OUTER_CORNER: 263,
  RIGHT_INNER_CORNER: 133,
  RIGHT_OUTER_CORNER: 33,
  LEFT_INNER_CANTHUS: 362,
  LEFT_OUTER_CANTHUS: 263,
  RIGHT_INNER_CANTHUS: 133,
  RIGHT_OUTER_CANTHUS: 33,

  // Eyelid vertical extremes
  LEFT_TOP_LID: 386,
  LEFT_BOTTOM_LID: 374,
  RIGHT_TOP_LID: 159,
  RIGHT_BOTTOM_LID: 145,

  // Extra iris ring landmarks for high-detail overlay
  LEFT_IRIS_PERIMETER: [469, 470, 471, 472],
  RIGHT_IRIS_PERIMETER: [474, 475, 476, 477],

  // Head pose reference points (Nose tip, Chin, Forehead, Ear regions)
  NOSE_TIP: 1,
  GLABELLA: 168,
  CHIN: 152,
  FOREHEAD: 10,
  LEFT_EAR_TRAGUS: 234,
  RIGHT_EAR_TRAGUS: 454,
};

export const MEDICAL_DISCLAIMER_TEXT =
  'Đây là công cụ sàng lọc mang tính giáo dục, không phải chẩn đoán y khoa. Kết quả đo lường chuyển động và thị giác hai mắt không đồng nghĩa với chẩn đoán bệnh lý mắt. Hệ thống chưa hiệu chuẩn độ lăng kính (Prism Diopters) hay góc quy tụ lâm sàng.';
