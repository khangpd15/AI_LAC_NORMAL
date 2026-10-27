import { describe, it, expect } from 'vitest';
import { validateImageFile } from '../hooks/useImagePreValidation';

describe('validateImageFile Client Pre-validation Tests', () => {
  it('TC-1.1: chấp thuận ảnh JPEG 500KB hợp lệ', () => {
    const file = new File([new Uint8Array(500 * 1024)], 'test_face.jpg', {
      type: 'image/jpeg',
    });
    const result = validateImageFile(file);
    expect(result.isValid).toBe(true);
    expect(result.errorMessage).toBeNull();
  });

  it('TC-1.2: từ chối file PDF 1MB không phải ảnh', () => {
    const file = new File([new Uint8Array(1024 * 1024)], 'document.pdf', {
      type: 'application/pdf',
    });
    const result = validateImageFile(file);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('Định dạng tệp không được hỗ trợ');
  });

  it('TC-1.3: từ chối ảnh > 15MB (ví dụ: 20MB)', () => {
    const file = new File([new Uint8Array(20 * 1024 * 1024)], 'huge_photo.jpg', {
      type: 'image/jpeg',
    });
    const result = validateImageFile(file);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('vượt quá giới hạn 15MB');
  });

  it('TC-1.4: từ chối ảnh < 50KB (ví dụ: 30KB)', () => {
    const file = new File([new Uint8Array(30 * 1024)], 'tiny_thumb.jpg', {
      type: 'image/jpeg',
    });
    const result = validateImageFile(file);
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('quá nhỏ (< 50KB)');
  });

  it('TC-1.5: chấp thuận ảnh đúng ngưỡng biên 50KB', () => {
    const file = new File([new Uint8Array(50 * 1024)], 'border_50kb.jpg', {
      type: 'image/jpeg',
    });
    const result = validateImageFile(file);
    expect(result.isValid).toBe(true);
    expect(result.errorMessage).toBeNull();
  });

  it('TC-1.6: chấp thuận ảnh eye_crop 15KB hợp lệ', () => {
    const file = new File([new Uint8Array(15 * 1024)], 'crop_15kb.jpg', {
      type: 'image/jpeg',
    });
    const result = validateImageFile(file, 'eye_crop');
    expect(result.isValid).toBe(true);
    expect(result.errorMessage).toBeNull();
  });

  it('TC-1.7: chấp thuận ảnh eye_crop đúng ngưỡng biên 10KB', () => {
    const file = new File([new Uint8Array(10 * 1024)], 'crop_10kb.jpg', {
      type: 'image/jpeg',
    });
    const result = validateImageFile(file, 'eye_crop');
    expect(result.isValid).toBe(true);
    expect(result.errorMessage).toBeNull();
  });

  it('TC-1.8: từ chối ảnh eye_crop < 10KB (ví dụ: 8KB)', () => {
    const file = new File([new Uint8Array(8 * 1024)], 'crop_8kb.jpg', {
      type: 'image/jpeg',
    });
    const result = validateImageFile(file, 'eye_crop');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('quá nhỏ (< 10KB)');
  });

  it('TC-1.9: từ chối ảnh eye_crop > 15MB', () => {
    const file = new File([new Uint8Array(16 * 1024 * 1024)], 'crop_huge.jpg', {
      type: 'image/jpeg',
    });
    const result = validateImageFile(file, 'eye_crop');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('vượt quá giới hạn 15MB');
  });

  it('TC-1.10: ảnh 15KB bị từ chối ở fullface (< 50KB) nhưng được chấp thuận ở eye_crop (>= 10KB)', () => {
    const file = new File([new Uint8Array(15 * 1024)], 'comparison_15kb.jpg', {
      type: 'image/jpeg',
    });
    // Chế độ fullface mặc định: từ chối
    const fullfaceResult = validateImageFile(file, 'fullface');
    expect(fullfaceResult.isValid).toBe(false);
    expect(fullfaceResult.errorMessage).toContain('quá nhỏ (< 50KB)');

    // Chế độ eye_crop: chấp thuận
    const eyeCropResult = validateImageFile(file, 'eye_crop');
    expect(eyeCropResult.isValid).toBe(true);
    expect(eyeCropResult.errorMessage).toBeNull();
  });
});
