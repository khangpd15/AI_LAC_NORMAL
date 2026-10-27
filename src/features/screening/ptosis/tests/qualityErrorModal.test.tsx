import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QualityErrorModal } from '../components/common/QualityErrorModal';
import type { QualityRejection } from '../types/api-contracts';

describe('QualityErrorModal Component', () => {
  const mockRejection: QualityRejection = {
    error_code: 'QUALITY_GATE_REJECTED',
    rejection_reason: 'HEAD_ROLL_EXCEEDED',
    rejection_message_vi: 'Đầu đang bị nghiêng sang một bên. Vui lòng giữ thẳng đầu thăng bằng.',
    audit_details: {
      roll_deg: 8.4,
      max_allowed_roll_deg: 5.0,
    },
  };

  it('hiển thị đầy đủ thông điệp tiếng Việt và mã nguyên nhân từ chối', () => {
    const handleRetry = vi.fn();
    render(<QualityErrorModal rejection={mockRejection} onRetry={handleRetry} />);

    expect(screen.getByText('HEAD_ROLL_EXCEEDED')).toBeInTheDocument();
    expect(
      screen.getByText('Đầu đang bị nghiêng sang một bên. Vui lòng giữ thẳng đầu thăng bằng.')
    ).toBeInTheDocument();
    expect(screen.getByText('Đầu Bị Nghiêng - Vui Lòng Giữ Thẳng Đầu')).toBeInTheDocument();
  });

  it('gọi hàm onRetry khi người dùng bấm nút Chụp lại ảnh', () => {
    const handleRetry = vi.fn();
    render(<QualityErrorModal rejection={mockRejection} onRetry={handleRetry} />);

    const retryBtn = screen.getByRole('button', { name: /Chụp lại ảnh/i });
    fireEvent.click(retryBtn);

    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('cho phép xem chi tiết thông số kỹ thuật kiểm định khi bấm mở rộng', () => {
    const handleRetry = vi.fn();
    render(<QualityErrorModal rejection={mockRejection} onRetry={handleRetry} />);

    const toggleBtn = screen.getByText(/Thông số kỹ thuật kiểm định/i);
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/roll_deg/i)).toBeInTheDocument();
    expect(screen.getByText(/8.4/i)).toBeInTheDocument();
  });
});
