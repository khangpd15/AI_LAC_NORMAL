/**
 * Bộ kiểm thử tích hợp toàn diện giao diện (Frontend E2E Component Test - Phase F).
 * Xác thực ResultScreen render chính xác với cả 4 dạng payloads:
 * 1. Payload toàn mặt tiêu chuẩn (Full-Face Standard - TIER_A).
 * 2. Payload crop 2 mắt (Dual-Eye Crop - Periocular Pipeline).
 * 3. Payload sụp mi che phủ bờ mi (Severe Occlusion - TIER_C & Null Guard).
 * 4. Payload thiếu phản quang do chất lượng (Indeterminate - TIER_B & Flash Guidance).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultScreen } from '../components/result/ResultScreen';
import type { MeasurementPayload } from '../types/api-contracts';

// Mock canvas-related functions if needed
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  setLineDash: vi.fn(),
  fillText: vi.fn(),
}) as any;

describe('ResultScreen E2E Integration Suite (Phase F)', () => {
  const onResetMock = vi.fn();

  it('renders standard Full-Face TIER_A payload and triggers onReset callback', () => {
    const payload: MeasurementPayload = {
      session_id: 'test-session-fullface-001',
      timestamp: '2026-10-26T10:00:00.000Z',
      image_quality_audit: {
        passed: true,
        rejection_reason: null,
        pose: { yaw: 1.0, pitch: 2.0, roll: 0.5 },
        sharpness_score: 180.0,
        mean_illumination: 130.0,
      },
      scale_reference: {
        method: 'HVID_WTW_POPULATION_AVERAGE',
        assumed_corneal_diameter_mm: 11.71,
        hvid_pixels: { right_eye: 160.0, left_eye: 162.0 },
        scale_factor_mm_per_px: { right_eye: 0.073, left_eye: 0.072 },
      },
      measurements: {
        right_eye_od: {
          mrd1_px: 50.0,
          mrd1_mm: 3.65,
          mrd1_estimated_range: '3.2 - 4.1 mm',
          pfh_px: 120.0,
          pfh_mm: 8.76,
          reference_point_used: 'CORNEAL_LIGHT_REFLEX',
          reference_coordinates: { x: 200.0, y: 300.0 },
          eyelid_margin_point: { x: 200.0, y: 250.0 },
          status: 'VALID',
          confidence_score: 0.95,
          warning_flags: [],
        },
        left_eye_os: {
          mrd1_px: 52.0,
          mrd1_mm: 3.74,
          mrd1_estimated_range: '3.3 - 4.2 mm',
          pfh_px: 122.0,
          pfh_mm: 8.78,
          reference_point_used: 'CORNEAL_LIGHT_REFLEX',
          reference_coordinates: { x: 500.0, y: 300.0 },
          eyelid_margin_point: { x: 500.0, y: 248.0 },
          status: 'VALID',
          confidence_score: 0.95,
          warning_flags: [],
        },
      },
      bilateral_comparison: {
        delta_mrd1_mm: 0.09,
        signed_delta_mrd1_mm: 0.09,
        asymmetry_classification: 'PHYSIOLOGICAL_SYMMETRY',
        delta_pfh_mm: 0.02,
        delta_brow_px: 1.0,
        eyebrow_height_discrepancy_px: 1.0,
      },
      triage_result: {
        tier: 'TIER_A',
        trigger_reasons: ['PHYSIOLOGICAL_NORMAL'],
        description_vi: 'Hình thái mi mắt trong giới hạn bình thường.',
        recommendation_vi: 'Tiếp tục duy trì thói quen lành mạnh.',
        safety_disclaimer_vi: 'Kết quả chỉ mang tính sàng lọc hình thái ban đầu.',
        is_bilateral_severe_triggered: false,
      },
      annotated_overlay_coordinates: {
        right_eye: {
          corneal_reflex: [200.0, 300.0],
          pupil_center: [200.0, 300.0],
          iris_limbus_contour: [[120.0, 300.0], [280.0, 300.0]],
          upper_eyelid_contour: [[120.0, 270.0], [200.0, 250.0], [280.0, 275.0]],
        },
        left_eye: {
          corneal_reflex: [500.0, 300.0],
          pupil_center: [500.0, 300.0],
          iris_limbus_contour: [[420.0, 300.0], [580.0, 300.0]],
          upper_eyelid_contour: [[420.0, 270.0], [500.0, 248.0], [580.0, 275.0]],
        },
      },
    };

    render(
      <ResultScreen
        payload={payload}
        selectedFile={null}
        onReset={onResetMock}
      />
    );

    // Kiểm tra TierCard
    expect(screen.getByText(/Mức A • Không phát hiện bất thường/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Hình thái mi mắt trong giới hạn bình thường/i).length).toBeGreaterThan(0);

    // Kiểm tra nút Reset hoạt động
    const resetButtons = screen.getAllByRole('button', { name: /sàng lọc lại|thực hiện sàng lọc mới/i });
    expect(resetButtons.length).toBeGreaterThan(0);
    fireEvent.click(resetButtons[0]);
    expect(onResetMock).toHaveBeenCalledTimes(1);
  });

  it('renders Dual-Eye Crop payload processed via Periocular Pipeline', () => {
    const payload: MeasurementPayload = {
      session_id: 'test-session-crop-002',
      timestamp: '2026-10-26T10:05:00.000Z',
      image_quality_audit: {
        passed: true,
        rejection_reason: null,
        pose: { yaw: 0.0, pitch: 0.0, roll: 1.2 },
        sharpness_score: 210.0,
        mean_illumination: 140.0,
        audit_details: { input_type: 'DUAL_EYE_CROP' },
      },
      scale_reference: {
        method: 'HVID_WTW_POPULATION_AVERAGE',
        assumed_corneal_diameter_mm: 11.71,
        hvid_pixels: { right_eye: 245.0, left_eye: 248.0 },
        scale_factor_mm_per_px: { right_eye: 0.0478, left_eye: 0.0472 },
      },
      measurements: {
        right_eye_od: {
          mrd1_px: 78.5,
          mrd1_mm: 3.75,
          mrd1_estimated_range: '3.3 - 4.3 mm',
          pfh_px: 212.0,
          pfh_mm: 10.13,
          reference_point_used: 'CORNEAL_LIGHT_REFLEX',
          reference_coordinates: { x: 340.0, y: 285.0 },
          eyelid_margin_point: { x: 340.0, y: 206.0 },
          status: 'VALID',
          confidence_score: 0.96,
          warning_flags: ['PROCESSED_VIA_PERIOCULAR_PIPELINE'],
        },
        left_eye_os: {
          mrd1_px: 75.0,
          mrd1_mm: 3.54,
          mrd1_estimated_range: '3.0 - 4.0 mm',
          pfh_px: 208.5,
          pfh_mm: 9.84,
          reference_point_used: 'CORNEAL_LIGHT_REFLEX',
          reference_coordinates: { x: 860.0, y: 284.0 },
          eyelid_margin_point: { x: 860.0, y: 209.0 },
          status: 'VALID',
          confidence_score: 0.95,
          warning_flags: ['PROCESSED_VIA_PERIOCULAR_PIPELINE'],
        },
      },
      bilateral_comparison: {
        delta_mrd1_mm: 0.21,
        signed_delta_mrd1_mm: -0.21,
        asymmetry_classification: 'PHYSIOLOGICAL_SYMMETRY',
        delta_pfh_mm: 0.29,
        delta_brow_px: 0.0,
        eyebrow_height_discrepancy_px: 0.0,
      },
      triage_result: {
        tier: 'TIER_A',
        trigger_reasons: ['PHYSIOLOGICAL_NORMAL'],
        description_vi: 'Không phát hiện dấu hiệu bất thường.',
        recommendation_vi: 'Kiểm tra mắt định kỳ.',
        safety_disclaimer_vi: 'Kết quả chỉ mang tính sàng lọc.',
        is_bilateral_severe_triggered: false,
      },
      annotated_overlay_coordinates: {
        right_eye: {
          corneal_reflex: [340.0, 285.0],
          pupil_center: [340.0, 285.0],
          iris_limbus_contour: [[217.0, 285.0], [463.0, 285.0]],
          upper_eyelid_contour: [[220.0, 240.0], [340.0, 206.0], [460.0, 245.0]],
        },
        left_eye: {
          corneal_reflex: [860.0, 284.0],
          pupil_center: [860.0, 284.0],
          iris_limbus_contour: [[736.0, 284.0], [984.0, 284.0]],
          upper_eyelid_contour: [[740.0, 242.0], [860.0, 209.0], [980.0, 246.0]],
        },
      },
    };

    render(
      <ResultScreen
        payload={payload}
        selectedFile={null}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByText(/3.75 mm/i)).toBeInTheDocument();
    expect(screen.getByText(/3.54 mm/i)).toBeInTheDocument();
  });

  it('renders Severe Ptosis / Lid Occlusion TIER_C with null guard and warning pills', () => {
    const payload: MeasurementPayload = {
      session_id: 'test-session-occluded-003',
      timestamp: '2026-10-26T10:10:00.000Z',
      image_quality_audit: {
        passed: true,
        rejection_reason: null,
        pose: { yaw: 0.0, pitch: 0.0, roll: 0.0 },
        sharpness_score: 150.0,
        mean_illumination: 120.0,
      },
      scale_reference: {
        method: 'HVID_WTW_POPULATION_AVERAGE',
        assumed_corneal_diameter_mm: 11.71,
        hvid_pixels: { right_eye: 150.0, left_eye: 155.0 },
        scale_factor_mm_per_px: { right_eye: 0.078, left_eye: 0.075 },
      },
      measurements: {
        right_eye_od: {
          mrd1_px: null,
          mrd1_mm: null,
          mrd1_estimated_range: null,
          pfh_px: 42.0,
          pfh_mm: 3.28,
          reference_point_used: 'NONE',
          reference_coordinates: null,
          eyelid_margin_point: { x: 380.0, y: 465.0 },
          status: 'MEASUREMENT_UNAVAILABLE',
          confidence_score: 0.0,
          warning_flags: ['REFLEX_OCCLUDED_BY_UPPER_LID', 'ANATOMICAL_NEGATIVE_SUSPECTED'],
          reflex_visibility: 'OCCLUDED_BY_LID',
        },
        left_eye_os: {
          mrd1_px: 48.0,
          mrd1_mm: 3.60,
          mrd1_estimated_range: '3.2 - 4.0 mm',
          pfh_px: 130.0,
          pfh_mm: 9.75,
          reference_point_used: 'CORNEAL_LIGHT_REFLEX',
          reference_coordinates: { x: 640.0, y: 450.0 },
          eyelid_margin_point: { x: 640.0, y: 402.0 },
          status: 'VALID',
          confidence_score: 0.95,
          warning_flags: [],
          reflex_visibility: 'VISIBLE',
        },
      },
      bilateral_comparison: {
        delta_mrd1_mm: null,
        signed_delta_mrd1_mm: null,
        asymmetry_classification: 'SIGNIFICANT_ASYMMETRY',
        delta_pfh_mm: 6.47,
        delta_brow_px: 12.0,
        eyebrow_height_discrepancy_px: 12.0,
      },
      triage_result: {
        tier: 'TIER_C',
        trigger_reasons: [
          'REFLEX_OCCLUDED_SEVERE',
          'UNILATERAL_VISUAL_AXIS_OBSTRUCTION',
          'BROW_COMPENSATION_SUSPECTED',
        ],
        description_vi: 'Ghi nhận bờ mi trên mắt phải che phủ đáng kể qua trục thị giác, kèm nhướng mày.',
        recommendation_vi: 'Khuyến nghị sớm thăm khám chuyên khoa mắt.',
        safety_disclaimer_vi: 'Kết quả chỉ mang tính sàng lọc y sinh.',
        is_bilateral_severe_triggered: false,
        flags: {
          is_bilateral_severe_triggered: false,
          is_brow_compensation_detected: true,
          is_pupil_fallback_used: false,
        },
      },
      annotated_overlay_coordinates: {
        right_eye: {
          corneal_reflex: null,
          pupil_center: null,
          iris_limbus_contour: [[300.0, 450.0], [460.0, 450.0]],
          upper_eyelid_contour: [[305.0, 470.0], [380.0, 465.0], [455.0, 472.0]],
        },
        left_eye: {
          corneal_reflex: [640.0, 450.0],
          pupil_center: [640.0, 450.0],
          iris_limbus_contour: [[560.0, 450.0], [720.0, 450.0]],
          upper_eyelid_contour: [[560.0, 425.0], [640.0, 402.0], [720.0, 428.0]],
        },
      },
    };

    render(
      <ResultScreen
        payload={payload}
        selectedFile={null}
        onReset={vi.fn()}
      />
    );

    // TierCard TIER_C
    expect(screen.getByText(/Mức C • Khuyến nghị khám chuyên khoa mắt/i)).toBeInTheDocument();
    expect(screen.getByText(/Nghi ngờ bờ mi che phủ trục thị giác/i)).toBeInTheDocument();

    // Null Guard trong MeasurementDetails
    expect(screen.getByText(/Không thể đo \(Che phủ bờ mi\)/i)).toBeInTheDocument();
  });

  it('renders Indeterminate TIER_B payload with diffuse light warning and flash prompt', () => {
    const payload: MeasurementPayload = {
      session_id: 'test-session-diffuse-004',
      timestamp: '2026-10-26T10:15:00.000Z',
      image_quality_audit: {
        passed: true,
        rejection_reason: null,
        pose: { yaw: 0.0, pitch: 0.0, roll: 2.0 },
        sharpness_score: 65.0,
        mean_illumination: 75.0,
      },
      scale_reference: {
        method: 'HVID_WTW_POPULATION_AVERAGE',
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
          reference_point_used: 'NONE',
          reference_coordinates: null,
          eyelid_margin_point: { x: 280.0, y: 210.0 },
          status: 'MEASUREMENT_UNAVAILABLE',
          confidence_score: 0.0,
          warning_flags: ['REFLEX_NOT_VISIBLE_QUALITY'],
          reflex_visibility: 'NOT_VISIBLE_QUALITY',
        },
        left_eye_os: {
          mrd1_px: null,
          mrd1_mm: null,
          mrd1_estimated_range: null,
          pfh_px: 112.5,
          pfh_mm: 6.86,
          reference_point_used: 'NONE',
          reference_coordinates: null,
          eyelid_margin_point: { x: 620.0, y: 208.0 },
          status: 'MEASUREMENT_UNAVAILABLE',
          confidence_score: 0.0,
          warning_flags: ['REFLEX_NOT_VISIBLE_QUALITY'],
          reflex_visibility: 'NOT_VISIBLE_QUALITY',
        },
      },
      bilateral_comparison: {
        delta_mrd1_mm: null,
        signed_delta_mrd1_mm: null,
        asymmetry_classification: 'BORDERLINE_ASYMMETRY',
        delta_pfh_mm: 0.08,
        delta_brow_px: 0.0,
        eyebrow_height_discrepancy_px: 0.0,
      },
      triage_result: {
        tier: 'TIER_B',
        trigger_reasons: ['REFLEX_NOT_VISIBLE_INDETERMINATE_QUALITY'],
        description_vi: 'Không phát hiện điểm phản xạ ánh sáng do thiếu sáng.',
        recommendation_vi: 'Vui lòng chụp lại ảnh có bật đèn flash ở khoảng cách 50-70cm.',
        safety_disclaimer_vi: 'Kết quả chỉ mang tính sàng lọc.',
        is_bilateral_severe_triggered: false,
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
          upper_eyelid_contour: [[528.0, 229.0], [620.0, 208.0], [712.0, 231.0]],
        },
      },
    };

    render(
      <ResultScreen
        payload={payload}
        selectedFile={null}
        onReset={vi.fn()}
      />
    );

    // Kiểm tra TierCard Indeterminate
    expect(screen.getByText(/Mức B • Chưa xác định \/ Cần chụp lại/i)).toBeInTheDocument();
    expect(screen.getByText(/Chưa xác định do chất lượng ảnh • Khuyến nghị chụp lại có flash/i)).toBeInTheDocument();

    // Kiểm tra MeasurementDetails hiển thị Unavailable do thiếu sáng
    const unavailableBadges = screen.getAllByText(/Không thể đo \(Thiếu sáng\)/i);
    expect(unavailableBadges.length).toBe(2);
  });
});
