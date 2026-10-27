import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TierCard } from '../components/result/TierCard';
import type { TriageResult } from '../types/api-contracts';

describe('TierCard Component - Phase E & Indeterminate Handling', () => {
  it('renders standard TIER_A correctly', () => {
    const triage: TriageResult = {
      tier: 'TIER_A',
      trigger_reasons: ['PHYSIOLOGICAL_NORMAL'],
      description_vi: 'Không phát hiện bất thường.',
      recommendation_vi: 'Duy trì thói quen lành mạnh.',
      safety_disclaimer_vi: 'Chỉ mang tính sàng lọc.',
      is_bilateral_severe_triggered: false,
    };

    render(<TierCard triage={triage} />);
    expect(screen.getByText(/Mức A • Không phát hiện bất thường/i)).toBeInTheDocument();
    expect(screen.getByText(/Hình thái Mi mắt Trong Giới hạn Bình thường/i)).toBeInTheDocument();
  });

  it('renders TIER_B Indeterminate case with updated badge, title, and guidance pill', () => {
    const triage: TriageResult = {
      tier: 'TIER_B',
      trigger_reasons: ['REFLEX_NOT_VISIBLE_INDETERMINATE_QUALITY'],
      description_vi: 'Không phát hiện điểm phản xạ do thiếu sáng.',
      recommendation_vi: 'Vui lòng chụp lại có flash.',
      safety_disclaimer_vi: 'Chỉ mang tính sàng lọc.',
      is_bilateral_severe_triggered: false,
    };

    render(<TierCard triage={triage} />);
    expect(screen.getByText(/Mức B • Chưa xác định \/ Cần chụp lại/i)).toBeInTheDocument();
    expect(screen.getByText(/Chưa Xác định Do Điều kiện Ánh sáng/i)).toBeInTheDocument();
    expect(screen.getByText(/Chưa xác định do chất lượng ảnh • Khuyến nghị chụp lại có flash/i)).toBeInTheDocument();
  });

  it('renders TIER_C with lid occlusion warning badge', () => {
    const triage: TriageResult = {
      tier: 'TIER_C',
      trigger_reasons: ['REFLEX_OCCLUDED_SEVERE', 'UNILATERAL_VISUAL_AXIS_OBSTRUCTION'],
      description_vi: 'Ghi nhận bờ mi trên che phủ đáng kể qua trục thị giác.',
      recommendation_vi: 'Khuyến nghị sớm thăm khám chuyên khoa mắt.',
      safety_disclaimer_vi: 'Chỉ mang tính sàng lọc.',
      is_bilateral_severe_triggered: false,
    };

    render(<TierCard triage={triage} />);
    expect(screen.getByText(/Mức C • Khuyến nghị khám chuyên khoa mắt/i)).toBeInTheDocument();
    expect(screen.getByText(/Nghi ngờ bờ mi che phủ trục thị giác/i)).toBeInTheDocument();
  });
});
