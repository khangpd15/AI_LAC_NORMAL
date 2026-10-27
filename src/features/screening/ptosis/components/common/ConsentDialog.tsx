/**
 * Hộp thoại đồng ý quyền riêng tư và xử lý dữ liệu sinh trắc học tạm thời (SP-004).
 * Thiết kế giao diện hỗ trợ cả hai chế độ Sáng / Tối theo RemiCare Brand Guidelines.
 * Tuân thủ G4: Tuyệt đối không dùng từ ngữ thuộc danh mục cấm.
 */

import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, AlertCircle, ArrowRight } from 'lucide-react';

interface ConsentDialogProps {
  onAccept: () => void;
}

export const ConsentDialog: React.FC<ConsentDialogProps> = ({ onAccept }) => {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <div className="w-full max-w-2xl mx-auto p-6 sm:p-8 bg-white dark:bg-[#0D2327] border border-[#B8E8DF] dark:border-[#1A3F45] rounded-2xl shadow-remi-card dark:shadow-remi-card-dark text-[#00545D] dark:text-[#F9F8F2] transition-colors duration-250">
      {/* Header icon & Title */}
      <div className="flex items-center space-x-3.5 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#E1F4F0] dark:bg-[#122D32] border border-[#B8E8DF] dark:border-[#1A3F45] flex items-center justify-center text-[#00AB9B] shadow-sm">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#00545D] dark:text-[#F9F8F2]">
            Cam kết Quyền Riêng tư & Bảo mật
          </h2>
          <p className="text-xs sm:text-sm text-[#267A78] dark:text-[#6FB4AF] font-medium">
            Xử lý hoàn toàn trong bộ nhớ khả biến (In-Memory Zero-Retention)
          </p>
        </div>
      </div>

      {/* Thông tin cam kết */}
      <div className="space-y-4 mb-6 text-sm leading-relaxed">
        <div className="flex items-start space-x-3 p-3.5 bg-[#E1F4F0]/60 dark:bg-[#122D32]/50 rounded-xl border border-[#B8E8DF]/70 dark:border-[#1A3F45]">
          <Lock className="w-5 h-5 text-[#00AB9B] flex-shrink-0 mt-0.5" />
          <p className="text-[#00545D] dark:text-[#F9F8F2]">
            <strong className="text-[#00545D] dark:text-[#F9F8F2] font-semibold">Không lưu trữ vĩnh viễn:</strong> Ảnh của bạn được xử lý trực tiếp trong bộ nhớ RAM máy chủ và bị giải phóng tức thì ngay khi hoàn tất phép đo. Hệ thống không ghi ảnh xuống ổ đĩa, không lưu trữ cơ sở dữ liệu.
          </p>
        </div>

        <div className="flex items-start space-x-3 p-3.5 bg-[#E1F4F0]/60 dark:bg-[#122D32]/50 rounded-xl border border-[#B8E8DF]/70 dark:border-[#1A3F45]">
          <Eye className="w-5 h-5 text-[#00AB9B] flex-shrink-0 mt-0.5" />
          <p className="text-[#00545D] dark:text-[#F9F8F2]">
            <strong className="text-[#00545D] dark:text-[#F9F8F2] font-semibold">Mục đích sử dụng:</strong> Ảnh chỉ được dùng để tính toán các chỉ số hình thái mi mắt bán định lượng phục vụ sàng lọc hỗ trợ ban đầu.
          </p>
        </div>

        {/* Thông cáo an toàn với Soft Amber Accent (#F2C66D) */}
        <div className="flex items-start space-x-3 p-3.5 bg-[#F2C66D]/15 dark:bg-[#F2C66D]/10 rounded-xl border border-[#F2C66D]/50 dark:border-[#F2C66D]/30 text-[#00545D] dark:text-[#F9F8F2]">
          <AlertCircle className="w-5 h-5 text-[#267A78] dark:text-[#F2C66D] flex-shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm">
            <strong className="text-[#00545D] dark:text-[#F2C66D] font-semibold">Thông cáo an toàn:</strong> Kết quả chỉ mang tính tham khảo sàng lọc hình thái học, không thay thế cho việc thăm khám trực tiếp tại cơ sở chuyên khoa mắt.
          </p>
        </div>
      </div>

      {/* Hộp kiểm đồng ý (SP-004) */}
      <div className="pt-4 border-t border-[#B8E8DF] dark:border-[#1A3F45]">
        <label className="flex items-start space-x-3.5 cursor-pointer select-none group">
          <input
            id="consent-checkbox"
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-[#B8E8DF] dark:border-[#1A3F45] bg-[#F9F8F2] dark:bg-[#071619] text-[#00AB9B] focus:ring-2 focus:ring-[#00AB9B]/40 focus:ring-offset-0 transition cursor-pointer"
          />
          <span className="text-xs sm:text-sm text-[#00545D] dark:text-[#F9F8F2] group-hover:text-[#267A78] dark:group-hover:text-[#6FB4AF] transition font-medium">
            Tôi đã đọc, hiểu rõ chính sách bảo vệ dữ liệu và đồng ý cung cấp hình ảnh phục vụ sàng lọc hình thái học mi mắt.
          </span>
        </label>
      </div>

      {/* Nút hành động */}
      <div className="mt-6 flex justify-end">
        <button
          id="btn-confirm-consent"
          disabled={!isChecked}
          onClick={onAccept}
          className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
            isChecked
              ? 'bg-[#00AB9B] text-[#F9F8F2] hover:bg-[#267A78] shadow-remi-button cursor-pointer transform hover:-translate-y-0.5'
              : 'bg-[#B8E8DF]/50 dark:bg-[#1A3F45]/50 text-[#267A78]/60 dark:text-[#6FB4AF]/50 border border-[#B8E8DF] dark:border-[#1A3F45] cursor-not-allowed opacity-60'
          }`}
        >
          <span>Bắt đầu sàng lọc</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
