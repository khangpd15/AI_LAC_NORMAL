import React, { useState, useEffect, useRef, useCallback } from 'react';
import AudioButton from '../audio/AudioButton';
import CameraView from '../CameraView';
import FixationTarget from './FixationTarget';
import {
  extractBrockStringFrame,
  analyzeTargetFixation,
  evaluateBrockStringSession,
} from '../../services/brockStringMeasurementService.js';
import {
  BROCK_STRING_TARGET_CONFIG,
} from '../../constants/binocularScreeningConfig.js';
import { captureScreeningFrame } from '../../services/screeningImageCaptureService.js';

/**
 * BrockStringStep Component
 * Step 3 of Digital Binocular Vision Screening.
 * 
 * Sequences gaze across 20 cm, 50 cm, and 100 cm simulated targets in Full-Screen Test Mode.
 * 
 * STRICT PROTOCOL CONSTRAINTS (Section 36):
 * 1. ONLY ONE TARGET AT A TIME (Section 36.1): Never show 3 beads simultaneously.
 * 2. Center Invariant: Target stays locked at center (Section 36.8).
 * 3. Size Progression: 20cm (Large, 84px) -> 50cm (Medium, 52px) -> 100cm (Small, 26px).
 * 4. Child-Friendly (Section 37): No dashboard clutter, no technical displacement numbers.
 * 5. Digital representation disclaimer (Section 42).
 */
