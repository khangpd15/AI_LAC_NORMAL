/**
 * Hook kết nối giao thức mạng với Backend FastAPI phục vụ gửi ảnh và phân tích.
 * Tuân thủ G5: Kiểm soát cấu trúc trả về theo MeasurementPayload và QualityRejection.
 * Tuân thủ G4: Tuyệt đối không dùng từ ngữ thuộc danh mục cấm.
 */

import { useState, useCallback } from 'react';
import type {
  MeasurementPayload,
  ImageType,
  QualityRejection,
  ScreeningThresholds,
} from '../types/api-contracts';

export interface UseScreeningApiResult {
  isLoading: boolean;
  analyzeImage: (file: File, imageType?: ImageType) => Promise<MeasurementPayload>;
  fetchThresholds: () => Promise<ScreeningThresholds>;
}

const API_BASE_URL = (import.meta.env.VITE_PTOSIS_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function useScreeningApi(): UseScreeningApiResult {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const analyzeImage = useCallback(async (file: File, imageType: ImageType = 'fullface'): Promise<MeasurementPayload> => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('image_type', imageType);
      formData.append('client_timestamp', new Date().toISOString());

      const response = await fetch(`${API_BASE_URL}/api/v1/screening/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const payload: MeasurementPayload = await response.json();
        return payload;
      }

      if (response.status === 422) {
        const errorData = await response.json();
        const rejection: QualityRejection = errorData.detail || errorData;
        const err = new Error(rejection.rejection_message_vi || 'Hình ảnh không đạt tiêu chuẩn sàng lọc.');
        (err as unknown as { rejection: QualityRejection }).rejection = rejection;
        throw err;
      }

      if (response.status === 400) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Không thể giải mã dữ liệu ảnh gửi lên.');
      }

      throw new Error(`Máy chủ phản hồi với mã trạng thái ${response.status}. Vui lòng thử lại sau.`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchThresholds = useCallback(async (): Promise<ScreeningThresholds> => {
    const response = await fetch(`${API_BASE_URL}/api/v1/config/thresholds`);
    if (!response.ok) {
      throw new Error('Không thể tải bảng thông số cấu hình ngưỡng.');
    }
    return response.json();
  }, []);

  return { isLoading, analyzeImage, fetchThresholds };
}
