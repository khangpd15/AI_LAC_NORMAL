import React from 'react';
import CameraView from '../CameraView';
import AudioButton from '../audio/AudioButton';
import PositionGuideVideo from './PositionGuideVideo';
import {
  POSITION_CONFIG,
  POSITION_QUALITY_CONFIG,
  POSITION_STATUS,
} from '../../constants/binocularScreeningConfig.js';
import { useCameraDisplayRect, mapCameraRectToDisplay } from '../../utils/cameraCoordinateTransform.js';

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
  onCameraActivate,
  speak = null,
  isVoiceEnabled = true,
}) {
  const [playbackReady, setPlaybackReady] = React.useState(false);
  const config = POSITION_CONFIG[testType] || POSITION_CONFIG.COVER_TEST;
  const isInitializing = isLoading || !isActive || !stream || !playbackReady || Boolean(error);
  const status = isInitializing ? POSITION_STATUS.INITIALIZING : (positionReport?.status || POSITION_STATUS.INITIALIZING);
  const isReady = !isInitializing && status === POSITION_STATUS.READY;

  const spokenIntroRef = React.useRef(false);
  React.useEffect(() => {
    if (isVoiceEnabled && speak && !spokenIntroRef.current) {
      spokenIntroRef.current = true;
      const distPrompt = config.targetRangeLabel
        ? `Ngồi cách camera khoảng ${config.targetRangeLabel}, giữ đầu thẳng nghen.`
        : 'Ngồi thẳng người trước camera, giữ đầu thẳng nghen.';
      speak(distPrompt);
    }
  }, [isVoiceEnabled, speak, config.targetRangeLabel]);

  const spokenReadyRef = React.useRef(false);
  React.useEffect(() => {
    if (isReady && isVoiceEnabled && speak && !spokenReadyRef.current) {
      spokenReadyRef.current = true;
      speak('Vị trí tốt, bấm bắt đầu nghen.');
    }
  }, [isReady, isVoiceEnabled, speak]);

  const checks = isInitializing
    ? {
        faceDetected: false,
        faceCentered: false,
        bothEyesDetected: false,
        irisDetected: false,
        distanceValid: false,
        headPoseValid: false,
        isStable: false,
      }
    : (positionReport?.checks || {
        faceDetected: false,
        faceCentered: false,
        bothEyesDetected: false,
        irisDetected: false,
        distanceValid: false,
        headPoseValid: false,
        isStable: false,
      });

  const faceClear = checks.faceDetected && checks.faceCentered && checks.bothEyesDetected && checks.irisDetected && checks.headPoseValid;

  const estimatedDistanceCm = isInitializing ? null : (positionReport?.estimatedDistanceCm ?? null);
  const stableDistanceCm = isInitializing ? null : (positionReport?.stableDistanceCm ?? estimatedDistanceCm);
  const feedbackMessage = error ? 'Chưa thể bắt đầu. Vui lòng kiểm tra camera và thử lại.' : isInitializing
    ? 'Bật camera và chờ hình ảnh hiển thị.'
    : (positionReport?.feedbackMessage || 'Đang kết nối camera và nhận diện khuôn mặt...');
  const centeringConfig = POSITION_QUALITY_CONFIG.FACE_CENTERING;

  const displayRect = useCameraDisplayRect(videoRef);
  const mappedBox = (positionReport?.boundingBox && checks.faceDetected && displayRect)
    ? mapCameraRectToDisplay(positionReport.boundingBox, displayRect, true)
    : null;

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

  const isPortraitMobile = typeof window !== 'undefined' && window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
  const maxOffsetY = isPortraitMobile ? Math.max(centeringConfig.MAX_OFFSET_Y, 0.16) : centeringConfig.MAX_OFFSET_Y;
  const maxOffsetX = centeringConfig.MAX_OFFSET_X;

  const mappedTargetZone = React.useMemo(() => {
    if (!displayRect) return null;
    const targetZoneCameraRect = {
      xMin: centeringConfig.TARGET_X - maxOffsetX,
      yMin: centeringConfig.TARGET_Y - maxOffsetY,
      width: maxOffsetX * 2,
      height: maxOffsetY * 2,
    };
    return mapCameraRectToDisplay(targetZoneCameraRect, displayRect, true);
  }, [displayRect, centeringConfig.TARGET_X, centeringConfig.TARGET_Y, maxOffsetX, maxOffsetY]);

  return (
    <div className="card stage-card-main position-check-card">
      <div className="stage-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-primary">{config.title}</span>
          <span className="badge badge-secondary">Kiểm tra vị trí</span>
        </div>
        <h2 className="stage-title">Đưa mặt vào đúng vị trí</h2>
        <p className="stage-subtitle">
          {config.instruction}. Giữ đầu thẳng, nhìn vào camera.
        </p>
      </div>
      <AudioButton text={`Dạ, cô chú ${config.instruction.toLowerCase()} nghen. Mình giữ đầu thẳng, nhìn thẳng vào camera và chờ hệ thống báo sẵn sàng nha.`} label="Nghe hướng dẫn" />

      <div className="position-check-layout">
        {/* Left Column: Camera Preview with Live Landmarking & Face Bounding Box */}
        <div className="cam-column" style={{ position: 'relative' }}>

          {/* Camera Activate Button: shown before camera starts. Uses user gesture to avoid iOS Safari block. */}
          {!isActive && !isLoading && !error && (onCameraActivate || onVideoReady) && (
            <div
              className="position-camera-idle"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '24px',
                background: 'var(--color-pale-teal, #f0f9f8)',
                borderRadius: '12px',
                border: '2px dashed var(--color-soft-mint, #b8e8df)',
                marginBottom: '12px',
                minHeight: '160px',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.5 }}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>Camera chưa được bật</p>
              <button
                id="btn-activate-camera-position"
                type="button"
                className="btn btn-primary"
                onClick={() => (onCameraActivate || onVideoReady)?.(null)}
                style={{ minWidth: '160px' }}
              >
                📷 Bật camera
              </button>
            </div>
          )}

          {/* Camera error retry button */}
          {error && (onCameraActivate || onVideoReady) && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '20px',
                background: 'var(--color-error-bg, #fff0f0)',
                borderRadius: '12px',
                border: '1.5px solid var(--color-error, #e55)',
                marginBottom: '12px',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--color-error, #c33)', textAlign: 'center', fontWeight: 600 }}>Lỗi camera</p>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>{error}</p>
              <button
                id="btn-retry-camera-position"
                type="button"
                className="btn btn-secondary"
                onClick={() => (onCameraActivate || onVideoReady)?.(null)}
              >
                🔄 Thử lại
              </button>
            </div>
          )}

          <div className="position-camera-preview" style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', display: (isActive || isLoading) ? 'block' : 'none' }}>
            <CameraView
              videoRef={videoRef}
              stream={stream}
              landmarks={landmarks}
              features={features}
              quality={positionReport?.quality}
              isActive={isActive}
              isLoading={isLoading}
              error={null}
              onVideoReady={onCameraActivate || onVideoReady}
              onPlaybackReadyChange={setPlaybackReady}
              speak={speak}
              voiceEnabled={isVoiceEnabled}
            />

            {/* Show alignment only once real video frames are available. */}
            {!isInitializing && <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: mappedTargetZone ? `${mappedTargetZone.leftPercent}%` : `${(centeringConfig.TARGET_X - maxOffsetX) * 100}%`,
                top: mappedTargetZone ? `${mappedTargetZone.topPercent}%` : `${(centeringConfig.TARGET_Y - maxOffsetY) * 100}%`,
                width: mappedTargetZone ? `${mappedTargetZone.widthPercent}%` : `${maxOffsetX * 200}%`,
                height: mappedTargetZone ? `${mappedTargetZone.heightPercent}%` : `${maxOffsetY * 200}%`,
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
            </div>}

            {/* Face Bounding Box indicator if face detected (mirrored to match scaleX(-1) camera feed) */}
            {positionReport?.boundingBox && checks.faceDetected && (
              <div
                className="face-bounding-box"
                style={{
                  position: 'absolute',
                  left: mappedBox ? `${mappedBox.leftPercent}%` : `${Math.max(0, (1.0 - positionReport.boundingBox.xMin - positionReport.boundingBox.width) * 100)}%`,
                  top: mappedBox ? `${mappedBox.topPercent}%` : `${positionReport.boundingBox.yMin * 100}%`,
                  width: mappedBox ? `${mappedBox.widthPercent}%` : `${positionReport.boundingBox.width * 100}%`,
                  height: mappedBox ? `${mappedBox.heightPercent}%` : `${positionReport.boundingBox.height * 100}%`,
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
                Gần
              </div>
              <div
                className="distance-zone zone-target"
                style={{ flex: `${config.maxDistanceCm - config.minDistanceCm}` }}
                title={`Mục tiêu (${config.targetRangeLabel})`}
              >
                Chuẩn
              </div>
              <div
                className="distance-zone zone-far"
                style={{ flex: `${trackMax - config.maxDistanceCm}` }}
                title={`Quá xa (> ${config.maxDistanceCm} cm)`}
              >
                Xa
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

        <div className="position-checklist-column">
          <div className="checklist-card position-start-card">
            <h3 className="checklist-title">Điều kiện bắt đầu</h3>
            <ul className="checklist-items" role="list">
              <li className={`checklist-item ${faceClear ? 'pass' : 'fail'}`}>
                <span className="check-icon" aria-hidden="true">{faceClear ? '✓' : '○'}</span>
                <div className="check-text">
                  <strong>Thấy rõ mặt</strong>
                  <span>{faceClear ? 'Đã đạt' : 'Nhìn thẳng vào camera'}</span>
                </div>
              </li>
              <li className={`checklist-item ${checks.distanceValid ? 'pass' : 'fail'}`}>
                <span className="check-icon" aria-hidden="true">{checks.distanceValid ? '✓' : '○'}</span>
                <div className="check-text">
                  <strong>Đúng khoảng cách</strong>
                  <span>{checks.distanceValid ? 'Đã đạt' : config.targetRangeLabel}</span>
                </div>
              </li>
            </ul>
            <PositionGuideVideo />
            <div className="checklist-actions" style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              {onRetry && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onRetry}
                  aria-label="Thử lại kiểm tra vị trí"
                >
                  Thử lại
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-large btn-block"
                disabled={!isReady || !checks.distanceValid || !faceClear}
                onClick={onProceed}
                aria-label={config.buttonLabel}
                style={{ flex: 1 }}
              >
                {isReady && checks.distanceValid && faceClear
                  ? 'Bắt đầu kiểm tra'
                  : isInitializing
                  ? error ? 'Kiểm tra lại camera' : isLoading ? 'Đang bật camera…' : !isActive ? 'Cần bật camera để tiếp tục' : 'Đang chờ hình ảnh camera…'
                  : `Đang kiểm tra vị trí (${config.targetRangeLabel})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
