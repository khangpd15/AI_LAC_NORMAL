/**
 * Kiểm thử tích hợp giao diện Frontend cho Giai đoạn Phase C:
 * Xác thực 5 Mock Payloads mẫu render chuẩn xác và an toàn.
 * Bao gồm:
 * 1. Badge "Không thể đo (Che phủ bờ mi)" khi reflex bị che (Payload 3).
 * 2. Badge "Không thể đo (Thiếu sáng)" khi mất reflex do chất lượng ảnh (Payload 5).
 * 3. An toàn khi corneal_reflex = null trên AnnotatedCanvas và calculateEyesBoundingBox.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MeasurementDetails } from '../components/result/MeasurementDetails';
import { calculateEyesBoundingBox } from '../utils/canvas-overlay-drawer';
import type { MeasurementPayload } from '../types/api-contracts';

const PAYLOAD_1: MeasurementPayload = {
  session_id: "c4b12345-789a-4bc0-a123-456789abcdef",
  timestamp: "2026-10-26T07:30:00.000Z",
  image_quality_audit: {
    passed: true,
    rejection_reason: null,
    pose: { yaw: -1.2, pitch: 2.1, roll: 0.5 },
    sharpness_score: 145.2,
    mean_illumination: 138.4,
  },
  scale_reference: {
    method: "HVID_WTW_POPULATION_AVERAGE",
    assumed_corneal_diameter_mm: 11.71,
    hvid_pixels: { right_eye: 182.0, left_eye: 184.0 },
    scale_factor_mm_per_px: { right_eye: 0.0643, left_eye: 0.0636 },
  },
  measurements: {
    right_eye_od: {
      mrd1_px: 54.4,
      mrd1_mm: 3.5,
      mrd1_estimated_range: "3.0 - 4.0 mm",
      pfh_px: 142.1,
      pfh_mm: 9.14,
      reference_point_used: "CORNEAL_LIGHT_REFLEX",
      reference_coordinates: { x: 420.5, y: 512.3 },
      eyelid_margin_point: { x: 420.5, y: 457.9 },
      status: "VALID",
      confidence_score: 0.95,
      warning_flags: [],
      reflex_visibility: "VISIBLE",
    },
    left_eye_os: {
      mrd1_px: 52.8,
      mrd1_mm: 3.36,
      mrd1_estimated_range: "2.9 - 3.9 mm",
      pfh_px: 139.5,
      pfh_mm: 8.87,
      reference_point_used: "CORNEAL_LIGHT_REFLEX",
      reference_coordinates: { x: 680.2, y: 511.8 },
      eyelid_margin_point: { x: 680.2, y: 459.0 },
      status: "VALID",
      confidence_score: 0.94,
      warning_flags: [],
      reflex_visibility: "VISIBLE",
    },
  },
  bilateral_comparison: {
    delta_mrd1_mm: 0.14,
    signed_delta_mrd1_mm: -0.14,
    asymmetry_classification: "PHYSIOLOGICAL_SYMMETRY",
    delta_pfh_mm: 0.27,
    delta_brow_px: 1.5,
    eyebrow_height_discrepancy_px: 1.5,
  },
  annotated_overlay_coordinates: {
    right_eye: {
      corneal_reflex: [420.5, 512.3],
      pupil_center: [420.2, 511.9],
      iris_limbus_contour: [[329.5, 512.3], [511.5, 512.3]],
      upper_eyelid_contour: [[330.0, 480.0], [420.5, 457.9], [510.0, 485.0]],
    },
    left_eye: {
      corneal_reflex: [680.2, 511.8],
      pupil_center: [680.0, 511.5],
      iris_limbus_contour: [[588.2, 511.8], [772.2, 511.8]],
      upper_eyelid_contour: [[590.0, 483.0], [680.2, 459.0], [770.0, 482.0]],
    },
  },
};

const PAYLOAD_3: MeasurementPayload = {
  session_id: "f1c54321-1234-4567-890a-bcdef1234567",
  timestamp: "2026-10-26T07:40:00.000Z",
  image_quality_audit: {
    passed: true,
    rejection_reason: null,
    pose: { yaw: 0.8, pitch: 1.5, roll: -0.4 },
    sharpness_score: 128.0,
    mean_illumination: 115.0,
  },
  scale_reference: {
    method: "HVID_WTW_POPULATION_AVERAGE",
    assumed_corneal_diameter_mm: 11.71,
    hvid_pixels: { right_eye: 160.0, left_eye: 162.0 },
    scale_factor_mm_per_px: { right_eye: 0.0732, left_eye: 0.0723 },
  },
  measurements: {
    right_eye_od: {
      mrd1_px: null,
      mrd1_mm: null,
      mrd1_estimated_range: null,
      pfh_px: 42.0,
      pfh_mm: 3.07,
      reference_point_used: "NONE",
      reference_coordinates: null,
      eyelid_margin_point: { x: 380.0, y: 465.2 },
      status: "MEASUREMENT_UNAVAILABLE",
      confidence_score: 0.0,
      warning_flags: [
        "REFLEX_OCCLUDED_BY_UPPER_LID",
        "VISUAL_AXIS_OBSTRUCTION_SUSPECTED",
      ],
      reflex_visibility: "OCCLUDED_BY_LID",
    },
    left_eye_os: {
      mrd1_px: 48.2,
      mrd1_mm: 3.48,
      mrd1_estimated_range: "3.0 - 4.0 mm",
      pfh_px: 130.5,
      pfh_mm: 9.44,
      reference_point_used: "CORNEAL_LIGHT_REFLEX",
      reference_coordinates: { x: 640.5, y: 450.0 },
      eyelid_margin_point: { x: 640.5, y: 401.8 },
      status: "VALID",
      confidence_score: 0.93,
      warning_flags: [],
      reflex_visibility: "VISIBLE",
    },
  },
  bilateral_comparison: {
    delta_mrd1_mm: null,
    signed_delta_mrd1_mm: null,
    asymmetry_classification: "SIGNIFICANT_ASYMMETRY",
    delta_pfh_mm: 6.37,
    delta_brow_px: 14.5,
    eyebrow_height_discrepancy_px: 14.5,
  },
  annotated_overlay_coordinates: {
    right_eye: {
      corneal_reflex: null,
      pupil_center: null,
      iris_limbus_contour: [[300.0, 450.0], [460.0, 450.0]],
      upper_eyelid_contour: [[305.0, 470.0], [380.0, 465.2], [455.0, 472.0]],
    },
    left_eye: {
      corneal_reflex: [640.5, 450.0],
      pupil_center: [640.3, 449.8],
      iris_limbus_contour: [[559.5, 450.0], [721.5, 450.0]],
      upper_eyelid_contour: [[560.0, 425.0], [640.5, 401.8], [720.0, 428.0]],
    },
  },
};

const PAYLOAD_5: MeasurementPayload = {
  session_id: "d7c88990-1122-3344-5566-778899aabbcc",
  timestamp: "2026-10-26T07:50:00.000Z",
  image_quality_audit: {
    passed: true,
    rejection_reason: null,
    pose: { yaw: 0.0, pitch: 0.0, roll: 2.5 },
    sharpness_score: 62.0,
    mean_illumination: 74.0,
  },
  scale_reference: {
    method: "HVID_WTW_POPULATION_AVERAGE",
    assumed_corneal_diameter_mm: 11.71,
    hvid_pixels: { right_eye: 190.0, left_eye: 192.0 },
    scale_factor_mm_per_px: { right_eye: 0.0616, left_eye: 0.0610 },
  },
  measurements: {
    right_eye_od: {
      mrd1_px: null,
      mrd1_mm: null,
      mrd1_estimated_range: null,
      pfh_px: 110.0,
      pfh_mm: 6.78,
      reference_point_used: "NONE",
      reference_coordinates: null,
      eyelid_margin_point: { x: 280.0, y: 210.0 },
      status: "MEASUREMENT_UNAVAILABLE",
      confidence_score: 0.0,
      warning_flags: ["REFLEX_NOT_VISIBLE_QUALITY", "IMAGE_UNDEREXPOSED_OR_DIFFUSE"],
      reflex_visibility: "NOT_VISIBLE_QUALITY",
    },
    left_eye_os: {
      mrd1_px: null,
      mrd1_mm: null,
      mrd1_estimated_range: null,
      pfh_px: 112.5,
      pfh_mm: 6.86,
      reference_point_used: "NONE",
      reference_coordinates: null,
      eyelid_margin_point: { x: 620.0, y: 208.5 },
      status: "MEASUREMENT_UNAVAILABLE",
      confidence_score: 0.0,
      warning_flags: ["REFLEX_NOT_VISIBLE_QUALITY", "IMAGE_UNDEREXPOSED_OR_DIFFUSE"],
      reflex_visibility: "NOT_VISIBLE_QUALITY",
    },
  },
  bilateral_comparison: {
    delta_mrd1_mm: null,
    signed_delta_mrd1_mm: null,
    asymmetry_classification: "BORDERLINE_ASYMMETRY",
    delta_pfh_mm: 0.08,
    delta_brow_px: 0.0,
    eyebrow_height_discrepancy_px: 0.0,
  },
  annotated_overlay_coordinates: {
    right_eye: {
      corneal_reflex: null,
      pupil_center: [280.0, 245.0],
      iris_limbus_contour: [[185.0, 245.0], [375.0, 245.0]],
      upper_eyelid_contour: [[190.0, 230.0], [280.0, 210.0], [370.0, 232.0]],
    },
    left_eye: {
      corneal_reflex: null,
      pupil_center: [620.0, 244.0],
      iris_limbus_contour: [[524.0, 244.0], [716.0, 244.0]],
      upper_eyelid_contour: [[528.0, 229.0], [620.0, 208.5], [712.0, 231.0]],
    },
  },
};

describe('Phase C Frontend Tests: MeasurementDetails and Canvas Overlay', () => {
  it('renders Payload 1 with valid measurements successfully', () => {
    render(<MeasurementDetails payload={PAYLOAD_1} />);
    expect(screen.getByText('Mắt Phải (OD)')).toBeDefined();
    expect(screen.getByText(/3\.50 mm/)).toBeDefined();
    expect(screen.getAllByText(/Hợp lệ/)).toHaveLength(2);
  });

  it('renders Payload 3 with Occluded Reflex badge "Không thể đo (Che phủ bờ mi)"', () => {
    render(<MeasurementDetails payload={PAYLOAD_3} />);
    expect(screen.getByText('Không thể đo (Che phủ bờ mi)')).toBeDefined();
    expect(screen.getByText('Không có mốc hợp lệ')).toBeDefined();
  });

  it('renders Payload 5 with Low Quality badge "Không thể đo (Thiếu sáng)" for both eyes', () => {
    render(<MeasurementDetails payload={PAYLOAD_5} />);
    const badges = screen.getAllByText('Không thể đo (Thiếu sáng)');
    expect(badges).toHaveLength(2);
  });

  it('calculateEyesBoundingBox handles null corneal_reflex safely without throwing', () => {
    const bbox = calculateEyesBoundingBox(PAYLOAD_3.annotated_overlay_coordinates, 1000, 1000);
    expect(bbox.width).toBeGreaterThan(0);
    expect(bbox.height).toBeGreaterThan(0);
  });
});
