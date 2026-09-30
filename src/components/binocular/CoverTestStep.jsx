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
import { SCREENING_CONFIG, COVER_TEST_CONFIG } from '../../constants/screeningConfig.js';
import { aggregateCoverCycles, createCoverFrame, createCycleRecord, generateUUIDv4, inconclusiveCycle, isCoverSessionCurrent, isValidUUIDv4, validateBaselinePair } from '../../services/coverTestProtocolService.js';
import { createTimeSeriesRecorder } from '../../services/coverTestTimeSeriesService.js';
import { captureScreeningFrame, captureEyeRegionCrop } from '../../services/screeningImageCaptureService.js';
import { saveCoverTestSession as saveCoverTestCloudSession } from '../../services/coverTest/coverTestPersistenceService.js';
import { analyzeCoverTest } from '../../services/aiBackendService.js';
import { toCanonicalEye, getCoverInstruction } from '../../utils/eyeCoordinateMapping.js';

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
  sessionId = null,
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

  // 15 Hz Time-series recording ref (Section 14: no array recreation in realtime loop)
  const timeSeriesRecorderRef = useRef(createTimeSeriesRecorder());
  const [telemetry, setTelemetry] = useState({
    realtimeFps: 0,
    datasetSampleRateHz: COVER_TEST_CONFIG.datasetSampleRateHz,
    totalFrames: 0,
    savedSamples: 0,
    validSamples: 0,
  });
  const lastTelemetryUpdateRef = useRef(0);

  // Recorded summary data
  const [_completedCyclesList, setCompletedCyclesList] = useState([]);
  const [coverSummary, setCoverSummary] = useState(null);
  const canonicalSessionId = useMemo(() => {
    if (isValidUUIDv4(sessionId)) return sessionId;
    if (sessionId) console.warn('[CoverTestStep] Non-UUID sessionId provided, generating canonical UUID v4:', sessionId);
    return generateUUIDv4();
  }, [sessionId]);

  // Execution refs
  const isAbortedRef = useRef(false);
  const currentBaselineRef = useRef(null);
  const sessionIdRef = useRef(canonicalSessionId);
  const activeRunTokenRef = useRef(0);
  const eyeImagesRef = useRef({});
  const accumulatedCyclesRef = useRef([]);
  const phaseRafRef = useRef(null);
  const phaseResolveRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    sessionIdRef.current = canonicalSessionId;
  }, [canonicalSessionId]);

  // Request cancellation on component unmount
  useEffect(() => {
    abortControllerRef.current = new AbortController();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Phase 4.2: AI Transfer Inference state (research experiment only)
  const [aiTransferState, setAiTransferState] = useState({
    status: 'idle', // 'idle' | 'loading' | 'success' | 'error'
    result: null,
    error: null,
    detail: null,
  });
  const hasSentAiTransferRef = useRef(false);

  // Cover Test sampling dataset persistence state
  const [sessionSaveState, setSessionSaveState] = useState({
    status: 'idle', // 'idle' | 'saving' | 'saved' | 'error'
    sessionId: null,
    sessionPath: null,
    sampleCount: 0,
    error: null,
    message: null,
  });
  const hasSavedSessionRef = useRef(false);

  const requestAiTransfer = useCallback(async (summary) => {
    if (!summary || hasSentAiTransferRef.current) return;
    hasSentAiTransferRef.current = true;
    setAiTransferState({ status: 'loading', result: null, error: null, detail: null });

    try {
      const response = await analyzeCoverTest(summary, {
        sampleId: canonicalSessionId,
        signal: abortControllerRef.current?.signal,
      });

      if (response && response.status === 'TRANSFER_EXPERIMENT') {
        setAiTransferState({
          status: 'success',
          result: response,
          error: null,
          detail: null,
        });
      } else {
        setAiTransferState({
          status: 'error',
          result: null,
          error: response?.message || 'Không thể nhận kết quả từ mô hình AI.',
          detail: response?.detail || response?.error,
        });
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setAiTransferState({
        status: 'error',
        result: null,
        error: 'Lỗi kết nối tới hệ thống AI. Vui lòng thử lại.',
        detail: err?.message,
      });
    }
  }, [canonicalSessionId]);

  const persistSessionSampling = useCallback(async (currentSessionId, cyclesList, summaryPayload = null) => {
    if (hasSavedSessionRef.current) return;
    hasSavedSessionRef.current = true;
    accumulatedCyclesRef.current = cyclesList || [];

    const totalSamples = (cyclesList || []).reduce(
      (acc, cycle) => acc + (cycle.samples?.length || cycle.rawTrajectory?.length || 0),
      0
    );

    setSessionSaveState({
      status: 'saving',
      sessionId: currentSessionId,
      sessionPath: null,
      sampleCount: totalSamples,
      error: null,
      message: null,
    });

    // Set AI inference to loading while backend processes both storage and model transfer
    if (!hasSentAiTransferRef.current) {
      setAiTransferState({ status: 'loading', result: null, error: null, detail: null });
    }

    try {
      const targetSessionId = isValidUUIDv4(currentSessionId) ? currentSessionId : canonicalSessionId;
      const result = await saveCoverTestCloudSession({
        sessionId: targetSessionId,
        clientMetadata: {
          testType: 'cover_test',
          createdAt: new Date().toISOString(),
          samplingRateHz: COVER_TEST_CONFIG.datasetSampleRateHz,
          protocolVersion: 'cover-test-v1',
          camera: { mirrored: true },
        },
        cycles: cyclesList || [],
        images: eyeImagesRef.current,
        runInference: true,
        signal: abortControllerRef.current?.signal,
      });

      if (result.saved && result.success) {
        setSessionSaveState({
          status: 'saved',
          sessionId: targetSessionId,
          sessionPath: result.storageRoot,
          sampleCount: totalSamples,
          error: null,
          message: 'Dữ liệu kiểm tra và ảnh vùng mắt đã được lưu trữ an toàn lên Cloud.',
        });

        // If backend executed AI inference, fulfill AI transfer state directly without duplicate API call
        if (result.aiResult) {
          hasSentAiTransferRef.current = true;
          setAiTransferState({
            status: 'success',
            result: result.aiResult,
            error: null,
            detail: null,
          });
        } else if (!hasSentAiTransferRef.current && (summaryPayload || coverSummary)) {
          // Fallback only if backend saved successfully but omitted AI inference
          requestAiTransfer(summaryPayload || coverSummary);
        }
      } else {
        hasSavedSessionRef.current = false;
        setSessionSaveState({
          status: 'error',
          sessionId: targetSessionId,
          sessionPath: null,
          sampleCount: totalSamples,
          error: result.error || 'SAVE_FAILED',
          message: result.message || 'Không thể lưu dữ liệu kiểm tra. Vui lòng thử lại.',
        });
        // Fallback to standalone AI inference endpoint if cloud storage persistence failed
        if (!hasSentAiTransferRef.current && (summaryPayload || coverSummary)) {
          requestAiTransfer(summaryPayload || coverSummary);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      hasSavedSessionRef.current = false;
      setSessionSaveState({
        status: 'error',
        sessionId: currentSessionId,
        sessionPath: null,
        sampleCount: totalSamples,
        error: err?.message || 'NETWORK_ERROR',
        message: 'Lỗi mạng khi lưu dữ liệu kiểm tra. Vui lòng thử lại.',
      });
      if (!hasSentAiTransferRef.current && (summaryPayload || coverSummary)) {
        requestAiTransfer(summaryPayload || coverSummary);
      }
    }
  }, [canonicalSessionId, coverSummary, requestAiTransfer]);

  const retrySessionSave = useCallback(() => {
    hasSavedSessionRef.current = false;
    persistSessionSampling(canonicalSessionId, accumulatedCyclesRef.current, coverSummary);
  }, [canonicalSessionId, coverSummary, persistSessionSampling]);

  useEffect(() => {
    // Only dispatch standalone requestAiTransfer if session persistence is NOT active
    if (coverState === 'FINISHED' && coverSummary && !hasSentAiTransferRef.current && !hasSavedSessionRef.current) {
      requestAiTransfer(coverSummary);
    }
  }, [coverState, coverSummary, requestAiTransfer]);

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
    // Never clobber the canonical UUID v4 session ID on run invalidation
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
        const phaseRunToken = activeRunTokenRef.current;
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
          if (isAbortedRef.current || phaseRunToken !== activeRunTokenRef.current || !isCoverSessionCurrent(phaseSessionId, sessionIdRef.current, isAbortedRef.current)) {
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
            } else if (state === 'TRACKING' && trackEye) {
              const tracked = createCoverFrame(feats, currentQuality, trackEye, now, elapsed);
              if (tracked.frame) {
                buffer.push(tracked.frame);
              }
            }

            // Downsampled 15 Hz time-series recording (Sections 2, 3, 4, 7, 8, 14, 16)
            timeSeriesRecorderRef.current.processFrame(
              now,
              state,
              feats,
              currentQuality,
              currentBaselineRef.current,
              trackEye,
              coverEye
            );

            // Throttle React state telemetry updates to 4 Hz (every 250ms) to avoid 60 FPS re-render churn (Section 14)
            if (now - lastTelemetryUpdateRef.current >= 250) {
              lastTelemetryUpdateRef.current = now;
              const telem = timeSeriesRecorderRef.current.getTelemetry();
              setTelemetry(telem);
              setLiveSampleCount(telem.savedSamples);

              if (state === 'TRACKING' && trackEye && baselineData?.normalizedBaselineX !== undefined) {
                const trackedX = trackEye === 'right' ? feats.raw?.rightIrisX : feats.raw?.leftIrisX;
                const trackedY = trackEye === 'right' ? feats.raw?.rightIrisY : feats.raw?.leftIrisY;
                if (trackedX != null && trackedY != null) {
                  const dx = trackedX - baselineData.normalizedBaselineX;
                  const dy = trackedY - baselineData.normalizedBaselineY;
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
                const latestEyeWidth = buffer.length && buffer.at(-1)?.eyeWidth > 0 ? buffer.at(-1).eyeWidth : null;
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
    const runToken = ++activeRunTokenRef.current;
    isAbortedRef.current = false;
    const runIsCurrent = () => !isAbortedRef.current && runToken === activeRunTokenRef.current;
    eyeImagesRef.current = {};
    setCompletedCyclesList([]);
    setCoverSummary(null);
    currentBaselineRef.current = null;
    hasSentAiTransferRef.current = false;
    setAiTransferState({ status: 'idle', result: null, error: null, detail: null });

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
      // Reset 15 Hz time-series recorder for new cycle
      timeSeriesRecorderRef.current.reset(performance.now());

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
        const rawTrajectory = timeSeriesRecorderRef.current.getSamples();
        const datasetQuality = timeSeriesRecorderRef.current.getQuality();
        const failedCycle = inconclusiveCycle(
          c,
          baselineQuality.reason,
          baselines,
          rawTrajectory,
          null,
          datasetQuality
        );
        failedCycle.summary = timeSeriesRecorderRef.current.finalizeCycleSummary(failedCycle);
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
      const leftCoverInstr = getCoverInstruction('LEFT');
      await executePhase({
        state: 'COVER',
        title: leftCoverInstr.title,
        text: leftCoverInstr.text,
        subtext: leftCoverInstr.subtext,
        coverEye: 'left',
        trackEye: null,
        durationMs: 4500,
        speechText: leftCoverInstr.speechText,
        cycleNum: c,
      });

      if (!runIsCurrent()) return;

      // Phase 3a: Brief Uncover notice (0.8s)
      // Protocol-Triggered Image Capture: LEFT eye crop
      captureEyeRegionCrop(videoRef.current, latestFeaturesRef?.current?.raw?.landmarks || landmarks, 'LEFT').then((crop) => {
        if (crop?.blob) {
          eyeImagesRef.current[`${c}_left`] = crop.blob;
          onImageCaptured?.(crop.metadata);
        }
      }).catch((e) => console.warn('[EyeCrop] Left eye capture note:', e));

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
      const rightCoverInstr = getCoverInstruction('RIGHT');
      await executePhase({
        state: 'COVER',
        title: rightCoverInstr.title,
        text: rightCoverInstr.text,
        subtext: rightCoverInstr.subtext,
        coverEye: 'right',
        trackEye: null,
        durationMs: 4500,
        speechText: rightCoverInstr.speechText,
        cycleNum: c,
      });

      if (!runIsCurrent()) return;

      // Phase 5a: Brief Uncover notice (0.8s)
      // Protocol-Triggered Image Capture: RIGHT eye crop
      captureEyeRegionCrop(videoRef.current, latestFeaturesRef?.current?.raw?.landmarks || landmarks, 'RIGHT').then((crop) => {
        if (crop?.blob) {
          eyeImagesRef.current[`${c}_right`] = crop.blob;
          onImageCaptured?.(crop.metadata);
        }
      }).catch((e) => console.warn('[EyeCrop] Right eye capture note:', e));

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

      // Record Cycle Result with 15 Hz time-series trajectory and summary (Sections 10, 11)
      const rawTrajectory = timeSeriesRecorderRef.current.getSamples();
      const datasetQuality = timeSeriesRecorderRef.current.getQuality();
      const cycleRecord = createCycleRecord(
        c,
        baselines,
        rightEyeAnalysis,
        leftEyeAnalysis,
        rawTrajectory,
        null,
        datasetQuality
      );
      cycleRecord.summary = timeSeriesRecorderRef.current.finalizeCycleSummary(cycleRecord);

      // Diagnostic telemetry log required by Section 22
      const activeEye = cycleRecord.trackedEye === 'RIGHT' ? cycleRecord.rightEye : cycleRecord.leftEye;
      const eyeBaseline = cycleRecord.trackedEye === 'RIGHT' ? baselines?.rightBaseline : baselines?.leftBaseline;
      const durationSec = Math.max(0.1, (datasetQuality.durationMs || 1) / 1000);
      const approxRate = Number((datasetQuality.savedSamples / durationSec).toFixed(1));
      console.log('[CoverTest Cycle Telemetry]', {
        cycle: c,
        realtimeFrameCount: datasetQuality.totalFrames,
        savedSampleCount: datasetQuality.savedSamples,
        validSampleCount: datasetQuality.validSamples,
        validRatio: datasetQuality.validRatio,
        durationMs: datasetQuality.durationMs,
        samplingRateApprox: approxRate,
        baseline: eyeBaseline ? {
          leftX: baselines?.leftBaseline?.baselineX ?? null,
          leftY: baselines?.leftBaseline?.baselineY ?? null,
          rightX: baselines?.rightBaseline?.baselineX ?? null,
          rightY: baselines?.rightBaseline?.baselineY ?? null,
        } : null,
        eyeWidth: activeEye?.eyeWidth ?? null,
        displacement: activeEye?.displacement ?? null,
        normalizedDisplacement: activeEye?.normalizedDisplacement ?? null,
        quality: cycleRecord.quality,
      });

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

      // Automatically persist raw sampling dataset to backend storage.
      // The cloud session persistence endpoint handles both storage and AI inference in ONE single roundtrip,
      // eliminating duplicate inference calls and race conditions.
      persistSessionSampling(canonicalSessionId, accumulatedCycles, summaryPayload);
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
          sessionId={canonicalSessionId}
          timerDisplay={timerDisplay}
          startTime={trackingStartTime}
          elapsedMs={trackingElapsedMs}
          realtimeFps={telemetry.realtimeFps}
          datasetSampleRateHz={telemetry.datasetSampleRateHz}
          totalFrames={telemetry.totalFrames}
          savedSamples={telemetry.savedSamples}
          validSamples={telemetry.validSamples}
        />
        {/* Full-viewport camera background (Section 35.1) */}
        <div className="fullscreen-camera-background">
          <CameraView
            videoRef={videoRef}
            stream={stream}
            landmarks={landmarks}
            featuresRef={latestFeaturesRef}
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
              {coverState === 'COVER' && toCanonicalEye(coveredEye) === 'LEFT' ? (
                <>
                  <span title="Che mắt trái" style={{ filter: 'grayscale(1)', opacity: 0.65 }}>✋</span>
                  <span title="Mắt phải mở">👁️</span>
                </>
              ) : coverState === 'COVER' && toCanonicalEye(coveredEye) === 'RIGHT' ? (
                <>
                  <span title="Mắt trái mở">👁️</span>
                  <span title="Che mắt phải" style={{ filter: 'grayscale(1)', opacity: 0.65 }}>✋</span>
                </>
              ) : (
                <>
                  <span title="Mắt trái mở">👁️</span>
                  <span title="Mắt phải mở">👁️</span>
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

          {/* Phase 4.2: AI Transfer Experiment Card */}
          <div
            className="ai-transfer-experiment-card"
            style={{
              maxWidth: '640px',
              margin: '0 auto 20px',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🔬</span>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#60a5fa' }}>
                  AI Transfer Experiment
                </h4>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#93c5fd',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                Nghiên cứu / Thử nghiệm
              </span>
            </div>

            {/* Scientific Disclaimer */}
            <div
              style={{
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.85rem',
                color: '#fde047',
                marginBottom: '14px',
                lineHeight: '1.45',
              }}
            >
              ⚠️ <strong>Lưu ý nghiên cứu:</strong> Kết quả này là đầu ra thử nghiệm của mô hình nghiên cứu, không phải chẩn đoán y khoa.
            </div>

            {/* State rendering */}
            {aiTransferState.status === 'loading' && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <div style={{ display: 'inline-block', marginBottom: '8px', fontSize: '1.3rem' }}>⏳</div>
                <div>Đang gửi dữ liệu Cover Test thô & thực hiện suy luận mô hình AI...</div>
              </div>
            )}

            {aiTransferState.status === 'error' && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ color: '#f87171', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                  {aiTransferState.error || 'Không thể kết nối tới hệ thống AI.'}
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Vui lòng đảm bảo backend FastAPI đang hoạt động trên cổng được cấu hình (VITE_AI_BACKEND_URL).
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '5px 12px' }}
                  onClick={() => {
                    hasSentAiTransferRef.current = false;
                    requestAiTransfer(coverSummary);
                  }}
                >
                  🔄 Thử lại gửi AI
                </button>
              </div>
            )}

            {aiTransferState.status === 'success' && aiTransferState.result && (() => {
              const res = aiTransferState.result;

              // Extract Korean 10-15 FPS candidate model
              const candidate15 = res.comparisonModels?.find(
                (m) =>
                  m.key === 'korean_15fps_candidate' ||
                  m.key === 'korean_10_15fps_research_model'
              ) || (res.comparisonModels && res.comparisonModels.length > 0 && res.comparisonModels[0].key !== 'korean_b2' ? res.comparisonModels[0] : null);

              const modelResult = candidate15 || {
                label: res.label || 'Korean 10–15 FPS candidate',
                prediction: res.prediction,
                classProbability: res.classProbability || res.classProbabilities,
                model: res.model || {
                  name: 'Korean 10-15 FPS robust transfer candidate',
                  version: 'remicare-transfer-10to15fps-candidate-v1.1.0',
                },
                samplingProfile: res.samplingProfile || 'Korean recordings augmented across fixed and variable 10–15 FPS with simulated frame drops',
              };

              const cleanLabel = modelResult.label || 'Korean 10–15 FPS candidate';
              const cleanPrediction = modelResult.prediction || 'INCONCLUSIVE';
              const cleanProbabilities = modelResult.classProbability || modelResult.classProbabilities || { NORMAL: 0, STRABISMUS: 0 };
              const cleanVersion = modelResult.model?.version || 'remicare-transfer-10to15fps-candidate-v1.1.0';
              const cleanProfile = modelResult.samplingProfile || 'Korean recordings augmented across fixed and variable 10–15 FPS with simulated frame drops';

              const cardStyle = {
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.86rem' }}>
                  {/* Card: Korean 10-15 FPS candidate */}
                  <div style={cardStyle}>
                    <div style={{ color: '#93c5fa', fontSize: '0.88rem', fontWeight: 700, marginBottom: '8px' }}>
                      {cleanLabel}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.74rem', marginBottom: '3px' }}>
                      Model Prediction
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: cleanPrediction === 'NORMAL' ? '#34d399' : '#fbbf24', marginBottom: '8px' }}>
                      {cleanPrediction}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.74rem', marginBottom: '3px' }}>
                      Model class probability
                    </div>
                    <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                      NORMAL: <span style={{ color: '#34d399' }}>{((cleanProbabilities.NORMAL ?? 0) * 100).toFixed(1)}%</span>
                      {' | '}
                      STRABISMUS: <span style={{ color: '#fbbf24' }}>{((cleanProbabilities.STRABISMUS ?? 0) * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', lineHeight: 1.4, marginTop: '8px' }}>
                      {cleanVersion}<br />
                      {cleanProfile}
                    </div>
                  </div>

                  {/* Metadata section */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                    <div>• <strong>Mô hình:</strong> {cleanLabel} ({cleanVersion}, 14 đặc trưng kỹ thuật)</div>
                    <div>• <strong>Domain shift:</strong> <span style={{ color: '#f59e0b', fontWeight: 600 }}>WARNING</span> (Korean IR Eye-tracker 60Hz → RemiCare Webcam 15Hz)</div>
                    <div>• <strong>Ý nghĩa lâm sàng:</strong> None (Clinical meaning: null)</div>
                    <div>• <strong>Research-only output:</strong> Probability is model output and has not been clinically validated for RemiCare webcam data.</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Research Sampling Storage Status (Section 5 & 12) */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              maxWidth: '640px',
              margin: '0 auto 20px auto',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                💾 Dữ liệu nghiên cứu (Sampling Data)
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {sessionSaveState.sessionId || canonicalSessionId}
              </span>
            </div>

            {sessionSaveState.status === 'saving' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <span className="spinner-small" aria-hidden="true" />
                <span>Đang tự động lưu trữ sampling thô vào thư mục data/...</span>
              </div>
            )}

            {sessionSaveState.status === 'saved' && (
              <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ color: '#34d399', fontWeight: 600, fontSize: '0.88rem', marginBottom: '2px' }}>
                  ✅ Đã lưu raw sampling thành công!
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  Đã ghi nhận <strong>{sessionSaveState.sampleCount}</strong> mẫu dữ liệu chuỗi thời gian (15 Hz) phục vụ đào tạo và nghiên cứu AI.
                </div>
              </div>
            )}

            {sessionSaveState.status === 'error' && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ color: '#f87171', fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px' }}>
                  ⚠️ Không thể lưu dữ liệu kiểm tra. Vui lòng thử lại.
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {sessionSaveState.message || sessionSaveState.error}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                  onClick={retrySessionSave}
                >
                  🔄 Thử lại lưu dữ liệu
                </button>
              </div>
            )}
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
            featuresRef={latestFeaturesRef}
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
