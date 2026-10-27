/**
 * Màn hình Kết quả Tổng thể Sàng lọc Hình thái Mi mắt (Module M8 / ResultScreen).
 * Tích hợp toàn diện:
 * 1. Thẻ phân tầng kết quả 3 mức (TierCard)
 * 2. Lớp phủ vector 2D trên ảnh gốc (AnnotatedCanvas)
 * 3. Accordion chi tiết số đo và dung sai kỹ thuật số (MeasurementDetails)
 * 4. Thông cáo an toàn y tế bắt buộc (SafetyDisclaimer)
 * 5. Nút điều khiển "Sàng lọc lại"
 * Tuân thủ tuyệt đối G4: Không dùng từ ngữ thuộc danh mục cấm.
 */

import React from 'react';
import { RotateCcw, Clock, Hash } from 'lucide-react';
import type { MeasurementPayload } from '../../types/api-contracts';
import { TierCard } from './TierCard';
import { AnnotatedCanvas } from './AnnotatedCanvas';
import { MeasurementDetails } from './MeasurementDetails';
import { SafetyDisclaimer } from '../common/SafetyDisclaimer';

interface ResultScreenProps {
  payload: MeasurementPayload;
  selectedFile: File | null;
  onReset: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  payload,
  selectedFile,
  onReset,
}) => {
  const formattedTime = new Date(payload.timestamp).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Thanh Meta thông tin phiên sàng lọc */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 text-xs text-[#267A78] dark:text-[#6FB4AF]">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <Hash className="w-3.5 h-3.5 text-[#00AB9B]" />
            <span className="font-mono text-[11px]">
              Phiên: {payload.session_id.slice(0, 8)}...
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-[#00AB9B]" />
            <span>{formattedTime}</span>
          </div>
        </div>

        <button
          onClick={onReset}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#E1F4F0] dark:bg-[#122D32] hover:bg-[#B8E8DF] dark:hover:bg-[#163940] text-[#00545D] dark:text-[#F9F8F2] text-xs font-semibold border border-[#B8E8DF] dark:border-[#1A3F45] transition cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#00AB9B]" />
          <span>Sàng lọc lại với ảnh khác</span>
        </button>
      </div>

      {/* 1. Thẻ kết quả phân tầng 3 mức (TierCard) */}
      {payload.triage_result && <TierCard triage={payload.triage_result} />}

      {/* 2. Lớp phủ đồ họa Canvas 2D mốc giải phẫu */}
      <AnnotatedCanvas
        imageFile={selectedFile}
        overlay={payload.annotated_overlay_coordinates}
        measurements={payload.measurements}
      />

      {/* 3. Bảng đo lường bán định lượng và dung sai kỹ thuật số */}
      <MeasurementDetails payload={payload} />

      {/* 4. Thông cáo miễn trừ an toàn y tế bắt buộc (FR-029) */}
      <SafetyDisclaimer
        customDisclaimer={payload.triage_result?.safety_disclaimer_vi}
      />

      {/* Nút thao tác chân trang */}
      <div className="flex justify-center pt-2 pb-6">
        <button
          onClick={onReset}
          className="px-8 py-3 rounded-xl bg-[#00AB9B] hover:bg-[#267A78] text-[#F9F8F2] text-sm font-semibold transition cursor-pointer shadow-remi-button flex items-center space-x-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Thực hiện sàng lọc mới</span>
        </button>
      </div>
    </div>
  );
};

export default ResultScreen;
