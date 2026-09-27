import React, { useState, useEffect, useRef, useCallback } from 'react';
import CameraView from '../components/CameraView';
import MedicalDisclaimer from '../components/MedicalDisclaimer';
import FixationTarget from '../components/FixationTarget';
import Countdown from '../components/Countdown';
import TestInstruction from '../components/TestInstruction';
import TestProgress from '../components/TestProgress';
import AIStatus from '../components/AIStatus';
import AudioButton from '../components/audio/AudioButton';
import ClinicalCalibrationResult from '../components/clinical/ClinicalCalibrationResult';
import { useCamera } from '../hooks/useCamera';
import { useFaceMesh } from '../hooks/useFaceMesh';
import { useEyeTracking } from '../hooks/useEyeTracking';
import { useSpeech } from '../hooks/useSpeech';
import { useStrabismusAI } from '../hooks/useStrabismusAI';
import {
  SCREENING_CONFIG,
  COVER_TEST_STATES,
  SCREENING_VERDICT,
} from '../constants/screeningConfig';
import {
  calculateRobustBaseline,
  analyzeUncoverTrajectory,
} from '../services/coverTestMeasurementService';
import { fuseScreeningSignals, aggregateMultiCycleFusion } from '../services/fusionService';
import { cameraMeasurementToPrismDiopters } from '../services/calibrationService';
import { createCoverFrame, createCoverSessionId, isCoverSessionCurrent, validateBaselinePair } from '../services/coverTestProtocolService.js';

const displayMetric = (value, digits = 2, suffix = '') => Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '--';

