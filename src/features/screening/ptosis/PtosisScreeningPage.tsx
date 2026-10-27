/**
 * Trang Sàng lọc Hình thái Mi mắt (PtosisCheck) — RemiCare Vision Health
 * Quản lý Finite State Machine: CONSENT -> READY_TO_CAPTURE -> ANALYZING -> RESULT / ERROR
 * Tích hợp toàn diện vào kiến trúc chung của RemiCare AI (Repo A).
 * Tuân thủ G1: Client tiền kiểm tra; G2: Zero-retention RAM; G4: Không dùng từ cấm.
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertCircle, RefreshCw, Eye } from 'lucide-react';

import type { ScreeningStep, ScreeningError } from './types/screening-state';
import type { ImageType, MeasurementPayload, QualityRejection } from './types/api-contracts';
import { useScreeningApi } from './hooks/useScreeningApi';
import { ConsentDialog } from './components/common/ConsentDialog';
import { CaptureScreen } from './components/capture/CaptureScreen';
import { QualityErrorModal } from './components/common/QualityErrorModal';
import { ResultScreen } from './components/result/ResultScreen';

export default function PtosisScreeningPage() {
  const [currentStep, setCurrentStep] = useState<ScreeningStep>('CONSENT');
  const [hasConsented, setHasConsented] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageType, setImageType] = useState<ImageType>('fullface');
  const [payload, setPayload] = useState<MeasurementPayload | null>(null);
  const [error, setError] = useState<ScreeningError | null>(null);

  const { isLoading, analyzeImage } = useScreeningApi();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  const handleConsentAccept = () => {
    setHasConsented(true);
    setCurrentStep('READY_TO_CAPTURE');
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setError(null);
  };

  const handleSubmitScreening = async () => {
    if (!selectedFile || !hasConsented) return;

    setCurrentStep('ANALYZING');
    setError(null);

    try {
      const result = await analyzeImage(selectedFile, imageType);
      setPayload(result);
      setCurrentStep('RESULT');
    } catch (err: unknown) {
      const rejection = (err as { rejection?: QualityRejection })?.rejection;
      if (rejection) {
        setError({
          type: 'QUALITY_GATE',
          title: 'Ảnh chưa đạt tiêu chuẩn sàng lọc',
          message: rejection.rejection_message_vi || 'Hình ảnh không đạt chuẩn chất lượng.',
          rejection,
        });
      } else {
        const rawMessage = err instanceof Error ? err.message : '';
        const isNetworkError =
          rawMessage.includes('Failed to fetch') ||
          rawMessage.includes('Network') ||
          rawMessage.includes('fetch');
        setError({
          type: 'SERVER',
          title: isNetworkError ? 'Không thể kết nối máy chủ phân tích' : 'Không thể hoàn tất sàng lọc',
          message: isNetworkError
            ? 'Không thể kết nối đến máy chủ phân tích hình thái. Vui lòng đảm bảo dịch vụ Backend đang chạy trên cổng 8000 (uvicorn app.main:app).'
            : (rawMessage || 'Có lỗi không xác định xảy ra trong quá trình gửi ảnh.'),
        });
      }
      setCurrentStep('ERROR');
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPayload(null);
    setError(null);
    setCurrentStep('READY_TO_CAPTURE');
  };

  return (
    <div className="ptosis-screening-container max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col items-center">
      {/* Top Banner Tiêu đề & Thông tin Bảo mật */}
      <div className="w-full mb-6 pb-5 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] text-[var(--color-mint)] flex items-center justify-center flex-shrink-0 border border-[var(--color-soft-mint)]">
            <Eye className="w-5 h-5 text-[var(--color-mint)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--text-heading)] tracking-tight">
                Sàng lọc Hình thái Mi mắt
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--bg-elevated)] text-[var(--color-mint)] border border-[var(--color-soft-mint)]">
                PtosisCheck AI
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Đo khoảng cách phản xạ bờ mi (MRD-1), độ mở khe mi và phát hiện bất đối xứng mi mắt
            </p>
          </div>
        </div>

        {/* Badge Zero-Retention RAM */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--color-soft-mint)] text-[var(--text-heading)] shadow-sm text-xs"
          title="Tuân thủ G2: Xử lý 100% trong RAM khả biến, tuyệt đối không lưu trữ ảnh trên máy chủ"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-mint)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-mint)]"></span>
          </span>
          <ShieldCheck className="w-4 h-4 text-[var(--color-mint)] flex-shrink-0" />
          <span className="font-semibold text-[11px] tracking-tight">
            Bảo mật RAM Zero-Retention
          </span>
        </div>
      </div>

      {/* Main Content Area: FSM States */}
      <div className="w-full flex flex-col justify-center items-center">
        {/* Bước 1: Cam kết quyền riêng tư (SP-004) */}
        {currentStep === 'CONSENT' && (
          <ConsentDialog onAccept={handleConsentAccept} />
        )}

        {/* Bước 2: Nạp ảnh & Bắt đầu phân tích */}
        {(currentStep === 'READY_TO_CAPTURE' || currentStep === 'ANALYZING') && (
          <CaptureScreen
            selectedFile={selectedFile}
            imageType={imageType}
            onImageTypeChange={setImageType}
            onFileSelect={handleFileSelect}
            onClearFile={handleClearFile}
            onSubmit={handleSubmitScreening}
            isAnalyzing={isLoading || currentStep === 'ANALYZING'}
          />
        )}

        {/* Bước 3: Hiển thị Kết quả Sàng lọc Hoàn thiện */}
        {currentStep === 'RESULT' && payload && (
          <ResultScreen
            payload={payload}
            selectedFile={selectedFile}
            onReset={handleReset}
          />
        )}

        {/* Màn hình Báo lỗi hoặc Modal Cổng Chất lượng */}
        {currentStep === 'ERROR' && error && (
          error.type === 'QUALITY_GATE' && error.rejection ? (
            <QualityErrorModal
              rejection={error.rejection}
              onRetry={handleReset}
              onClose={handleReset}
            />
          ) : (
            <div className="w-full max-w-lg mx-auto bg-[var(--bg-surface)] border border-[#F28C7B]/60 rounded-2xl p-6 sm:p-8 shadow-md text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#F28C7B]/15 border border-[#F28C7B]/40 mx-auto flex items-center justify-center text-[#F28C7B]">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-heading)]">{error.title}</h3>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">{error.message}</p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-xs font-bold transition cursor-pointer shadow-md"
                  style={{
                    background: 'linear-gradient(135deg, #00AB9B 0%, #087F78 100%)',
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Thử lại với ảnh khác
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Thông cáo y tế phi can thiệp chân trang module */}
      <div className="w-full mt-10 pt-5 border-t border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)] space-y-1">
        <p className="font-semibold text-[var(--text-heading)]">
          ⚠️ Lưu ý y khoa: RemiCare PtosisCheck là công cụ hỗ trợ sàng lọc hình thái học ban đầu bằng AI, không thay thế cho chẩn đoán chuyên sâu từ bác sĩ chuyên khoa mắt.
        </p>
        <p className="text-[11px] opacity-80">
          Tuân thủ Nghị định 13/2023/NĐ-CP & Điều 9 GDPR — Dữ liệu ảnh được giải phóng ngay sau khi xuất kết quả.
        </p>
      </div>
    </div>
  );
}
