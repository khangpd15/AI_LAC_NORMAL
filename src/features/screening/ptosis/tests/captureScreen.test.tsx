import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaptureScreen } from '../components/capture/CaptureScreen';

describe('CaptureScreen Component - Eye Crop and Full Face Mode Selector', () => {
  it('hiển thị đầy đủ 2 tùy chọn chế độ ảnh Toàn mặt và Cận cảnh 2 mắt', () => {
    const onImageTypeChange = vi.fn();
    render(
      <CaptureScreen
        selectedFile={null}
        imageType="fullface"
        onImageTypeChange={onImageTypeChange}
        onFileSelect={vi.fn()}
        onClearFile={vi.fn()}
        onSubmit={vi.fn()}
        isAnalyzing={false}
      />
    );

    const fullFaceBtn = screen.getByRole('button', { name: /ảnh toàn mặt/i });
    const eyeCropBtn = screen.getByRole('button', { name: /cận cảnh 2 mắt/i });

    expect(fullFaceBtn).toBeDefined();
    expect(eyeCropBtn).toBeDefined();
    expect(screen.getByText(/quy chuẩn chụp ảnh toàn mặt chính xác/i)).toBeDefined();
  });

  it('gọi hàm onImageTypeChange khi người dùng chuyển sang chế độ Cận cảnh 2 mắt', () => {
    const onImageTypeChange = vi.fn();
    render(
      <CaptureScreen
        selectedFile={null}
        imageType="fullface"
        onImageTypeChange={onImageTypeChange}
        onFileSelect={vi.fn()}
        onClearFile={vi.fn()}
        onSubmit={vi.fn()}
        isAnalyzing={false}
      />
    );

    const eyeCropBtn = screen.getByRole('button', { name: /cận cảnh 2 mắt/i });
    fireEvent.click(eyeCropBtn);

    expect(onImageTypeChange).toHaveBeenCalledWith('eye_crop');
  });

  it('hiển thị đúng hướng dẫn quy chuẩn khi chế độ eye_crop được chọn', () => {
    render(
      <CaptureScreen
        selectedFile={null}
        imageType="eye_crop"
        onImageTypeChange={vi.fn()}
        onFileSelect={vi.fn()}
        onClearFile={vi.fn()}
        onSubmit={vi.fn()}
        isAnalyzing={false}
      />
    );

    expect(screen.getByText(/quy chuẩn ảnh cắt cận cảnh hai mắt/i)).toBeDefined();
    expect(screen.getAllByText(/bao gồm trọn vẹn cả 2 mắt/i).length).toBeGreaterThanOrEqual(1);
  });
});
