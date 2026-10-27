/**
 * Component Modal thông báo vi phạm Cổng Sàng lọc Chất lượng Lâm sàng (QualityErrorModal).
 * Hiển thị lý do từ chối cụ thể kèm hướng dẫn chụp lại bằng tiếng Việt (FR-010).
 * Tuân thủ chuẩn thẩm mỹ RemiCare Brand Guidelines và hỗ trợ Dark Mode.
 * Tuân thủ G4: Tuyệt đối không dùng từ ngữ thuộc danh mục cấm.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  RotateCcw,
  X,
  ChevronDown,
  ChevronUp,
  Camera,
  Sun,
  Eye,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import type { QualityRejection } from '../../types/api-contracts';

interface QualityErrorModalProps {
  rejection: QualityRejection;
  onRetry: () => void;
  onClose?: () => void;
}

export const QualityErrorModal: React.FC<QualityErrorModalProps> = ({
  rejection,
  onRetry,
  onClose,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  // Gợi ý hướng dẫn tương ứng với từng mã lỗi
  const getGuidanceItems = (reason: string) => {
    switch (reason) {
      case 'HEAD_ROLL_EXCEEDED':
      case 'HEAD_YAW_EXCEEDED':
      case 'HEAD_PITCH_EXCEEDED':
        return [
          {
            icon: Compass,
            text: 'Giữ đầu thẳng thăng bằng, nhìn trực diện vào chấm camera.',
          },
          {
            icon: Camera,
            text: 'Cầm điện thoại ngang tầm mắt, không ngửa cằm hoặc cúi đầu.',
          },
        ];
      case 'BLUR_DETECTED':
        return [
          {
            icon: Camera,
            text: 'Cầm chắc máy bằng hai tay hoặc tựa tay vào mặt bàn để chống rung.',
          },
          {
            icon: Eye,
            text: 'Chạm vào màn hình để lấy nét rõ ràng vào vùng hai mắt trước khi chụp.',
          },
        ];
      case 'TOO_DARK':
      case 'TOO_BRIGHT':
      case 'GLARE_DETECTED':
        return [
          {
            icon: Sun,
            text: 'Chụp trong phòng đủ sáng với nguồn sáng tán xạ tự nhiên.',
          },
          {
            icon: AlertTriangle,
            text: 'Tránh chụp ngược sáng hoặc để đèn/flash chiếu gắt trực tiếp vào mắt gây lóa mống mắt.',
          },
        ];
      case 'EYES_CLOSED':
        return [
          {
            icon: Eye,
            text: 'Mở mắt to tự nhiên, nhìn thẳng về phía trước.',
          },
          {
            icon: CheckCircle2,
            text: 'Thả lỏng cơ mặt, tránh chớp mắt hoặc nheo mi khi bấm chụp.',
          },
        ];
      case 'OCULAR_REGION_TOUCHES_IMAGE_EDGE':
        return [
          {
            icon: Camera,
            text: 'Căn chỉnh khuôn mặt vào chính giữa khung hình, cách đều các cạnh.',
          },
          {
            icon: Eye,
            text: 'Đảm bảo trọn vẹn cả hai mắt và lông mày không bị che khuất hoặc sát viền ảnh.',
          },
        ];
      case 'REFLEX_GLARE_ARTIFACT':
        return [
          {
            icon: Sun,
            text: 'Tránh chụp dưới đèn tuýp LED hoặc nguồn sáng dài gây vệt lóa trên mắt.',
          },
          {
            icon: AlertTriangle,
            text: 'Chuyển hướng nhìn lệch nhẹ khỏi nguồn sáng chói trực tiếp và chụp lại.',
          },
        ];
      case 'REFLEX_AMBIGUOUS_CLUSTER':
        return [
          {
            icon: Sun,
            text: 'Tắt bớt nguồn sáng phụ hoặc đèn chùm gây hiện tượng phản xạ kép trên giác mạc.',
          },
          {
            icon: CheckCircle2,
            text: 'Ưu tiên một nguồn sáng chính duy nhất từ phía trước mặt.',
          },
        ];
      case 'LOW_RESOLUTION':
      default:
        return [
          {
            icon: Camera,
            text: 'Đưa camera lại gần mặt hơn (khoảng một cánh tay, 50 - 70 cm).',
          },
          {
            icon: CheckCircle2,
            text: 'Đảm bảo khuôn mặt và hai mắt nằm trọn vẹn trong khung hình.',
          },
        ];
    }
  };

  const getSpecificTitle = (reason: string) => {
    switch (reason) {
      case 'OCULAR_REGION_TOUCHES_IMAGE_EDGE':
        return 'Mắt Bị Sát Viền Ảnh - Vui Lòng Căn Giữa';
      case 'REFLEX_GLARE_ARTIFACT':
        return 'Mống Mắt Có Vệt Lóa Dài - Vui Lòng Chụp Lại';
      case 'REFLEX_AMBIGUOUS_CLUSTER':
        return 'Nhiều Đốm Sáng Gây Nhiễu - Vui Lòng Đổi Góc Sáng';
      case 'BLUR_DETECTED':
        return 'Ảnh Bị Mờ Nhòe - Vui Lòng Chụp Lại';
      case 'HEAD_ROLL_EXCEEDED':
        return 'Đầu Bị Nghiêng - Vui Lòng Giữ Thẳng Đầu';
      case 'HEAD_YAW_EXCEEDED':
        return 'Đầu Quay Sang Bên - Vui Lòng Nhìn Thẳng Trực Diện';
      case 'HEAD_PITCH_EXCEEDED':
        return 'Cằm Ngửa / Cúi - Vui Lòng Giữ Thẳng Đầu';
      case 'TOO_DARK':
        return 'Ảnh Quá Tối - Vui Lòng Chụp Nơi Đủ Sáng';
      case 'TOO_BRIGHT':
        return 'Ảnh Quá Sáng / Lóa - Vui Lòng Giảm Bớt Ánh Sáng';
      case 'GLARE_DETECTED':
        return 'Mắt Bị Lóa Sáng - Vui Lòng Tránh Đèn Chiếu Gắt';
      case 'EYES_CLOSED':
        return 'Mắt Đang Nhắm / Nheo - Vui Lòng Mở Mắt Tự Nhiên';
      case 'LOW_RESOLUTION':
        return 'Ảnh Quá Nhỏ / Xa - Vui Lòng Đưa Máy Lại Gần Hơn';
      case 'NO_FACE_DETECTED':
        return 'Không Thấy Khuôn Mặt - Vui Lòng Chụp Lại Rõ Ràng';
      default:
        return 'Ảnh Chưa Đạt Tiêu Chuẩn - Vui Lòng Chụp Lại';
    }
  };

  const guidanceItems = getGuidanceItems(rejection.rejection_reason);
  const specificTitle = getSpecificTitle(rejection.rejection_reason);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0D2327] rounded-2xl border border-[#F28C7B]/50 dark:border-[#F28C7B]/40 shadow-2xl overflow-hidden transition-all transform scale-100">
        {/* Nút đóng góc trên nếu có */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-[#267A78] dark:text-[#6FB4AF] hover:bg-[#E1F4F0] dark:hover:bg-[#122D32] transition cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Phần Header Cảnh báo */}
        <div className="p-6 sm:p-7 space-y-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-[#F28C7B]/15 border border-[#F28C7B]/40 flex items-center justify-center text-[#F28C7B] shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#F2C66D]/20 text-[#00545D] dark:text-[#F2C66D] border border-[#F2C66D]/60">
                  {rejection.rejection_reason}
                </span>
                <span className="text-[11px] text-[#267A78] dark:text-[#6FB4AF] font-medium">
                  Cổng Chất lượng Hình ảnh
                </span>
              </div>
              <h3 className="text-lg font-bold text-[#00545D] dark:text-[#F9F8F2] mt-1">
                {specificTitle}
              </h3>
            </div>
          </div>

          {/* Thông điệp tiếng Việt cụ thể (FR-010) */}
          <div className="p-4 rounded-xl bg-[#E1F4F0]/70 dark:bg-[#122D32]/70 border border-[#B8E8DF] dark:border-[#1A3F45]">
            <p className="text-sm font-semibold text-[#00545D] dark:text-[#F9F8F2] leading-relaxed">
              {rejection.rejection_message_vi}
            </p>
          </div>

          {/* Hướng dẫn khắc phục từng bước */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#267A78] dark:text-[#6FB4AF]">
              Hướng dẫn chụp lại đạt chuẩn:
            </h4>
            <div className="space-y-2">
              {guidanceItems.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-start space-x-2.5 text-xs text-[#00545D] dark:text-[#F9F8F2]"
                  >
                    <IconComponent className="w-4 h-4 text-[#00AB9B] shrink-0 mt-0.5" />
                    <span>{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mục Chi tiết Kỹ thuật có thể mở rộng */}
          {rejection.audit_details && Object.keys(rejection.audit_details).length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="flex items-center justify-between w-full text-[11px] font-semibold text-[#267A78] dark:text-[#6FB4AF] hover:text-[#00545D] dark:hover:text-[#F9F8F2] py-1 cursor-pointer transition"
              >
                <span>Thông số kỹ thuật kiểm định ({rejection.rejection_reason})</span>
                {showTechnicalDetails ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showTechnicalDetails && (
                <pre className="mt-2 p-3 rounded-lg bg-[#00545D] dark:bg-[#040C0E] text-[#B8E8DF] dark:text-[#6FB4AF] font-mono text-[10px] overflow-x-auto max-h-36 leading-relaxed border border-[#00545D] dark:border-[#1A3F45]">
                  {JSON.stringify(rejection.audit_details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Nút hành động */}
        <div className="p-4 sm:p-6 bg-[#E1F4F0]/40 dark:bg-[#071619]/60 border-t border-[#B8E8DF] dark:border-[#1A3F45] flex items-center justify-end space-x-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#267A78] dark:text-[#6FB4AF] hover:bg-[#E1F4F0] dark:hover:bg-[#122D32] border border-[#B8E8DF] dark:border-[#1A3F45] transition cursor-pointer"
            >
              Hủy
            </button>
          )}

          <button
            type="button"
            onClick={onRetry}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#00AB9B] hover:bg-[#267A78] text-[#F9F8F2] text-xs font-bold shadow-remi-button transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Chụp lại ảnh</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QualityErrorModal;