export default function StrabismusScreening() {
  const videoRef = useRef(null);
  const chartCanvasLeftRef = useRef(null);
  const chartCanvasRightRef = useRef(null);

  // Screening state machine
  const [testState, setTestState] = useState(COVER_TEST_STATES.INTRO);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [countdownSec, setCountdownSec] = useState(0);
  const [selectedCycleFilter, setSelectedCycleFilter] = useState('ALL'); // 'ALL' | '1' | '2' | '3'
  const [activeInstruction, setActiveInstruction] = useState({
    title: 'Sẵn sàng kiểm tra',
    text: 'Ngồi thẳng cách camera 40 - 60cm, mắt nhìn thẳng.',
    subtext: 'Bật camera trước, kiểm tra các điểm mống mắt và AI rồi bấm "Bắt đầu".',
    highlightEye: null,
  });

  // Recorded test & fusion data
  const [trajectories, setTrajectories] = useState([]);
  const [fusedResults, setFusedResults] = useState(null);
  const latestCalibrationForEye = (eye) => trajectories.filter((item) => item.eye === eye && item.prism).at(-1);

  // Hardware & Vision hooks
  const { stream, isActive, isLoading: isCameraLoading, error: cameraError, start: startCam, stop: stopCam } = useCamera();
  const { quality, latestFeaturesRef, latestQualityRef, rawLandmarks, processResults } = useEyeTracking();
  const { isEnabled: isVoiceEnabled, toggleSound, speak, cancel: cancelSpeech } = useSpeech(false);

  // AI Inference Hook (Supporting Signal)
  const {
    isReady: isAIReady,
    isLoading: isAILoading,
    error: aiError,
    smoothedPrediction,
    latestSmoothedRef,
    inferenceFps,
    processFrameAI,
    reset: resetAI,
  } = useStrabismusAI();

  // Execution refs
  const isAbortedRef = useRef(false);
  const testStateRef = useRef(COVER_TEST_STATES.INTRO);
  const sessionIdRef = useRef(createCoverSessionId());
  const phaseRafRef = useRef(null);
  const phaseResolveRef = useRef(null);

  const invalidateActiveRun = useCallback(() => {
    isAbortedRef.current = true;
    sessionIdRef.current = createCoverSessionId();
    if (phaseRafRef.current !== null) cancelAnimationFrame(phaseRafRef.current);
    phaseRafRef.current = null;
    phaseResolveRef.current?.(null);
    phaseResolveRef.current = null;
  }, []);

  useEffect(() => {
    testStateRef.current = testState;
  }, [testState]);

  // Frame results receiver (Runs MediaPipe and triggers throttled AI inference)
  const handleResults = useRef(null);
  useEffect(() => {
    handleResults.current = (results) => {
      const res = processResults(results);
      if (res && res.features) {
        // Runs at throttled 5-15 FPS inside hook using refs (no setState every frame)
        processFrameAI(res.features);
      }
    };
  }, [processResults, processFrameAI]);

  const { startLoop, stopLoop } = useFaceMesh((r) => handleResults.current?.(r));

  // Connect camera
  const handleStartCamera = async () => {
    try {
      const videoEl = videoRef.current;
      await startCam(videoEl);
      await startLoop(videoEl);
    } catch (err) {
      console.error('Camera startup error:', err);
    }
  };

  // Automated phase runner with trajectory tracking and multi-modal signal collection
  const executePhase = useCallback(
    ({
      stateName,
      title,
      text,
      subtext,
      highlightEye,
      durationMs,
      speechText,
      trackEye = null,
      cycleNum,
      baselineData = null,
    }) => {
      return new Promise((resolve) => {
        const phaseSessionId = sessionIdRef.current;
        let settled = false;
        const finish = (value) => { if (settled) return; settled = true; if (phaseRafRef.current !== null) cancelAnimationFrame(phaseRafRef.current); phaseRafRef.current = null; if (phaseResolveRef.current === finish) phaseResolveRef.current = null; resolve(value); };
        phaseResolveRef.current = finish;
        if (isAbortedRef.current) {
          finish(null);
          return;
        }

        setTestState(stateName);
        setActiveInstruction({ title, text, subtext, highlightEye });

        if (speechText) {
          speak(speechText);
        }

        const collectedPoints = [];
        const collectedBaselineLeft = [];
        const collectedBaselineRight = [];
        const startT = performance.now();
        const initialSeconds = Math.ceil(durationMs / 1000);
        setCountdownSec(initialSeconds);
        let prevSec = initialSeconds;

        const loop = () => {
          if (!isCoverSessionCurrent(phaseSessionId, sessionIdRef.current, isAbortedRef.current)) {
            finish(null);
            return;
          }

          const elapsed = performance.now() - startT;
          const remaining = Math.max(0, durationMs - elapsed);
          const currentSec = Math.ceil(remaining / 1000);

          if (currentSec !== prevSec) {
            prevSec = currentSec;
            setCountdownSec(currentSec);
          }

          const features = latestFeaturesRef.current;
          const currentQuality = latestQualityRef.current;

          // 1. If BASELINE phase: collect multi-frame baseline for BOTH eyes
          if (stateName === COVER_TEST_STATES.BASELINE && features) {
            const left = createCoverFrame(features, currentQuality, 'left', performance.now(), Math.round(elapsed));
            const right = createCoverFrame(features, currentQuality, 'right', performance.now(), Math.round(elapsed));
            if (left.frame) collectedBaselineLeft.push(left.frame);
            if (right.frame) collectedBaselineRight.push(right.frame);
          }

          // 2. If UNCOVER phase: track fellow eye trajectory
          if (trackEye && features) {
            const tracked = createCoverFrame(features, currentQuality, trackEye, performance.now(), Math.round(elapsed));
            if (tracked.frame) collectedPoints.push(tracked.frame);
          }

          if (elapsed >= durationMs) {
            // If Baseline phase, compute robust baselines for both eyes
            if (stateName === COVER_TEST_STATES.BASELINE) {
              const baselineLeft = calculateRobustBaseline(collectedBaselineLeft);
              const baselineRight = calculateRobustBaseline(collectedBaselineRight);

              finish({
                stateName,
                cycle: cycleNum,
                baselineLeft,
                baselineRight,
              });
              return;
            }

            // Uncover trajectory measurement
            let measurement = null;
            let prismResult = null;
            if (trackEye) {
              const eyeWidth = collectedPoints.at(-1)?.eyeWidth;

              measurement = analyzeUncoverTrajectory(
                collectedPoints,
                baselineData,
                trackEye,
                cycleNum,
                eyeWidth
              );

              const currentQuality = latestQualityRef.current;
              prismResult = cameraMeasurementToPrismDiopters(measurement, {
                context: {
                  faceTrackingValid: currentQuality?.faceDetected,
                  irisTrackingValid: currentQuality?.irisValid,
                  eyeWidth,
                },
              });
            }

            // Snapshot AI signal at phase completion as SUPPORTING signal
            const currentAISignal = latestSmoothedRef.current || { enabled: false, normalScore: null, strabismusScore: null, confidence: null };

            // Decision support fusion
            const fusionResult = trackEye && measurement
              ? fuseScreeningSignals({
                  measurement,
                  aiSignal: currentAISignal,
                  dataQuality: latestQualityRef.current,
                  eye: trackEye,
                  cycle: cycleNum,
                })
              : null;

            finish({
              stateName,
              cycle: cycleNum,
              eye: trackEye,
              points: collectedPoints,
              measurement,
              aiSignal: currentAISignal,
              fusionResult,
              prismResult,
            });
          } else {
            phaseRafRef.current = requestAnimationFrame(loop);
          }
        };

        phaseRafRef.current = requestAnimationFrame(loop);
      });
    },
    [latestFeaturesRef, latestQualityRef, latestSmoothedRef, speak]
  );

  // Execute 3-cycle Digital Cover Test Measurement
  const handleStartScreening = async () => {
    if (!isActive) return;

    invalidateActiveRun();
    const runSessionId = createCoverSessionId();
    sessionIdRef.current = runSessionId;
    isAbortedRef.current = false;
    const runIsCurrent = () => isCoverSessionCurrent(runSessionId, sessionIdRef.current, isAbortedRef.current);
    setTrajectories([]);
    setFusedResults(null);
    resetAI();

    const accumulatedTrajectories = [];
    const accumulatedFusions = [];

    await executePhase({ stateName: 'PREPARING', title: 'Chuẩn bị bắt đầu', text: 'Hãy ngồi thẳng, giữ yên đầu và nhìn cố định vào chấm đỏ ở giữa màn hình.', subtext: 'Bắt đầu chu kỳ đầu tiên trong giây lát...', highlightEye: null, durationMs: 3000, speechText: 'Chúng ta bắt đầu kiểm tra mắt nhé.', cycleNum: 1 });
    if (!runIsCurrent()) return;

    for (let c = 1; c <= SCREENING_CONFIG.CYCLES; c++) {
      if (!runIsCurrent()) return;
      setCurrentCycle(c);

      // 1. BASELINE FIXATION (4.5s) - multi-frame robust baseline
      const baselineResult = await executePhase({
        stateName: COVER_TEST_STATES.BASELINE,
        title: `Chu kỳ ${c}/${SCREENING_CONFIG.CYCLES} — Cố định thị giác (Baseline)`,
        text: 'Nhìn chăm chú vào chấm đỏ tròn ở giữa. Giữ thẳng đầu và cố định ánh nhìn.',
        subtext: 'Hệ thống đang thu thập chuỗi khung hình để tính toán vị trí mống mắt trung vị (robust baseline)...',
        highlightEye: null,
        durationMs: SCREENING_CONFIG.BASELINE_MS,
        speechText: 'Nhìn vào chấm tròn ở giữa.',
        cycleNum: c,
      });
      if (!runIsCurrent() || !baselineResult) return;

      const currentBaselineLeft = baselineResult.baselineLeft;
      const currentBaselineRight = baselineResult.baselineRight;
      const baselineQuality = validateBaselinePair({ leftBaseline: currentBaselineLeft, rightBaseline: currentBaselineRight });
      if (!baselineQuality.isValid) {
        for (const eye of ['right', 'left']) {
          const measurement = { eye, cycle: c, dataQuality: { isValid: false, reason: baselineQuality.reason }, normalizedDisplacement: null, peakVelocity: null, sampleCount: 0 };
          accumulatedTrajectories.push({ cycle: c, eye, points: [], measurement, aiSignal: null, fusion: fuseScreeningSignals({ measurement, aiSignal: {}, dataQuality: { isValid: false, reason: baselineQuality.reason }, eye, cycle: c }), prism: cameraMeasurementToPrismDiopters(measurement) });
          accumulatedFusions.push(accumulatedTrajectories.at(-1).fusion);
        }
        continue;
      }

      // 2. COVER LEFT EYE (5.0s)
      const coverLeftResult = await executePhase({
        stateName: COVER_TEST_STATES.COVER_LEFT,
        title: 'Che MẮT TRÁI bằng lòng bàn tay',
        text: 'Dùng tay che mắt trái lại (mắt bên phải màn hình). Mắt phải tiếp tục nhìn điểm đỏ.',
        subtext: 'Không ép chặt vào mi mắt, giữ yên đầu.',
        highlightEye: 'LEFT',
        durationMs: SCREENING_CONFIG.COVER_MS,
        speechText: 'Che mắt trái.',
        cycleNum: c,
      });
      if (!runIsCurrent() || !coverLeftResult) return;

      // 3. UNCOVER LEFT EYE (Track right eye refixation + AI, 4.5s)
      const uncoverLeftResult = await executePhase({
        stateName: COVER_TEST_STATES.UNCOVER_LEFT,
        title: 'Bỏ tay che — Giữ mắt nhìn thẳng',
        text: 'Bỏ tay ra nhanh nhưng nhẹ nhàng. Tiếp tục nhìn cố định vào điểm đỏ.',
        subtext: 'Đo lường chuyển động tái định vị của mắt phải so với baseline...',
        highlightEye: null,
        durationMs: SCREENING_CONFIG.RECORD_MS,
        trackEye: 'right',
        baselineData: currentBaselineRight,
        speechText: 'Bỏ tay ra. Tiếp tục nhìn vào chấm tròn.',
        cycleNum: c,
      });
      if (!runIsCurrent() || !uncoverLeftResult) return;

      if (uncoverLeftResult.points) {
        accumulatedTrajectories.push({
          cycle: c,
          eye: 'right',
          points: uncoverLeftResult.points,
          measurement: uncoverLeftResult.measurement,
          aiSignal: uncoverLeftResult.aiSignal,
          fusion: uncoverLeftResult.fusionResult,
          prism: uncoverLeftResult.prismResult,
        });
        if (uncoverLeftResult.fusionResult) {
          accumulatedFusions.push(uncoverLeftResult.fusionResult);
        }
      }

      // 4. COVER RIGHT EYE (5.0s)
      const coverRightResult = await executePhase({
        stateName: COVER_TEST_STATES.COVER_RIGHT,
        title: 'Che MẮT PHẢI bằng lòng bàn tay',
        text: 'Dùng tay che mắt phải lại (mắt bên trái màn hình). Mắt trái tiếp tục nhìn điểm đỏ.',
        subtext: 'Không ép chặt vào mi mắt, giữ yên đầu.',
        highlightEye: 'RIGHT',
        durationMs: SCREENING_CONFIG.COVER_MS,
        speechText: 'Che mắt phải.',
        cycleNum: c,
      });
      if (!runIsCurrent() || !coverRightResult) return;

      // 5. UNCOVER RIGHT EYE (Track left eye refixation + AI, 4.5s)
      const uncoverRightResult = await executePhase({
        stateName: COVER_TEST_STATES.UNCOVER_RIGHT,
        title: 'Bỏ tay che — Giữ mắt nhìn thẳng',
        text: 'Bỏ tay ra nhanh nhưng nhẹ nhàng. Tiếp tục nhìn cố định vào điểm đỏ.',
        subtext: 'Đo lường chuyển động tái định vị của mắt trái so với baseline...',
        highlightEye: null,
        durationMs: SCREENING_CONFIG.RECORD_MS,
        trackEye: 'left',
        baselineData: currentBaselineLeft,
        speechText: 'Bỏ tay ra. Tiếp tục nhìn vào chấm tròn.',
        cycleNum: c,
      });
      if (!runIsCurrent() || !uncoverRightResult) return;

      if (uncoverRightResult.points) {
        accumulatedTrajectories.push({
          cycle: c,
          eye: 'left',
          points: uncoverRightResult.points,
          measurement: uncoverRightResult.measurement,
          aiSignal: uncoverRightResult.aiSignal,
          fusion: uncoverRightResult.fusionResult,
          prism: uncoverRightResult.prismResult,
        });
        if (uncoverRightResult.fusionResult) {
          accumulatedFusions.push(uncoverRightResult.fusionResult);
        }
      }

      // Rest interval between cycles (3.0s)
      if (c < SCREENING_CONFIG.CYCLES && runIsCurrent()) {
        await executePhase({
          stateName: 'REST',
          title: `Nghỉ ngắn (${c}/${SCREENING_CONFIG.CYCLES})`,
          text: 'Chớp mắt nhẹ thư giãn chuẩn bị chu kỳ tiếp theo.',
          subtext: 'Chuẩn bị bắt đầu trong giây lát...',
          highlightEye: null,
          durationMs: SCREENING_CONFIG.REST_MS,
          speechText: 'Chuẩn bị lần tiếp theo.',
          cycleNum: c,
        });
      }
    }

    if (runIsCurrent()) {
      setTrajectories(accumulatedTrajectories);
      const multiCycleFusion = aggregateMultiCycleFusion(accumulatedFusions);
      setFusedResults(multiCycleFusion);
      setTestState(COVER_TEST_STATES.COMPLETE);
      speak('Đã hoàn thành phần kiểm tra.', true);
    }
  };

  // Abort test immediately
  const handleCancelScreening = () => {
    invalidateActiveRun();
    cancelSpeech();
    setTestState(COVER_TEST_STATES.CANCELLED);
    setActiveInstruction({
      title: 'Đã hủy bài test',
      text: 'Bạn có thể bấm "Bắt đầu Cover Test" để thực hiện lại bất kỳ lúc nào.',
      subtext: null,
      highlightEye: null,
    });
  };

  // Render Trajectory Charts with cycle filtering and distinct markers
  useEffect(() => {
    if (testState !== COVER_TEST_STATES.COMPLETE || trajectories.length === 0) return;

    const renderChart = (canvas, eyeType) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;

      const rect = canvas.getBoundingClientRect();
      const W = rect.width || 340;
      const H = 170;

      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, W, H);

      let eyeTrajectories = trajectories.filter((t) => t.eye === eyeType);
      if (selectedCycleFilter !== 'ALL') {
        eyeTrajectories = eyeTrajectories.filter((t) => t.cycle === Number(selectedCycleFilter));
      }

      const allPoints = eyeTrajectories.flatMap((t) => t.points);

      if (allPoints.length === 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Không có dữ liệu cho chu kỳ này', W / 2, H / 2);
        return;
      }

      // Min/Max bounds for normalization
      const allX = allPoints.map((p) => p.normalizedX);
      const minX = Math.min(...allX) - 0.02;
      const maxX = Math.max(...allX) + 0.02;
      const rangeX = Math.max(0.01, maxX - minX);

      const PAD_LEFT = 40;
      const PAD_RIGHT = 24;
      const PAD_TOP = 26;
      const PAD_BOTTOM = 30;
      const plotW = W - PAD_LEFT - PAD_RIGHT;
      const plotH = H - PAD_TOP - PAD_BOTTOM;

      // Grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 3; i++) {
        const y = PAD_TOP + (i / 3) * plotH;
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT, y);
        ctx.lineTo(W - PAD_RIGHT, y);
        ctx.stroke();
      }

      // Uncover line marker (0ms)
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, PAD_TOP);
      ctx.lineTo(PAD_LEFT, PAD_TOP + plotH);
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('0ms (Mở)', PAD_LEFT + 2, PAD_TOP - 8);

      // Analysis window marker (500ms)
      const windowX = PAD_LEFT + (SCREENING_CONFIG.UNCOVER_WINDOW_MS / SCREENING_CONFIG.RECORD_MS) * plotW;
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(windowX, PAD_TOP);
      ctx.lineTo(windowX, PAD_TOP + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#f59e0b';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${SCREENING_CONFIG.UNCOVER_WINDOW_MS}ms (Cửa sổ sớm)`, windowX, PAD_TOP - 8);

      const cycleColors = ['#06b6d4', '#f43f5e', '#8b5cf6'];

      eyeTrajectories.forEach((traj) => {
        const pts = traj.points;
        if (!pts || pts.length === 0) return;

        const color = cycleColors[(traj.cycle - 1) % cycleColors.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        pts.forEach((p, pIdx) => {
          const px = PAD_LEFT + (p.t / SCREENING_CONFIG.RECORD_MS) * plotW;
          const py = PAD_TOP + plotH - ((p.normalizedX - minX) / rangeX) * plotH;

          if (pIdx === 0) {
            ctx.moveTo(px, py);
          } else {
            ctx.lineTo(px, py);
          }
        });
        ctx.stroke();

        // Start point dot
        const startP = pts[0];
        const sx = PAD_LEFT + (startP.t / SCREENING_CONFIG.RECORD_MS) * plotW;
        const sy = PAD_TOP + plotH - ((startP.normalizedX - minX) / rangeX) * plotH;
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Mark Peak movement point if available
        if (traj.measurement && traj.measurement.peakPosition) {
          const peakP = traj.measurement.peakPosition;
          const pkX = PAD_LEFT + (peakP.t / SCREENING_CONFIG.RECORD_MS) * plotW;
          const pkY = PAD_TOP + plotH - ((peakP.normalizedX - minX) / rangeX) * plotH;

          // Glowing diamond marker for peak
          ctx.save();
          ctx.fillStyle = color;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(pkX, pkY - 4.5);
          ctx.lineTo(pkX + 4.5, pkY);
          ctx.lineTo(pkX, pkY + 4.5);
          ctx.lineTo(pkX - 4.5, pkY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      });

      // Axis labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('0ms', PAD_LEFT, H - 8);

      ctx.textAlign = 'right';
      ctx.fillText(`${SCREENING_CONFIG.RECORD_MS}ms`, W - PAD_RIGHT, H - 8);

      // Legend
      ctx.textAlign = 'left';
      eyeTrajectories.forEach((traj, i) => {
        const lx = PAD_LEFT + 65 + i * 44;
        ctx.fillStyle = cycleColors[(traj.cycle - 1) % cycleColors.length];
        ctx.fillText(`C${traj.cycle}`, lx, H - 8);
      });
    };

    renderChart(chartCanvasLeftRef.current, 'left');
    renderChart(chartCanvasRightRef.current, 'right');
  }, [testState, trajectories, selectedCycleFilter]);

  // Clean cleanup on unmount
  useEffect(() => {
    return () => {
      invalidateActiveRun();
      cancelSpeech();
      stopLoop();
      stopCam();
    };
  }, [cancelSpeech, invalidateActiveRun, stopCam, stopLoop]);

  const isTestingActive =
    testState !== COVER_TEST_STATES.INTRO &&
    testState !== COVER_TEST_STATES.COMPLETE &&
    testState !== COVER_TEST_STATES.CANCELLED;

  return (
    <div className="page-container cover-test-page">
      <div className="page-header">
        <div className="header-badge-row">
          <span className="badge badge-clinical">Digital Cover Test Measurement &bull; Clinical Screening</span>
          <button
            type="button"
            className="sound-toggle-btn"
            onClick={toggleSound}
            title={isVoiceEnabled ? 'Tắt giọng nói' : 'Bật giọng nói'}
            aria-label="Bật hoặc tắt giọng nói hướng dẫn"
          >
            {isVoiceEnabled ? '🔊 Giọng nói: BẬT' : '🔇 Giọng nói: TẮT'}
          </button>
        </div>
        <h1 className="page-title">Đo lường Cover Test Số hóa &bull; RemiCare</h1>
        <p className="page-subtitle">
          Số hóa quy trình Cover Test lâm sàng bằng thị giác máy tính và phân tích chuyển động học thời gian thực. Mô hình AI đóng vai trò tín hiệu hỗ trợ hình thái tĩnh.
        </p>
        <AudioButton text="Chúng ta bắt đầu kiểm tra mắt nhé. Hãy nhìn vào chấm tròn ở giữa." onActivate={() => { if (!isVoiceEnabled) toggleSound(); }} />
      </div>

      <MedicalDisclaimer />

      {/* Main Testing Viewport */}
      <div className="card stage-card-screening">
        {/* Fixation target displayed when test is active */}
        {isTestingActive && (
          <div className="screening-active-banner">
            <FixationTarget isPulsing={true} size={32} />
            <Countdown value={countdownSec} unit="s" label="Thời gian pha hiện tại" />
          </div>
        )}

        <div className="screening-layout">
          <div className="screening-cam-panel">
            <CameraView
              videoRef={videoRef}
              stream={stream}
              landmarks={rawLandmarks}
              quality={quality}
              isActive={isActive}
              isLoading={isCameraLoading}
              error={cameraError}
              occluderEye={testState === COVER_TEST_STATES.COVER_LEFT ? 'left' : testState === COVER_TEST_STATES.COVER_RIGHT ? 'right' : null}
              trackedEye={testState === COVER_TEST_STATES.UNCOVER_LEFT ? 'right' : testState === COVER_TEST_STATES.UNCOVER_RIGHT ? 'left' : null}
            />

            {/* Real-time Telemetry & AI Status Bar */}
            <AIStatus
              quality={quality}
              isAIReady={isAIReady}
              isAILoading={isAILoading}
              aiError={aiError}
              smoothedPrediction={smoothedPrediction}
              inferenceFps={inferenceFps}
            />

            {isActive && (
              <TestProgress
                totalCycles={SCREENING_CONFIG.CYCLES}
                currentCycle={currentCycle}
                activePhase={testState}
              />
            )}
          </div>

          <div className="screening-control-panel">
            <TestInstruction
              title={activeInstruction.title}
              instruction={activeInstruction.text}
              subtext={activeInstruction.subtext}
              highlightEye={activeInstruction.highlightEye}
            />

            <div className="control-actions">
              {!isActive ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStartCamera}
                  disabled={isCameraLoading}
                >
                  {isCameraLoading ? 'Đang bật camera...' : 'Bật camera'}
                </button>
              ) : !isTestingActive ? (
                <button
                  type="button"
                  className="btn btn-primary btn-pulse"
                  onClick={handleStartScreening}
                >
                  Bắt đầu Cover Test (3 chu kỳ)
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleCancelScreening}
                >
                  Hủy bài kiểm tra
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RESULT REPORT SECTION (DIGITAL COVER TEST MEASUREMENT) */}
      {testState === COVER_TEST_STATES.COMPLETE && fusedResults && (
        <div className="card result-card-section" role="region" aria-label="Kết quả sàng lọc Cover Test">
          <div className="result-header">
            <span className="badge badge-clinical">BÁO CÁO ĐO LƯỜNG COVER TEST SỐ HÓA</span>
            <h2 className="result-title" style={{ marginTop: '8px' }}>Kết Quả Sàng Lọc Thị Giác</h2>
            <p className="result-subtitle">
              Đo lường chuyển động tái định vị mống mắt (Refixation Saccade) kết hợp tham chiếu vị trí cố định thị giác ban đầu (Robust Baseline).
            </p>
          </div>

          {/* SECTION A: COVER TEST MEASUREMENT (PRIMARY CLINICAL SIGNAL) */}
          <div className="result-section-box" style={{ marginTop: '0', paddingTop: '0', borderTop: 'none' }}>
            <h3 className="section-subheading">
              A. Phép Đo Cover Test Số Hóa (Primary Signal)
            </h3>
            <p className="section-desc">
              Phép đo động học tái định thị của mắt quan sát khi bỏ che mắt đối bên. Đây là nguồn dữ liệu quyết định chính theo chuẩn lâm sàng.
            </p>

            <div className="result-cards-grid">
              {/* Left Eye Report */}
              <div className={`summary-card ${fusedResults.leftEye.verdict === SCREENING_VERDICT.SIGNAL_DETECTED ? 'flagged' : 'normal'}`}>
                <div className="summary-eye-label">MẮT TRÁI (theo dõi khi bỏ che mắt phải)</div>
                <div className="summary-verdict">
                  {fusedResults.leftEye.label}
                </div>

                <div className="measurement-metric-grid">
                  <div className="metric-item">
                    <span className="metric-label">Độ dịch chuyển</span>
                    <span className="metric-value">{displayMetric(Number.isFinite(fusedResults.leftEye.medianDisplacement) ? fusedResults.leftEye.medianDisplacement * 100 : null, 1, '%')}</span>
                    <span className="metric-sub">độ rộng mắt (chuẩn hóa)</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Vận tốc đỉnh</span>
                    <span className="metric-value">{displayMetric(fusedResults.leftEye.medianPeakVelocity, 2, ' /s')}</span>
                    <span className="metric-sub">độ rộng mắt / giây</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Chu kỳ hợp lệ</span>
                    <span className="metric-value">{fusedResults.leftEye.validCycles}/{fusedResults.leftEye.cycles.length}</span>
                    <span className="metric-sub">đạt chuẩn chất lượng</span>
                  </div>
                  <div className="metric-item"><span className="metric-label">Hiệu chuẩn PACT</span><span className="badge-uncalibrated">Có khóa an toàn</span><span className="metric-sub">Xem trạng thái bên dưới</span></div>
                </div>
                <ClinicalCalibrationResult result={latestCalibrationForEye('left')?.prism} movement={latestCalibrationForEye('left')?.measurement} />
              </div>

              {/* Right Eye Report */}
              <div className={`summary-card ${fusedResults.rightEye.verdict === SCREENING_VERDICT.SIGNAL_DETECTED ? 'flagged' : 'normal'}`}>
                <div className="summary-eye-label">MẮT PHẢI (theo dõi khi bỏ che mắt trái)</div>
                <div className="summary-verdict">
                  {fusedResults.rightEye.label}
                </div>

                <div className="measurement-metric-grid">
                  <div className="metric-item">
                    <span className="metric-label">Độ dịch chuyển</span>
                    <span className="metric-value">{displayMetric(Number.isFinite(fusedResults.rightEye.medianDisplacement) ? fusedResults.rightEye.medianDisplacement * 100 : null, 1, '%')}</span>
                    <span className="metric-sub">độ rộng mắt (chuẩn hóa)</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Vận tốc đỉnh</span>
                    <span className="metric-value">{displayMetric(fusedResults.rightEye.medianPeakVelocity, 2, ' /s')}</span>
                    <span className="metric-sub">độ rộng mắt / giây</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-label">Chu kỳ hợp lệ</span>
                    <span className="metric-value">{fusedResults.rightEye.validCycles}/{fusedResults.rightEye.cycles.length}</span>
                    <span className="metric-sub">đạt chuẩn chất lượng</span>
                  </div>
                  <div className="metric-item"><span className="metric-label">Hiệu chuẩn PACT</span><span className="badge-uncalibrated">Có khóa an toàn</span><span className="metric-sub">Xem trạng thái bên dưới</span></div>
                </div>
                <ClinicalCalibrationResult result={latestCalibrationForEye('right')?.prism} movement={latestCalibrationForEye('right')?.measurement} />
              </div>
            </div>
          </div>

          {/* SECTION B: AI SUPPORTING SIGNAL */}
          <div className="result-section-box">
            <h3 className="section-subheading">
              B. Tín Hiệu AI Hỗ Trợ Hình Thái Học (Supporting Signal)
            </h3>
            <p className="section-desc">
              Mô hình học máy ONNX suy luận đặc trưng hình thái tĩnh. AI đóng vai trò bổ trợ ghi nhận bất đối xứng, không thể thay thế hay phủ quyết phép đo chuyển động Cover Test.
            </p>

            <div className="ai-support-card">
              <div className="ai-support-row">
                <div><strong>Tín hiệu AI:</strong> Đã ghi nhận làm dữ liệu hỗ trợ nghiên cứu.</div>
                <div className="ai-support-meta">
                  Không hiển thị điểm mô hình như xác suất mắc bệnh &bull; Mô hình ONNX WebAssembly
                </div>
              </div>
            </div>
          </div>

          {/* SECTION C: OVERALL SCREENING VERDICT */}
          <div className="result-section-box">
            <h3 className="section-subheading">
              C. Nhận Định Sàng Lọc Chung (Overall Screening)
            </h3>

            <div className={`interpretation-banner ${fusedResults.overallVerdict === SCREENING_VERDICT.SIGNAL_DETECTED ? 'warning' : 'reassurance'}`}>
              <p style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>
                {fusedResults.overallLabel}
              </p>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                {fusedResults.overallVerdict === SCREENING_VERDICT.SIGNAL_DETECTED
                  ? 'Ghi nhận chuyển động điều chỉnh của mống mắt trong cửa sổ 500ms sau khi bỏ che. Khuyến nghị người dùng đến cơ sở chuyên khoa Mắt để bác sĩ thực hiện nghiệm pháp Cover Test chuẩn với thước lăng kính (PACT).'
                  : 'Không phát hiện thấy chuyển động giật mắt tái định vị vượt ngưỡng kỹ thuật trong lần thực hiện này. Hãy tiếp tục duy trì thói quen kiểm tra mắt định kỳ.'}
              </p>
            </div>
          </div>

          {/* Trajectory Canvas Charts with Cycle Selection */}
          <div className="trajectories-section" style={{ marginTop: '24px' }}>
            <div className="charts-header-row">
              <div>
                <h3 className="charts-title">Đồ thị Quỹ đạo Chuyển động Mống mắt</h3>
                <p className="charts-desc">
                  Trục X: Thời gian (0 &ndash; {SCREENING_CONFIG.RECORD_MS}ms). Trục Y: Vị trí ngang chuẩn hóa. Đánh dấu: Điểm mở mắt (0ms), Cửa sổ phân tích ({SCREENING_CONFIG.UNCOVER_WINDOW_MS}ms), và Điểm vận động đỉnh (hình thoi).
                </p>
              </div>

              {/* Cycle Filter Selection */}
              <div className="cycle-filter-buttons" role="group" aria-label="Lọc theo chu kỳ">
                {['ALL', '1', '2', '3'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`cycle-filter-btn ${selectedCycleFilter === item ? 'active' : ''}`}
                    onClick={() => setSelectedCycleFilter(item)}
                  >
                    {item === 'ALL' ? 'Tất cả chu kỳ' : `Chu kỳ ${item}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="charts-grid">
              <div className="chart-box">
                <div className="chart-heading">Mắt trái — Quỹ đạo qua các chu kỳ (theo dõi khi bỏ che mắt phải)</div>
                <canvas ref={chartCanvasLeftRef} className="trajectory-canvas" />
              </div>
              <div className="chart-box">
                <div className="chart-heading">Mắt phải — Quỹ đạo qua các chu kỳ (theo dõi khi bỏ che mắt trái)</div>
                <canvas ref={chartCanvasRightRef} className="trajectory-canvas" />
              </div>
            </div>
          </div>

          <div className="retry-action-row" style={{ marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartScreening}
            >
              Thực hiện lại bài kiểm tra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
