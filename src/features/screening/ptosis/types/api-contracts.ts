/**
 * Giao ước Dữ liệu API (Strict API Contract) giữa Backend FastAPI và Frontend React.
 * Ánh xạ 1:1 với Pydantic schemas tại backend/app/schemas/.
 * Tuân thủ tuyệt đối G4: Không dùng từ ngữ thuộc danh mục cấm.
 */

export type ImageType = 'fullface' | 'eye_crop';

export type ScreeningTier = 'TIER_A' | 'TIER_B' | 'TIER_C';

export type AsymmetryClassification =
  | 'PHYSIOLOGICAL_SYMMETRY'
  | 'BORDERLINE_ASYMMETRY'
  | 'SIGNIFICANT_ASYMMETRY';

export type MeasurementStatus =
  | 'VALID'
  | 'LOW_CONFIDENCE'
  | 'INVALID'
  | 'NOT_DETECTABLE'
  | 'MEASUREMENT_UNAVAILABLE'
  | 'INDETERMINATE';

export type ReferencePointUsed =
  | 'CORNEAL_LIGHT_REFLEX'
  | 'PUPIL_CENTER_FALLBACK'
  | 'NONE';

export type ReflexVisibility =
  | 'VISIBLE'
  | 'OCCLUDED_BY_LID'
  | 'NOT_VISIBLE_QUALITY'
  | 'INDETERMINATE';

export interface PointCoordinates {
  x: number;
  y: number;
}

export interface PoseAudit {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface ImageQualityAudit {
  passed: boolean;
  rejection_reason?: string | null;
  pose: PoseAudit;
  sharpness_score: number;
  mean_illumination: number;
  audit_details?: Record<string, any> | null;
}

export interface EyeFloatPair {
  right_eye: number;
  left_eye: number;
}

export interface ScaleReference {
  method: string;
  assumed_corneal_diameter_mm: number;
  hvid_pixels: EyeFloatPair;
  scale_factor_mm_per_px: EyeFloatPair;
}

export interface SingleEyeMeasurement {
  mrd1_px?: number | null;
  mrd1_mm?: number | null;
  mrd1_estimated_range?: string | null;
  pfh_px?: number;
  pfh_mm?: number;
  reference_point_used: ReferencePointUsed;
  reference_coordinates?: PointCoordinates | null;
  eyelid_margin_point?: PointCoordinates | null;
  status: MeasurementStatus;
  confidence_score: number;
  warning_flags: string[];
  reflex_visibility?: ReflexVisibility;
  // Các trường mở rộng từ V2 (Optional - tương thích ngược G5)
  glint_aspect_ratio?: number | null;
  pupil_diameter_px?: number | null;
  fallback_type?: 'NONE' | 'PUPIL_DETECTOR' | 'IRIS_CENTER' | null;
}

export interface MeasurementsContainer {
  right_eye_od: SingleEyeMeasurement;
  left_eye_os: SingleEyeMeasurement;
}

export interface BilateralComparison {
  delta_mrd1_mm?: number | null;
  signed_delta_mrd1_mm?: number | null;
  asymmetry_classification: AsymmetryClassification;
  delta_pfh_mm?: number;
  delta_brow_px?: number;
  eyebrow_height_discrepancy_px?: number;
}

export interface EyeAnnotationPoints {
  corneal_reflex: [number, number] | null;
  pupil_center?: [number, number] | null;
  iris_limbus_contour: [number, number][];
  upper_eyelid_contour: [number, number][];
  lower_eyelid_contour?: [number, number][];
}

export interface AnnotatedOverlayContainer {
  right_eye: EyeAnnotationPoints;
  left_eye: EyeAnnotationPoints;
}

export interface TriageFlags {
  is_bilateral_severe_triggered?: boolean;
  is_brow_compensation_detected?: boolean;
  is_pupil_fallback_used?: boolean;
}

export interface TriageResult {
  tier: ScreeningTier;
  trigger_reasons: string[];
  description_vi: string;
  recommendation_vi: string;
  safety_disclaimer_vi: string;
  is_bilateral_severe_triggered: boolean;
  flags?: TriageFlags;
}

export interface MeasurementPayload {
  session_id: string;
  timestamp: string;
  image_quality_audit: ImageQualityAudit;
  scale_reference: ScaleReference;
  measurements: MeasurementsContainer;
  bilateral_comparison: BilateralComparison;
  annotated_overlay_coordinates: AnnotatedOverlayContainer;
  triage_result?: TriageResult;
}

export interface QualityRejection {
  error_code: string;
  rejection_reason: string;
  rejection_message_vi: string;
  audit_details?: Record<string, unknown>;
}

export interface ScreeningThresholds {
  absolute_severe_mrd1_mm: number;
  tier_a_min_mrd1_mm: number;
  tier_b_min_mrd1_mm: number;
  physiological_asymmetry_max_mm: number;
  borderline_asymmetry_max_mm: number;
  brow_asymmetry_threshold_px: number;
  max_yaw_deg: number;
  max_pitch_deg: number;
  max_roll_deg: number;
  min_eye_width_px: number;
  min_iris_diameter_px: number;
  min_brightness: number;
  max_brightness: number;
  max_glare_ratio: number;
  min_eye_aperture_ratio: number;
  assumed_corneal_diameter_mm: number;
  nominal_tolerance_mm: number;
}
