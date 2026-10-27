/**
 * Định nghĩa trạng thái cho cỗ máy trạng thái (State Machine) luồng sàng lọc hình thái mi mắt.
 * Tuân thủ G4: Tuyệt đối không dùng từ ngữ thuộc danh mục cấm.
 */

import type { MeasurementPayload, QualityRejection } from './api-contracts';

export type ScreeningStep =
  | 'CONSENT'
  | 'READY_TO_CAPTURE'
  | 'ANALYZING'
  | 'RESULT'
  | 'ERROR';

export interface ScreeningError {
  type: 'CLIENT_VALIDATION' | 'QUALITY_GATE' | 'NETWORK' | 'SERVER';
  title: string;
  message: string;
  rejection?: QualityRejection;
}

export interface ScreeningState {
  currentStep: ScreeningStep;
  hasConsented: boolean;
  selectedFile: File | null;
  previewUrl: string | null;
  measurementPayload: MeasurementPayload | null;
  error: ScreeningError | null;
}
