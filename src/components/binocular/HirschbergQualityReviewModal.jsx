import React from 'react';

/**
 * HirschbergQualityReviewModal
 * Pre-screening quality inspection screen for captured or uploaded Hirschberg photos.
 * Displays multi-factor quality validation results and enforces safety gates:
 * - If acceptable: User can confirm to send to AI backend for measurement.
 * - If not acceptable: Submit button is blocked, prompting user to retake or re-upload with clear tips.
 */
export default function HirschbergQualityReviewModal({
  imageDataUrl,
  validation,
  isInspecting = false,
  isAnalyzing = false,
  analysisError = null,
  onConfirm,
  onRetake,
  onReupload,
}) {
  const isAcceptable = Boolean(validation?.isAcceptable);
  const errors = validation?.errors || [];
  const warnings = validation?.warnings || [];
  const passedChecks = validation?.passedChecks || [];
  const metrics = validation?.metrics || {};

  return (
    <div className="hirschberg-review-overlay fade-in">
      <div className="card hirschberg-review-card">
        {/* Top Header */}
        <div className="hirschberg-review-header">
          <button
            type="button"
            className="modal-close-btn"
            onClick={onRetake}
            title="Đóng / Trở lại hướng dẫn"
            aria-label="Đóng"
          >
            ✕
          </button>
          <div className="header-badge-row">
            {isInspecting ? (
              <span className="badge badge-info animate-pulse">
                🔍 Đang sàng lọc chất lượng ảnh...
              </span>
            ) : isAcceptable ? (
              <span className="badge badge-success">
                ✓ Ảnh đạt chuẩn sàng lọc AI
              </span>
            ) : (
              <span className="badge badge-danger">
                ⚠️ Ảnh chưa tối ưu - Khuyên chụp lại hoặc vẫn gửi AI thử nghiệm
              </span>
            )}
          </div>
          <h2 className="hirschberg-review-title">
            {isInspecting
              ? 'Đang kiểm tra chất lượng ảnh...'
              : validation?.title || 'Kiểm tra ảnh Hirschberg'}
          </h2>
          <p className="hirschberg-review-subtitle">
            {isInspecting
              ? 'AI đang quét khuôn mặt, độ nét, ánh sáng và phản xạ giác mạc...'
              : validation?.summary || 'Kết quả kiểm tra trước khi gửi về AI'}
          </p>
        </div>

        {/* Two-column layout: Left image preview, Right checklist & guidance */}
        <div className="hirschberg-review-body">
          {/* Left: Image Preview Frame */}
          <div className="hirschberg-preview-column">
            <div className="hirschberg-img-frame">
              {imageDataUrl ? (
                <img
                  src={imageDataUrl}
                  alt="Hirschberg preview"
                  className="hirschberg-preview-image"
                />
              ) : (
                <div className="hirschberg-img-empty">
                  <span>Chưa có ảnh</span>
                </div>
              )}

              {/* Status overlay banner on preview */}
              <div
                className={`preview-status-tag ${
                  isInspecting ? 'status-inspecting' : isAcceptable ? 'status-pass' : 'status-fail'
                }`}
              >
                {isInspecting
                  ? 'Đang quét...'
                  : isAcceptable
                  ? '✓ Đạt yêu cầu'
                  : '✕ Cần đổi ảnh'}
              </div>
            </div>

            {/* Quick Metrics Bar under image */}
            {!isInspecting && (
              <div className="hirschberg-metrics-strip">
                <span className="metric-chip">
                  Độ nét: <strong>{metrics.focusScore ?? 'N/A'}</strong>
                </span>
                <span className="metric-chip">
                  Ánh sáng: <strong>{metrics.meanLuma ?? 'N/A'}</strong>
                </span>
                <span className="metric-chip">
                  Phản quang:{' '}
                  <strong>
                    OD: {metrics.reflexCountPerEye?.right ?? 0} | OS:{' '}
                    {metrics.reflexCountPerEye?.left ?? 0}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Right: Validation Checklist & Guidance */}
          <div className="hirschberg-checklist-column">
            {isInspecting ? (
              <div className="inspecting-loading-box">
                <div className="analyzing-spinner" />
                <p>AI đang đánh giá khuôn mặt, góc mắt và độ nét ảnh...</p>
              </div>
            ) : (
              <>
                {/* 1. Critical Errors if any */}
                {errors.length > 0 && (
                  <div className="prescreen-callout callout-danger">
                    <div className="callout-header">
                      <span className="callout-icon">🚫</span>
                      <strong>Các lỗi cần khắc phục:</strong>
                    </div>
                    <ul className="callout-list">
                      {errors.map((err, idx) => (
                        <li key={idx} className="callout-item">
                          <span className="item-title">{err.label}</span>
                          <span className="item-tip">👉 {err.tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 2. Warnings if any */}
                {warnings.length > 0 && (
                  <div className="prescreen-callout callout-warning">
                    <div className="callout-header">
                      <span className="callout-icon">💡</span>
                      <strong>Lưu ý cải thiện:</strong>
                    </div>
                    <ul className="callout-list">
                      {warnings.map((warn, idx) => (
                        <li key={idx} className="callout-item">
                          <span className="item-title">{warn.label}</span>
                          <span className="item-tip">👉 {warn.tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3. Passed Checks */}
                {passedChecks.length > 0 && (
                  <div className="prescreen-callout callout-success">
                    <div className="callout-header">
                      <span className="callout-icon">✓</span>
                      <strong>Tiêu chuẩn đã đạt:</strong>
                    </div>
                    <ul className="checklist-grid">
                      {passedChecks.map((item, idx) => (
                        <li key={idx} className="check-item-pass">
                          <span className="check-icon">✓</span>
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* Backend Analysis Error Banner if encountered */}
            {analysisError && (
              <div className="prescreen-callout callout-danger">
                <strong>Lỗi phân tích:</strong> {analysisError}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="hirschberg-review-actions">
          {/* If unacceptable: Prompt user to retake or re-upload, or allow sending to AI with advisory notice */}
          {!isAcceptable && !isInspecting && (
            <div className="review-action-row">
              <button
                type="button"
                className="btn btn-secondary btn-action-reupload"
                onClick={onReupload}
                disabled={isAnalyzing}
              >
                📁 Chọn ảnh khác
              </button>

              <button
                type="button"
                className="btn btn-primary btn-action-retake"
                onClick={onRetake}
                disabled={isAnalyzing}
              >
                📸 Chụp lại
              </button>

              <button
                type="button"
                className="btn btn-action-override"
                onClick={onConfirm}
                disabled={isAnalyzing}
                title="Vẫn gửi ảnh này cho AI backend kiểm tra và đo đạc"
              >
                {isAnalyzing ? (
                  <span className="btn-loading-flex">
                    <span className="btn-mini-spinner" />
                    Đang gửi AI phân tích...
                  </span>
                ) : (
                  '🚀 Vẫn gửi phân tích AI'
                )}
              </button>
            </div>
          )}

          {/* If acceptable: User can confirm to send or optionally change photo */}
          {isAcceptable && !isInspecting && (
            <div className="review-action-row">
              <button
                type="button"
                className="btn btn-secondary btn-action-back"
                onClick={onRetake}
                disabled={isAnalyzing}
              >
                🔄 Chụp lại / Đổi ảnh
              </button>

              <button
                type="button"
                className="btn btn-success btn-action-confirm"
                onClick={onConfirm}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <span className="btn-loading-flex">
                    <span className="btn-mini-spinner" />
                    Đang gửi AI phân tích...
                  </span>
                ) : (
                  '🚀 Xác nhận & Gửi AI phân tích'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
