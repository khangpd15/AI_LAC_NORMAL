import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { checkVideoLightingAndBlur } from '../../services/positionCalibrationService.js';
import { COVER_PHASE_MS, isCoverPhaseComplete } from '../../services/coverTestTimeline.js';
import { createCoverTestCues } from '../../services/coverTestCues.js';
import audioService from '../../services/audioService.js';
import { createCoverBaselineBuffer, isCoverFrameInPhase } from '../../services/coverTestBaselineBuffer.js';
import { coverTestGuideVideo } from '../../content/coverTestGuideVideo.js';
import AudioButton from '../audio/AudioButton';
import CoverTestDebugPanel from '../debug/CoverTestDebugPanel';
import CameraView from '../CameraView';
import FixationTarget from './FixationTarget';
import {
  analyzeUncoverTrajectory,
} from '../../services/coverTestMeasurementService.js';
import {
  COVER_TEST_VERDICTS,
  FIXATION_TARGET_CONFIG,
} from '../../constants/binocularScreeningConfig.js';
import { COVER_TEST_CONFIG, SCREENING_CONFIG } from '../../constants/screeningConfig.js';
import { RESEARCH_QUALITY_CONFIG } from '../../constants/researchScreeningConfig.js';
import { aggregateCoverCycles, createCoverFrame, createCycleRecord, generateUUIDv4, isCoverSessionCurrent, isValidUUIDv4, validateBaselinePair } from '../../services/coverTestProtocolService.js';
import { createTimeSeriesRecorder } from '../../services/coverTestTimeSeriesService.js';
import { captureScreeningFrame } from '../../services/screeningImageCaptureService.js';
import { UncoverCaptureObserver, freezeEyePair, encodeEyePair } from '../../services/coverTest/uncoverCaptureService.js';
import { saveCoverTestSession as saveCoverTestCloudSession } from '../../services/coverTest/coverTestPersistenceService.js';
import { toCanonicalEye } from '../../utils/eyeCoordinateMapping.js';
import CoverTestLightbox from '../coverTest/CoverTestLightbox';
import CoverTestLiveThumbnailStrip from '../coverTest/CoverTestLiveThumbnailStrip';
import CoverTestImageGallery from '../coverTest/CoverTestImageGallery';


