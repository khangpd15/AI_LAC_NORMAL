/**
 * Thành phần WebRTC CameraView cho phép người dùng chụp ảnh trực tiếp (FR-001, NFR-003).
 * Tích hợp khung oval định vị mắt, lời nhắc tư thế và nút chụp ảnh.
 * Tuân thủ tuyệt đối G4: Không dùng từ ngữ thuộc danh mục cấm.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle, RefreshCw, Zap } from 'lucide-react';

interface CameraViewProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(true);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function startCamera() {
      setIsStarting(true);
      setCameraError(null);

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Trình duyệt không hỗ trợ truy cập camera qua WebRTC.');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }
      } catch (err: unknown) {
        const error = err as Error;
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setCameraError('Quyền truy cập camera bị từ chối. Vui lòng cho phép quyền trong cài đặt trình duyệt.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setCameraError('Không tìm thấy thiết bị camera trên thiết bị của bạn.');
        } else {
          setCameraError('Không thể khởi chạy camera: ' + (error.message || 'Lỗi không xác định'));
        }
      } finally {
        setIsStarting(false);
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleTakePhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Vẽ khung hình hiện tại từ video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture_${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });

        // Dừng camera và trả file
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        onCapture(file);
      },
      'image/jpeg',
      0.95
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-[#0D2327] border border-[#1A3F45] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Thanh Header Modal */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#1A3F45] bg-[#071619]/80">
          <div className="flex items-center space-x-2 text-white">
            <Camera className="w-4 h-4 text-[#00AB9B]" />
            <span className="text-sm font-bold">Chụp Ảnh Trực Tiếp Bằng Camera</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Khung Video & Khung Oval Căn Mặt */}
        <div className="relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
          {isStarting && (
            <div className="flex flex-col items-center space-y-3 text-white/80">
              <RefreshCw className="w-8 h-8 animate-spin text-[#00AB9B]" />
              <p className="text-xs">Đang khởi chạy camera...</p>
            </div>
          )}

          {cameraError && (
            <div className="p-6 text-center max-w-sm space-y-3">
              <AlertCircle className="w-10 h-10 text-[#F28C7B] mx-auto" />
              <p className="text-xs text-white/90 leading-relaxed">{cameraError}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#00AB9B] text-white text-xs font-semibold"
              >
                Chuyển sang Tải tệp ảnh
              </button>
            </div>
          )}

          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraError || isStarting ? 'hidden' : 'block'}`}
          />

          {/* Lớp phủ hướng dẫn căn mặt (Oval Guide Overlay) */}
          {!cameraError && !isStarting && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Khung oval nét đứt Remi Mint */}
              <div className="w-[62%] h-[78%] rounded-[50%] border-2 border-dashed border-[#00AB9B]/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center">
                {/* Đường dẫn ngang mắt */}
                <div className="w-full border-t border-dashed border-[#00AB9B]/40" />
              </div>

              {/* Lời nhắc hướng dẫn */}
              <div className="absolute bottom-4 px-4 py-1.5 rounded-full bg-black/75 backdrop-blur-md text-[11px] text-white/90 font-medium flex items-center space-x-2">
                <Zap className="w-3.5 h-3.5 text-[#F2C66D]" />
                <span>Đặt mắt nằm ngang theo đường dẫn và nhìn thẳng vào camera</span>
              </div>
            </div>
          )}
        </div>

        {/* Bảng điều khiển nút chụp chân trang */}
        <div className="p-5 flex items-center justify-between bg-[#071619] border-t border-[#1A3F45]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white/70 hover:text-white transition"
          >
            Hủy bỏ
          </button>

          <button
            onClick={handleTakePhoto}
            disabled={!stream || isStarting || !!cameraError}
            className="w-14 h-14 rounded-full bg-[#00AB9B] hover:bg-[#267A78] text-white border-4 border-white/20 flex items-center justify-center shadow-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Chụp ảnh ngay"
          >
            <div className="w-6 h-6 rounded-full bg-white" />
          </button>

          <div className="w-16" />
        </div>
      </div>
    </div>
  );
};

export default CameraView;
