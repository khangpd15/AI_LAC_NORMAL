import React from 'react';

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
  const aiPred = measurement?.aiPrediction || null;
  const capture = hirschbergData?.captures?.hirschberg || hirschbergData?.captures?.straight || null;
  const imageSrc = capture?.image || capture?.originalFrame || null;

  // Determine screening outcome
  const rawStatus = aiPred?.predictedClass || measurement?.result || 'INCONCLUSIVE';
  let badgeClass = 'badge-inconclusive';
  let statusTitle = 'Kết quả không đủ điều kiện để đánh giá';
  let statusDesc = 'Ảnh chụp chưa đủ thông tin hoặc chất lượng chưa đạt để đánh giá phản xạ giác mạc.';
  let emoji = '⚪';

  if (rawStatus === 'NORMAL') {
    badgeClass = 'badge-clear';
    statusTitle = 'Không phát hiện dấu hiệu rõ ràng trong lần sàng lọc này';
    statusDesc = 'Các chỉ số phản xạ giác mạc hai mắt cân đối, chưa ghi nhận dấu hiệu lệch trục nhãn cầu.';
    emoji = '🟢';
  } else if (rawStatus === 'STRABISMUS' || rawStatus === 'SUSPICIOUS') {
    badgeClass = 'badge-attention';
    statusTitle = 'Có dấu hiệu cần kiểm tra thêm';
    statusDesc = 'Ghi nhận độ lệch phản xạ ánh sáng giác mạc giữa hai mắt. Khuyên nên thực hiện thêm Cover Test hoặc thăm khám chuyên khoa.';
    emoji = '🟡';
  } else if (rawStatus === 'SYSTEM_ERROR') {
    badgeClass = 'badge-error';
    statusTitle = 'Lỗi hệ thống khi phân tích';
    statusDesc = measurement?.message || 'Hệ thống chưa hoàn tất phân tích Hirschberg. Vui lòng thử lại hoặc kiểm tra kết nối backend.';
    emoji = '🔴';
  } else if (rawStatus === 'INELIGIBLE') {
    badgeClass = 'badge-attention';
    statusTitle = 'Chưa đủ điều kiện sàng lọc';
    statusDesc = measurement?.message || 'Thông tin hiện tại chưa nằm trong phạm vi hỗ trợ của bài sàng lọc này.';
    emoji = '🟡';
  }

  // Voice announcement
  React.useEffect(() => {
    if (isVoiceEnabled && speak) {
      if (rawStatus === 'NORMAL') {
        speak('Ảnh Hirschberg chưa phát hiện dấu hiệu bất thường. Bạn có thể kiểm tra bổ sung bằng Cover Test để chắc chắn hơn.');
      } else if (rawStatus === 'STRABISMUS' || rawStatus === 'SUSPICIOUS') {
        speak('Ảnh Hirschberg có dấu hiệu cần kiểm tra thêm. Khuyến nghị thực hiện Cover Test bổ sung.');
      } else if (rawStatus === 'INELIGIBLE') {
        speak('Thông tin hiện tại chưa đủ điều kiện để hệ thống phân tích Hirschberg tự động.');
      } else {
        speak('Đã hoàn thành phân tích Hirschberg.');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confidencePct = aiPred?.confidence != null ? Math.round(aiPred.confidence * 100) : null;
  const deltaH = measurement?.measurements?.delta_h ?? null;

  return (
    <div className="card stage-card-main hirschberg-result-card">
      <div className="stage-header hirschberg-result-header">
        <div className="hirschberg-result-badges">
          <span className="badge badge-primary">Bước 2: Kết quả Hirschberg</span>
          <span className={`badge ${badgeClass}`}>{emoji} {rawStatus}</span>
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
          <div className={`hirschberg-status-panel hirschberg-status-panel--${rawStatus.toLowerCase()}`}>
            <h3 className="hirschberg-status-title">
              <span aria-hidden="true">{emoji}</span> {statusTitle}
            </h3>
            <p className="hirschberg-status-desc">
              {statusDesc}
            </p>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Phương pháp:</span>
              <strong>Hirschberg Photo Screening</strong>
            </div>
            {confidencePct != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Độ tự tin mô hình AI:</span>
                <strong>{confidencePct}%</strong>
              </div>
            )}
            {deltaH != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Chỉ số lệch phản xạ giác mạc (&Delta;h):</span>
                <strong>{Number(deltaH).toFixed(3)}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Thời gian thực hiện:</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
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