export default function BrockStringStep({
  videoRef,
  stream = null,
  landmarks,
  quality,
  onComplete,
  speak,
  isVoiceEnabled,
  toggleSound,
  onVideoReady,
  positionReport = null,
  onImageCaptured,
}) {
  const imageCaptureAttemptedRef = useRef(false);
  const [stage, setStage] = useState('TRANSITION'); // 'TRANSITION' | 'RUNNING' | 'COMPLETED'
  const [activeTargetIndex, setActiveTargetIndex] = useState(0); // 0: 20CM, 1: 50CM, 2: 100CM
  const [countdownSec, setCountdownSec] = useState(0);
  const [sessionResults, setSessionResults] = useState(null);

  // Target beads sequence (One target active at a time - Section 36.1 & 36.4)
  const targetList = [
    BROCK_STRING_TARGET_CONFIG['20CM'],
    BROCK_STRING_TARGET_CONFIG['50CM'],
    BROCK_STRING_TARGET_CONFIG['100CM'],
  ];

  const currentTarget = targetList[activeTargetIndex] || targetList[0];

  // Execution refs
  const isAbortedRef = useRef(false);
  const bufferRef = useRef([]);
  const targetsDataRef = useRef({});

  // Clean up on unmount
  useEffect(() => {
    isAbortedRef.current = false;
    return () => {
      isAbortedRef.current = true;
    };
  }, []);

  // Lock body scroll in FullScreen Test Mode (Section 35.9)
  useEffect(() => {
    if (stage === 'RUNNING') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [stage]);

  // Handler: Abort / Exit FullScreen Test Mode back to Intro
  const handleAbortTest = useCallback(() => {
    isAbortedRef.current = true;
    setStage('TRANSITION');
    if (speak) speak('Đã dừng bài kiểm tra.');
  }, [speak]);

  // Collect frames for current target
  useEffect(() => {
    if (stage !== 'RUNNING') return;

    if (landmarks && landmarks.length >= 478 && quality?.isValid) {
      const frameData = extractBrockStringFrame(
        landmarks,
        currentTarget.id,
        currentTarget.distanceCm,
        performance.now()
      );
      bufferRef.current.push(frameData);
    }
  }, [stage, landmarks, quality, currentTarget]);

  // Execute a single target interval
  const runTargetBead = useCallback(
    (target) => {
      return new Promise((resolve) => {
        if (isAbortedRef.current) {
          resolve(null);
          return;
        }

        bufferRef.current = [];
        const startT = performance.now();
        const durationMs = target.durationMs || 4000;
        const initialSeconds = Math.ceil(durationMs / 1000);
        setCountdownSec(initialSeconds);
        let prevSec = initialSeconds;

        if (speak) {
          speak(target.id === 'NEAR' ? 'Nhìn vào chấm tròn ở giữa.' : 'Tiếp tục nhìn vào chấm tròn.');
        }

        let rafId = null;

        const loop = () => {
          if (isAbortedRef.current) {
            if (rafId) cancelAnimationFrame(rafId);
            resolve(null);
            return;
          }

          const now = performance.now();
          const elapsed = now - startT;
          const remainingSec = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));

          if (remainingSec !== prevSec) {
            prevSec = remainingSec;
            setCountdownSec(remainingSec);
          }

          if (elapsed >= durationMs) {
            const rawFrames = [...bufferRef.current];
            // BUG-01 FIX: analyzeTargetFixation(frames, targetConfig) — pass object not positional args
            const analysis = analyzeTargetFixation(rawFrames, {
              id: target.id,
              label: target.label,
              distanceCm: target.distanceCm,
            });
            resolve(analysis);
            return;
          }

          rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
      });
    },
    [speak]
  );

  // Automated 3-bead runner
  const startBrockStringProtocol = async () => {
    if (!imageCaptureAttemptedRef.current) {
      imageCaptureAttemptedRef.current = true;
      const validPositionAndTracking = positionReport?.status === 'READY' && quality?.isValid;
      const artifact = await captureScreeningFrame(validPositionAndTracking ? videoRef.current : null, 'brock_string.jpg');
      onImageCaptured?.(artifact);
    }
    setStage('RUNNING');
    isAbortedRef.current = false;
    targetsDataRef.current = {};

    for (let i = 0; i < targetList.length; i++) {
      if (isAbortedRef.current) break;
      setActiveTargetIndex(i);
      const target = targetList[i];

      const targetAnalysis = await runTargetBead(target);
      if (isAbortedRef.current || !targetAnalysis) break;

      targetsDataRef.current[target.id] = targetAnalysis;

      // Small pause between targets (1.0s)
      if (i < targetList.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!isAbortedRef.current) {
      const overallEvaluation = evaluateBrockStringSession(targetsDataRef.current);
      setSessionResults(overallEvaluation);
      setStage('COMPLETED');
      if (speak) {
        speak('Đã hoàn thành.');
      }
    }
  };

  // 1. FULL-SCREEN BROCK STRING TEST MODE (Section 36, 37, 38, 41)
  if (stage === 'RUNNING') {
    return (
      <div
        className="fullscreen-test-mode"
        role="dialog"
        aria-modal="true"
        aria-label="Giao diện kiểm tra Brock String toàn màn hình"
      >
        {/* Full-viewport camera background (Section 36.9) */}
        <div className="fullscreen-camera-background">
          <CameraView
            videoRef={videoRef}
            stream={stream}
            landmarks={landmarks}
            quality={quality}
            isActive={true}
            cleanMode={true}
            onVideoReady={onVideoReady}
          />
        </div>

        {/* Centered Single Fixation Target (Section 36.1, 36.2, 36.3, 36.7, 36.8) */}
        <FixationTarget
          size={currentTarget.sizePx}
          color={currentTarget.color}
          position="CENTER"
          isPulsing={true}
          ariaLabel={`Tiêu điểm Brock String: ${currentTarget.label}`}
        />

        {/* Minimal child-friendly Top Bar (Section 36.6 & 37) */}
        <div className="fullscreen-top-bar">
          <div className="fullscreen-pills-row">
            <span className="fullscreen-pill">
              Tiêu điểm <strong>{activeTargetIndex + 1} / 3</strong>
            </span>
            <span className="fullscreen-pill fullscreen-pill-active">
              ⏱️ {countdownSec}s
            </span>
          </div>

          <div className="fullscreen-instruction-banner">
            <h1 className="fullscreen-inst-title">
              {activeTargetIndex === 0 ? 'Nhìn vào chấm tròn ở giữa' : 'Tiếp tục nhìn vào chấm tròn'}
            </h1>
            <p className="fullscreen-inst-sub">
              {currentTarget.label}
            </p>
          </div>

          <div className="fullscreen-pills-row">
            <button
              type="button"
              className={`btn-sound ${isVoiceEnabled ? 'sound-on' : 'sound-off'}`}
              onClick={toggleSound}
              title={isVoiceEnabled ? 'Tắt âm' : 'Bật âm'}
              style={{ pointerEvents: 'auto' }}
            >
              {isVoiceEnabled ? '🔊' : '🔇'}
            </button>
            <button
              type="button"
              className="fullscreen-exit-btn"
              onClick={handleAbortTest}
              aria-label="Dừng bài kiểm tra"
            >
              ✕ Dừng
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. BROCK STRING RESULT SCREEN (Section 36.5)
  if (stage === 'COMPLETED' && sessionResults) {
    return (
      <div className="card stage-card-main brock-step-card">
        <div className="stage-header">
          <span className="badge badge-primary">Bước 3 / 4</span>
          <h2 className="stage-title">Kết quả Nghiệm pháp Dây Brock (Brock String)</h2>
        </div>

        <div className="brock-completed-view" style={{ padding: '20px 0' }}>
          <div className="completed-banner-box" style={{ padding: '20px', textAlign: 'center', maxWidth: '640px', margin: '0 auto 20px' }}>
            <div className="completed-icon" style={{ width: '48px', height: '48px', fontSize: '1.6rem', margin: '0 auto 12px' }}>✓</div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.3rem' }}>Bài kiểm tra Brock String đã hoàn tất</h3>
            <p style={{ fontSize: '0.95rem', margin: 0, color: 'var(--text-muted)' }}>
              Đã ghi nhận dữ liệu định thị qua cả 3 cự ly mục tiêu (20 cm, 50 cm, 100 cm).
            </p>
          </div>

          <div className="targets-breakdown-grid" style={{ maxWidth: '640px', margin: '0 auto 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {targetList.map((t) => {
              const res = sessionResults.targets[t.id];
              const isGood = res && res.sampleCount >= 10;
              return (
                <div key={t.id} className="target-metric-box" style={{ background: 'var(--bg-surface)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                  <span className="target-box-name" style={{ color: t.color, fontWeight: '700', fontSize: '0.9rem', display: 'block', marginBottom: '6px' }}>
                    ● {t.label}
                  </span>
                  <div className="target-box-status" style={{ fontSize: '0.82rem', marginBottom: '4px' }}>
                    Chất lượng: <strong className={isGood ? 'text-success' : 'text-warning'}>
                      {isGood ? 'GOOD' : 'INCONCLUSIVE'}
                    </strong>
                  </div>
                  <div className="target-box-samples" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Số mẫu: {res?.sampleCount ?? 0} frames
                  </div>
                </div>
              );
            })}
          </div>

          <div className="checklist-safety-note" style={{ maxWidth: '640px', margin: '0 auto 24px', background: 'rgba(255, 255, 255, 0.03)', padding: '12px 16px', borderRadius: '8px' }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              💡 <strong>Lưu ý lâm sàng (Section 42):</strong> Kích thước hạt trên màn hình là mô phỏng thị giác số để định hướng phản xạ quy tụ hai mắt, không đại diện cho khoảng cách vật lý tuyệt đối.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '14px', maxWidth: '640px', margin: '0 auto' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={startBrockStringProtocol}
            >
              🔄 Đo lại Brock String
            </button>
            <button
              type="button"
              className="btn btn-primary btn-large"
              style={{ flex: 2 }}
              onClick={() => onComplete(sessionResults)}
            >
              XEM TỔNG HỢP SÀNG LỌC ➜
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. BROCK STRING INTRO SCREEN (Section 38 & 43)
  return (
    <div className="card stage-card-main brock-step-card">
      <div className="stage-header">
        <span className="badge badge-primary">Bước 3 / 4</span>
        <h2 className="stage-title">Nghiệm pháp Dây Brock (Brock String)</h2>
        <div className="header-sound-btn">
          <button
            type="button"
            className={`btn-sound ${isVoiceEnabled ? 'sound-on' : 'sound-off'}`}
            onClick={toggleSound}
            title={isVoiceEnabled ? 'Tắt âm hướng dẫn' : 'Bật âm hướng dẫn'}
          >
            {isVoiceEnabled ? '🔊 Âm thanh BẬT' : '🔇 Âm thanh TẮT'}
          </button>
        </div>
        <AudioButton text="Đưa khuôn mặt vào đúng vị trí. Sau đó nhìn vào chấm tròn." onActivate={() => { if (!isVoiceEnabled) toggleSound?.(); }} />
      </div>

      <div className="cover-running-layout">
        {/* Left Column: Camera Preview */}
        <div className="cam-column">
          <CameraView
            videoRef={videoRef}
            stream={stream}
            landmarks={landmarks}
            quality={quality}
            isActive={true}
            cleanMode={false}
            onVideoReady={onVideoReady}
          />
        </div>

        {/* Right Column: Guidance & Instructions */}
        <div className="instruction-column">
          <div className="cover-state-machine-box">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--text-main)' }}>
              Hướng dẫn thực hiện Brock String
            </h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '14px' }}>
              Kiểm tra khả năng phối hợp và phản xạ quy tụ của hai mắt qua <strong>3 cự ly mô phỏng (20 cm, 50 cm, 100 cm)</strong>.
            </p>

            <div className="intro-steps-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>📏</span>
                <div style={{ fontSize: '0.88rem' }}>
                  <strong>Giữ khoảng cách 20–25 cm</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Ngồi thẳng người, nhìn trực diện vào webcam.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>🎯</span>
                <div style={{ fontSize: '0.88rem' }}>
                  <strong>Chỉ nhìn một chấm duy nhất ở giữa màn hình</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Chấm tròn sẽ thu nhỏ kích thước tương ứng từ gần ra xa.</div>
                </div>
              </div>
            </div>

            <div className="checklist-safety-note" style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: '8px', marginBottom: '8px' }}>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                💡 <strong>Lưu ý lâm sàng (Section 42):</strong> Kích thước chấm trên màn hình là mô phỏng thị giác số để định hướng định thị, không tương đương vật lý chính xác với cự ly thực tế.
              </p>
            </div>
          </div>

          <div className="cover-action-box" style={{ marginTop: '14px' }}>
            <button
              type="button"
              className="btn btn-primary btn-large btn-block"
              onClick={startBrockStringProtocol}
            >
              ▶ BẮT ĐẦU BROCK STRING (TOÀN MÀN HÌNH)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
