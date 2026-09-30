import React from 'react';
import CameraView from '../CameraView';
import AudioButton from '../audio/AudioButton';
import {
  POSITION_CONFIG,
  POSITION_QUALITY_CONFIG,
  POSITION_STATUS,
} from '../../constants/binocularScreeningConfig.js';

/**
 * PositionCheck Component
 * Step 1 (Cover Test) & Step 3 (Brock String) of Digital Binocular Vision Screening.
 * Configured independently via `testType` prop:
 * - 'COVER_TEST': Target 33–40 cm
 * - 'BROCK_STRING': Target 20–25 cm
 * 
 * Medical & Safety Constraints:
 * - No hard-coded distance values in JSX (all sourced from POSITION_CONFIG[testType]).
 * - Button enabled ONLY when positionReport?.status === 'READY'.
 * - Displays estimated distance with clear relative estimation terminology.
 */
export default function PositionCheck({
  testType = 'COVER_TEST',
  videoRef,
  stream = null,
  landmarks,
  features = null,
  positionReport,
  onProceed,
  onRetry,
  isActive = false,
  isLoading = false,
  error = null,
  onVideoReady,
  speak = null,
  isVoiceEnabled = true,
}) {
  const config = POSITION_CONFIG[testType] || POSITION_CONFIG.COVER_TEST;
  const status = positionReport?.status || POSITION_STATUS.INITIALIZING;
  const isReady = status === POSITION_STATUS.READY;

  const spokenIntroRef = React.useRef(false);
  React.useEffect(() => {
    if (isVoiceEnabled && speak && !spokenIntroRef.current) {
      spokenIntroRef.current = true;
      speak(`Dạ, cô chú ${config.instruction.toLowerCase()} nghen. Mình giữ đầu thẳng và nhìn vào camera nha.`);
    }
  }, [isVoiceEnabled, speak, config.instruction]);

  const spokenReadyRef = React.useRef(false);
  React.useEffect(() => {
    if (isReady && isVoiceEnabled && speak && !spokenReadyRef.current) {
      spokenReadyRef.current = true;
      speak('Dạ, vị trí đã rất tốt rồi nghen. Cô chú bấm nút bắt đầu nha.');
    }
  }, [isReady, isVoiceEnabled, speak]);

  const checks = positionReport?.checks || {
    faceDetected: false,
    faceCentered: false,
    bothEyesDetected: false,
    irisDetected: false,
    distanceValid: false,
    headPoseValid: false,
    isStable: false,
  };

  const estimatedDistanceCm = positionReport?.estimatedDistanceCm ?? null;
  const stableDistanceCm = positionReport?.stableDistanceCm ?? estimatedDistanceCm;
  const feedbackMessage = positionReport?.feedbackMessage || 'Đang kết nối camera và nhận diện khuôn mặt...';
  const centeringConfig = POSITION_QUALITY_CONFIG.FACE_CENTERING;

  // Dynamic visual track limits based on test config
  const trackMin = Math.max(10, config.minDistanceCm - 12);
  const trackMax = config.maxDistanceCm + 15;
  const displayDistance = stableDistanceCm ?? estimatedDistanceCm;
  const pinPercent = displayDistance !== null
    ? Math.min(100, Math.max(0, ((displayDistance - trackMin) / (trackMax - trackMin)) * 100))
    : null;

  // Status banner variant styling
  let bannerClass = 'banner-warning';
  if (isReady) {
    bannerClass = 'banner-success';
  } else if (status === POSITION_STATUS.NO_FACE || status === POSITION_STATUS.LOW_CONFIDENCE) {
    bannerClass = 'banner-alert';
  }

  return (
    <div className="card stage-card-main position-check-card">
      <div className="stage-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-primary">{config.title}</span>
          <span className="badge badge-secondary">Kiểm tra vị trí</span>
        </div>
        <h2 className="stage-title">{config.title} — Kiểm tra vị trí</h2>
        <p className="stage-subtitle">
          {config.instruction}. Giữ đầu thẳng và nhìn vào camera để hệ thống chuẩn bị bài kiểm tra.
        </p>
      </div>
      <AudioButton text={`Dạ, cô chú ${config.instruction.toLowerCase()} nghen. Mình giữ đầu thẳng, nhìn thẳng vào camera và chờ hệ thống báo sẵn sàng nha.`} label="Nghe hướng dẫn" />

      <div className="position-check-layout">
        {/* Left Column: Camera Preview with Live Landmarking & Face Bounding Box */}
        <div className="cam-column" style={{ position: 'relative' }}>
          <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
            <CameraView
              videoRef={videoRef}
              stream={stream}
              landmarks={landmarks}
              features={features}
              quality={positionReport?.quality}
              isActive={isActive}
              isLoading={isLoading}
              error={error}
              onVideoReady={onVideoReady}
            />

            {/* Safe zone for the center point of the detected face. */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: `${(centeringConfig.TARGET_X - centeringConfig.MAX_OFFSET_X) * 100}%`,
                top: `${(centeringConfig.TARGET_Y - centeringConfig.MAX_OFFSET_Y) * 100}%`,
                width: `${centeringConfig.MAX_OFFSET_X * 200}%`,
                height: `${centeringConfig.MAX_OFFSET_Y * 200}%`,
                border: `2px dashed ${checks.faceCentered ? 'var(--color-mint)' : 'var(--color-soft-amber)'}`,
                borderRadius: '12px',
                background: checks.faceCentered ? 'rgba(0, 171, 155, 0.08)' : 'rgba(242, 198, 109, 0.08)',
                pointerEvents: 'none',
                zIndex: 7,
                transition: 'all 0.15s ease-out',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: '10px',
                  height: '10px',
                  border: '2px solid currentColor',
                  borderRadius: '50%',
                  color: checks.faceCentered ? 'var(--color-mint)' : 'var(--color-soft-amber)',
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>

            {/* Face Bounding Box indicator if face detected (mirrored to match scaleX(-1) camera feed) */}
            {positionReport?.boundingBox && checks.faceDetected && (
              <div
                className="face-bounding-box"
                style={{
                  position: 'absolute',
                  left: `${Math.max(0, (1.0 - positionReport.boundingBox.xMin - positionReport.boundingBox.width) * 100)}%`,
                  top: `${positionReport.boundingBox.yMin * 100}%`,
                  width: `${positionReport.boundingBox.width * 100}%`,
                  height: `${positionReport.boundingBox.height * 100}%`,
                  border: isReady ? '2px solid var(--color-mint)' : '2px dashed var(--color-soft-mint)',
                  borderRadius: '10px',
                  pointerEvents: 'none',
                  boxShadow: isReady
                    ? '0 0 14px rgba(0, 171, 155, 0.45)'
                    : '0 0 8px rgba(184, 232, 223, 0.35)',
                  transition: 'all 0.15s ease-out',
                  zIndex: 8,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '-22px',
                    left: '4px',
                    background: isReady ? 'var(--color-mint)' : 'var(--color-deep-teal)',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.4px',
                  }}
                >
                  {isReady ? '✓ VỊ TRÍ PHÙ HỢP' : 'KHUÔN MẶT ĐƯỢC NHẬN DIỆN'}
                </span>
              </div>
            )}
          </div>

          {/* Distance Meter Gauge */}
          <div className="distance-gauge-container">
            <div className="distance-gauge-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="distance-gauge-label">Khoảng cách yêu cầu: </span>
                <strong style={{ color: 'var(--color-deep-teal)', marginLeft: '4px' }}>{config.targetRangeLabel}</strong>
              </div>
              <div>
                <span className="distance-gauge-label">Khoảng cách ước tính: </span>
                <span className={`distance-gauge-value ${isReady ? 'valid' : 'warning'}`}>
                  {stableDistanceCm !== null ? `khoảng ${stableDistanceCm} cm` : '-- cm'}
                </span>
              </div>
            </div>

            <div
              className="distance-track"
              role="meter"
              aria-valuenow={displayDistance || 0}
              aria-valuemin={trackMin}
              aria-valuemax={trackMax}
              aria-label={`Thanh đo khoảng cách ${config.label}`}
            >
              <div
                className="distance-zone zone-near"
                style={{ flex: `${config.minDistanceCm - trackMin}` }}
                title={`Quá gần (< ${config.minDistanceCm} cm)`}
              >
                Quá gần
              </div>
              <div
                className="distance-zone zone-target"
                style={{ flex: `${config.maxDistanceCm - config.minDistanceCm}` }}
                title={`Mục tiêu (${config.targetRangeLabel})`}
              >
                Mục tiêu ({config.targetRangeLabel})
              </div>
              <div
                className="distance-zone zone-far"
                style={{ flex: `${trackMax - config.maxDistanceCm}` }}
                title={`Quá xa (> ${config.maxDistanceCm} cm)`}
              >
                Quá xa
              </div>

              {pinPercent !== null && (
                <div
                  className="distance-marker-pin"
                  style={{
                    left: `${pinPercent}%`,
                    transition: 'left 0.12s ease-out',
                  }}
                  aria-hidden="true"
                />
              )}
            </div>

            <p className={`feedback-banner ${bannerClass}`} role="status">
              {feedbackMessage}
            </p>
          </div>
        </div>

        {/* Right Column: Pre-test Safety Checklist & Strict Gating */}
        <div className="position-checklist-column">
          <div className="checklist-card">
            <h3 className="checklist-title">Tiêu chuẩn chất lượng vị trí:</h3>
            <ul className="checklist-items" role="list">
              <li className={`checklist-item ${checks.faceDetected ? 'pass' : 'fail'}`}>
                <span className="check-icon" aria-hidden="true">
                  {checks.faceDetected ? '✓' : '○'}
                </span>
                <div className="check-text">
                  <strong>Khuôn mặt được phát hiện</strong>
                  <span>MediaPipe Face Mesh nhận diện rõ viền mặt</span>
                </div>
              </li>

              <li className={`checklist-item ${checks.faceCentered ? 'pass' : 'fail'}`}>
                <span className="check-icon" aria-hidden="true">
                  {checks.faceCentered ? '✓' : '○'}
                </span>
                <div className="check-text">
                  <strong>Khuôn mặt nằm giữa khung hình</strong>
                  <span>
                    {positionReport?.faceCentering
                      ? `Lệch ngang ${Math.round(Math.abs(positionReport.faceCentering.offsetX) * 100)}%, dọc ${Math.round(Math.abs(positionReport.faceCentering.offsetY) * 100)}%`
                      : 'Đưa tâm khuôn mặt vào vùng hướng dẫn'}
                  </span>
                </div>
              </li>

              <li className={`checklist-item ${checks.bothEyesDetected ? 'pass' : 'fail'}`}>
                <span className="check-icon" aria-hidden="true">
                  {checks.bothEyesDetected ? '✓' : '○'}
                </span>
                <div className="check-text">
                  <strong>Hai mắt nhìn rõ ràng</strong>
                  <span>Khóe mắt trong và ngoài mở đều</span>
                </div>
              </li>

              <li className={`checklist-item ${checks.irisDetected ? 'pass' : 'fail'}`}>
                <span className="check-icon" aria-hidden="true">
                  {checks.irisDetected ? '✓' : '○'}
                </span>
                <div className="check-text">
                  <strong>Tâm mống mắt nhận diện rõ</strong>
                  <span>Mống mắt trái (468) & phải (473)</span>
                </div>
              </li>

              <li className={`checklist-item ${checks.headPoseValid ? 'pass' : 'fail'}`}>
                <span className="check-icon" aria-hidden="true">
                  {checks.headPoseValid ? '✓' : '○'}
                </span>
                <div className="check-text">
                  <strong>Đầu thẳng, nhìn vào camera</strong>
                  <span>
                    Nghiêng (Roll): {positionReport?.headPose?.rollDeg ?? 0}°, Quay (Yaw): {positionReport?.headPose?.yawDeg ?? 0}°
                  </span>
                </div>
              </li>

              <li className={`checklist-item ${checks.distanceValid ? 'pass' : 'fail'}`}>
                <span className="check-icon" aria-hidden="true">
                  {checks.distanceValid ? '✓' : '○'}
                </span>
                <div className="check-text">
                  <strong>Khoảng cách phù hợp ({config.targetRangeLabel})</strong>
                  <span>Ổn định liên tục qua nhiều khung hình</span>
                </div>
              </li>
            </ul>

            <div className="checklist-safety-note" style={{ background: 'var(--color-pale-teal)', border: '1px solid var(--color-soft-mint)', padding: '10px 14px', borderRadius: '8px', marginTop: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                💡 <strong>Ghi chú:</strong> {config.clinicalNote}
              </p>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', opacity: 0.85 }}>
                * Khoảng cách hiển thị là giá trị ước tính quang học tương đối để định hướng tư thế, không phải thước đo vật lý tuyệt đối.
              </p>
            </div>

            <div className="checklist-actions" style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              {onRetry && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onRetry}
                  aria-label="Thử lại kiểm tra vị trí"
                >
                  🔄 THỬ LẠI
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-large btn-block"
                disabled={!isReady}
                onClick={onProceed}
                aria-label={config.buttonLabel}
                style={{ flex: 1 }}
              >
                {isReady ? `✓ ${config.buttonLabel}` : 'Chờ vị trí đạt chuẩn...'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