/**
 * CoverTestStep Component
 * Step 2 of Digital Binocular Vision Screening.
 * 
 * Clinical Protocol State Machine:
 * IDLE -> PREPARING -> BASELINE (if needed) -> COVER -> TRACKING -> CHECKING -> FINISHED
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
  landmarksRef = null,
  quality = null,
  latestFeaturesRef = null,
  onComplete,
  speak,
  isVoiceEnabled = true,
  toggleSound,
  onVideoReady,
  positionReport = null,
  faceMeshMetrics = null,
  aiMetrics = null,
  onImageCaptured,
  onTrackingContextChange,
  frameConsumerRef,
}) {
  const imageCaptureAttemptedRef = useRef(false);
  const cuesRef = useRef(null);
  const voiceEnabledRef = useRef(isVoiceEnabled);
  voiceEnabledRef.current = isVoiceEnabled;
  const [cueError, setCueError] = useState(false);
  const playCue = (kind) => {
    if (!voiceEnabledRef.current) return;
    cuesRef.current ||= createCoverTestCues();
    cuesRef.current.play(kind).then(ok => setCueError(!ok)).catch(() => setCueError(true));
  };
  const testCue = () => {
    cuesRef.current ||= createCoverTestCues();
    if (!voiceEnabledRef.current) toggleSound?.();
    cuesRef.current.play('uncover').then(ok => setCueError(!ok)).catch(() => setCueError(true));
  };
  const handleToggleSound = () => {
    if (!voiceEnabledRef.current || cueError) testCue();
    else { cuesRef.current?.cancel(); toggleSound?.(); }
  };
  useEffect(() => () => { cuesRef.current?.close(); audioService.stop(); }, []);
  // Master State Machine:
  // 'IDLE' | 'PREPARING' | 'BASELINE' | 'COVER' | 'UNCOVER' | 'TRACKING' | 'CYCLE_COMPLETE' | 'NEXT_CYCLE' | 'FINISHED'
  const [coverState, setCoverState] = useState('IDLE');
  const [cycleIndex, setCycleIndex] = useState(1);
  const [countdownSec, setCountdownSec] = useState(0);
  const [protocolSecond, setProtocolSecond] = useState(0);
  const [baselineError, setBaselineError] = useState(null);
  const baselineBufferRef = useRef(createCoverBaselineBuffer());
  const baselineStartRef = useRef(0);
  const baselineFeedbackRef = useRef('Đang chờ hình ảnh camera.');
  const [baselineProgress, setBaselineProgress] = useState(null);
  const protocolStartRef = useRef(null);
  const positionReportRef = useRef(positionReport);
  useEffect(() => { positionReportRef.current = positionReport; }, [positionReport]);

  // Active instructions & active eyes
  const [coveredEye, setCoveredEye] = useState(null); // 'left' | 'right' | null
  const [trackedEye, setTrackedEye] = useState(null); // 'left' | 'right' | null
  const [instructionTitle, setInstructionTitle] = useState('Cover Test');
  const [instructionText, setInstructionText] = useState('Sẵn sàng kiểm tra 3 chu kỳ che mở mắt.');
  const [instructionSubtext, setInstructionSubtext] = useState('Nhìn chấm đỏ và nghe hướng dẫn.');

  // Live real-time telemetry (internal tracking)
  const [liveSampleCount, setLiveSampleCount] = useState(0);
  const [_liveDisplacement, setLiveDisplacement] = useState(0);

  // Timestamp-downsampled time-series recording ref (no array recreation in realtime loop)
  const timeSeriesRecorderRef = useRef(createTimeSeriesRecorder(0, { fullRate: true }));
  const phaseFrameHandlerRef = useRef(null);
  const uncoverObserverRef = useRef(null);
  const uncoverEventsRef = useRef([]);
  const pendingCropsRef = useRef(new Set());
  const cycleStartRef = useRef(0);
  const [capturedPairs, setCapturedPairs] = useState(0);
  const captureFeedbackRef = useRef('');
  const [captureFeedback, setCaptureFeedback] = useState('');
  const lastFeedbackUpdateRef = useRef(0);
  const [recentCaptureNotice, setRecentCaptureNotice] = useState(null);
  const captureNoticeTimeoutRef = useRef(null);

  // Object URL memory management & Gallery Slots
  const createdUrlsRef = useRef(new Set());
  const revokeAllCreatedUrls = useCallback(() => {
    createdUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    });
    createdUrlsRef.current.clear();
  }, []);

  const createInitialSlots = useCallback(() => [
    { slotIndex: 0, cycle: 1, uncoveredEye: 'LEFT', status: 'PENDING', leftUrl: null, rightUrl: null, previewUrl: null, timingOffsetMs: null, rejectionReason: null, debugInfo: null },
    { slotIndex: 1, cycle: 1, uncoveredEye: 'RIGHT', status: 'PENDING', leftUrl: null, rightUrl: null, previewUrl: null, timingOffsetMs: null, rejectionReason: null, debugInfo: null },
    { slotIndex: 2, cycle: 2, uncoveredEye: 'LEFT', status: 'PENDING', leftUrl: null, rightUrl: null, previewUrl: null, timingOffsetMs: null, rejectionReason: null, debugInfo: null },
    { slotIndex: 3, cycle: 2, uncoveredEye: 'RIGHT', status: 'PENDING', leftUrl: null, rightUrl: null, previewUrl: null, timingOffsetMs: null, rejectionReason: null, debugInfo: null },
    { slotIndex: 4, cycle: 3, uncoveredEye: 'LEFT', status: 'PENDING', leftUrl: null, rightUrl: null, previewUrl: null, timingOffsetMs: null, rejectionReason: null, debugInfo: null },
    { slotIndex: 5, cycle: 3, uncoveredEye: 'RIGHT', status: 'PENDING', leftUrl: null, rightUrl: null, previewUrl: null, timingOffsetMs: null, rejectionReason: null, debugInfo: null },
  ], []);

  const [capturedSlots, setCapturedSlots] = useState(createInitialSlots);
  const slotDebugTelemetryRef = useRef({});
  const [lightboxState, setLightboxState] = useState({ isOpen: false, currentIndex: 0, items: [] });

  const handleOpenLightbox = useCallback((index, items) => {
    setLightboxState({
      isOpen: true,
      currentIndex: index,
      items: items || [],
    });
  }, []);

  const currentActiveSlotIndex = useMemo(() => {
    const base = (cycleIndex - 1) * 2;
    const isRight = coveredEye === 'right' || trackedEye === 'right';
    return Math.min(5, Math.max(0, base + (isRight ? 1 : 0)));
  }, [cycleIndex, coveredEye, trackedEye]);

  useEffect(() => {
    return () => {
      revokeAllCreatedUrls();
    };
  }, [revokeAllCreatedUrls]);

  useEffect(() => {
    if (!frameConsumerRef) return;
    const consume = packet => phaseFrameHandlerRef.current?.(packet);
    frameConsumerRef.current = consume;
    return () => {
      if (frameConsumerRef.current === consume) frameConsumerRef.current = null;
    };
  }, [frameConsumerRef]);
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
    setAiTransferState({
      status: 'error',
      result: null,
      error: 'Chưa nhận được kết quả phân tích từ máy chủ. Hãy thử phân tích lại bên dưới.',
      detail: null,
    });
  }, []);

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
          samplingRateHz: 30,
          samplingMode: 'UNIQUE_SOURCE_FRAMES',
          protocolVersion: 'cover-test-multimodal-v2',
          researchSchemaVersion: RESEARCH_QUALITY_CONFIG.schemaVersion,
          coverSequenceSchema: {
            timestampField: 'timestampMs',
            phaseField: 'phase',
            irisXField: 'iris_x',
            eyeCornerField: 'eye_corner',
            visibilityField: 'visibility',
            thresholdSource: RESEARCH_QUALITY_CONFIG.thresholdSource,
          },
          camera: { previewMirrored: true, imagesMirrored: false },
        },
        cycles: cyclesList || [],
        images: eyeImagesRef.current,
        runInference: true,
        signal: abortControllerRef.current?.signal,
      });

      if (result.success) {
        setSessionSaveState({
          status: result.saved ? 'saved' : 'processed',
          sessionId: targetSessionId,
          sessionPath: result.storageRoot,
          sampleCount: totalSamples,
          error: null,
          message: 'Dữ liệu chuyển động mắt đã được lưu trữ lên Cloud.',
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
    hasSentAiTransferRef.current = false;
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
  const [videoDims, setVideoDims] = useState({ width: null, height: null });

  useEffect(() => {
    const v = videoRef?.current;
    if (!v) return;
    const handleResize = () => {
      if (v.videoWidth > 0 && v.videoHeight > 0) {
        setVideoDims((prev) => (prev.width === v.videoWidth && prev.height === v.videoHeight ? prev : { width: v.videoWidth, height: v.videoHeight }));
      }
    };
    handleResize();
    v.addEventListener('resize', handleResize);
    v.addEventListener('loadedmetadata', handleResize);
    return () => {
      v.removeEventListener('resize', handleResize);
      v.removeEventListener('loadedmetadata', handleResize);
    };
  }, [videoRef, stream]);

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
        const eyeNormY = (landmarks[133] && landmarks[362]) ? (landmarks[133].y + landmarks[362].y) / 2 : 0.35;
        const displayY = eyeNormY != null ? Number((eyeNormY * 100).toFixed(1)) : 38;
        return { x: clampedX, y: Math.max(32, Math.min(42, displayY)) };
      }
    }
    return { x: 50, y: 38 };
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
    audioService.stop();
    cuesRef.current?.cancel();
    isAbortedRef.current = true;
    protocolStartRef.current = null;
    phaseFrameHandlerRef.current = null;
    uncoverObserverRef.current?.transition.reset();
    isTargetLockedRef.current = false;
    setLockedTargetPos(null);
    if (captureNoticeTimeoutRef.current) clearTimeout(captureNoticeTimeoutRef.current);
    captureNoticeTimeoutRef.current = null;
    setRecentCaptureNotice(null);
    setCaptureFeedback('');
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
      onTrackingContextChange?.(null);
    };
  }, [invalidateActiveRun, onTrackingContextChange]);

  useEffect(() => {
    onTrackingContextChange?.({
      phase: coverState,
      coveredEye,
      trackedEye,
    });
  }, [coverState, coveredEye, trackedEye, onTrackingContextChange]);

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
    if (speak) speak('Dạ, đã tạm dừng bài kiểm tra rồi nghen.');
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
        const phaseRecorder = timeSeriesRecorderRef.current;
        const phaseSessionId = sessionIdRef.current;
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          if (phaseRafRef.current !== null) cancelAnimationFrame(phaseRafRef.current);
          phaseRafRef.current = null;
          phaseFrameHandlerRef.current = null;
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

        let speechFinished = !speechText || !speak || !isVoiceEnabled;
        if (!speechFinished) Promise.resolve(speak(speechText)).catch(() => false).finally(() => { speechFinished = true; });
        if (state === 'COVER' || state === 'TRACKING') {
          playCue(state === 'TRACKING' ? 'uncover' : 'cover');
        }

        const buffer = [];
        const startT = performance.now();
        if (state === 'COVER') uncoverObserverRef.current?.transition.reset(coverEye);
        const initialSeconds = Math.ceil(durationMs / 1000);
        setCountdownSec(initialSeconds);
        let prevSec = initialSeconds;

        // Called synchronously from each completed inference, with its frozen
        // source image. Never sample a newer live video using older landmarks.
        let lastTimestamp = -Infinity;
        phaseFrameHandlerRef.current = ({ results, features: feats, quality: currentQuality }) => {
          if (isAbortedRef.current || phaseRunToken !== activeRunTokenRef.current) return;
          const captured = results?.capturedFrame;
          if (!captured || !isCoverFrameInPhase(captured.timestampMs, state, startT, baselineStartRef.current, lastTimestamp)) return;
          lastTimestamp = captured.timestampMs;
          const { image, ...metadata } = captured;
          const lm = results.multiFaceLandmarks?.[0];
          const observation = uncoverObserverRef.current?.observe(image, lm, captured.timestampMs, state === 'PREPARING' ? 'BASELINE' : state,
            () => !feats || !currentQuality?.faceDetected || currentQuality?.headPoseValid === false ? null : freezeEyePair(image, lm, metadata));
          if (state === 'COVER') {
            captureFeedbackRef.current = uncoverObserverRef.current?.transition.armed
              ? 'Đã nhận diện che mắt. Giữ nguyên và chờ hiệu lệnh bỏ che.'
              : 'Chưa xác nhận che mắt. Che kín mắt được yêu cầu, để mắt còn lại rõ trong camera.';
          } else if (state === 'TRACKING') {
            captureFeedbackRef.current = uncoverObserverRef.current?.transition.done
              ? 'Đã nhận diện bỏ che. Giữ đầu yên để ghi phản ứng mắt.'
              : 'Bỏ tay ra hoàn toàn để camera nhìn rõ cả hai mắt.';
          }
          const nowMs = performance.now();
          if (nowMs - lastFeedbackUpdateRef.current > 150) {
            lastFeedbackUpdateRef.current = nowMs;
            setCaptureFeedback(captureFeedbackRef.current);
          }

          const activeSide = state === 'COVER' ? coverEye : (state === 'TRACKING' ? trackEye : null);
          if (activeSide && (state === 'COVER' || state === 'TRACKING')) {
            const currentSlotIdx = (cycleNum - 1) * 2 + (activeSide === 'left' ? 0 : 1);
            if (!slotDebugTelemetryRef.current[currentSlotIdx]) {
              slotDebugTelemetryRef.current[currentSlotIdx] = {
                armedEverTrue: false,
                headPoseInvalidEver: false,
                lastObservedVisibility: null,
              };
            }
            const diag = slotDebugTelemetryRef.current[currentSlotIdx];
            if (uncoverObserverRef.current?.transition?.armed) {
              diag.armedEverTrue = true;
            }
            if (currentQuality && currentQuality.headPoseValid === false) {
              diag.headPoseInvalidEver = true;
            }
            if (observation?.visibility) {
              diag.lastObservedVisibility = observation.visibility;
            }
          }

          if (observation?.event) {
            const cycleStart = cycleStartRef.current;
            const pending = encodeEyePair(observation.event, cycleNum, cycleStart).then(({ images, metadata: event }) => {
              if (isAbortedRef.current || phaseRunToken !== activeRunTokenRef.current) return;
              if (!phaseRecorder.getSamples().some(sample => sample.frameId === event.frameId &&
                  sample.timestampMs === event.timestampMs)) throw new Error('SOURCE_SAMPLE_UNAVAILABLE');
              Object.assign(eyeImagesRef.current, images);
              uncoverEventsRef.current.push(event);
              setCapturedPairs(count => count + 1);
              playCue('capture');
              setRecentCaptureNotice(`📸 Đã chụp ảnh hai mắt lúc bỏ che (Lần ${cycleNum})!`);
              if (captureNoticeTimeoutRef.current) clearTimeout(captureNoticeTimeoutRef.current);
              captureNoticeTimeoutRef.current = setTimeout(() => setRecentCaptureNotice(null), 2400);

              const leftField = event.crops?.left?.field;
              const rightField = event.crops?.right?.field;
              const leftBlob = leftField ? images[leftField] : null;
              const rightBlob = rightField ? images[rightField] : null;
              let leftUrl = null;
              let rightUrl = null;
              if (leftBlob) {
                leftUrl = URL.createObjectURL(leftBlob);
                createdUrlsRef.current.add(leftUrl);
              }
              if (rightBlob) {
                rightUrl = URL.createObjectURL(rightBlob);
                createdUrlsRef.current.add(rightUrl);
              }
              const previewUrl = event.uncoveredEye === 'LEFT' ? leftUrl : rightUrl;
              const slotIdx = (cycleNum - 1) * 2 + (event.uncoveredEye === 'LEFT' ? 0 : 1);
              setCapturedSlots(prev => {
                const next = [...prev];
                next[slotIdx] = {
                  slotIndex: slotIdx,
                  cycle: cycleNum,
                  uncoveredEye: event.uncoveredEye,
                  status: 'CAPTURED',
                  leftUrl,
                  rightUrl,
                  previewUrl: previewUrl || leftUrl || rightUrl,
                  timingOffsetMs: event.timingOffsetMs || (event.confirmedAtMs && event.lastCoveredMs ? event.confirmedAtMs - event.lastCoveredMs : null),
                  cropDims: {
                    left: event.crops?.left ? { w: event.crops.left.width, h: event.crops.left.height } : null,
                    right: event.crops?.right ? { w: event.crops.right.width, h: event.crops.right.height } : null,
                  },
                  rejectionReason: null,
                  debugInfo: null,
                };
                return next;
              });
            }).catch(error => {
              if (isAbortedRef.current || phaseRunToken !== activeRunTokenRef.current) return;
              uncoverEventsRef.current.push({
                cycle: cycleNum, uncoveredEye: observation.event.uncoveredEye.toUpperCase(),
                status: 'FAILED', reason: error.message, timestampMs: observation.event.timestampMs,
              });
            }).finally(() => pendingCropsRef.current.delete(pending));
            pendingCropsRef.current.add(pending);
          }
          if (!feats) {
            baselineFeedbackRef.current = 'Chưa nhận diện được khuôn mặt. Đưa mặt vào giữa camera.';
            return;
          }
          const observedFeatures = { ...feats, observedVisibility: observation?.visibility };
          const elapsed = captured.timestampMs - startT;
          if (state === 'BASELINE' || state === 'PREPARING') {
            const imageQuality = checkVideoLightingAndBlur(videoRef.current);
            if (!imageQuality.isLightingValid || !imageQuality.isBlurValid) {
              baselineFeedbackRef.current = !imageQuality.isLightingValid
                ? 'Ánh sáng chưa phù hợp. Tránh ngược sáng và chiếu sáng đều khuôn mặt.'
                : 'Hình ảnh chưa rõ. Lau camera và giữ điện thoại cố định.';
              return;
            }
            const left = createCoverFrame(feats, currentQuality, 'left', captured.timestampMs, elapsed);
            const right = createCoverFrame(feats, currentQuality, 'right', captured.timestampMs, elapsed);
            baselineBufferRef.current.add('left', left.frame);
            baselineBufferRef.current.add('right', right.frame);
            const rejection = left.reason || right.reason;
            baselineFeedbackRef.current = rejection === 'BLINK'
              ? 'Camera đang nhận diện mắt nhắm. Để rõ cả hai mắt và nhìn vào camera.'
              : rejection === 'HEAD_MOTION' ? 'Giữ đầu thẳng, tránh nghiêng hoặc quay đầu.'
              : rejection ? 'Chưa thấy rõ mống mắt. Điều chỉnh vị trí và ánh sáng.' : null;
          } else if (state === 'TRACKING' && trackEye) {
            const eyeVis = observation?.visibility?.[trackEye];
            const isCurrentlyOccluded = eyeVis === 'OCCLUDED' || currentQuality?.eyeVisibility?.[trackEye] === 'OCCLUDED';
            // Do not record while hand is covering the eye or before eye is confirmed visible
            const isReadyForUncoverTrajectory = !isCurrentlyOccluded && (buffer.length > 0 || eyeVis === 'VISIBLE' || !observation);
            if (isReadyForUncoverTrajectory) {
              const tracked = createCoverFrame(observedFeatures, currentQuality, trackEye, captured.timestampMs, elapsed);
              if (tracked.frame) buffer.push(tracked.frame);
            }
          }
          phaseRecorder.processFrame(captured.timestampMs, state, observedFeatures,
            currentQuality, currentBaselineRef.current, trackEye, coverEye);
        };

        const loop = () => {
          if (isAbortedRef.current || phaseRunToken !== activeRunTokenRef.current || !isCoverSessionCurrent(phaseSessionId, sessionIdRef.current, isAbortedRef.current)) {
            finish(null);
            return;
          }

          const now = performance.now();
          const elapsed = now - startT;
          const collectingBaseline = state === 'BASELINE' || state === 'PREPARING';
          const baseline = collectingBaseline ? baselineBufferRef.current.read(now) : null;
          const baselineReady = baseline && validateBaselinePair(baseline).isValid &&
            (!positionReportRef.current || positionReportRef.current.status === 'READY');
          const phaseRemaining = durationMs - elapsed;
          const remainingSec = Math.max(0, Math.ceil(phaseRemaining / 1000));
          if (protocolStartRef.current != null) setProtocolSecond(Math.floor((now - protocolStartRef.current) / 1000));

          if (remainingSec !== prevSec) {
            prevSec = remainingSec;
            setCountdownSec(remainingSec);
          }

          // Sample features at high frequency
          const feats = latestFeaturesRef?.current;
          if (feats) {
            // Throttle React state telemetry updates to 4 Hz (every 250ms) to avoid 60 FPS re-render churn (Section 14)
            if (now - lastTelemetryUpdateRef.current >= 250) {
              lastTelemetryUpdateRef.current = now;
              if (state === 'COVER' || state === 'TRACKING') setInstructionSubtext(captureFeedbackRef.current);
              if (baseline) {
                setBaselineProgress({ left: baseline.leftBaseline.sampleCount, right: baseline.rightBaseline.sampleCount });
                setInstructionSubtext(baselineFeedbackRef.current ||
                  (positionReportRef.current?.status !== 'READY' && positionReportRef.current?.feedbackMessage) ||
                  (validateBaselinePair(baseline).reason === 'BASELINE_UNSTABLE'
                    ? 'Mẫu mắt chưa ổn định. Giữ đầu yên và nhìn vào mục tiêu.' : 'Đang tích lũy mẫu rõ từ cả hai mắt.'));
              }
              const telem = phaseRecorder.getTelemetry();
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

          if (isCoverPhaseComplete(elapsed, durationMs, speechFinished) || (state === 'BASELINE' && baselineReady)) {
            try {
              if (state === 'BASELINE' || state === 'PREPARING') {
                finish(baselineBufferRef.current.read(now));
              } else if (state === 'TRACKING' && trackEye) {
                const latestEyeWidth = buffer.length && buffer.at(-1)?.eyeWidth > 0 ? buffer.at(-1).eyeWidth : null;
                const analysis = buffer.length
                  ? analyzeUncoverTrajectory(buffer, baselineData, trackEye, cycleNum, latestEyeWidth)
                  : null;

                // Head pose safety check: detect head movements during uncover tracking
                if (positionReportRef.current?.headPose && !positionReportRef.current.headPose.isValid) {
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
    audioService.stop();
    cuesRef.current ||= createCoverTestCues();
    if (isVoiceEnabled) cuesRef.current.unlock();
    invalidateActiveRun();
    setBaselineError(null);
    baselineBufferRef.current = createCoverBaselineBuffer();
    baselineStartRef.current = performance.now();
    baselineFeedbackRef.current = 'Đang chờ hình ảnh camera.';
    setBaselineProgress({ left: 0, right: 0 });
    // LOCK fixation target position at test start (Sections 10, 11)
    isTargetLockedRef.current = true;
    setLockedTargetPos(fixationTargetPos);
    const runToken = ++activeRunTokenRef.current;
    isAbortedRef.current = false;
    const runIsCurrent = () => !isAbortedRef.current && runToken === activeRunTokenRef.current;
    eyeImagesRef.current = {};
    uncoverEventsRef.current = [];
    pendingCropsRef.current = new Set();
    uncoverObserverRef.current = new UncoverCaptureObserver();
    setCapturedPairs(0);
    revokeAllCreatedUrls();
    setCapturedSlots(createInitialSlots());
    slotDebugTelemetryRef.current = {};
    setLightboxState({ isOpen: false, currentIndex: 0, items: [] });
    hasSavedSessionRef.current = false;
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    setCompletedCyclesList([]);
    setCoverSummary(null);
    currentBaselineRef.current = null;
    hasSentAiTransferRef.current = false;
    setAiTransferState({ status: 'idle', result: null, error: null, detail: null });

    setCycleIndex(1);
    setProtocolSecond(0);
    imageCaptureAttemptedRef.current = false;
    timeSeriesRecorderRef.current.reset(performance.now());
    protocolStartRef.current = null;
    const instructions = [
      'Giữ đầu thẳng, mở cả hai mắt và nhìn vào chấm tròn.',
      'Chờ hiệu lệnh rồi che mắt được yêu cầu. Không ấn vào mắt.',
      'Khi nghe hai tiếng bíp hoặc thấy chữ Bỏ che, bỏ tay ra ngay.',
      'Lặp lại ba lần mỗi bên. Bây giờ chuẩn bị bắt đầu.',
    ];
    let baselines;
    for (let second = 0; second < instructions.length; second++) {
      baselines = await executePhase({
        state: 'PREPARING', title: 'Hướng dẫn thao tác', text: instructions[second],
        subtext: 'Để cả hai mắt mở trong phần hướng dẫn để camera kiểm tra.',
        durationMs: COVER_PHASE_MS.preparation,
        speechText: instructions[second], cycleNum: 1,
      });
      if (!runIsCurrent()) return;
    }
    // Require fresh, stable samples from BOTH eyes before starting the timed sequence.
    protocolStartRef.current = null;
    if (!validateBaselinePair(baselines).isValid ||
        (positionReportRef.current && positionReportRef.current.status !== 'READY')) {
      baselines = await executePhase({
        state: 'BASELINE', title: 'Điều chỉnh trước khi bắt đầu',
        text: 'Mở cả hai mắt, giữ đầu thẳng và nhìn vào mục tiêu.',
        subtext: positionReportRef.current?.feedbackMessage || 'Đảm bảo đủ sáng, khuôn mặt và cả hai mắt nằm rõ trong camera.',
        durationMs: 20000, cycleNum: 1,
      });
      if (!runIsCurrent()) return;
    }
    if (!validateBaselinePair(baselines).isValid ||
        (positionReportRef.current && positionReportRef.current.status !== 'READY')) {
      invalidateActiveRun();
      setBaselineError(baselineFeedbackRef.current ||
        (positionReportRef.current?.status !== 'READY' && positionReportRef.current?.feedbackMessage) ||
        'Chưa thu đủ mẫu mắt ổn định. Giữ điện thoại cố định và thử lại.');
      setInstructionTitle('Chưa thu đủ mẫu mắt');
      setCoverState('BASELINE_RETRY');
      return;
    }
    currentBaselineRef.current = baselines;
    const sequenceStart = performance.now();
    protocolStartRef.current = sequenceStart;
    // Do not let image encoding delay the timed instructions.
    captureScreeningFrame(videoRef.current, 'cover_test.jpg').then(artifact => {
      if (runIsCurrent()) onImageCaptured?.(artifact);
    }).catch(error => console.warn('[CoverTest] Preview capture failed', error));
    const accumulatedCycles = [];
    const pendingCycleRecords = [];
    for (let c = 1; c <= 3; c++) {
      if (!runIsCurrent()) return;
      setCycleIndex(c);
      cycleStartRef.current = performance.now();
      timeSeriesRecorderRef.current = createTimeSeriesRecorder(cycleStartRef.current, { fullRate: true });
      const leftText = c === 1 ? 'Che mắt trái, giữ mắt phải nhìn vào mục tiêu.'
        : c === 2 ? 'Tiếp tục che mắt trái, nhìn vào mục tiêu.'
        : 'Lần cuối, che mắt trái và nhìn vào mục tiêu.';
      await executePhase({
        state: 'COVER', title: 'Che mắt trái', text: leftText,
        subtext: 'Không ấn vào mắt. Giữ đầu yên.', coverEye: 'left',
        durationMs: COVER_PHASE_MS.cover,
        speechText: 'Che mắt trái.', cycleNum: c,
      });
      if (!runIsCurrent()) return;
      const leftEyeAnalysis = await executePhase({
        state: 'TRACKING', title: 'Bỏ che!', text: 'Bỏ che mắt trái nhanh.',
        subtext: 'Tiếp tục nhìn vào mục tiêu, giữ đầu yên.', trackEye: 'left',
        durationMs: COVER_PHASE_MS.uncover,
        baselineData: baselines.leftBaseline, speechText: 'Bỏ che!', cycleNum: c,
      });
      if (!runIsCurrent()) return;
      const rightText = c === 1 ? 'Đổi bên, che mắt phải và nhìn vào mục tiêu bằng mắt trái.' : 'Đổi bên, che mắt phải.';
      await executePhase({
        state: 'COVER', title: 'Che mắt phải', text: rightText,
        subtext: 'Không ấn vào mắt. Giữ đầu yên.', coverEye: 'right',
        durationMs: COVER_PHASE_MS.cover,
        speechText: 'Che mắt phải.', cycleNum: c,
      });
      if (!runIsCurrent()) return;
      const rightEyeAnalysis = await executePhase({
        state: 'TRACKING', title: 'Bỏ che!', text: 'Bỏ che mắt phải nhanh.',
        subtext: c === 3 ? 'Đang ghi nhận phản ứng cuối và kiểm tra dữ liệu.' : 'Tiếp tục nhìn vào mục tiêu, giữ đầu yên.',
        trackEye: 'right', durationMs: COVER_PHASE_MS.uncover,
        baselineData: baselines.rightBaseline, speechText: 'Bỏ che!', cycleNum: c,
      });
      if (!runIsCurrent()) return;
      // Record Cycle Result with timestamp-downsampled trajectory and summary (Sections 10, 11)
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
      cycleRecord.samplingRateHz = 30;
      cycleRecord.samplingMode = 'UNIQUE_SOURCE_FRAMES';
      pendingCycleRecords.push(cycleRecord);

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

    }
    protocolStartRef.current = null;
    transitionToState('CHECKING', 3);
    setInstructionTitle('Đang kiểm tra dữ liệu');
    setInstructionText('Đã hoàn tất 3 chu kỳ che và bỏ che.');
    setInstructionSubtext('Vui lòng chờ trong giây lát.');
    if (isVoiceEnabled) {
      playCue('complete');
      speak?.('Đã kết thúc kiểm tra. Bạn có thể hạ tay và nghỉ.');
    }
    await Promise.all([...pendingCropsRef.current]);
    if (!runIsCurrent()) return;
    for (const cycleRecord of pendingCycleRecords) {
      cycleRecord.uncoverEvents = ['LEFT', 'RIGHT'].map(side => {
        const found = uncoverEventsRef.current.find(event => event.cycle === cycleRecord.cycle && event.uncoveredEye === side);
        if (found) return found;
        const sIdx = (cycleRecord.cycle - 1) * 2 + (side === 'LEFT' ? 0 : 1);
        const diag = slotDebugTelemetryRef.current[sIdx];
        let reason = 'NO_CONFIRMED_VISIBLE_TRANSITION';
        if (diag) {
          if (!diag.armedEverTrue) reason = 'ARMED_FALSE';
          else if (diag.headPoseInvalidEver) reason = 'HEAD_POSE_INVALID';
          else reason = 'WINDOW_EXPIRED';
        }
        return {
          cycle: cycleRecord.cycle,
          uncoveredEye: side,
          status: 'NOT_CAPTURED',
          reason,
        };
      });
      cycleRecord.occlusionMethod = 'pixel-contrast-v1';
      cycleRecord.occlusionVerified = cycleRecord.uncoverEvents.every(event => event.status === 'CAPTURED');
    }

    setCapturedSlots(prev => {
      return prev.map((slot, idx) => {
        if (slot.status === 'CAPTURED') return slot;
        const diag = slotDebugTelemetryRef.current[idx];
        let reason = 'CHUA_XAC_NHAN_BO_CHE';
        let details = 'Hạ tay chưa dứt khoát hoặc mất dấu mắt';
        if (diag) {
          if (!diag.armedEverTrue) {
            reason = 'CHUA_CHE_DU_KIN';
            details = 'Chưa che đủ kín mống mắt (cần che tối ≥ 120ms)';
          } else if (diag.headPoseInvalidEver) {
            reason = 'NGHIENG_DAU_KHI_BO_CHE';
            details = 'Đầu nghiêng quá góc cho phép khi bỏ che';
          } else {
            reason = 'QUA_CUA_SO_THOI_GIAN';
            details = 'Hạ tay chậm quá cửa sổ xác nhận (1.8s)';
          }
        }
        return {
          ...slot,
          status: 'NOT_CAPTURED',
          rejectionReason: reason,
          debugInfo: { details, diag },
        };
      });
    });

    if (runIsCurrent() && accumulatedCycles.length > 0) {
      const summaryPayload = aggregateCoverCycles(accumulatedCycles);
      summaryPayload.datasetSampleRateHz = 30;
      summaryPayload.datasetSamplingMode = 'UNIQUE_SOURCE_FRAMES';

      setCoverSummary(summaryPayload);
      transitionToState('FINISHED', 3);
      if (speak) {
        speak('Hoàn tất bài kiểm tra che mắt nghen.');
      }

      // Automatically persist raw sampling dataset to backend storage.
      // The cloud session persistence endpoint handles both storage and AI inference in ONE single roundtrip,
      // eliminating duplicate inference calls and race conditions.
      persistSessionSampling(canonicalSessionId, accumulatedCycles, summaryPayload);
    }
  };

  // Determine state label color and badge
  const isTestingActive = coverState !== 'IDLE' && coverState !== 'FINISHED';
  // Intro/fullscreen use different video nodes. Rebind inference to the node
  // that now owns the existing stream when switching layouts.
  const onVideoReadyRef = useRef(onVideoReady);
  useEffect(() => { onVideoReadyRef.current = onVideoReady; }, [onVideoReady]);
  useEffect(() => {
    if (stream && videoRef?.current) {
      Promise.resolve(onVideoReadyRef.current?.(videoRef.current)).catch(error => {
        console.warn('[CoverTest] Camera rebind failed', error);
      });
    }
  }, [isTestingActive, stream, videoRef]);

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
          rejectedSamples={telemetry.rejectedSamples}
          validSampleRatio={telemetry.validSampleRatio}
          faceMeshMetrics={faceMeshMetrics}
          aiMetrics={aiMetrics}
          videoWidth={videoDims.width}
          videoHeight={videoDims.height}
        />
        {/* Full-viewport camera background (Section 35.1) */}
        <div className="fullscreen-camera-background">
          <CameraView
            videoRef={videoRef}
            stream={stream}
            landmarks={landmarks}
            featuresRef={latestFeaturesRef}
            landmarksRef={landmarksRef}
            quality={quality}
            isActive={true}
            cleanMode={true}
            onVideoReady={onVideoReady}
            occluderEye={coveredEye}
            trackedEye={trackedEye}
            speak={speak}
            voiceEnabled={false}
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

        {/* Live Thumbnail Strip lúc đang đo */}
        <CoverTestLiveThumbnailStrip
          slots={capturedSlots}
          activeSlotIndex={currentActiveSlotIndex}
          coverState={coverState}
        />

        {/* Minimal child-friendly Top Bar (Section 35.4 & 35.5) */}
        <div className="fullscreen-top-bar">
          <div className="fullscreen-pills-row">
            <span className="fullscreen-pill">
              {['PREPARING', 'BASELINE', 'BASELINE_RETRY'].includes(coverState) ? 'Kiểm tra camera' : `Chu kỳ ${cycleIndex} / 3`}
            </span>
            <span className="fullscreen-pill fullscreen-pill-active">
              {coverState === 'BASELINE_RETRY' ? 'Cần thử lại' : coverState === 'BASELINE'
                ? '⏳ Đang thu mẫu mắt — giữ đầu yên'
                : coverState === 'PREPARING' ? `Hướng dẫn · ${countdownSec}s`
                : `⏱️ ${protocolSecond}s · Bước này ${countdownSec}s`}
            </span>
            {!['PREPARING', 'BASELINE', 'BASELINE_RETRY'].includes(coverState) && <span className="fullscreen-pill" role="status">Đã chụp {capturedPairs} lần bỏ che</span>}
          </div>

          <div className="fullscreen-instruction-banner">
            <h1 className="fullscreen-inst-title">{instructionTitle}</h1>
            {cueError && <p className="fullscreen-inst-sub" role="alert">Chưa phát được tiếng bíp. Chạm nút loa để bật lại; làm theo hiệu lệnh trên màn hình.</p>}
            {['PREPARING', 'BASELINE', 'BASELINE_RETRY'].includes(coverState) && baselineProgress &&
              <p className="fullscreen-inst-sub" role="status">Mẫu mắt trái: {baselineProgress.left}/{SCREENING_CONFIG.MIN_VALID_SAMPLES_BASELINE} · Mắt phải: {baselineProgress.right}/{SCREENING_CONFIG.MIN_VALID_SAMPLES_BASELINE}</p>}
            <p className="fullscreen-inst-sub" aria-live="polite">{baselineError || instructionText}</p>
            {!baselineError && <p className="fullscreen-inst-sub">{instructionSubtext}</p>}
            {['COVER', 'TRACKING'].includes(coverState) && captureFeedback && (
              <div
                role="status"
                style={{
                  margin: '6px auto 0 auto',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: captureFeedback.includes('Đã nhận diện') ? 'rgba(46, 125, 50, 0.22)' : 'rgba(230, 81, 0, 0.22)',
                  color: captureFeedback.includes('Đã nhận diện') ? '#1b5e20' : '#e65100',
                  border: `1px solid ${captureFeedback.includes('Đã nhận diện') ? '#81c784' : '#ffb74d'}`,
                }}
              >
                <span>{captureFeedback.includes('Đã nhận diện') ? '✅' : '👉'}</span>
                <span>{captureFeedback}</span>
              </div>
            )}
            {recentCaptureNotice && (
              <div
                role="status"
                style={{
                  margin: '6px auto 0 auto',
                  padding: '4px 14px',
                  borderRadius: '16px',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  background: 'rgba(21, 101, 192, 0.25)',
                  color: '#0d47a1',
                  border: '1px solid #64b5f6',
                }}
              >
                {recentCaptureNotice}
              </div>
            )}
            {coverState === 'BASELINE_RETRY' && <button type="button" className="btn btn-primary" style={{ pointerEvents: 'auto' }} onClick={startCoverTestProtocol}>Thu mẫu lại</button>}
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
              onClick={handleToggleSound}
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
              Dừng
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
                <span style={{ color: '#704800' }}>🟡 Đã ghi nhận chuyển động tái định thị</span>
              ) : coverSummary.verdict === COVER_TEST_VERDICTS.NO_SIGNIFICANT_REFIXATION ? (
                <span style={{ color: 'var(--color-deep-green)' }}>🟢 Không ghi nhận tái định thị bất thường</span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>⚪ Dữ liệu chưa đủ kết luận</span>
              )}
            </div>
          </div>

          {/* Clinician & researcher data breakdown */}
          <div className="clinician-detail-box" style={{ maxWidth: '640px', margin: '0 auto 24px', background: 'var(--color-pale-teal)', border: '1px solid var(--color-soft-mint)', borderRadius: '12px', padding: '16px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.92rem', color: 'var(--color-deep-teal)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '700' }}>
              Chi tiết dữ liệu lâm sàng 3 chu kỳ:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {coverSummary.cycles.map((cyc) => (
                <div key={cyc.cycleIndex} style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: '700', marginBottom: '4px', color: 'var(--color-deep-teal)' }}>Chu kỳ {cyc.cycleIndex}</div>
                  <div>Chất lượng: <strong style={{ color: cyc.quality?.isValid ? 'var(--color-deep-green)' : '#704800' }}>{cyc.quality?.isValid ? 'Hợp lệ' : 'Chưa đạt'}</strong></div>
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
              background: 'var(--bg-surface)',
              border: '1px solid var(--color-soft-mint)',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>🔬</span>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-deep-teal)' }}>
                  Phân tích Cover Test
                </h4>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  background: 'var(--color-pale-teal)',
                  color: 'var(--color-deep-teal)',
                  border: '1px solid var(--color-soft-mint)',
                  fontWeight: 600,
                }}
              >
                Nghiên cứu / Thử nghiệm
              </span>
            </div>

            {/* Scientific Disclaimer */}
            <div
              style={{
                background: 'rgba(242, 198, 109, 0.16)',
                border: '1px solid var(--color-soft-amber)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.85rem',
                color: '#704800',
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
              <div style={{ background: 'rgba(242, 140, 123, 0.15)', border: '1px solid var(--color-warm-coral)', borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ color: '#8a1f12', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                  {aiTransferState.error || 'Không thể kết nối tới hệ thống AI.'}
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Kiểm tra kết nối mạng rồi thử phân tích lại phiên vừa đo.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '5px 12px' }}
                  onClick={retrySessionSave}
                >
                  🔄 Thử lại gửi AI
                </button>
              </div>
            )}

            {aiTransferState.status === 'success' && aiTransferState.result && (() => {
              const res = aiTransferState.result;

              // Extract Korean 10-15 FPS candidate model
              const modelResult = res;
              const cleanLabel = modelResult.label || 'Kết quả AI Cover Test';
              const cleanPrediction = modelResult.prediction || 'INCONCLUSIVE';
              const cleanProbabilities = modelResult.classProbability || modelResult.classProbabilities;
              const cleanVersion = modelResult.model?.version || 'Chưa có model được nạp';
              const cleanProfile = modelResult.samplingProfile || '';

              const cardStyle = {
                background: 'var(--color-pale-teal)',
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid var(--color-soft-mint)',
              };

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.86rem' }}>
                  {/* Card: Korean 10-15 FPS candidate */}
                  <div style={cardStyle}>
                    <div style={{ color: 'var(--color-deep-teal)', fontSize: '0.88rem', fontWeight: 700, marginBottom: '8px' }}>
                      {cleanLabel}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.74rem', marginBottom: '3px' }}>
                      Model Prediction
                    </div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: cleanPrediction === 'NORMAL' ? 'var(--color-deep-green)' : 'var(--color-warm-coral)', marginBottom: '8px' }}>
                      {cleanPrediction}
                    </div>
                    {cleanProbabilities && <div style={{ color: 'var(--text-dim)', fontSize: '0.74rem', marginBottom: '3px' }}>
                      Model class probability
                    </div>}
                    {cleanProbabilities && <div style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                      NORMAL: <span style={{ color: 'var(--color-deep-green)' }}>{((cleanProbabilities.NORMAL ?? 0) * 100).toFixed(1)}%</span>
                      {' | '}
                      STRABISMUS: <span style={{ color: '#8c5a00' }}>{((cleanProbabilities.STRABISMUS ?? 0) * 100).toFixed(1)}%</span>
                    </div>}
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.72rem', lineHeight: 1.4, marginTop: '8px' }}>
                      {cleanVersion}<br />
                      {cleanProfile}
                    </div>
                  </div>

                  {/* Metadata section */}
                  <div style={{ background: 'rgba(0, 84, 93, 0.04)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: '1.6', border: '1px solid var(--border-subtle)' }}>
                    <div>{res.reason === 'MODEL_NOT_LOADED'
                      ? 'Dữ liệu đã được lưu. Chưa có model AI Cover Test được nạp; bác sĩ cần đánh giá phiên đo này.'
                      : res.notice || 'Kết quả nghiên cứu cần được bác sĩ đánh giá.'}</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Research Sampling Storage Status (Section 5 & 12) */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--color-soft-mint)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '20px',
              maxWidth: '640px',
              margin: '0 auto 20px auto',
              textAlign: 'left',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-deep-teal)' }}>
                Xử lý phiên kiểm tra
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {sessionSaveState.sessionId || canonicalSessionId}
              </span>
            </div>

            {sessionSaveState.status === 'saving' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <span className="spinner-small" aria-hidden="true" />
                <span>Đang gửi mẫu để phân tích tạm thời, không lưu trữ dữ liệu người dùng...</span>
              </div>
            )}

            {sessionSaveState.status === 'saved' && (
              <div style={{ background: 'var(--color-pale-teal)', border: '1px solid var(--color-mint)', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ color: 'var(--color-deep-green)', fontWeight: 600, fontSize: '0.88rem', marginBottom: '2px' }}>
                  ✅ Đã lưu raw sampling thành công!
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Đã ghi nhận <strong>{sessionSaveState.sampleCount}</strong> mẫu dữ liệu chuỗi thời gian theo timestamp phục vụ đào tạo và nghiên cứu AI.
                </div>
              </div>
            )}

            {sessionSaveState.status === 'processed' && (
              <p role="status" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '8px 0' }}>
                Đã xử lý {sessionSaveState.sampleCount} mẫu dữ liệu. Ảnh và chuỗi thời gian được gửi để phân tích AI tạm thời và không được lưu trữ trên máy chủ.
              </p>
            )}

            {sessionSaveState.status === 'error' && (
              <div style={{ background: 'rgba(242, 140, 123, 0.15)', border: '1px solid var(--color-warm-coral)', borderRadius: '8px', padding: '10px 14px', marginTop: '8px' }}>
                <div style={{ color: '#8a1f12', fontWeight: 600, fontSize: '0.88rem', marginBottom: '4px' }}>
                  ⚠️ Chưa phân tích được phiên kiểm tra. Vui lòng thử lại.
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
                  🔄 Phân tích lại
                </button>
              </div>
            )}
          </div>

          {/* Thư viện ảnh crop mắt lúc bỏ che (6 cặp) */}
          <CoverTestImageGallery
            slots={capturedSlots}
            capturedPairs={capturedPairs}
            onOpenLightbox={handleOpenLightbox}
          />

          {/* Modal Lightbox xem chi tiết ảnh */}
          <CoverTestLightbox
            isOpen={lightboxState.isOpen}
            items={lightboxState.items}
            currentIndex={lightboxState.currentIndex}
            onClose={() => setLightboxState((prev) => ({ ...prev, isOpen: false }))}
            onNavigate={(newIdx) => setLightboxState((prev) => ({ ...prev, currentIndex: newIdx }))}
          />

          <div style={{ display: 'flex', gap: '14px', maxWidth: '640px', margin: '0 auto', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={capturedPairs < 6 ? 'btn btn-primary' : 'btn btn-secondary'}
              style={{ flex: 1, minWidth: '220px' }}
              onClick={startCoverTestProtocol}
            >
              🔄 {capturedPairs < 6 ? 'Đo lại để đủ 6 lần chụp' : 'Đo lại Cover Test'}
            </button>
            <button
              type="button"
              className={capturedPairs < 6 ? 'btn btn-secondary btn-large' : 'btn btn-primary btn-large'}
              style={{ flex: 2, minWidth: '260px' }}
              onClick={() => onComplete?.({ ...coverSummary, aiResult: aiTransferState.result,
                analysisStatus: aiTransferState.status, capturedPairs })}
            >
              XEM KẾT QUẢ SÀNG LỌC ➜
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
        <h2 className="stage-title">Cover Test</h2>
        <div className="header-sound-btn">
          <button
            type="button"
            className={`btn-sound ${isVoiceEnabled ? 'sound-on' : 'sound-off'}`}
            onClick={handleToggleSound}
            title={isVoiceEnabled ? 'Tắt âm hướng dẫn' : 'Bật âm hướng dẫn'}
          >
            {isVoiceEnabled ? '🔊 Âm thanh BẬT' : '🔇 Âm thanh TẮT'}
          </button>
        </div>
        <button type="button" className="btn btn-secondary" onClick={testCue}>🔊 Thử tiếng bíp bỏ che</button>
        {cueError && <p role="alert">Chưa phát được tiếng bíp. Bấm “Thử tiếng bíp bỏ che” để bật âm thanh trình duyệt.</p>}
        <AudioButton text="Dạ, cô chú cứ bình tĩnh nghen. Mình ngồi thẳng người, nhìn vào chấm tròn ở giữa màn hình và làm theo hướng dẫn từng bước nha." onActivate={() => { if (!isVoiceEnabled) toggleSound?.(); }} />
      </div>

      <div className="cover-running-layout">
        {/* Left Column: Camera Feed preview */}
        <div className="cam-column">
          <CameraView
            videoRef={videoRef}
            stream={stream}
            landmarks={landmarks}
            featuresRef={latestFeaturesRef}
            landmarksRef={landmarksRef}
            quality={quality}
            isActive={true}
            cleanMode={false}
            onVideoReady={onVideoReady}
            speak={speak}
            voiceEnabled={isVoiceEnabled}
          />
        </div>

        {/* Right Column: Introduction & Child-friendly instructions */}
        <div className="instruction-column">
          <div className="cover-state-machine-box">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--color-deep-teal)' }}>
              Hướng dẫn thực hiện Cover Test
            </h3>
            <figure className="hirschberg-guide-video">
              <video controls playsInline preload="none" src={coverTestGuideVideo.src}
                aria-label="Video mẫu cho hướng dẫn Cover Test">
                Trình duyệt không hỗ trợ video. <a href={coverTestGuideVideo.src}>Mở video</a>.
              </video>
              <figcaption>{coverTestGuideVideo.caption}</figcaption>
            </figure>
          </div>

          <div className="cover-action-box" style={{ marginTop: '14px' }}>
            {baselineError && <p role="alert">{baselineError}</p>}
            <button
              type="button"
              className="btn btn-primary btn-large btn-block"
              onClick={startCoverTestProtocol}
            >
              BẮT ĐẦU COVER TEST
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
