import React from 'react';

/**
 * AIStatus Component - Telemetry bar showing real-time Face, Eye tracking, and AI inference status
 */
export default function AIStatus({
  quality,
  isAIReady = false,
  isAILoading = false,
  aiError = null,
  smoothedPrediction = null,
  inferenceFps = 0,
}) {
  const faceOk = quality?.faceDetected;
  const leftEyeOk = quality?.leftEyeDetected;
  const rightEyeOk = quality?.rightEyeDetected;

  let aiBadgeText = 'AI: Đang tải...';
  let aiBadgeClass = 'loading';

  if (isAILoading) {
    aiBadgeText = 'AI: Đang tải...';
    aiBadgeClass = 'loading';
  } else if (aiError || !isAIReady) {
    aiBadgeText = 'AI: Không khả dụng (Dùng CV)';
    aiBadgeClass = 'unavailable';
  } else {
    aiBadgeText = inferenceFps > 0 ? `AI: Hoạt động (${inferenceFps} FPS)` : 'AI: Sẵn sàng';
    aiBadgeClass = 'active';
  }

  return (
    <div className="ai-telemetry-container" role="status" aria-label="Trạng thái hệ thống thời gian thực">
      <div className="telemetry-badges-row">
        <span className={`telemetry-item ${faceOk ? 'ok' : 'missing'}`}>
          Khuôn mặt: <strong>{faceOk ? '✓' : '✕'}</strong>
        </span>
        <span className={`telemetry-item ${leftEyeOk ? 'ok' : 'missing'}`}>
          Mắt trái: <strong>{leftEyeOk ? '✓' : '✕'}</strong>
        </span>
        <span className={`telemetry-item ${rightEyeOk ? 'ok' : 'missing'}`}>
          Mắt phải: <strong>{rightEyeOk ? '✓' : '✕'}</strong>
        </span>
        <span className={`telemetry-item ai-badge ${aiBadgeClass}`}>
          {aiBadgeText}
        </span>
      </div>

      {isAIReady && smoothedPrediction && (
        <div className="ai-gauge-mini">
          <div className="gauge-label-row">
            <span className="gauge-title">Tín hiệu AI hỗ trợ nghiên cứu:</span>
            <span className="gauge-val">Đang ghi nhận</span>
          </div>
          <small>Không diễn giải tín hiệu này thành xác suất mắc bệnh.</small>
        </div>
      )}
    </div>
  );
}
