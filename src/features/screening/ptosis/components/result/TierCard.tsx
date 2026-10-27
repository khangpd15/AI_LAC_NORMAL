/**
 * Thẻ Hiển thị Phân tầng Kết quả Sàng lọc 3 Mức (Module M8 / FR-022, FR-026, FR-027, FR-028).
 * Mức A: Nền xanh ngọc / lá - Không phát hiện bất thường
 * Mức B: Nền vàng hổ phách - Dấu hiệu nghi ngờ / Ranh giới
 * Mức C: Nền đỏ san hô - Khuyến nghị khám chuyên khoa mắt
 * Tuân thủ tuyệt đối G4: Không dùng từ ngữ thuộc danh mục cấm.
 */

import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  Info,
  Sparkles,
  Eye,
} from 'lucide-react';
import type { TriageResult } from '../../types/api-contracts';

interface TierCardProps {
  triage: TriageResult;
}

export const TierCard: React.FC<TierCardProps> = ({ triage }) => {
  const { tier, description_vi, recommendation_vi, is_bilateral_severe_triggered, flags, trigger_reasons } = triage;

  const isIndeterminate =
    trigger_reasons?.includes('REFLEX_NOT_VISIBLE_INDETERMINATE_QUALITY') ||
    trigger_reasons?.includes('INDETERMINATE_IMAGE_QUALITY');

  // Cấu hình giao diện theo từng mức phân tầng
  const config = {
    TIER_A: {
      badge: 'Mức A • Không phát hiện bất thường',
      title: 'Hình thái Mi mắt Trong Giới hạn Bình thường',
      bgCard: 'bg-emerald-500/10 dark:bg-emerald-950/30',
      borderCard: 'border-emerald-500/30 dark:border-emerald-500/40',
      badgeBg: 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40',
      iconBg: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      icon: <CheckCircle2 className="w-8 h-8" />,
      accentColor: 'text-emerald-700 dark:text-emerald-300',
    },
    TIER_B: {
      badge: isIndeterminate
        ? 'Mức B • Chưa xác định / Cần chụp lại'
        : 'Mức B • Dấu hiệu nghi ngờ / Cần theo dõi',
      title: isIndeterminate
        ? 'Chưa Xác định Do Điều kiện Ánh sáng'
        : 'Ghi nhận Dấu hiệu Ranh giới hoặc Chênh lệch Nhẹ',
      bgCard: 'bg-amber-500/10 dark:bg-amber-950/30',
      borderCard: 'border-amber-500/30 dark:border-amber-500/40',
      badgeBg: 'bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-500/40',
      iconBg: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
      icon: <AlertTriangle className="w-8 h-8" />,
      accentColor: 'text-amber-800 dark:text-amber-300',
    },
    TIER_C: {
      badge: 'Mức C • Khuyến nghị khám chuyên khoa mắt',
      title: 'Khuyến nghị Sớm Thăm khám Chuyên khoa Mắt',
      bgCard: 'bg-rose-500/10 dark:bg-rose-950/30',
      borderCard: 'border-rose-500/30 dark:border-rose-500/40',
      badgeBg: 'bg-rose-500/20 text-rose-900 dark:text-rose-300 border-rose-500/40',
      iconBg: 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/30',
      icon: <AlertOctagon className="w-8 h-8" />,
      accentColor: 'text-rose-800 dark:text-rose-300',
    },
  }[tier];

  return (
    <div
      className={`w-full rounded-2xl ${config.bgCard} border ${config.borderCard} p-6 sm:p-7 shadow-remi-card dark:shadow-remi-card-dark transition-all duration-250`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-black/5 dark:border-white/10">
        <div className="flex items-center space-x-3.5">
          <div className={`w-12 h-12 rounded-2xl ${config.iconBg} border flex items-center justify-center shrink-0`}>
            {config.icon}
          </div>
          <div>
            <span
              className={`inline-flex items-center text-[11px] font-bold px-3 py-0.5 rounded-full border uppercase tracking-wider ${config.badgeBg}`}
            >
              {config.badge}
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-[#00545D] dark:text-[#F9F8F2] mt-1">
              {config.title}
            </h3>
          </div>
        </div>
      </div>

      {/* Nội dung diễn giải phổ thông & Khuyến nghị định hướng */}
      <div className="mt-5 space-y-4">
        <div className="p-4 rounded-xl bg-white/70 dark:bg-[#071619]/60 border border-black/5 dark:border-white/5 space-y-1.5">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#267A78] dark:text-[#6FB4AF]">
            <Info className="w-3.5 h-3.5 text-[#00AB9B]" />
            <span>Mô tả kết quả ghi nhận</span>
          </div>
          <p className="text-sm sm:text-base text-[#00545D] dark:text-[#F9F8F2] leading-relaxed font-medium">
            {description_vi}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white/70 dark:bg-[#071619]/60 border border-black/5 dark:border-white/5 space-y-1.5">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#267A78] dark:text-[#6FB4AF]">
            <ArrowRight className="w-3.5 h-3.5 text-[#00AB9B]" />
            <span>Khuyến nghị định hướng tiếp theo</span>
          </div>
          <p className="text-sm text-[#00545D] dark:text-[#F9F8F2] leading-relaxed">
            {recommendation_vi}
          </p>
        </div>

        {/* Các cờ an toàn bổ trợ đặc biệt */}
        {(is_bilateral_severe_triggered ||
          flags?.is_brow_compensation_detected ||
          flags?.is_pupil_fallback_used ||
          isIndeterminate ||
          trigger_reasons?.includes('REFLEX_OCCLUDED_SEVERE')) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {is_bilateral_severe_triggered && (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-medium">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Kích hoạt chốt chặn an toàn: Cả hai mắt có độ mở mi hẹp</span>
              </span>
            )}
            {trigger_reasons?.includes('REFLEX_OCCLUDED_SEVERE') && (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-medium">
                <AlertOctagon className="w-3.5 h-3.5" />
                <span>Nghi ngờ bờ mi che phủ trục thị giác</span>
              </span>
            )}
            {isIndeterminate && (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Chưa xác định do chất lượng ảnh • Khuyến nghị chụp lại có flash</span>
              </span>
            )}
            {flags?.is_brow_compensation_detected && (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ghi nhận phản xạ nâng cung mày bù trừ</span>
              </span>
            )}
            {flags?.is_pupil_fallback_used && (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-[#E1F4F0] dark:bg-[#122D32] border border-[#B8E8DF] dark:border-[#1A3F45] text-[#00545D] dark:text-[#F9F8F2] text-xs font-medium">
                <Eye className="w-3.5 h-3.5 text-[#00AB9B]" />
                <span>Sử dụng mốc tâm đồng tử dự phòng do không có phản quang flash</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TierCard;
