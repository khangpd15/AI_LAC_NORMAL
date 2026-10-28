import AudioGuide from '../audio/ListeningExperience';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  STRABISMUS_TYPES,
  AFFECTED_EYE,
  processStrabismusFrame,
  createClinicalSnapshot,
  angleToPrismDiopters,
} from '../../services/cv/strabismusEngine';
import {
  STRABISMUS_DEFINITIONS,
  ANGLE_PRESETS,
  EYE_OPTIONS,
} from './strabismusData';
import VirtualJoystick from './VirtualJoystick';
import StrabismusEducationModal from './StrabismusEducationModal';
import {
  startCameraStream,
  stopCameraStream,
  getCameraErrorMessage,
} from '../../services/cameraService';
import {
  initializeFaceMesh,
  sendFrameToFaceMesh,
  isFaceMeshBusy,
  closeFaceMesh,
} from '../../services/faceMeshService';
import audioService from '../../services/audioService';
import { getSimulationProcessingSize, getSimulationRenderSize, stabilizeSimulationLandmarks } from '../../services/cv/simulationTracking';
import './strabismusSimulation.css';

export default function StrabismusSimulationPage({ onExit, onStartScreening }) {
  // Video & Canvas DOM references
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const faceMeshRef = useRef(null);
  const animFrameRef = useRef(null);
  const landmarksRef = useRef(null);
  const meshBusyRef = useRef(false);
  const landmarkTimeRef = useRef(0);
  const inferenceFrameRef = useRef(null);
  const trackedFrameRef = useRef(null);
  const frameVersionRef = useRef(0);
  const submittedVideoTimeRef = useRef(-1);
  const eyeTrackingStateRef = useRef({});
  const [mobilePipeline] = useState(() => navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  // Camera & Tracking states
  const [cameraState, setCameraState] = useState('INIT'); // 'INIT' | 'RUNNING' | 'ERROR'
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const isMirrored = facingMode === 'user';
  const [fps, setFps] = useState(0);
  const [hasFace, setHasFace] = useState(false);

  // Simulation parameters
  const [type, setType] = useState(STRABISMUS_TYPES.ESOTROPIA); // Default: Lác trong
  const [affectedEye, setAffectedEye] = useState(AFFECTED_EYE.RIGHT); // Default: Mắt phải
  const [angleDeg, setAngleDeg] = useState(12); // Start with a subtle, visible deviation
  const [customVector, setCustomVector] = useState({ x: 0, y: 0 });
  const [showHud, setShowHud] = useState(false); // Clean camera filter mode by default!
  const [showHirschberg, setShowHirschberg] = useState(false); // Off by default for realistic camera look
  const [isHoldingOriginal, setIsHoldingOriginal] = useState(false);
  const [alternatingEye, setAlternatingEye] = useState('RIGHT');

  // UI Drawer & Modal states
  const [isEduModalOpen, setIsEduModalOpen] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [snapshotToast, setSnapshotToast] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);

  // Alternating strabismus timer
  useEffect(() => {
    if (affectedEye !== AFFECTED_EYE.ALTERNATING) return;
    const interval = setInterval(() => {
      setAlternatingEye((prev) => (prev === 'RIGHT' ? 'LEFT' : 'RIGHT'));
    }, 3200);
    return () => clearInterval(interval);
  }, [affectedEye]);

  // Read current definition
  const currentDef = STRABISMUS_DEFINITIONS[type] || STRABISMUS_DEFINITIONS[STRABISMUS_TYPES.ESOTROPIA];

  // Voice narration handler
  const speakCurrentScript = useCallback(
    (script) => {
      if (!isVoiceEnabled || !script) return;
      setIsSpeaking(true);
      audioService.speak(script, {
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [isVoiceEnabled]
  );

  const toggleVoice = () => {
    if (isSpeaking) {
      audioService.stop();
      setIsSpeaking(false);
      setIsVoiceEnabled(false);
    } else {
      setIsVoiceEnabled(true);
      setIsSpeaking(true);
      audioService.speak(currentDef.voiceScript, { onEnd: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) });
    }
  };

  // Speak when type changes (if voice enabled)
  const handleTypeSelect = (newType) => {
    setType(newType);
    if (newType === STRABISMUS_TYPES.CUSTOM) {
      setShowAdvanced(true);
    }
    const def = STRABISMUS_DEFINITIONS[newType];
    if (def && isVoiceEnabled) {
      speakCurrentScript(def.voiceScript);
    }
  };

  // 1. Initialize Camera and FaceMesh pipeline
  useEffect(() => {
    let isCancelled = false;

    async function initPipeline() {
      try {
        setCameraState('INIT');
        setCameraError(null);
        landmarksRef.current = null;
        landmarkTimeRef.current = 0;
        inferenceFrameRef.current = document.createElement('canvas');
        trackedFrameRef.current = document.createElement('canvas');
        frameVersionRef.current = 0;
        submittedVideoTimeRef.current = -1;
        eyeTrackingStateRef.current = {};
        meshBusyRef.current = false;
        setHasFace(false);

        // 1. Start Camera
        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: mobilePipeline ? 640 : 1280, max: mobilePipeline ? 1280 : 1920 },
            height: { ideal: mobilePipeline ? 480 : 720, max: mobilePipeline ? 1280 : 1080 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        };

        const stream = await startCameraStream(videoRef.current, constraints);
        if (isCancelled) {
          stopCameraStream(stream, videoRef.current);
          return;
        }

        streamRef.current = stream;

        // 2. Initialize MediaPipe FaceMesh
        const faceMesh = await initializeFaceMesh((results) => {
          if (isCancelled) return;
          const now = performance.now();
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            const next = results.multiFaceLandmarks[0];
            const deltaMs = now - landmarkTimeRef.current;
            landmarksRef.current = stabilizeSimulationLandmarks(next, deltaMs < (mobilePipeline ? 700 : 250) ? landmarksRef.current : null, deltaMs, { mobile: mobilePipeline });
            landmarkTimeRef.current = now;
            setHasFace(true);
          } else {
            // Advance the camera without an effect when detection is lost.
            // Freezing the previous matched image causes visible stop/start.
            landmarksRef.current = null;
            eyeTrackingStateRef.current = {};
            setHasFace(false);
          }
          const source = inferenceFrameRef.current;
          const tracked = trackedFrameRef.current;
          if (source.width && source.height) {
            if (tracked.width !== source.width || tracked.height !== source.height) {
              tracked.width = source.width;
              tracked.height = source.height;
            }
            tracked.getContext('2d').drawImage(source, 0, 0);
            frameVersionRef.current += 1;
          }
        });

        faceMeshRef.current = faceMesh;
        setCameraState('RUNNING');
      } catch (err) {
        if (isCancelled) return;
        console.error('[StrabismusSimulation] Init error:', err);
        setCameraState('ERROR');
        setCameraError(getCameraErrorMessage(err));
      }
    }

    const videoElement = videoRef.current;
    initPipeline();

    return () => {
      isCancelled = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (streamRef.current) {
        stopCameraStream(streamRef.current, videoElement);
        streamRef.current = null;
      }
      closeFaceMesh();
      audioService.stop();
    };
  }, [facingMode, cameraAttempt, mobilePipeline]);

  // 2. Main Render & Inference Animation Loop
  useEffect(() => {
    if (cameraState !== 'RUNNING') return;

    let lastFpsTime = performance.now();
    let frameCount = 0;
    let lastRenderedVersion = -1;


    const renderLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        // Send frame to FaceMesh at controlled cadence
        if (!meshBusyRef.current && faceMeshRef.current && !isFaceMeshBusy(faceMeshRef.current) && !video.paused && submittedVideoTimeRef.current !== video.currentTime) {
          meshBusyRef.current = true;
          submittedVideoTimeRef.current = video.currentTime;
          const source = inferenceFrameRef.current;
          const size = getSimulationProcessingSize(video.videoWidth, video.videoHeight, mobilePipeline ? 640 : 960);
          if (source.width !== size.width || source.height !== size.height) {
            source.width = size.width;
            source.height = size.height;
          }
          source.getContext('2d').drawImage(video, 0, 0, source.width, source.height);
          sendFrameToFaceMesh(faceMeshRef.current, video, source).finally(() => {
            meshBusyRef.current = false;
          });
        }

        // Each captured image is warped once, with landmarks from that image.
        // Reusing old landmarks over a newer live video frame causes eye jumps.
        if (lastRenderedVersion === frameVersionRef.current) {
          animFrameRef.current = requestAnimationFrame(renderLoop);
          return;
        }
        lastRenderedVersion = frameVersionRef.current;
        const displaySource = frameVersionRef.current > 0 ? trackedFrameRef.current : video;

        // Preserve viewport proportions while bounding the CPU pixel workload.
        const canvasRect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const sourceW = displaySource.videoWidth || displaySource.width || 640;
        const sourceH = displaySource.videoHeight || displaySource.height || 480;
        const renderSize = getSimulationRenderSize(
          canvasRect.width > 0 ? canvasRect.width * dpr : sourceW,
          canvasRect.height > 0 ? canvasRect.height * dpr : sourceH,
          sourceW, sourceH, mobilePipeline,
        );
        const targetW = renderSize.width;
        const targetH = renderSize.height;
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width  = targetW;
          canvas.height = targetH;
        }


        // Render simulation or original
        const effectiveConfig = isHoldingOriginal
          ? {
              type: STRABISMUS_TYPES.ORTHOTROPIA,
              affectedEye,
              angleDeg: 0,
              showHud: false,
              showHirschberg: false,
              isMirrored,
            }
          : {
              type,
              affectedEye,
              angleDeg,
              customVector,
              showHud,
              showHirschberg,
              alternatingState: alternatingEye,
              isMirrored,
            };

        processStrabismusFrame({
          canvas,
          videoElement: displaySource,
          landmarks: landmarksRef.current,
          simulationConfig: { ...effectiveConfig, renderMode: mobilePipeline ? 'continuous' : 'texture' },
          trackingState: eyeTrackingStateRef.current,
        });

        // Compute FPS
        frameCount++;
        const now = performance.now();
        if (now - lastFpsTime >= 1000) {
          setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
          frameCount = 0;
          lastFpsTime = now;
        }
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    cameraState,
    type,
    affectedEye,
    angleDeg,
    customVector,
    showHud,
    showHirschberg,
    isHoldingOriginal,
    alternatingEye,
    isMirrored,
    mobilePipeline,
  ]);

  // 3. Snapshot Handler
  const handleTakeSnapshot = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = await createClinicalSnapshot({
        sourceCanvas: canvas,
        simulationConfig: {
          type,
          affectedEye,
          angleDeg: type === STRABISMUS_TYPES.ORTHOTROPIA || isHoldingOriginal ? 0 : angleDeg,
        },
        isMirrored,
      });

      // Trigger automatic PNG download
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `RemiCare_Strabismus_${type}_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSnapshotToast('Đã lưu ảnh phân tích mô phỏng thành công!');
      setTimeout(() => setSnapshotToast(null), 3000);
    } catch (err) {
      console.error('[StrabismusSimulation] Snapshot error:', err);
      setSnapshotToast('Không thể xuất ảnh, vui lòng thử lại.');
      setTimeout(() => setSnapshotToast(null), 3000);
    }
  };

  // Flip camera (user <-> environment)
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  return (
    <div className="strabismus-sim-container">
      {/* Hidden processing video element */}
      <video
        ref={videoRef}
        className="sim-hidden-video"
        playsInline
        muted
        autoPlay
      />

      {/* Top Header Bar */}
      <header className="sim-top-nav">
        <div className="nav-left">
          <button
            type="button"
            className="sim-btn-back"
            onClick={onExit}
            title="Quay lại trang chủ"
          >
            <span className="back-arrow">‹</span>
            <span>Trang chủ</span>
          </button>
          <div className="sim-title-group">
            <span className="sim-brand-title">RemiCare AI</span>
            <h1 className="sim-feature-title">Mô phỏng mắt lác</h1>
          </div>
        </div>

        <div className="nav-center-telemetry">
          {cameraState === 'RUNNING' && (
            <>
              <div className={`telemetry-badge ${hasFace ? 'badge-ok' : 'badge-warn'}`}>
                <span className="dot-pulse" />
                <span>{hasFace ? 'Đã nhận diện khuôn mặt' : 'Đang quét tìm khuôn mặt...'}</span>
              </div>
              <div className="telemetry-badge badge-fps">
                <span>{fps} FPS</span>
              </div>
            </>
          )}
        </div>

        <div className="nav-right-actions">
          <button
            type="button"
            className={`sim-tool-btn ${isVoiceEnabled ? 'active' : ''}`}
            onClick={toggleVoice}
            title={isVoiceEnabled ? 'Tắt giọng nói Lumi' : 'Bật giọng nói Lumi'}
          >
            <span className="tool-icon">{isVoiceEnabled ? '🔊' : '🔇'}</span>
            <span className="tool-text">Lumi</span>
          </button>

          <button
            type="button"
            className="sim-tool-btn"
            onClick={() => setIsEduModalOpen(true)}
            title="Xem giải thích y khoa chi tiết"
          >
            <span className="tool-icon">📖</span>
            <span className="tool-text">Kiến thức</span>
          </button>

          <button
            type="button"
            className="sim-tool-btn sim-btn-cta-screening"
            onClick={onStartScreening}
            title="Chuyển sang quy trình Sàng lọc lâm sàng"
          >
            <span className="tool-icon">📋</span>
            <span className="tool-text">Sàng lọc</span>
          </button>
        </div>
      </header>

      {/* Main Simulation Viewport */}
      <details className="sim-listening-panel"><summary>Nghe hướng dẫn mô phỏng cùng Lumi</summary><AudioGuide guideId="simulation" compact /></details>
      <div className="sim-page-intro"><div><span className="sim-eyebrow">TRẢI NGHIỆM TRỰC QUAN</span><h2>Hiểu từng hướng lệch của mắt</h2><p>Chọn kiểu lệch, chọn mắt và kéo thanh mức độ để quan sát trực tiếp.</p></div><span className="sim-education-note">Mô phỏng minh họa · Không phải kết quả đo</span></div>
      <main className="sim-main-stage">
        {/* Camera Stage Frame */}
        <div className="sim-viewport-frame">
          {cameraState === 'INIT' && (
            <div className="sim-loading-curtain">
              <div className="sim-spinner-ring" />
              <h3>Đang mở camera…</h3>
              <p>Vui lòng cấp quyền truy cập camera trên trình duyệt của bạn</p>
            </div>
          )}

          {cameraState === 'ERROR' && (
            <div className="sim-error-curtain">
              <div className="error-icon">⚠️</div>
              <h3>Không thể kết nối camera</h3>
              <p>{cameraError || 'Đã có lỗi xảy ra khi truy cập webcam.'}</p>
              <button
                type="button"
                className="btn-retry-camera"
                onClick={() => setCameraAttempt((attempt) => attempt + 1)}
              >
                Thử lại camera
              </button>
            </div>
          )}

          {/* Real-time Rendered Canvas */}
          <canvas
            ref={canvasRef}
            className="sim-display-canvas"
            style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
          />

          {cameraState === 'RUNNING' && <div className={`sim-camera-guidance ${hasFace ? 'tracking' : ''}`} role="status"><span />{hasFace ? 'Nhìn thẳng vào camera để quan sát rõ hiệu ứng' : 'Đưa khuôn mặt vào giữa khung hình'}</div>}
          {/* Quick On-Screen Control Floaters */}
          <div className="sim-screen-overlays">
            {/* Top Bar: Left Filter Tag + Right Tool Chips */}
            <div className="sim-overlay-header">
              <div className="sim-overlay-filter-badge">
                <span className="filter-badge-sparkle">✨</span>
                <span className="filter-badge-title">
                  {type === STRABISMUS_TYPES.ORTHOTROPIA
                    ? 'Ảnh gốc · Không hiệu ứng'
                    : isHoldingOriginal ? 'Đang xem ảnh gốc' : `${currentDef.title} · ${angleDeg}°`}
                </span>
              </div>

              {/* Top Right Quick Toggles */}
              <div className="sim-overlay-tools-top">
                <button
                  type="button"
                  className={`btn-overlay-chip ${showHirschberg ? 'active' : ''}`}
                  aria-pressed={showHirschberg}
                  onClick={() => setShowHirschberg((s) => !s)}
                  title="Bật/Tắt ánh phản xạ giác mạc Hirschberg"
                >
                  <span>Phản xạ ánh sáng</span>
                </button>

                <button
                  type="button"
                  className={`btn-overlay-chip ${showHud ? 'active' : ''}`}
                  aria-pressed={showHud}
                  onClick={() => setShowHud((s) => !s)}
                  title="Bật/Tắt đường viền mi mắt & Vector thị giác"
                >
                  <span>Đường hướng dẫn</span>
                </button>

                <button
                  type="button"
                  className="btn-overlay-chip"
                  onClick={handleFlipCamera}
                  title="Đổi camera trước / sau"
                >
                  <span>🔄 Đổi cam</span>
                </button>
              </div>
            </div>

            {/* Bottom Floating Bar */}
            <div className="sim-overlay-tools-bottom">
              {/* Hold to Compare Button */}
              <button
                type="button"
                className={`btn-hold-compare ${isHoldingOriginal ? 'active' : ''}`}
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setIsHoldingOriginal(true); }}
                onPointerUp={() => setIsHoldingOriginal(false)}
                onPointerCancel={() => setIsHoldingOriginal(false)}
                onLostPointerCapture={() => setIsHoldingOriginal(false)}
                onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setIsHoldingOriginal(true); } }}
                onKeyUp={() => setIsHoldingOriginal(false)}
                onBlur={() => setIsHoldingOriginal(false)}
                title="Giữ chuột hoặc chạm giữ để so sánh với mắt ban đầu"
              >
                <span className="btn-icon">👁️</span>
                <span>{isHoldingOriginal ? 'Đang xem: Ảnh gốc' : 'Giữ để xem gốc'}</span>
              </button>

              {/* Snapshot Button */}
              <button
                type="button"
                className="btn-snapshot-action"
                disabled={cameraState !== 'RUNNING' || !hasFace}
                onClick={handleTakeSnapshot}
                title="Chụp ảnh và tải về kết quả mô phỏng"
              >
                <span className="btn-icon">📸</span>
                <span>Chụp ảnh</span>
              </button>
            </div>

            {/* Toast Notification */}
            {snapshotToast && (
              <div className="sim-toast-popup" role="status">
                <span>✓ {snapshotToast}</span>
              </div>
            )}
          </div>
        </div>

        <aside className="sim-control-deck" aria-label="Điều chỉnh mô phỏng">
          <div className="sim-deck-title"><div><span className="sim-eyebrow">BẢNG ĐIỀU CHỈNH</span><h2>Tạo mô phỏng của bạn</h2></div><button type="button" className="sim-reset" onClick={() => { setType(STRABISMUS_TYPES.ESOTROPIA); setAffectedEye(AFFECTED_EYE.RIGHT); setAngleDeg(12); setCustomVector({ x: 0, y: 0 }); setShowHud(false); setShowHirschberg(false); setShowAdvanced(false); }}>Đặt lại</button></div>
          <section className="sim-step"><h3><b>1</b> Chọn hướng lệch</h3><div className="presets-grid">
            {[STRABISMUS_TYPES.ESOTROPIA, STRABISMUS_TYPES.EXOTROPIA].map((id) => {
              const definition = STRABISMUS_DEFINITIONS[id];
              return <button key={id} type="button" className={`btn-preset-card ${type === id ? 'active' : ''}`} aria-pressed={type === id} onClick={() => handleTypeSelect(id)}><EyeDirection type={id} /><span className="card-info"><strong>{definition.title}</strong><small>{({ ESOTROPIA: 'Về phía mũi', EXOTROPIA: 'Về phía tai' })[id]}</small></span><span className="sim-card-check">{type === id ? '✓' : ''}</span></button>;
            })}
          </div><button type="button" className="sim-original-option" aria-pressed={type === STRABISMUS_TYPES.ORTHOTROPIA} onClick={() => handleTypeSelect(STRABISMUS_TYPES.ORTHOTROPIA)}>◎ Xem ảnh gốc · Không áp dụng hiệu ứng</button></section>
          <section className="sim-step"><h3><b>2</b> Chọn mắt áp dụng</h3><div className="eye-selector-group" aria-label="Chọn mắt áp dụng">{EYE_OPTIONS.map((option) => <button key={option.id} type="button" aria-pressed={affectedEye === option.id} className={`btn-eye-chip ${affectedEye === option.id ? 'active' : ''}`} onClick={() => setAffectedEye(option.id)}>{option.label}</button>)}</div><p className="sim-field-help">Trái / phải theo phía của bạn. {isMirrored ? 'Camera trước hiển thị như gương, cùng chiều chuyển động của bạn.' : 'Camera sau hiển thị theo hướng chụp thực tế.'}{affectedEye === AFFECTED_EYE.ALTERNATING && ` Đang áp dụng: ${alternatingEye === 'RIGHT' ? 'mắt phải' : 'mắt trái'}.`}</p></section>
          <section className="sim-step"><h3><b>3</b> Điều chỉnh mức độ <output htmlFor="sim-deviation">{type === STRABISMUS_TYPES.ORTHOTROPIA ? 0 : angleDeg}°</output></h3><input id="sim-deviation" aria-label="Góc lệch mô phỏng" type="range" min="0" max="35" step="1" value={angleDeg} disabled={type === STRABISMUS_TYPES.ORTHOTROPIA} onChange={(event) => setAngleDeg(Number(event.target.value))} className="sim-angle-slider" /><div className="slider-ticks-row"><span>0° · Không lệch</span><span>35° · Lệch rõ</span></div><div className="presets-btn-row">{ANGLE_PRESETS.map((preset) => <button key={preset.label} type="button" disabled={type === STRABISMUS_TYPES.ORTHOTROPIA} aria-pressed={angleDeg === preset.angleDeg} className={`btn-angle-chip ${angleDeg === preset.angleDeg ? 'active' : ''}`} onClick={() => setAngleDeg(preset.angleDeg)}>{preset.label} <small>{preset.angleDeg}°</small></button>)}</div><p className="sim-field-help">Góc đặt cho hiệu ứng, không phải độ lác đo từ camera.</p></section>
          <div className="sim-current-explanation"><span className="sim-eyebrow">BẠN ĐANG QUAN SÁT</span><strong>{currentDef.title}</strong><p>{type === STRABISMUS_TYPES.ORTHOTROPIA ? 'Hình ảnh camera gốc, chưa áp dụng dịch chuyển mắt.' : currentDef.summary}</p>{showHirschberg && <p>{currentDef.hirschbergNote}</p>}</div>
          <details className="sim-advanced" open={showAdvanced} onToggle={(event) => setShowAdvanced(event.currentTarget.open)}><summary>Tùy chỉnh hướng lệch tự do</summary><p className="sim-field-help">Kéo về “Trong” để hướng về mũi, “Ngoài” để hướng về tai. Kéo xa tâm để tăng độ lệch.</p><VirtualJoystick value={customVector} onChange={(vector) => { setCustomVector(vector); setType(STRABISMUS_TYPES.CUSTOM); }} size={160} label="Hướng lệch phối hợp" /><p className="sim-field-help">Quy đổi góc đặt: ~{angleToPrismDiopters(type === STRABISMUS_TYPES.ORTHOTROPIA ? 0 : angleDeg)}Δ.</p></details>
        </aside>
      </main>

      {/* Educational Fullscreen Modal */}
      <StrabismusEducationModal
        isOpen={isEduModalOpen}
        onClose={() => setIsEduModalOpen(false)}
      />
    </div>
  );
}

function EyeDirection({ type }) {
  const dx = type === STRABISMUS_TYPES.ESOTROPIA ? 5 : type === STRABISMUS_TYPES.EXOTROPIA ? -5 : 0;
  return <svg className="sim-eye-diagram" width="62" height="32" viewBox="0 0 62 32" fill="none" aria-hidden="true"><defs><clipPath id={`eye-${type}`}><path d="M3 16Q15 2 27 16Q15 30 3 16ZM35 16Q47 2 59 16Q47 30 35 16Z" /></clipPath></defs><path d="M3 16Q15 2 27 16Q15 30 3 16ZM35 16Q47 2 59 16Q47 30 35 16Z" fill="white" stroke="currentColor" strokeWidth="1.5" /><g clipPath={`url(#eye-${type})`} fill="currentColor"><circle cx={15 + dx} cy="16" r="5" /><circle cx="47" cy="16" r="5" /></g><circle cx={14 + dx} cy="15" r="1.3" fill="white" /><circle cx="46" cy="15" r="1.3" fill="white" /></svg>;
}
