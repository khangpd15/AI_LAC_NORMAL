import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VisualEffectEngine } from './VisualEffectEngine';
import { useFaceMesh } from '../../hooks/useFaceMesh';
import { eyeCoverDetector } from '../../services/cv/eyeCoverDetector';
import {
  attachStreamToVideo,
  getCameraErrorMessage,
  startCameraStream,
  stopCameraStream,
} from '../../services/cameraService';

/**
 * CameraView
 * Renders the realtime camera stream onto a full-viewport Canvas with VisualEffectEngine.
 * No card frames, no borders, true immersive fullscreen.
 */
export default function CameraView({
  effect = 'normal',
  effectOptions = {},
  onPhaseChange,
  onEyeCoverDetected,
  isCameraActive = true,
  onCameraReady,
  onClick,
  className = '',
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  const [hasCameraStream, setHasCameraStream] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const simAnimIdRef = useRef(null);
  const simCanvasRef = useRef(null);
  const activeStreamRef = useRef(null);

  // Callback refs to keep callbacks fresh without triggering effect cleanups
  const onCameraReadyRef = useRef(onCameraReady);
  useEffect(() => {
    onCameraReadyRef.current = onCameraReady;
  }, [onCameraReady]);

  const onEyeCoverDetectedRef = useRef(onEyeCoverDetected);
  useEffect(() => {
    onEyeCoverDetectedRef.current = onEyeCoverDetected;
  }, [onEyeCoverDetected]);

  const onPhaseChangeRef = useRef(onPhaseChange);
  useEffect(() => {
    onPhaseChangeRef.current = onPhaseChange;
  }, [onPhaseChange]);

  // Initialize camera stream (only runs when requested)
  const initCamera = useCallback(async () => {
    setCameraError(null);
    setHasCameraStream(false);
    try {
      if (activeStreamRef.current) {
        stopCameraStream(activeStreamRef.current, videoRef.current);
        activeStreamRef.current = null;
      }

      const stream = await startCameraStream(videoRef.current);
      activeStreamRef.current = stream;

      if (videoRef.current) {
        await attachStreamToVideo(videoRef.current, stream);
      }

      setHasCameraStream(true);
      onCameraReadyRef.current?.();
    } catch (err) {
      console.warn('[CameraView] getUserMedia error:', err);
      setCameraError(getCameraErrorMessage(err));
    }
  }, []);

  // Fallback simulated camera stream (for testing or systems without physical webcam)
  const initSimulatedCamera = useCallback(() => {
    try {
      const width = 1280;
      const height = 720;
      const simCanvas = document.createElement('canvas');
      simCanvas.width = width;
      simCanvas.height = height;
      simCanvasRef.current = simCanvas;
      const ctx = simCanvas.getContext('2d');

      const startTime = performance.now();
      const renderSim = (now) => {
        const elapsed = (now - startTime) * 0.001;
        // Background room gradient
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#10222a');
        bgGrad.addColorStop(1, '#060d11');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Ambient lighting
        ctx.fillStyle = 'rgba(0, 171, 155, 0.08)';
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.45, 260, 0, Math.PI * 2);
        ctx.fill();

        // Simulated person head & face
        const headX = width * 0.5 + Math.sin(elapsed * 0.8) * 8;
        const headY = height * 0.48 + Math.cos(elapsed * 1.1) * 6;

        // Neck
        ctx.fillStyle = '#dca783';
        ctx.fillRect(headX - 35, headY + 70, 70, 90);

        // Head oval
        ctx.beginPath();
        ctx.ellipse(headX, headY, 110, 140, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#eec3a3';
        ctx.fill();

        // Hair
        ctx.beginPath();
        ctx.ellipse(headX, headY - 60, 115, 90, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#2c221e';
        ctx.fill();

        // Eyes
        const blink = Math.sin(elapsed * 2.5) > 0.98;
        const eyeY = headY - 10;
        const eyeOffset = 38;

        if (blink) {
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(headX - eyeOffset - 16, eyeY);
          ctx.lineTo(headX - eyeOffset + 16, eyeY);
          ctx.moveTo(headX + eyeOffset - 16, eyeY);
          ctx.lineTo(headX + eyeOffset + 16, eyeY);
          ctx.stroke();
        } else {
          // Eyeballs
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(headX - eyeOffset, eyeY, 18, 12, 0, 0, Math.PI * 2);
          ctx.ellipse(headX + eyeOffset, eyeY, 18, 12, 0, 0, Math.PI * 2);
          ctx.fill();

          // Iris
          const pupilX = Math.sin(elapsed * 0.5) * 4;
          ctx.fillStyle = '#3a2318';
          ctx.beginPath();
          ctx.arc(headX - eyeOffset + pupilX, eyeY, 7, 0, Math.PI * 2);
          ctx.arc(headX + eyeOffset + pupilX, eyeY, 7, 0, Math.PI * 2);
          ctx.fill();
        }

        // Nose
        ctx.strokeStyle = '#c6926f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(headX, headY - 2);
        ctx.lineTo(headX - 6, headY + 30);
        ctx.lineTo(headX + 6, headY + 30);
        ctx.stroke();

        // Smile
        ctx.beginPath();
        ctx.arc(headX, headY + 55, 24, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.strokeStyle = '#a6544a';
        ctx.lineWidth = 4;
        ctx.stroke();

        simAnimIdRef.current = requestAnimationFrame(renderSim);
      };

      simAnimIdRef.current = requestAnimationFrame(renderSim);

      const stream = simCanvas.captureStream(30);
      if (videoRef.current) {
        if (activeStreamRef.current) {
          stopCameraStream(activeStreamRef.current, videoRef.current);
        }
        activeStreamRef.current = stream;
        attachStreamToVideo(videoRef.current, stream);
        setHasCameraStream(true);
        setCameraError(null);
        onCameraReadyRef.current?.();
      }
    } catch (err) {
      console.error('[CameraView] Simulation error:', err);
    }
  }, []);

  const isSevereStage = effect === 'severeAmblyopia';

  // Realtime AI Eye & Hand Occlusion Detection callback (FaceMesh)
  const handleFaceMeshResults = useCallback((results) => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    try {
      const landmarks = results?.multiFaceLandmarks;
      const detection = eyeCoverDetector.detect(video, landmarks);
      // Chỉ gửi tín hiệu khi đang ở Giai đoạn 7 (severeAmblyopia)
      if (isSevereStage) {
        onEyeCoverDetectedRef.current?.({
          isCovered: detection.isCovered,
          side: detection.side,
          byAI: true,
        });
      }
    } catch (err) {
      console.warn('[CameraView] eyeCoverDetector error:', err);
    }
  }, [isSevereStage]);

  const { startLoop, stopLoop } = useFaceMesh(handleFaceMeshResults);

  // Reset detector trạng thái sạch sẽ mỗi khi bước vào Giai đoạn 7
  useEffect(() => {
    if (isSevereStage) {
      eyeCoverDetector.reset();
    }
  }, [isSevereStage]);

  // FaceMesh AI: Tải trước (pre-load) ngay khi camera sẵn sàng
  // để khi người dùng đến Giai đoạn 7 mô hình đã sẵn sàng trong RAM, phản hồi ngay lập tức!
  useEffect(() => {
    const video = videoRef.current;
    if (hasCameraStream && video) {
      startLoop(video).catch((err) => {
        console.warn('[CameraView] FaceMesh startLoop non-fatal:', err);
      });
    } else {
      stopLoop();
    }
    return () => {
      stopLoop();
    };
  }, [hasCameraStream, startLoop, stopLoop]);

  const effectRef = useRef(effect);
  useEffect(() => {
    effectRef.current = effect;
  }, [effect]);

  const effectOptionsRef = useRef(effectOptions);
  useEffect(() => {
    effectOptionsRef.current = effectOptions;
  }, [effectOptions]);

  // Request camera when active — clean up ONLY when unmounted or deactivated
  useEffect(() => {
    const videoEl = videoRef.current;

    if (isCameraActive) {
      initCamera();
    }

    return () => {
      if (simAnimIdRef.current) {
        cancelAnimationFrame(simAnimIdRef.current);
        simAnimIdRef.current = null;
      }
      if (activeStreamRef.current) {
        stopCameraStream(activeStreamRef.current, videoEl);
        activeStreamRef.current = null;
      } else if (videoEl?.srcObject) {
        stopCameraStream(videoEl.srcObject, videoEl);
      }
      if (engineRef.current) {
        engineRef.current.stop();
        engineRef.current = null;
      }
    };
  }, [isCameraActive, initCamera]);

  // Setup VisualEffectEngine ONCE when camera stream becomes ready
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !hasCameraStream) return;

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const handleVideoReady = () => {
      resizeCanvas();

      if (!engineRef.current) {
        engineRef.current = new VisualEffectEngine(video, canvas);
      }

      engineRef.current.setEffect(effectRef.current, {
        ...effectOptionsRef.current,
        onPhaseChange: (p) => onPhaseChangeRef.current?.(p),
        onEyeCoverDetected: (d) => onEyeCoverDetectedRef.current?.(d),
      });
      engineRef.current.start();
    };

    if (video.readyState >= 2) {
      handleVideoReady();
    } else {
      video.addEventListener('loadedmetadata', handleVideoReady, { once: true });
    }

    window.addEventListener('resize', resizeCanvas);

    return () => {
      video.removeEventListener('loadedmetadata', handleVideoReady);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [hasCameraStream]); // ONLY runs when stream starts!

  // Update engine effect dynamically without stopping or interrupting rendering
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setEffect(effect, {
        ...effectOptions,
        onPhaseChange: (p) => onPhaseChangeRef.current?.(p),
        onEyeCoverDetected: (d) => onEyeCoverDetectedRef.current?.(d),
      });
    }
  }, [effect, effectOptions]);

  return (
    <div
      className={`camera-fullscreen-viewport ${className}`}
      onClick={onClick}
    >
      {/* Hidden source video element - offscreen nhưng vẫn active để trình duyệt không ngưng giải mã khung hình */}
      <video
        ref={videoRef}
        playsInline
        autoPlay
        muted
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0.001,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />

      {/* Main Fullscreen Realtime Canvas */}
      <canvas
        ref={canvasRef}
        className={`fullscreen-canvas-renderer ${
          effect === 'blur'
            ? 'canvas-effect-blur'
            : effect === 'amblyopia'
            ? 'canvas-effect-amblyopia'
            : effect === 'severeAmblyopia' && effectOptions?.isEyeCovered
            ? 'canvas-effect-severe'
            : ''
        }`}
      />

      {/* Camera Error Prompt */}
      {cameraError && (
        <div className="fullscreen-camera-error">
          <div className="error-dialog-box fade-in">
            <span className="error-icon">📷</span>
            <h3>Cần quyền truy cập Camera</h3>
            <p>{cameraError}</p>
            <div className="error-actions-group">
              <button
                type="button"
                className="btn-retry-camera"
                onClick={initCamera}
              >
                Bật camera lại
              </button>
              <button
                type="button"
                className="btn-simulated-camera"
                onClick={initSimulatedCamera}
              >
                Tiếp tục bằng mô phỏng camera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
