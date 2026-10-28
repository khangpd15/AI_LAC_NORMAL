import React, { useEffect, useState } from 'react';
import { Download, X, RefreshCw, Share } from 'lucide-react';

/**
 * PwaManager Component
 * Quản lý vòng đời PWA:
 * 1. Đăng ký service worker /sw.js
 * 2. Bắt sự kiện beforeinstallprompt để hiển thị thanh cài đặt kín đáo
 * 3. Hướng dẫn iOS Safari "Thêm vào màn hình chính"
 * 4. Nhắc cập nhật phiên bản mới
 */
export default function PwaManager() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  // 1. Đăng ký Service Worker & Theo dõi bản cập nhật
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            // Kiểm tra nếu đã có worker đang waiting
            if (reg.waiting) {
              setWaitingWorker(reg.waiting);
              setNewVersionAvailable(true);
            }

            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    setWaitingWorker(newWorker);
                    setNewVersionAvailable(true);
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.debug('[PWA] ServiceWorker registration skipped/failed:', err);
          });
      });
    }
  }, []);

  // 2. Lắng nghe sự kiện beforeinstallprompt (Chrome / Android / Edge)
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);

      // Kiểm tra xem người dùng đã từ chối gần đây chưa
      const dismissedTime = localStorage.getItem('remicare_pwa_dismissed');
      const now = Date.now();
      if (!dismissedTime || now - Number(dismissedTime) > 7 * 24 * 60 * 60 * 1000) {
        setShowInstallBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // 3. Kiểm tra iOS Safari chưa cài PWA
  const isIos =
    typeof window !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !window.MSStream;
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowInstallBanner(false);
      }
      setInstallPrompt(null);
    } else if (isIos) {
      setShowIosGuide(true);
      setShowInstallBanner(false);
    }
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem('remicare_pwa_dismissed', String(Date.now()));
  };

  const handleUpdateApp = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  return (
    <>
      {/* Toast thông báo phiên bản mới */}
      {newVersionAvailable && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[1200] p-4 bg-[#00545D] text-white rounded-2xl shadow-2xl border border-[#B8E8DF]/40 flex items-center justify-between gap-3 animate-fade-in"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#00AB9B]/30 flex items-center justify-center flex-shrink-0 text-[#B8E8DF]">
              <RefreshCw className="w-5 h-5 animate-spin" />
            </div>
            <div className="min-w-0">
              <strong className="block text-sm font-bold truncate">Đã có phiên bản mới</strong>
              <span className="text-xs text-[#B8E8DF] block">Cập nhật ngay để trải nghiệm tốt nhất</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleUpdateApp}
            className="flex-shrink-0 px-4 py-2 bg-[#00AB9B] hover:bg-[#267A78] text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
          >
            Tải lại
          </button>
        </div>
      )}

      {/* Banner cài đặt ứng dụng (kín đáo, không che nội dung chính) */}
      {showInstallBanner && !isStandalone && (
        <div
          className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-sm z-[1150] p-3.5 bg-white dark:bg-[#1E293B] border border-[#B8E8DF] dark:border-[#334155] rounded-2xl shadow-xl flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/icons/icon-192x192.png"
              alt="RemiCare AI Logo"
              className="w-10 h-10 rounded-xl object-contain border border-[#B8E8DF]/50 flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#00545D] dark:text-[#F9F8F2] truncate">
                Cài đặt RemiCare AI
              </div>
              <div className="text-[11px] text-[#3a565c] dark:text-[#94A3B8] truncate">
                Mở nhanh từ màn hình chính
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00AB9B] hover:bg-[#267A78] text-white text-xs font-bold rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Cài</span>
            </button>
            <button
              type="button"
              onClick={handleDismissInstall}
              className="w-7 h-7 flex items-center justify-center text-[#94A3B8] hover:text-[#00545D] dark:hover:text-white rounded-lg transition"
              aria-label="Đóng thông báo cài đặt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal hướng dẫn cho iOS Safari */}
      {showIosGuide && (
        <div
          className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowIosGuide(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#1E293B] rounded-3xl p-6 text-center space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#E1F4F0] text-[#00AB9B] mx-auto flex items-center justify-center">
              <Share className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#00545D] dark:text-[#F9F8F2]">
              Cài đặt trên iOS Safari
            </h3>
            <ol className="text-xs text-left text-[#3a565c] dark:text-[#94A3B8] space-y-2 list-decimal list-inside bg-[#F8F9FA] dark:bg-[#0F172A] p-4 rounded-xl">
              <li>Chạm vào biểu tượng <strong>Chia sẻ (Share) ⎋</strong> ở thanh dưới trình duyệt.</li>
              <li>Cuộn danh sách xuống và chọn <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong>.</li>
              <li>Chọn <strong>Thêm (Add)</strong> ở góc trên bên phải để hoàn tất.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 bg-[#00AB9B] text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
}
