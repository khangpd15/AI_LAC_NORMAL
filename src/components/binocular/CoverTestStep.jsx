import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AudioButton from '../audio/AudioButton';
import CoverTestDebugPanel from '../debug/CoverTestDebugPanel';
import CameraView from '../CameraView';
import FixationTarget from './FixationTarget';
import {
  calculateRobustBaseline,
  analyzeUncoverTrajectory,
} from '../../services/coverTestMeasurementService.js';
import {
  COVER_TEST_VERDICTS,
  FIXATION_TARGET_CONFIG,
} from '../../constants/binocularScreeningConfig.js';
import { SCREENING_CONFIG } from '../../constants/screeningConfig.js';
import { aggregateCoverCycles, createCoverFrame, createCoverSessionId, createCycleRecord, inconclusiveCycle, isCoverSessionCurrent, validateBaselinePair } from '../../services/coverTestProtocolService.js';
import { captureScreeningFrame } from '../../services/screeningImageCaptureService.js';

/**
 * CoverTestStep Component
 * Step 2 of Digital Binocular Vision Screening.
 * 
 * Clinical Protocol State Machine:
 * IDLE -> PREPARING -> BASELINE -> COVER -> UNCOVER -> TRACKING -> CYCLE_COMPLETE -> NEXT_CYCLE -> FINISHED
 * 
 * Features:
 * 1. Persistent camera stream (never unmounts or cuts to black).
 * 2. Visual occluder on camera & UI showing exactly which eye to cover.
 * 3. Live UI debug telemetry: State, checklist, samples, tracked eye, real-time displacement.
 * 4. Head-movement rejection to avoid mistaking head tilt for refixation saccades.
 * 5. Multi-cycle preservation without overwriting.
 */
