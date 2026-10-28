import React, { useState } from 'react';
import { ShieldCheck, Lock, Eye, AlertCircle, ArrowRight } from 'lucide-react';

/**
 * Shared Privacy & Security Consent Component
 * Tuân thủ chuẩn Zero-Retention RAM và phong cách thiết kế RemiCare AI.
 * Dùng chung cho cả Sàng lọc Lác / Lé và Sàng lọc Sụp mí.
 */
export default function PrivacyConsentCard({
  title = 'Cam kết Quyền riêng tư & Bảo mật',
  subtitle = 'Xử lý hoàn toàn trong bộ nhớ khả biến (In-Memory Zero-Retention)',
  noStorageTitle = 'Không lưu trữ vĩnh viễn:',
  noStorageDesc = 'Ảnh/khung hình của bạn được xử lý trực tiếp trong bộ nhớ RAM máy chủ và bị giải phóng ngay khi hoàn tất phép đo. Hệ thống không ghi ảnh xuống ổ đĩa, không lưu trữ cơ sở dữ liệu.',
  purposeTitle = 'Mục đích sử dụng:',
  purposeDesc,
  safetyTitle = 'Thông cáo an toàn:',
  safetyDesc = 'Kết quả chỉ mang tính tham khảo sàng lọc, không thay thế cho việc thăm khám trực tiếp tại cơ sở chuyên khoa mắt.',
  checkboxLabel,
  buttonText = 'Bắt đầu sàng lọc',
  buttonId = 'btn-confirm-consent',
  checkboxId = 'consent-checkbox',
  onAccept,
}) {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <div className="w-full max-w-2xl mx-auto p-5 sm:p-8 bg-white dark:bg-[#0D2327] border border-[#B8E8DF] dark:border-[#1A3F45] rounded-2xl shadow-remi-card dark:shadow-remi-card-dark text-[#00545D] dark:text-[#F9F8F2] transition-colors duration-250">
      {/* Header icon & Title */}
      <div className="flex items-center space-x-3.5 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#E1F4F0] dark:bg-[#122D32] border border-[#B8E8DF] dark:border-[#1A3F45] flex items-center justify-center text-[#00AB9B] shadow-sm flex-shrink-0">
          <ShieldCheck className="w-7 h-7" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#00545D] dark:text-[#F9F8F2]">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-[#267A78] dark:text-[#6FB4AF] font-medium mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>

      {/* 3 khối thông tin cam kết */}
      <div className="space-y-3.5 sm:space-y-4 mb-6 text-sm leading-relaxed">
        {/* Khối 1: Không lưu trữ vĩnh viễn */}
        <div className="flex items-start space-x-3 p-3.5 bg-[#E1F4F0]/60 dark:bg-[#122D32]/50 rounded-xl border border-[#B8E8DF]/70 dark:border-[#1A3F45]">
          <Lock className="w-5 h-5 text-[#00AB9B] flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[#00545D] dark:text-[#F9F8F2] m-0">
            <strong className="text-[#00545D] dark:text-[#F9F8F2] font-semibold">{noStorageTitle}</strong>{' '}
            {noStorageDesc}
          </p>
        </div>

        {/* Khối 2: Mục đích sử dụng */}
        <div className="flex items-start space-x-3 p-3.5 bg-[#E1F4F0]/60 dark:bg-[#122D32]/50 rounded-xl border border-[#B8E8DF]/70 dark:border-[#1A3F45]">
          <Eye className="w-5 h-5 text-[#00AB9B] flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[#00545D] dark:text-[#F9F8F2] m-0">
            <strong className="text-[#00545D] dark:text-[#F9F8F2] font-semibold">{purposeTitle}</strong>{' '}
            {purposeDesc}
          </p>
        </div>

        {/* Khối 3: Thông cáo an toàn */}
        <div className="flex items-start space-x-3 p-3.5 bg-[#F2C66D]/15 dark:bg-[#F2C66D]/10 rounded-xl border border-[#F2C66D]/50 dark:border-[#F2C66D]/30 text-[#00545D] dark:text-[#F9F8F2]">
          <AlertCircle className="w-5 h-5 text-[#267A78] dark:text-[#F2C66D] flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs sm:text-sm m-0">
            <strong className="text-[#00545D] dark:text-[#F2C66D] font-semibold">{safetyTitle}</strong>{' '}
            {safetyDesc}
          </p>
        </div>
      </div>

      {/* Checkbox đồng ý */}
      <div className="pt-4 border-t border-[#B8E8DF] dark:border-[#1A3F45]">
        <label
          htmlFor={checkboxId}
          className="flex items-start space-x-3.5 cursor-pointer select-none group min-h-[44px] py-1"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-[#B8E8DF] dark:border-[#1A3F45] bg-[#F9F8F2] dark:bg-[#071619] text-[#00AB9B] focus:ring-2 focus:ring-[#00AB9B]/40 focus:ring-offset-0 transition cursor-pointer flex-shrink-0"
          />
          <span className="text-xs sm:text-sm text-[#00545D] dark:text-[#F9F8F2] group-hover:text-[#267A78] dark:group-hover:text-[#6FB4AF] transition font-medium">
            {checkboxLabel}
          </span>
        </label>
      </div>

      {/* Nút hành động */}
      <div className="mt-6 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
        <button
          id={buttonId}
          type="button"
          disabled={!isChecked}
          aria-disabled={!isChecked}
          onClick={() => {
            if (isChecked && onAccept) {
              onAccept();
            }
          }}
          className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-7 py-3.5 min-h-[48px] rounded-xl font-semibold text-sm transition-all duration-200 ${
            isChecked
              ? 'bg-[#00AB9B] text-[#F9F8F2] hover:bg-[#267A78] shadow-remi-button cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[#00AB9B] focus:ring-offset-2'
              : 'bg-[#B8E8DF]/50 dark:bg-[#1A3F45]/50 text-[#267A78]/60 dark:text-[#6FB4AF]/50 border border-[#B8E8DF] dark:border-[#1A3F45] cursor-not-allowed opacity-60'
          }`}
        >
          <span>{buttonText}</span>
          <ArrowRight className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
