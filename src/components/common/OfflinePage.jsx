import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function OfflinePage() {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-lg mx-auto p-6 sm:p-8 my-8 sm:my-16 bg-white dark:bg-[#1E293B] border border-[#B8E8DF] dark:border-[#334155] rounded-3xl shadow-remi-card text-center space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-[#E1F4F0] dark:bg-[#122D32] border border-[#B8E8DF] text-[#00AB9B] mx-auto flex items-center justify-center">
        <WifiOff className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-extrabold text-[#00545D] dark:text-[#F9F8F2] tracking-tight">
        Không có kết nối mạng
      </h1>
      <p className="text-sm text-[#3a565c] dark:text-[#94A3B8] leading-relaxed">
        Quy trình sàng lọc thị lực bằng AI (phân tích Hirschberg, Cover Test và MRD-1) cần gửi dữ liệu xử lý trong bộ nhớ RAM máy chủ.
      </p>
      <div className="p-3.5 bg-[#FFF8E6] dark:bg-[#F2C66D]/10 border border-[#F2C66D] rounded-xl text-xs text-[#704800] dark:text-[#F2C66D] text-left">
        ℹ️ Vui lòng kiểm tra lại kết nối Wi-Fi hoặc dữ liệu di động (4G/5G) của thiết bị để tiếp tục sử dụng.
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#00AB9B] hover:bg-[#267A78] text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Thử kết nối lại</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center justify-center px-6 py-3 bg-[#E1F4F0] dark:bg-[#122D32] text-[#00545D] dark:text-[#B8E8DF] font-semibold text-sm rounded-xl transition cursor-pointer"
        >
          Về Trang chủ
        </button>
      </div>
    </div>
  );
}
