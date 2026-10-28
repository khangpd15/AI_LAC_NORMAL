import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConsentDialog } from '../components/common/ConsentDialog';

describe('TC-1.6: ConsentDialog Component Tests', () => {
  it('nút gửi ảnh bị disable khi chưa tick consent', () => {
    const handleAccept = vi.fn();
    render(<ConsentDialog onAccept={handleAccept} />);

    const button = screen.getByRole('button', { name: /bắt đầu sàng lọc/i });
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;

    // Chưa tick consent: nút phải bị vô hiệu hóa (disabled)
    expect(checkbox.checked).toBe(false);
    expect(button.hasAttribute('disabled')).toBe(true);

    // Thử click nút khi đang disable
    fireEvent.click(button);
    expect(handleAccept).not.toHaveBeenCalled();
  });

  it('nút gửi ảnh được kích hoạt sau khi tick consent', () => {
    const handleAccept = vi.fn();
    render(<ConsentDialog onAccept={handleAccept} />);

    const button = screen.getByRole('button', { name: /bắt đầu sàng lọc/i });
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;

    // Tick chọn đồng ý
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(button.hasAttribute('disabled')).toBe(false);

    // Click nút xác nhận
    fireEvent.click(button);
    expect(handleAccept).toHaveBeenCalledTimes(1);
  });
});
