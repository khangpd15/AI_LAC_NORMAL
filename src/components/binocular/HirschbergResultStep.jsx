import React from 'react';
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
  speak,
  isVoiceEnabled = true,
}) {
  const measurement = hirschbergData?.hirschbergResult || {};
  const capture = hirschbergData?.captures?.hirschberg || hirschbergData?.captures?.straight || null;
  const imageSrc = capture?.image || capture?.originalFrame || null;
  const { title, message } = normalizeHirschbergResult(measurement);
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

      {/* Safety Medical Disclaimer */}
      <div style={{ background: '#f8fafc', borderLeft: '4px solid #3b82f6', padding: '12px 16px', borderRadius: '4px', margin: '20px 0', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
        <strong>Lưu ý y tế quan trọng:</strong> Kết quả sàng lọc hình ảnh mang tính tham khảo ban đầu và <em>không thay thế chẩn đoán chuyên khoa của bác sĩ mắt</em>.
      </div>

      {/* Decision CTA Section */}
      <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '12px', padding: '20px', marginTop: '24px', textAlign: 'center' }}>
        <h4 style={{ margin: '0 0 6px 0', color: '#115e59', fontSize: '1.1rem' }}>
          Bạn có muốn kiểm tra bổ sung bằng Cover Test?
        </h4>
        <p style={{ margin: '0 0 16px 0', color: '#0f766e', fontSize: '0.88rem' }}>
          Cover Test kiểm tra sự dịch chuyển nhãn cầu qua 3 chu kỳ che - mở mắt, giúp tăng độ chính xác của sàng lọc.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary btn-large"
            onClick={onProceedToCoverTest}
            style={{ minWidth: '260px' }}
          >
            🔬 Kiểm tra bổ sung bằng Cover Test
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-large"
            onClick={onSkipCoverTest}
          >
            📊 Xem kết quả sàng lọc ngay
          </button>
        </div>
      </div>
    </div>
  );
}
