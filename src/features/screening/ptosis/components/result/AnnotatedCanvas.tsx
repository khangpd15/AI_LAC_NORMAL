/**
 * Thành phần Canvas 2D Hiển thị Lớp phủ Đồ họa Vector Mốc Giải phẫu (Module M8 / FR-032).
 * Cho phép người dùng và chuyên gia kiểm tra trực quan mốc mống mắt, bờ mi, phản quang.
 * Tích hợp bảng điều khiển bật/tắt từng lớp phủ và chế độ phóng to vùng hai mắt.
 * Tuân thủ tuyệt đối G4: Không dùng từ ngữ thuộc danh mục cấm.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Layers,
  Download,
  Sliders,
} from 'lucide-react';
import type {
  AnnotatedOverlayContainer,
  MeasurementsContainer,
} from '../../types/api-contracts';
import {
  DEFAULT_OVERLAY_OPTIONS,
  drawAnnotatedCanvas,
  type OverlayDrawOptions,
} from '../../utils/canvas-overlay-drawer';

interface AnnotatedCanvasProps {
  imageFile: File | null;
  overlay: AnnotatedOverlayContainer;
  measurements: MeasurementsContainer;
}

export const AnnotatedCanvas: React.FC<AnnotatedCanvasProps> = ({
  imageFile,
  overlay,
  measurements,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [options, setOptions] = useState<OverlayDrawOptions>(DEFAULT_OVERLAY_OPTIONS);
  const [showControls, setShowControls] = useState<boolean>(false);

  // Tạo URL và nạp đối tượng Image từ file ảnh người dùng đã gửi
  useEffect(() => {
    if (!imageFile) return;

    const objectUrl = URL.createObjectURL(imageFile);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = objectUrl;

    img.onload = () => {
      setImageObj(img);
    };

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile]);

  // Vẽ lại canvas mỗi khi hình ảnh hoặc tùy chọn lớp phủ thay đổi
  useEffect(() => {
    if (!canvasRef.current || !imageObj) return;
    drawAnnotatedCanvas(canvasRef.current, imageObj, overlay, measurements, options);
  }, [imageObj, overlay, measurements, options]);

  const toggleOption = (key: keyof OverlayDrawOptions) => {
    setOptions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDownloadAnnotatedImage = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `PtosisCheck_Annotated_${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="w-full rounded-2xl bg-white dark:bg-[#0D2327] border border-[#B8E8DF] dark:border-[#1A3F45] p-5 sm:p-6 shadow-remi-card dark:shadow-remi-card-dark transition-colors duration-250">
      {/* Tiêu đề & Thanh công cụ thao tác nhanh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#B8E8DF] dark:border-[#1A3F45] mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#00AB9B]" />
            <h4 className="text-sm font-bold text-[#00545D] dark:text-[#F9F8F2]">
              Lớp Phủ Đồ Họa Vector Minh Bạch (Canvas 2D)
            </h4>
          </div>
          <p className="text-xs text-[#267A78] dark:text-[#6FB4AF] mt-0.5">
            Kiểm tra trực quan vị trí mốc mống mắt, bờ sụn mi và đốm phản quang
          </p>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto">
          {/* Nút phóng to / thu nhỏ hai mắt */}
          <button
            onClick={() => toggleOption('zoomToEyes')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              options.zoomToEyes
                ? 'bg-[#00AB9B] text-[#F9F8F2] border-[#00AB9B] shadow-xs'
                : 'bg-[#E1F4F0] dark:bg-[#122D32] text-[#00545D] dark:text-[#F9F8F2] border-[#B8E8DF] dark:border-[#1A3F45] hover:bg-[#B8E8DF]/50'
            }`}
            title="Chuyển đổi góc nhìn phóng to hai mắt / toàn cảnh"
          >
            {options.zoomToEyes ? (
              <>
                <ZoomOut className="w-3.5 h-3.5" />
                <span>Toàn cảnh</span>
              </>
            ) : (
              <>
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Phóng to mắt</span>
              </>
            )}
          </button>

          {/* Nút bật/tắt bảng điều khiển lớp phủ */}
          <button
            onClick={() => setShowControls((prev) => !prev)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#E1F4F0] dark:bg-[#122D32] hover:bg-[#B8E8DF]/60 text-[#00545D] dark:text-[#F9F8F2] text-xs font-semibold border border-[#B8E8DF] dark:border-[#1A3F45] transition cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-[#00AB9B]" />
            <span className="hidden sm:inline">Lớp phủ</span>
          </button>

          {/* Nút tải ảnh đã vẽ lớp phủ */}
          <button
            onClick={handleDownloadAnnotatedImage}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#E1F4F0] dark:bg-[#122D32] hover:bg-[#B8E8DF]/60 text-[#00545D] dark:text-[#F9F8F2] text-xs font-semibold border border-[#B8E8DF] dark:border-[#1A3F45] transition cursor-pointer"
            title="Lưu ảnh có mốc đo xuống máy"
          >
            <Download className="w-3.5 h-3.5 text-[#267A78] dark:text-[#6FB4AF]" />
            <span className="hidden sm:inline">Lưu ảnh</span>
          </button>
        </div>
      </div>

      {/* Bảng điều khiển bộ lọc lớp phủ (Accordion mở rộng) */}
      {showControls && (
        <div className="mb-4 p-3.5 rounded-xl bg-[#E1F4F0]/60 dark:bg-[#122D32]/70 border border-[#B8E8DF] dark:border-[#1A3F45] grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.showIrisLimbus}
              onChange={() => toggleOption('showIrisLimbus')}
              className="accent-[#00AB9B] rounded"
            />
            <span className="text-[#00545D] dark:text-[#F9F8F2]">Mống mắt HVID</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.showUpperMargin}
              onChange={() => toggleOption('showUpperMargin')}
              className="accent-[#10B981] rounded"
            />
            <span className="text-[#00545D] dark:text-[#F9F8F2]">Bờ mi trên</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.showLowerMargin}
              onChange={() => toggleOption('showLowerMargin')}
              className="accent-[#38BDF8] rounded"
            />
            <span className="text-[#00545D] dark:text-[#F9F8F2]">Bờ mi dưới</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.showCornealReflex}
              onChange={() => toggleOption('showCornealReflex')}
              className="accent-[#EF4444] rounded"
            />
            <span className="text-[#00545D] dark:text-[#F9F8F2]">Phản quang</span>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options.showMrd1Arrow}
              onChange={() => toggleOption('showMrd1Arrow')}
              className="accent-[#F59E0B] rounded"
            />
            <span className="text-[#00545D] dark:text-[#F9F8F2]">Thước đo MRD1</span>
          </label>
        </div>
      )}

      {/* Khu vực khung hiển thị Canvas */}
      <div className="relative w-full rounded-xl overflow-hidden bg-black/90 flex items-center justify-center border border-black/10 dark:border-white/10 shadow-inner">
        <canvas
          ref={canvasRef}
          className="max-h-[460px] w-auto h-auto object-contain block mx-auto select-none"
        />
      </div>

      {/* Chú giải ký hiệu màu sắc chuẩn lâm sàng */}
      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-[#267A78] dark:text-[#6FB4AF]">
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-0.5 border-t-2 border-dashed border-white inline-block bg-transparent" />
          <span>Viền mống mắt HVID</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-0.5 bg-[#10B981] inline-block" />
          <span>Bờ sụn mi trên (Spline)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] border border-white inline-block" />
          <span>Phản quang Purkinje</span>
        </div>
        {(measurements.right_eye_od.reference_point_used === 'PUPIL_CENTER_FALLBACK' ||
          measurements.left_eye_os.reference_point_used === 'PUPIL_CENTER_FALLBACK') && (
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F97316] border border-white inline-block" />
            <span>Mốc dự phòng (Đồng tử / Mống mắt)</span>
          </div>
        )}
        <div className="flex items-center space-x-1.5">
          <span className="w-3 h-0.5 bg-[#F59E0B] inline-block" />
          <span>Đoạn đo MRD1</span>
        </div>
      </div>
    </div>
  );
};

export default AnnotatedCanvas;
