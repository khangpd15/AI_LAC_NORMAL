import React from 'react';
import { predictHirschberg } from '../../api/hirschbergApi.js';
import { toHirschbergSessionResult } from '../../services/hirschbergResultService.js';
import HirschbergOutcome from './HirschbergOutcome.jsx';
import { normalizeHirschbergResult } from '../../services/hirschbergResultService.js';

/**
 * HirschbergResultStep (B2 - Hirschberg Screening Result)
 *
 * Dedicated result screen for Hirschberg screening before proceeding to Cover Test.
 * Medical UX strictly adheres to non-diagnostic terminology:
 * - "Kết quả sàng lọc"
 * - "Không phát hiện dấu hiệu rõ ràng trong lần sàng lọc này"
 * - "Có dấu hiệu cần kiểm tra thêm"
 * - "Kết quả không đủ điều kiện để đánh giá"
 * - "Kết quả sàng lọc không thay thế chẩn đoán của bác sĩ."
 */
export default function HirschbergResultStep({
  hirschbergData,
  onProceedToCoverTest,
  onSkipCoverTest,
  onRetake,
  onAnalysisComplete,
  sessionId,
  speak,
  isVoiceEnabled = true,
}) {
  const measurement = hirschbergData?.hirschbergResult || {};
  const capture = hirschbergData?.captures?.hirschberg || hirschbergData?.captures?.straight || null;
  const imageSrc = capture?.image || capture?.originalFrame || null;
  const { title, message, status } = normalizeHirschbergResult(measurement);
  const [isResending, setIsResending] = React.useState(false);
  const [retryError, setRetryError] = React.useState(null);
  const retryRef = React.useRef(null);
  React.useEffect(() => () => retryRef.current?.abort(), []);
  const resend = async () => {
    if (!imageSrc || retryRef.current || status === 'INELIGIBLE') return;
    const controller = new AbortController();
    retryRef.current = controller;
    setIsResending(true);
    setRetryError(null);
    try {
      const metadata = capture?.captureMetadata || {};
      const raw = await predictHirschberg(imageSrc, {
        orientation: metadata.orientation || (['mirrored', 'unmirrored'].includes(measurement.aiPrediction?.orientation) ? measurement.aiPrediction.orientation : 'auto'),
        fixation: metadata.fixation || 'unknown',
        sessionId, signal: controller.signal,
      });
      if (!controller.signal.aborted) onAnalysisComplete?.({
        ...hirschbergData, completedAt: new Date().toISOString(),
        ...toHirschbergSessionResult(raw),
      });
    } catch {
      if (!controller.signal.aborted) setRetryError('Chưa gửi lại được ảnh. Bạn hãy thử lại sau hoặc chụp ảnh mới.');
    } finally {
      if (!controller.signal.aborted) {
        retryRef.current = null;
        setIsResending(false);
      }
    }
  };
  React.useEffect(() => {
    if (isVoiceEnabled && speak) speak(`${title}. ${message}`);
  }, [isVoiceEnabled, speak, title, message]);
  return (
    <div className="card stage-card-main hirschberg-result-card">
      <div className="stage-header hirschberg-result-header">
        <div className="hirschberg-result-badges">
          <span className="badge badge-primary">Bước 2: Kết quả Hirschberg</span>

        </div>
        <h2 className="stage-title hirschberg-result-title">
          Kết quả Sàng lọc Hirschberg
        </h2>
        <p className="stage-subtitle hirschberg-result-subtitle">
          Phương pháp đo phản xạ ánh sáng giác mạc và phân tích hình thái hai mắt bằng AI.
        </p>
      </div>

      <div className={`hirschberg-result-layout ${imageSrc ? 'has-image' : 'no-image'}`}>
        {imageSrc && (
          <div className="hirschberg-result-image-col">
            <div className="hirschberg-result-image-frame">
              <img
                src={imageSrc}
                alt="Ảnh Hirschberg đã phân tích"
                className="hirschberg-result-image"
              />
            </div>
            <span className="hirschberg-result-image-caption">
              Ảnh phân tích phản xạ giác mạc
            </span>
          </div>
        )}

        <div className="hirschberg-result-content-col">
          <HirschbergOutcome result={measurement} />
        </div>
      </div>

      <div className="hirschberg-retry-panel" aria-busy={isResending}>
        <div className="hirschberg-retry-actions">
          <button type="button" className="btn btn-primary" onClick={onRetake} disabled={isResending}>
            Chụp lại / chọn ảnh khác
          </button>
          {imageSrc && status !== 'INELIGIBLE' && <button type="button" className="btn btn-secondary" onClick={resend} disabled={isResending}>
            {isResending ? 'Đang gửi lại…' : 'Gửi lại ảnh này'}
          </button>}
        </div>
        <p className="hirschberg-retry-hint" role="status">{isResending
          ? 'Đang phân tích lại ảnh. Bạn vui lòng đợi.'
          : 'Chọn ảnh mới để kiểm tra lại, hoặc gửi lại ảnh hiện tại nếu lần phân tích trước bị gián đoạn.'}</p>
        {retryError && <p className="hirschberg-retry-error" role="alert">{retryError}</p>}
      </div>

      {/* Safety Medical Disclaimer */}
      <div className="hirschberg-disclaimer">
        <strong>Lưu ý y tế quan trọng:</strong> Kết quả sàng lọc hình ảnh mang tính tham khảo ban đầu và <em>không thay thế chẩn đoán chuyên khoa của bác sĩ mắt</em>.
      </div>

      {/* Decision CTA Section */}
      <div className="hirschberg-cover-options">
        <h4 style={{ margin: '0 0 6px 0', color: '#115e59', fontSize: '1.1rem' }}>
          Bạn có muốn kiểm tra bổ sung bằng Cover Test?
        </h4>
        <p style={{ margin: '0 0 16px 0', color: '#0f766e', fontSize: '0.88rem' }}>
          Cover Test kiểm tra sự dịch chuyển nhãn cầu qua 3 chu kỳ che - mở mắt, giúp tăng độ chính xác của sàng lọc.
        </p>

        <div className="hirschberg-cover-actions">
          <button
            type="button"
            className="btn btn-primary btn-large"
            onClick={onProceedToCoverTest}
            disabled={isResending}
          >
            🔬 Kiểm tra bổ sung bằng Cover Test
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-large"
            onClick={onSkipCoverTest}
            disabled={isResending}
          >
            📊 Xem kết quả sàng lọc ngay
          </button>
        </div>
      </div>
    </div>
  );
}
