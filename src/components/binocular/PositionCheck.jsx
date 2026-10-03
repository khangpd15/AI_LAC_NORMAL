import React from 'react';
import CameraView from '../CameraView';
import AudioButton from '../audio/AudioButton';
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
  const config = POSITION_CONFIG[testType] || POSITION_CONFIG.COVER_TEST;
  const isInitializing = isLoading || !isActive || !stream;
  const status = isInitializing ? POSITION_STATUS.INITIALIZING : (positionReport?.status || POSITION_STATUS.INITIALIZING);
  const isReady = !isInitializing && status === POSITION_STATUS.READY;

  // Section VI: Pre-test 5-item confirmation checklist
  const [checklist, setChecklist] = React.useState({
    hasHelper: true,
    phoneFixed: true,
    headStraight: true,
    goodLighting: true,
    assistiveLight: true,
  });

  const isChecklistComplete = Boolean(
    checklist.hasHelper &&
    checklist.phoneFixed &&
    checklist.headStraight &&
    checklist.goodLighting &&
    checklist.assistiveLight
  );

  const toggleChecklistItem = (key) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllChecklist = () => {
    const nextVal = !isChecklistComplete;
    setChecklist({
      hasHelper: nextVal,
      phoneFixed: nextVal,
      headStraight: nextVal,
      goodLighting: nextVal,
      assistiveLight: nextVal,
    });
  };

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
    if (isReady && isChecklistComplete && isVoiceEnabled && speak && !spokenReadyRef.current) {
      spokenReadyRef.current = true;
      speak('Vị trí tốt, bấm bắt đầu nghen.');
    }
  }, [isReady, isChecklistComplete, isVoiceEnabled, speak]);

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

  const estimatedDistanceCm = isInitializing ? null : (positionReport?.estimatedDistanceCm ?? null);
  const stableDistanceCm = isInitializing ? null : (positionReport?.stableDistanceCm ?? estimatedDistanceCm);
  const feedbackMessage = isInitializing
    ? 'Đang kết nối camera và nhận diện khuôn mặt...'
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

          <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden', display: (isActive || isLoading) ? 'block' : 'none' }}>
            <CameraView
              videoRef={videoRef}
              stream={stream}
              landmarks={landmarks}
              features={features}
              quality={positionReport?.quality}
              isActive={isActive}
              isLoading={isLoading}
              error={null}
              onVideoReady={undefined}
              speak={speak}
              voiceEnabled={isVoiceEnabled}
            />

            {/* Safe zone for the center point of the detected face. */}
            <div
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
            </div>

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

        {/* Right Column: Pre-test Safety Checklist & Strict Gating */}
        <div className="position-checklist-column">
          <div className="checklist-card">
            <h3 className="checklist-title">Điều kiện bắt đầu</h3>
            <ul className="checklist-items" role="list">
              <li className={`checklist-item ${checks.faceDetected ? 'pass' : 'fail'}`}>
                <span className="check-icon" aria-hidden="true">
                  {checks.faceDetected ? '✓' : '○'}
                </span>
                <div className="check-text">
                  <strong>Thấy khuôn mặt</strong>
                  <span>MediaPipe Face Mesh nhận diện rõ viền mặt</span>
                </div>
              </li>

              <li className={`checklist-item ${checks.faceCentered ? 'pass' : 'fail'}`}>
                <span className="check-icon" aria-hidden="true">
                  {checks.faceCentered ? '✓' : '○'}
                </span>
                <div className="check-text">
                  <strong>Mặt ở giữa khung</strong>
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
                  <strong>Hai mắt rõ</strong>
                  <span>Khóe mắt trong và ngoài mở đều</span>
                </div>
              </li>

              <li className={`checklist-item ${checks.irisDetected ? 'pass' : 'fail'}`}>
                <span className="check-icon" aria-hidden="true">
                  {checks.irisDetected ? '✓' : '○'}
                </span>
                <div className="check-text">
                  <strong>Mống mắt rõ</strong>
                  <span>Mống mắt trái (468) & phải (473)</span>
                </div>
              </li>

              <li className={`checklist-item ${checks.headPoseValid ? 'pass' : 'fail'}`}>
                <span className="check-icon" aria-hidden="true">
                  {checks.headPoseValid ? '✓' : '○'}
                </span>
                <div className="check-text">
                  <strong>Đầu thẳng</strong>
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
                  <strong>Đúng khoảng cách</strong>
                  <span>Ổn định liên tục qua nhiều khung hình</span>
                </div>
              </li>
            </ul>

            {/* Section VI: Pre-test confirmation checklist */}
            <div className="pretest-checklist-box" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                  Xác nhận điều kiện Cover Test
                </strong>
                <button
                  type="button"
                  onClick={toggleAllChecklist}
                  style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  {isChecklistComplete ? 'Bỏ chọn' : 'Chọn tất cả'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: '#334155' }}>
                <label style={{ display: 'flex', gap: '8px', cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={checklist.hasHelper}
                    onChange={() => toggleChecklistItem('hasHelper')}
                    style={{ marginTop: '2px' }}
                  />
                  <span><strong>1. Người hỗ trợ:</strong> Có người hỗ trợ đứng bên cạnh để thực hiện thao tác cover.</span>
                </label>

                <label style={{ display: 'flex', gap: '8px', cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={checklist.phoneFixed}
                    onChange={() => toggleChecklistItem('phoneFixed')}
                    style={{ marginTop: '2px' }}
                  />
                  <span><strong>2. Cố định máy:</strong> Điện thoại được cố định trên giá đỡ/bàn, không cầm tay.</span>
                </label>

                <label style={{ display: 'flex', gap: '8px', cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={checklist.headStraight}
                    onChange={() => toggleChecklistItem('headStraight')}
                    style={{ marginTop: '2px' }}
                  />
                  <span><strong>3. Đầu thẳng:</strong> Người được test giữ đầu thẳng và hướng về điện thoại.</span>
                </label>

                <label style={{ display: 'flex', gap: '8px', cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={checklist.goodLighting}
                    onChange={() => toggleChecklistItem('goodLighting')}
                    style={{ marginTop: '2px' }}
                  />
                  <span><strong>4. Ánh sáng:</strong> Khu vực kiểm tra đủ sáng, rõ hai mắt.</span>
                </label>

                <label style={{ display: 'flex', gap: '8px', cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={checklist.assistiveLight}
                    onChange={() => toggleChecklistItem('assistiveLight')}
                    style={{ marginTop: '2px' }}
                  />
                  <span><strong>5. Đèn hỗ trợ:</strong> Người hỗ trợ chiếu đèn nhỏ từ phía sau camera theo protocol.</span>
                </label>
              </div>
            </div>

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
                disabled={!isChecklistComplete || !isReady || !checks.distanceValid || !checks.faceDetected || !checks.bothEyesDetected}
                onClick={onProceed}
                aria-label={config.buttonLabel}
                style={{ flex: 1 }}
              >
                {!isChecklistComplete
                  ? 'Cần xác nhận 5 điều kiện trên'
                  : isReady && checks.distanceValid && checks.faceDetected && checks.bothEyesDetected
                  ? '✓ BẮT ĐẦU KIỂM TRA (3 CHU KỲ)'
                  : 'Đang điều chỉnh cự ly (30–50 cm)'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
