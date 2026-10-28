/**
 * Thành phần Hiển thị Thông cáo Miễn trừ Trách nhiệm Y tế Bắt buộc (FR-029).
 * Xuất hiện trên 100% màn hình kết quả và chân trang.
 * Tuân thủ tuyệt đối G4: Không dùng từ ngữ thuộc danh mục cấm.
 */

import React from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface SafetyDisclaimerProps {
  variant?: 'banner' | 'card' | 'compact';
  customDisclaimer?: string;
}

export const SafetyDisclaimer: React.FC<SafetyDisclaimerProps> = ({
  variant = 'card',
  customDisclaimer,
}) => {
  const defaultText =
    customDisclaimer ||
    'Kết quả này chỉ mang tính sàng lọc hình thái ban đầu, không thay thế ' +
    'thăm khám y khoa chuyên sâu. Vui lòng tham vấn chuyên gia hoặc bác sĩ ' +
    'chuyên khoa mắt khi có băn khoăn.';

  if (variant === 'compact') {
    return (
      <div className="flex items-start space-x-2 text-[11px] text-[#267A78] dark:text-[#6FB4AF] leading-relaxed">
        <ShieldCheck className="w-3.5 h-3.5 text-[#00AB9B] shrink-0 mt-0.5" />
        <span>{defaultText}</span>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="w-full bg-[#E1F4F0] dark:bg-[#122D32] border-y border-[#B8E8DF] dark:border-[#1A3F45] py-2.5 px-4 text-xs text-[#00545D] dark:text-[#F9F8F2] flex items-center justify-center space-x-2">
        <AlertTriangle className="w-4 h-4 text-[#F2C66D] shrink-0" />
        <span className="font-medium text-center">{defaultText}</span>
      </div>
    );
  }

  // Variant 'card' (mặc định hiển thị nổi bật trên màn hình kết quả)
  return (
    <div className="w-full rounded-2xl bg-[#E1F4F0]/70 dark:bg-[#0D2327]/90 border border-[#B8E8DF] dark:border-[#1A3F45] p-5 shadow-xs transition-colors duration-250">
      <div className="flex items-start space-x-3.5">
        <div className="w-9 h-9 rounded-xl bg-[#00AB9B]/15 dark:bg-[#00AB9B]/20 border border-[#00AB9B]/30 flex items-center justify-center text-[#00AB9B] shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="space-y-1.5 flex-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#00545D] dark:text-[#F9F8F2] flex items-center space-x-1.5">
            <span>Thông cáo An toàn & Miễn trừ Y tế</span>
            <span className="text-[10px] px-2 py-0.2 rounded-full bg-[#00AB9B]/15 text-[#00AB9B] font-semibold lowercase">
              quy định bắt buộc
            </span>
          </h4>
          <p className="text-xs text-[#00545D] dark:text-[#F9F8F2] leading-relaxed font-medium">
            {defaultText}
          </p>
          <p className="text-[11px] text-[#267A78] dark:text-[#6FB4AF] leading-relaxed">
            PtosisCheck là hệ thống hỗ trợ định lượng hình thái qua ảnh chụp quang học tự phục vụ,
            không đưa ra kết luận điều trị và không liên kết thông tin cá nhân.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SafetyDisclaimer;