export default function CoverTestStep({
  videoRef,
  stream = null,
  landmarks = null,
  quality = null,
  latestFeaturesRef = null,
  latestQualityRef = null,
  onComplete,
  speak,
  isVoiceEnabled = true,
  toggleSound,
  onVideoReady,
  positionReport = null,
  onImageCaptured,
}) {
  const imageCaptureAttemptedRef = useRef(false);
  // Master State Machine:
  // 'IDLE' | 'PREPARING' | 'BASELINE' | 'COVER' | 'UNCOVER' | 'TRACKING' | 'CYCLE_COMPLETE' | 'NEXT_CYCLE' | 'FINISHED'
  const [coverState, setCoverState] = useState('IDLE');
  const [cycleIndex, setCycleIndex] = useState(1);
  const [countdownSec, setCountdownSec] = useState(0);

  // Active instructions & active eyes
  const [coveredEye, setCoveredEye] = useState(null); // 'left' | 'right' | null
  const [trackedEye, setTrackedEye] = useState(null); // 'left' | 'right' | null
  const [instructionTitle, setInstructionTitle] = useState('Nghiệm pháp Che mắt (Cover Test)');
  const [_instructionText, setInstructionText] = useState('Sẵn sàng kiểm tra 3 chu kỳ che mở mắt.');
  const [instructionSubtext, setInstructionSubtext] = useState('Giữ đầu thẳng, nhìn vào chấm đỏ trung tâm, làm theo hướng dẫn bằng giọng nói.');

  // Live real-time telemetry (internal tracking)
  const [liveSampleCount, setLiveSampleCount] = useState(0);
  const [_liveDisplacement, setLiveDisplacement] = useState(0);

  // Recorded summary data
  const [_completedCyclesList, setCompletedCyclesList] = useState([]);
  const [coverSummary, setCoverSummary] = useState(null);
  const [debugSessionId, setDebugSessionId] = useState(() => createCoverSessionId());

  // Execution refs
  const isAbortedRef = useRef(false);
  const currentBaselineRef = useRef(null);
  const sessionIdRef = useRef(debugSessionId);
  const phaseRafRef = useRef(null);
  const phaseResolveRef = useRef(null);

  // Fixation target positioning & lock state (Sections 9, 10, 11)
  const [lockedTargetPos, setLockedTargetPos] = useState(null);
  const isTargetLockedRef = useRef(false);

  // Flow: Face detected -> Estimate face vertical midline -> Place fixation target -> LOCK target position
  const fixationTargetPos = useMemo(() => {
    // If target has already been locked for an active test session, keep locked position
    if (lockedTargetPos) {
      return lockedTargetPos;
    }
    if (landmarks && landmarks.length > 0) {
      let faceMidlineX = null;
      if (landmarks[1] && typeof landmarks[1].x === 'number') {
        faceMidlineX = landmarks[1].x;
      } else if (landmarks[133] && landmarks[362]) {
        faceMidlineX = (landmarks[133].x + landmarks[362].x) / 2;
      }

      if (faceMidlineX != null) {
        // Mirrored webcam compensation (camera feed has scaleX(-1))
        const displayX = Number(((1 - faceMidlineX) * 100).toFixed(1));
        // Clamp to safe central horizontal window [44%, 56%]
        const clampedX = Math.max(44, Math.min(56, displayX));
        // Vertical placement: comfortable straight-ahead visual target on screen (48%)
        return { x: clampedX, y: 48 };
      }
    }
    return { x: 50, y: 48 };
  }, [landmarks, lockedTargetPos]);

  // Independent High-Precision Elapsed Timer for TRACKING (Sections 1, 2, 3, 4, 5, 6)
  const trackingStartTimeRef = useRef(null);
  const [trackingStartTime, setTrackingStartTime] = useState(null);
  const [trackingElapsedMs, setTrackingElapsedMs] = useState(0);

  useEffect(() => {
    // Timer only runs when Cover Test is actively in TRACKING state
    if (coverState !== 'TRACKING') {
      return;
    }

    const startTime = performance.now();
    trackingStartTimeRef.current = startTime;

    let animationFrameId;

    const updateTimer = () => {
      if (trackingStartTimeRef.current == null) {
        return;
      }
      const elapsed = performance.now() - trackingStartTimeRef.current;
      setTrackingElapsedMs(elapsed);
      animationFrameId = requestAnimationFrame(updateTimer);
    };

    // Schedule update asynchronously in next RAF tick to keep render & effect pure
    animationFrameId = requestAnimationFrame(() => {
      setTrackingStartTime(startTime);
      setTrackingElapsedMs(0);
      animationFrameId = requestAnimationFrame(updateTimer);
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      // Keep trackingElapsedMs intact so final duration is retained upon state transition (Section 6)
      trackingStartTimeRef.current = null;
    };
  }, [coverState, cycleIndex, trackedEye]);

  const elapsedSecFormatted = (trackingElapsedMs / 1000).toFixed(1);
  const timerDisplay = `${elapsedSecFormatted}s`;

  const invalidateActiveRun = useCallback(() => {
    isAbortedRef.current = true;
    isTargetLockedRef.current = false;
    setLockedTargetPos(null);
    sessionIdRef.current = createCoverSessionId();
    if (phaseRafRef.current !== null) cancelAnimationFrame(phaseRafRef.current);
    phaseRafRef.current = null;
    phaseResolveRef.current?.(null);
    phaseResolveRef.current = null;
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      invalidateActiveRun();
    };
  }, [invalidateActiveRun]);

  // Lock body scroll in FullScreen Test Mode (Section 35.9)
  useEffect(() => {
    const isTesting = coverState !== 'IDLE' && coverState !== 'FINISHED';
    if (isTesting) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [coverState]);

  // Handler: Abort / Exit FullScreen Test Mode back to Intro
  const handleAbortTest = useCallback(() => {
    invalidateActiveRun();
    setCoverState('IDLE');
    if (speak) speak('Đã dừng bài kiểm tra.');
  }, [invalidateActiveRun, speak]);

  // Logging state changes as required by Step 6
  const transitionToState = useCallback((nextState, cycle) => {
    setCoverState(nextState);
    console.debug('[CoverTest]', {
      state: nextState,
      cycle,
      timestamp: performance.now(),
    });
  }, []);

  // Helper: Executes an individual phase with countdown and high-frequency data sampling
  const executePhase = ({
      state,
      title,
      text,
      subtext,
      coverEye = null,
      trackEye = null,
      durationMs,
      speechText = null,
      baselineData = null,
      cycleNum,
    }) => {
      return new Promise((resolve) => {
        const phaseSessionId = sessionIdRef.current;
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          if (phaseRafRef.current !== null) cancelAnimationFrame(phaseRafRef.current);
          phaseRafRef.current = null;
          if (phaseResolveRef.current === finish) phaseResolveRef.current = null;
          resolve(value);
        };
        phaseResolveRef.current = finish;
        if (isAbortedRef.current) {
          finish(null);
          return;
        }

        transitionToState(state, cycleNum);
        setInstructionTitle(title);
        setInstructionText(text);
        setInstructionSubtext(subtext);
        setCoveredEye(coverEye);
        setTrackedEye(trackEye);
        setLiveSampleCount(0);
        setLiveDisplacement(0);

        if (speechText && speak) {
          speak(speechText);
        }

        const buffer = [];
        const leftBaselineBuffer = [];
        const rightBaselineBuffer = [];
        const startT = performance.now();
        const initialSeconds = Math.ceil(durationMs / 1000);
        setCountdownSec(initialSeconds);
        let prevSec = initialSeconds;

        const loop = () => {
          if (!isCoverSessionCurrent(phaseSessionId, sessionIdRef.current, isAbortedRef.current)) {
            finish(null);
            return;
          }

          const now = performance.now();
          const elapsed = now - startT;
          const remainingSec = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));

          if (remainingSec !== prevSec) {
            prevSec = remainingSec;
            setCountdownSec(remainingSec);
          }

          // Sample features at high frequency
          const feats = latestFeaturesRef?.current;
          const currentQuality = latestQualityRef?.current || quality;
          if (feats) {
            if (state === 'BASELINE') {
              const left = createCoverFrame(feats, currentQuality, 'left', now, elapsed);
              const right = createCoverFrame(feats, currentQuality, 'right', now, elapsed);
              if (left.frame) leftBaselineBuffer.push(left.frame);
              if (right.frame) rightBaselineBuffer.push(right.frame);
              setLiveSampleCount(leftBaselineBuffer.length);
            } else if (state === 'TRACKING' && trackEye) {
              const tracked = createCoverFrame(feats, currentQuality, trackEye, now, elapsed);
              if (tracked.frame) {
                buffer.push(tracked.frame);
                setLiveSampleCount(buffer.length);
                if (baselineData?.normalizedBaselineX !== undefined) {
                  const dx = tracked.frame.normalizedX - baselineData.normalizedBaselineX;
                  const dy = tracked.frame.normalizedY - baselineData.normalizedBaselineY;
                  setLiveDisplacement(Number(Math.hypot(dx, dy).toFixed(3)));
                }
              }
            }
          }

          if (elapsed >= durationMs) {
            try {
              if (state === 'BASELINE') {
                finish({
                  leftBaseline: calculateRobustBaseline(leftBaselineBuffer),
                  rightBaseline: calculateRobustBaseline(rightBaselineBuffer),
                });
              } else if (state === 'TRACKING' && trackEye) {
                const latestEyeWidth = buffer.length ? buffer.at(-1)?.eyeWidth : 0.05;
                const analysis = buffer.length
                  ? analyzeUncoverTrajectory(buffer, baselineData, trackEye, cycleNum, latestEyeWidth)
                  : null;

                // Head pose safety check: detect head movements during uncover tracking
                if (positionReport?.headPose && !positionReport.headPose.isValid) {
                  if (analysis?.dataQuality) {
                    analysis.dataQuality.isValid = false;
                    analysis.dataQuality.reason = 'Phát hiện cử động đầu trong khi đo';
                  }
                }

                finish(analysis);
              } else {
                finish(true);
              }
            } catch (err) {
              console.error('[CoverTestStep] Phase execution error:', err);
              finish(null);
            }
            return;
          }

          phaseRafRef.current = requestAnimationFrame(loop);
        };

        phaseRafRef.current = requestAnimationFrame(loop);
      });
    };

  // Automated 3-cycle runner
  const startCoverTestProtocol = async () => {
    invalidateActiveRun();
    // LOCK fixation target position at test start (Sections 10, 11)
    isTargetLockedRef.current = true;
    setLockedTargetPos(fixationTargetPos);
    const runSessionId = createCoverSessionId();
    sessionIdRef.current = runSessionId;
    setDebugSessionId(runSessionId);
    isAbortedRef.current = false;
    const runIsCurrent = () => isCoverSessionCurrent(runSessionId, sessionIdRef.current, isAbortedRef.current);
    setCompletedCyclesList([]);
    setCoverSummary(null);
    currentBaselineRef.current = null;

    // 1. PREPARING (3 seconds countdown)
    await executePhase({
      state: 'PREPARING',
      title: 'Chuẩn bị...',
      text: 'Ngồi thẳng và nhìn vào chấm tròn ở giữa.',
      subtext: 'Chu kỳ 1 sẽ bắt đầu trong giây lát...',
      durationMs: 3000,
      speechText: 'Chuẩn bị bắt đầu. Hãy nhìn thẳng vào chấm đỏ.',
      cycleNum: 1,
    });

    if (!runIsCurrent()) return;

    const accumulatedCycles = [];

    for (let c = 1; c <= SCREENING_CONFIG.CYCLES; c++) {
      if (!runIsCurrent()) return;
      setCycleIndex(c);

      // Phase 1: Robust Baseline Fixation (4.0s)
      const baselines = await executePhase({
        state: 'BASELINE',
        title: 'Nhìn vào chấm tròn ở giữa',
        text: 'Cố định ánh nhìn vào chấm đỏ.',
        subtext: 'Giữ yên đầu và nhìn thẳng.',
        coverEye: null,
        trackEye: null,
        durationMs: 4000,
        speechText: 'Nhìn vào chấm tròn ở giữa.',
        cycleNum: c,
      });

      if (!runIsCurrent()) return;
      const baselineQuality = validateBaselinePair(baselines);
      if (!baselineQuality.isValid) {
        const failedCycle = inconclusiveCycle(c, baselineQuality.reason, baselines);
        accumulatedCycles.push(failedCycle);
        setCompletedCyclesList([...accumulatedCycles]);
        transitionToState('CYCLE_COMPLETE', c);
        if (c < SCREENING_CONFIG.CYCLES) {
          await executePhase({ state: 'NEXT_CYCLE', title: 'Chuẩn bị lần tiếp theo', text: 'Dữ liệu chưa ổn định. Hãy giữ đầu yên và thử chu kỳ tiếp theo.', subtext: `Chu kỳ ${c + 1} sẽ bắt đầu sau ít giây.`, durationMs: 2500, speechText: 'Giữ đầu yên. Chuẩn bị lần tiếp theo.', cycleNum: c });
        }
        continue;
      }
      currentBaselineRef.current = baselines;

      if (!imageCaptureAttemptedRef.current) {
        imageCaptureAttemptedRef.current = true;
        const artifact = await captureScreeningFrame(videoRef.current, 'cover_test.jpg');
        onImageCaptured?.(artifact);
      }

      // Phase 2: Cover Left Eye (4.5s)
      await executePhase({
        state: 'COVER',
        title: 'Che mắt trái',
        text: 'Dùng tay che kín mắt trái (bên phải bạn).',
        subtext: 'Mắt phải tiếp tục nhìn vào chấm tròn.',
        coverEye: 'left',
        trackEye: null,
        durationMs: 4500,
        speechText: 'Che mắt trái.',
        cycleNum: c,
      });

      if (!runIsCurrent()) return;

      // Phase 3a: Brief Uncover notice (0.8s)
      await executePhase({
        state: 'UNCOVER',
        title: 'Bỏ che mắt',
        text: 'Bỏ tay ra khỏi mắt trái.',
        subtext: 'Tiếp tục nhìn vào chấm tròn.',
        coverEye: null,
        trackEye: 'right',
        durationMs: 800,
        speechText: 'Bỏ che mắt.',
        cycleNum: c,
      });

      if (!runIsCurrent()) return;

      // Phase 3b: Tracking Right Eye (3.5s)
      const rightEyeAnalysis = await executePhase({
        state: 'TRACKING',
        title: 'Nhìn thẳng vào chấm',
        text: 'Cố định ánh nhìn vào chấm đỏ ở giữa.',
        subtext: 'Mắt nhìn thẳng vào tâm chấm.',
        coverEye: null,
        trackEye: 'right',
        durationMs: 3500,
        baselineData: baselines.rightBaseline,
        cycleNum: c,
      });

      if (!runIsCurrent()) return;

      // Phase 4: Cover Right Eye (4.5s)
      await executePhase({
        state: 'COVER',
        title: 'Che mắt phải',
        text: 'Dùng tay che kín mắt phải (bên trái bạn).',
        subtext: 'Mắt trái tiếp tục nhìn vào chấm tròn.',
        coverEye: 'right',
        trackEye: null,
        durationMs: 4500,
        speechText: 'Che mắt phải.',
        cycleNum: c,
      });

      if (!runIsCurrent()) return;

      // Phase 5a: Brief Uncover notice (0.8s)
      await executePhase({
        state: 'UNCOVER',
        title: 'Bỏ che mắt',
        text: 'Bỏ tay ra khỏi mắt phải.',
        subtext: 'Tiếp tục nhìn vào chấm tròn.',
        coverEye: null,
        trackEye: 'left',
        durationMs: 800,
        speechText: 'Bỏ che mắt.',
        cycleNum: c,
      });

      if (!runIsCurrent()) return;

      // Phase 5b: Tracking Left Eye (3.5s)
      const leftEyeAnalysis = await executePhase({
        state: 'TRACKING',
        title: 'Nhìn thẳng vào chấm',
        text: 'Cố định ánh nhìn vào chấm đỏ ở giữa.',
        subtext: 'Mắt nhìn thẳng vào tâm chấm.',
        coverEye: null,
        trackEye: 'left',
        durationMs: 3500,
        baselineData: baselines.leftBaseline,
        cycleNum: c,
      });

      if (!runIsCurrent()) return;

      // Record Cycle Result
      // NOTE: analyzeUncoverTrajectory returns `isNotableMovement` (not `isRefixationNotable`)
      const cycleRecord = createCycleRecord(c, baselines, rightEyeAnalysis, leftEyeAnalysis);

      accumulatedCycles.push(cycleRecord);
      setCompletedCyclesList([...accumulatedCycles]);
      transitionToState('CYCLE_COMPLETE', c);

      // Rest interval between cycles (2.5s)
      if (c < SCREENING_CONFIG.CYCLES) {
        await executePhase({
          state: 'NEXT_CYCLE',
          title: 'Chuẩn bị lần tiếp theo',
          text: 'Chớp mắt nhẹ nhàng và thư giãn trong giây lát.',
          subtext: `Chu kỳ ${c + 1} sẽ bắt đầu sau ít giây.`,
          durationMs: 2500,
          speechText: 'Chuẩn bị lần tiếp theo.',
          cycleNum: c,
        });
      }
    }

    if (runIsCurrent() && accumulatedCycles.length > 0) {
      const summaryPayload = aggregateCoverCycles(accumulatedCycles);

      setCoverSummary(summaryPayload);
      transitionToState('FINISHED', 3);
      if (speak) {
        speak('Đã hoàn thành phần kiểm tra.');
      }
    }
  };

  // Determine state label color and badge
  const isTestingActive = coverState !== 'IDLE' && coverState !== 'FINISHED';

  // 1. FULL-SCREEN TEST MODE (Section 35, 37, 38, 40)
  if (isTestingActive) {
    return (
      <div
        className="fullscreen-test-mode"
        role="dialog"
        aria-modal="true"
        aria-label="Giao diện kiểm tra Cover Test toàn màn hình"
      >
        <CoverTestDebugPanel
          cameraReady={Boolean(stream)}
          quality={quality}
          positionReport={positionReport}
          state={coverState}
          cycle={cycleIndex}
          trackedEye={trackedEye}
          samples={liveSampleCount}
          sessionId={debugSessionId}
          timerDisplay={timerDisplay}
          startTime={trackingStartTime}
          elapsedMs={trackingElapsedMs}
        />
        {/* Full-viewport camera background (Section 35.1) */}
        <div className="fullscreen-camera-background">
          <CameraView
            videoRef={videoRef}
            stream={stream}
            landmarks={landmarks}
            quality={quality}
            isActive={true}
            cleanMode={true}
            onVideoReady={onVideoReady}
            occluderEye={coveredEye}
            trackedEye={trackedEye}
          />
        </div>

        {/* Centered Fixation Target (Section 35.2, 35.3 & 39) */}
        <FixationTarget
          type={FIXATION_TARGET_CONFIG.type}
          size={FIXATION_TARGET_CONFIG.sizePx}
          color={FIXATION_TARGET_CONFIG.color}
          position="CENTER"
          isPulsing={true}
          targetPosition={fixationTargetPos}
          ariaLabel="Điểm nhìn trung tâm Cover Test"
        />

        {/* Minimal child-friendly Top Bar (Section 35.4 & 35.5) */}
        <div className="fullscreen-top-bar">
          <div className="fullscreen-pills-row">
            <span className="fullscreen-pill">
              Chu kỳ <strong>{cycleIndex} / 3</strong>
            </span>
            <span className="fullscreen-pill fullscreen-pill-active">
              ⏱️ {coverState === 'TRACKING' ? timerDisplay : `${countdownSec}s`}
            </span>
          </div>

          <div className="fullscreen-instruction-banner">
            <h1 className="fullscreen-inst-title">{instructionTitle}</h1>
            <p className="fullscreen-inst-sub">{instructionSubtext}</p>
            {/* Visual Eye Representation (Section 35.6) */}
            <div
              className="fullscreen-eye-visual"
              aria-hidden="true"
              style={{
                marginTop: '6px',
                fontSize: '1.7rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '14px',
              }}
            >
              {coverState === 'COVER' && coveredEye === 'left' ? (
                <>
                  <span title="Mắt phải mở">👁️</span>
                  <span title="Che mắt trái" style={{ filter: 'grayscale(1)', opacity: 0.65 }}>✋</span>
                </>
              ) : coverState === 'COVER' && coveredEye === 'right' ? (
                <>
                  <span title="Che mắt phải" style={{ filter: 'grayscale(1)', opacity: 0.65 }}>✋</span>
                  <span title="Mắt trái mở">👁️</span>
                </>
              ) : (
                <>
                  <span title="Mắt phải mở">👁️</span>
                  <span title="Mắt trái mở">👁️</span>
                </>
              )}
            </div>
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

  // 2. COVER TEST RESULT SCREEN (Section 35.8)
  if (coverState === 'FINISHED' && coverSummary) {
    return (
      <div className="card stage-card-main cover-test-card">
        <div className="stage-header">
          <span className="badge badge-primary">Bước 2 / 4</span>
          <h2 className="stage-title">Kết quả Nghiệm pháp Che mắt (Cover Test)</h2>
        </div>

        <div className="cover-finished-view" style={{ padding: '20px 0' }}>
          <div className="completed-banner-box" style={{ padding: '20px', textAlign: 'center', maxWidth: '640px', margin: '0 auto 20px' }}>
            <div className="completed-icon" style={{ width: '48px', height: '48px', fontSize: '1.6rem', margin: '0 auto 12px' }}>✓</div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.3rem' }}>Cover Test Hoàn Tất</h3>
            <p style={{ fontSize: '0.95rem', margin: '0 0 12px 0', color: 'var(--text-muted)' }}>
              Đã thu thập <strong>{coverSummary.validCycles} / 3</strong> chu kỳ đạt chuẩn kỹ thuật.
            </p>

            <div style={{ marginTop: '8px', fontSize: '1.05rem', fontWeight: '700' }}>
              {coverSummary.verdict === COVER_TEST_VERDICTS.REFIXATION_DETECTED ? (
                <span style={{ color: 'var(--accent-amber)' }}>🟡 Đã ghi nhận chuyển động tái định thị</span>
              ) : coverSummary.verdict === COVER_TEST_VERDICTS.NO_SIGNIFICANT_REFIXATION ? (
                <span style={{ color: 'var(--accent-emerald)' }}>🟢 Không ghi nhận tái định thị bất thường</span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>⚪ Dữ liệu chưa đủ kết luận</span>
              )}
            </div>
          </div>

          {/* Clinician & researcher data breakdown */}
          <div className="clinician-detail-box" style={{ maxWidth: '640px', margin: '0 auto 24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.92rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Chi tiết dữ liệu lâm sàng 3 chu kỳ:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {coverSummary.cycles.map((cyc) => (
                <div key={cyc.cycleIndex} style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: '700', marginBottom: '4px' }}>Chu kỳ {cyc.cycleIndex}</div>
                  <div>Chất lượng: <strong style={{ color: cyc.quality?.isValid ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>{cyc.quality?.isValid ? 'Hợp lệ' : 'Chưa đạt'}</strong></div>
                  <div>Tái định thị: <strong>{cyc.isRefixationNotable ? 'Có' : 'Không'}</strong></div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', maxWidth: '640px', margin: '0 auto' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={startCoverTestProtocol}
            >
              🔄 Đo lại Cover Test
            </button>
            <button
              type="button"
              className="btn btn-primary btn-large"
              style={{ flex: 2 }}
              onClick={() => onComplete?.(coverSummary)}
            >
              SANG BROCK STRING ➜
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. COVER TEST INTRO SCREEN (Section 38 & 43)
  return (
    <div className="card stage-card-main cover-test-card">
      <div className="stage-header">
        <span className="badge badge-primary">Bước 2 / 4</span>
        <h2 className="stage-title">Nghiệm pháp Che mắt (Cover Test)</h2>
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
        <AudioButton text="Chúng ta bắt đầu kiểm tra mắt nhé. Nhìn vào chấm tròn ở giữa." onActivate={() => { if (!isVoiceEnabled) toggleSound?.(); }} />
      </div>

      <div className="cover-running-layout">
        {/* Left Column: Camera Feed preview */}
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

        {/* Right Column: Introduction & Child-friendly instructions */}
        <div className="instruction-column">
          <div className="cover-state-machine-box">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--text-main)' }}>
              Hướng dẫn thực hiện Cover Test
            </h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '14px' }}>
              Hệ thống sẽ thực hiện <strong>3 chu kỳ che mở từng mắt</strong>. Khi bắt đầu, màn hình sẽ chuyển sang chế độ <strong>Toàn màn hình</strong> để bé tập trung nhìn vào tâm điểm.
            </p>

            <div className="intro-steps-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>🔴</span>
                <div style={{ fontSize: '0.88rem' }}>
                  <strong>Nhìn vào chấm đỏ ở giữa màn hình</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Giữ đầu thẳng và mắt nhìn cố định vào tâm chấm.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>✋</span>
                <div style={{ fontSize: '0.88rem' }}>
                  <strong>Che mắt theo hiệu lệnh</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Dùng lòng bàn tay hoặc miếng che che mắt trái/phải theo giọng nói.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>👀</span>
                <div style={{ fontSize: '0.88rem' }}>
                  <strong>Bỏ che mắt &amp; tiếp tục nhìn thẳng</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Hạ tay xuống và giữ ánh nhìn cố định vào chấm đỏ.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="cover-action-box" style={{ marginTop: '14px' }}>
            <button
              type="button"
              className="btn btn-primary btn-large btn-block"
              onClick={startCoverTestProtocol}
            >
              ▶ BẮT ĐẦU 3 CHU KỲ COVER TEST (TOÀN MÀN HÌNH)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
