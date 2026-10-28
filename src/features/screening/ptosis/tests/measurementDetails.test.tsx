import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MeasurementDetails } from '../components/result/MeasurementDetails';
import type { MeasurementPayload } from '../types/api-contracts';

const mockPayloadWithNulls: MeasurementPayload = {
  session_id: 'test-session-null',
  timestamp: new Date().toISOString(),
  image_quality_audit: {
    passed: true,
    rejection_reason: null,
    pose: { yaw: 0, pitch: 0, roll: 0 },
    sharpness_score: 120,
    mean_illumination: 110,
  },
  scale_reference: {
    method: 'HVID_WTW_POPULATION_AVERAGE',
    assumed_corneal_diameter_mm: 11.71,
    hvid_pixels: { right_eye: 160, left_eye: 160 },
    scale_factor_mm_per_px: { right_eye: 0.073, left_eye: 0.073 },
  },
  measurements: {
    right_eye_od: {
      mrd1_px: 45.0,
      mrd1_mm: 3.28,
      mrd1_estimated_range: '2.8 - 3.8 mm',
      pfh_px: 120.0,
      pfh_mm: 8.76,
      reference_point_used: 'CORNEAL_LIGHT_REFLEX',
      status: 'VALID',
      confidence_score: 0.95,
      warning_flags: [],
    },
    left_eye_os: {
      mrd1_px: null,
      mrd1_mm: null,
      mrd1_estimated_range: null,
      pfh_px: 40.0,
      pfh_mm: 2.92,
      reference_point_used: 'CORNEAL_LIGHT_REFLEX',
      status: 'MEASUREMENT_UNAVAILABLE',
      confidence_score: 0.0,
      warning_flags: ['ANATOMICAL_NEGATIVE_SUSPECTED'],
    },
  },
  bilateral_comparison: {
    delta_mrd1_mm: null,
    signed_delta_mrd1_mm: null,
    asymmetry_classification: 'SIGNIFICANT_ASYMMETRY',
    delta_pfh_mm: 5.84,
    delta_brow_px: 12.0,
    eyebrow_height_discrepancy_px: 12.0,
  },
  annotated_overlay_coordinates: {
    right_eye: {
      corneal_reflex: [200, 200],
      pupil_center: [200, 200],
      iris_limbus_contour: [[150, 200], [250, 200]],
      upper_eyelid_contour: [[150, 180], [250, 180]],
    },
    left_eye: {
      corneal_reflex: [400, 200],
      pupil_center: [400, 200],
      iris_limbus_contour: [[350, 200], [450, 200]],
      upper_eyelid_contour: [[350, 210], [450, 210]],
    },
  },
};

describe('Phase A - MeasurementDetails Null Safety Tests', () => {
  it('renders without throwing TypeError when mrd1_mm and delta_mrd1_mm are null', () => {
    render(<MeasurementDetails payload={mockPayloadWithNulls} />);
    
    // Mắt phải (OD) hợp lệ
    expect(screen.getByText('Chỉ số: 3.28 mm')).toBeInTheDocument();
    
    // Mắt trái (OS) không khả dụng do che phủ bờ mi (Phase C nâng cấp)
    expect(screen.getByText(/Không thể đo \(Che phủ bờ mi\)|Không khả dụng/)).toBeInTheDocument();
    expect(screen.getAllByText('Chỉ số: --').length).toBeGreaterThan(0);
    
    // delta_mrd1_mm là null
    expect(screen.getByText('Chênh lệch |ΔMRD1|')).toBeInTheDocument();
  });
});
