import React, { useState, useEffect, useRef, useCallback } from 'react';
import AudioButton from './audio/AudioButton';
import CameraView from './CameraView';
import MedicalDisclaimer from './MedicalDisclaimer';
import { useCamera } from '../hooks/useCamera';
import { useFaceMesh } from '../hooks/useFaceMesh';
import { useSpeech } from '../hooks/useSpeech';
import {
  BROCK_STRING_TARGETS,
  BINOCULAR_VERDICT,
  PROTOCOLS,
} from '../constants/screeningConfig';
import {
  validateBrockStringQuality,
  extractBrockStringFrame,
  analyzeTargetFixation,
  evaluateBrockStringSession,
} from '../services/brockStringMeasurementService';
import { createUnifiedMeasurementResult } from '../services/measurementResultService';

/**
 * BrockStringTest Component
 * Digital Binocular Vision Screening protocol tracking eye convergence
 * across configurable target beads (NEAR -> MID -> FAR).
 */
export default function BrockStringTest() {
  const videoRef = useRef(null);
  const chartCanvasRef = useRef(null);

  // Distances configuration (in cm)
  const [nearDist, setNearDist] = useState(20);
  const [midDist, setMidDist] = useState(50);
  const [farDist, setFarDist] = useState(100);

  // Testing flow state
  const [isTesting, setIsTesting] = useState(false);
  const [currentTargetId, setCurrentTargetId] = useState('NEAR'); // 'NEAR' | 'MID' | 'FAR'
  const [countdownSec, setCountdownSec] = useState(0);
  const [sessionResults, setSessionResults] = useState(null);
  const [targetMeasurements, setTargetMeasurements] = useState({});

  // Real-time telemetry
  const [currentQuality, setCurrentQuality] = useState(null);
  const [rawLandmarks, setRawLandmarks] = useState(null);
  const [liveVergence, setLiveVergence] = useState(null);
  const [statusMessage, setStatusMessage] = useState('Sẵn sàng. Nhấn "Bắt đầu đo Brock String" để kiểm tra.');

  // Camera & FaceMesh hooks
  const { stream, isActive, isLoading: isCamLoading, error: camError, start: startCam, stop: stopCam } = useCamera();
  const { speak, cancel: cancelSpeech, isVoiceEnabled, toggleSound } = useSpeech();

  // Execution refs
  const isAbortedRef = useRef(false);
  const rawLandmarksRef = useRef(null);
  const targetBufferRef = useRef([]);
  const activeTargetIdRef = useRef('NEAR');
  const activeTargetDistRef = useRef(20);

  useEffect(() => {
    activeTargetIdRef.current = currentTargetId;
    if (currentTargetId === 'NEAR') activeTargetDistRef.current = nearDist;
    else if (currentTargetId === 'MID') activeTargetDistRef.current = midDist;
    else activeTargetDistRef.current = farDist;
  }, [currentTargetId, nearDist, midDist, farDist]);

  // Frame results receiver from MediaPipe
  const onResults = useCallback((results) => {
    const multiLm = results?.multiFaceLandmarks;
    const qualityReport = validateBrockStringQuality(multiLm);
    setCurrentQuality(qualityReport);

    if (!qualityReport.isValid) {
      rawLandmarksRef.current = null;
      setRawLandmarks(null);
      setLiveVergence(null);
      return;
    }

    const lm = multiLm[0];
    rawLandmarksRef.current = lm;
    setRawLandmarks(lm);

    const frameData = extractBrockStringFrame(
      lm,
      activeTargetIdRef.current,
      activeTargetDistRef.current,
      performance.now()
    );

    setLiveVergence(frameData.binocularFeature.vergenceRatio);

    // If recording an active target, append frame to buffer
    if (isAbortedRef.current === false && targetBufferRef.current !== null) {
      targetBufferRef.current.push(frameData);
    }
  }, []);

  const { startLoop, stopLoop } = useFaceMesh(onResults);

  // Start Camera
  const handleStartCamera = async () => {
    try {
      const videoEl = videoRef.current;
      if (!videoEl) throw new Error('Không tìm thấy khung webcam.');
      await startCam(videoEl);
      if (videoEl.paused) {
        await videoEl.play().catch(() => {});
      }
      await startLoop(videoEl);
      setStatusMessage('Camera hoạt động. Đưa khuôn mặt vào giữa khung hình.');
    } catch (err) {
      console.error('Lỗi bật camera Brock String:', err);
      setStatusMessage(err.message || 'Không thể khởi động camera.');
    }
  };

  // Run a single target phase
  const runTargetPhase = (targetId, targetLabel, distanceCm, durationSec = 4) => {
    return new Promise((resolve) => {
      if (isAbortedRef.current) {
        resolve(null);
        return;
      }

      setCurrentTargetId(targetId);
      targetBufferRef.current = [];
      setCountdownSec(durationSec);

      speak(targetId === 'NEAR' ? 'Nhìn vào chấm tròn.' : 'Tiếp tục nhìn vào chấm tròn.');
      setStatusMessage(`Đang theo dõi cố định thị giác: ${targetLabel} (${distanceCm} cm)...`);

      let remaining = durationSec;
      const intervalId = setInterval(() => {
        if (isAbortedRef.current) {
          clearInterval(intervalId);
          resolve(null);
          return;
        }

        remaining -= 1;
        setCountdownSec(remaining);

        if (remaining <= 0) {
          clearInterval(intervalId);
          const recordedFrames = [...targetBufferRef.current];
          const result = analyzeTargetFixation(recordedFrames, {
            id: targetId,
            label: targetLabel,
            distanceCm,
          });
          resolve(result);
        }
      }, 1000);
    });
  };

  // Start full 3-target Brock String Protocol
  const handleStartTest = async () => {
    if (!isActive) {
      await handleStartCamera();
    }

    isAbortedRef.current = false;
    setIsTesting(true);
    setSessionResults(null);
    setTargetMeasurements({});

    speak('Bắt đầu bài kiểm tra Brock String. Giữ thẳng đầu và nhìn lần lượt theo hướng dẫn.', true);

    // 1. NEAR TARGET
    const nearRes = await runTargetPhase(
      BROCK_STRING_TARGETS.NEAR.id,
      BROCK_STRING_TARGETS.NEAR.label,
      nearDist,
      4
    );
    if (isAbortedRef.current || !nearRes) {
      setIsTesting(false);
      return;
    }
    setTargetMeasurements((prev) => ({ ...prev, NEAR: nearRes }));

    // Short pause
    await new Promise((r) => setTimeout(r, 1000));
    if (isAbortedRef.current) {
      setIsTesting(false);
      return;
    }

    // 2. MID TARGET
    const midRes = await runTargetPhase(
      BROCK_STRING_TARGETS.MID.id,
      BROCK_STRING_TARGETS.MID.label,
      midDist,
      4
    );
    if (isAbortedRef.current || !midRes) {
      setIsTesting(false);
      return;
    }
    setTargetMeasurements((prev) => ({ ...prev, MID: midRes }));

    // Short pause
    await new Promise((r) => setTimeout(r, 1000));
    if (isAbortedRef.current) {
      setIsTesting(false);
      return;
    }

    // 3. FAR TARGET
    const farRes = await runTargetPhase(
      BROCK_STRING_TARGETS.FAR.id,
      BROCK_STRING_TARGETS.FAR.label,
      farDist,
      4
    );
    if (isAbortedRef.current || !farRes) {
      setIsTesting(false);
      return;
    }

    const allTargetResults = {
      NEAR: nearRes,
      MID: midRes,
      FAR: farRes,
    };
    setTargetMeasurements(allTargetResults);

    // Evaluate whole session
    const evaluation = evaluateBrockStringSession(allTargetResults);
    const unified = createUnifiedMeasurementResult({
      protocol: PROTOCOLS.BROCK_STRING,
      quality: evaluation.dataQuality,
      measurements: evaluation,
      cycles: [nearRes, midRes, farRes],
    });

    setSessionResults(unified);
    setIsTesting(false);
    speak('Đã hoàn thành.');
    setStatusMessage('Hoàn tất bài kiểm tra Brock String.');
  };

  // Stop / Cancel Test
  const handleCancelTest = () => {
    isAbortedRef.current = true;
    cancelSpeech();
    setIsTesting(false);
    setCountdownSec(0);
    setStatusMessage('Đã hủy bài kiểm tra. Bạn có thể bắt đầu lại bất kỳ lúc nào.');
  };

  // Unmount cleanup
  useEffect(() => {
    return () => {
      isAbortedRef.current = true;
      cancelSpeech();
      stopLoop();
      stopCam();
    };
  }, [cancelSpeech, stopCam, stopLoop]);

  // Render Vergence Chart across distances
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas || !sessionResults) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width || 480;
    const H = 180;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const PAD_LEFT = 50;
    const PAD_RIGHT = 30;
    const PAD_TOP = 25;
    const PAD_BOTTOM = 30;
    const plotW = W - PAD_LEFT - PAD_RIGHT;
    const plotH = H - PAD_TOP - PAD_BOTTOM;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PAD_TOP + (i / 4) * plotH;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, y);
      ctx.lineTo(W - PAD_RIGHT, y);
      ctx.stroke();
    }

    const targets = [
      { id: 'NEAR', label: `Near (${nearDist}cm)`, dist: nearDist, data: targetMeasurements.NEAR, color: '#06b6d4' },
      { id: 'MID', label: `Mid (${midDist}cm)`, dist: midDist, data: targetMeasurements.MID, color: '#f59e0b' },
      { id: 'FAR', label: `Far (${farDist}cm)`, dist: farDist, data: targetMeasurements.FAR, color: '#8b5cf6' },
    ];

    const validPoints = targets
      .map((t, idx) => {
        const ratio = t.data?.medianVergenceRatio;
        return ratio ? { ...t, ratio, xIdx: idx } : null;
      })
      .filter(Boolean);

    if (validPoints.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Không có dữ liệu hợp lệ để vẽ biểu đồ', W / 2, H / 2);
      return;
    }

    // Determine scale for vergence ratio
    const ratios = validPoints.map((p) => p.ratio);
    const minR = Math.min(...ratios, 0.8) - 0.05;
    const maxR = Math.max(...ratios, 1.2) + 0.05;
    const rangeR = Math.max(0.01, maxR - minR);

    // Plot connecting line
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    validPoints.forEach((p, i) => {
      const px = PAD_LEFT + (p.xIdx / 2) * plotW;
      const py = PAD_TOP + plotH - ((p.ratio - minR) / rangeR) * plotH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();

    // Plot points & labels
    validPoints.forEach((p) => {
      const px = PAD_LEFT + (p.xIdx / 2) * plotW;
      const py = PAD_TOP + plotH - ((p.ratio - minR) / rangeR) * plotH;

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Ratio text
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.ratio.toFixed(2), px, py - 10);

      // X label
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(p.label, px, H - 10);
    });

    // Y Axis label
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Tỉ lệ quy tụ (Vergence Ratio)', 10, 16);
  }, [sessionResults, targetMeasurements, nearDist, midDist, farDist]);

  const isHeadOk = currentQuality?.headPose?.isAcceptable ?? false;
  const isBothEyesOk = currentQuality?.details?.leftEye && currentQuality?.details?.rightEye;

  return (
    <div className="page-container brock-string-page">
      <div className="page-header">
        <div className="header-badge-row">
          <span className="badge badge-clinical">Digital Binocular Vision Screening &bull; Brock String Protocol</span>
          <button
            type="button"
            className="sound-toggle-btn"
            onClick={toggleSound}
            title={isVoiceEnabled ? 'Tắt giọng nói' : 'Bật giọng nói'}
            aria-label="Bật hoặc tắt giọng nói hướng dẫn"
          >
            {isVoiceEnabled ? '🔊 Giọng nói Bật' : '🔇 Giọng nói Tắt'}
          </button>
        </div>
        <h1 className="page-title">Kiểm tra thị giác hai mắt Brock String</h1>
        <p className="page-subtitle">
          Quan sát chuyển động hội tụ quang học của hai mắt khi nhìn cố định lần lượt vào các hạt mục tiêu ở khoảng cách gần, vừa và xa.
        </p>
        <AudioButton text="Đưa khuôn mặt vào đúng vị trí. Sau đó nhìn vào chấm tròn." onActivate={() => { if (!isVoiceEnabled) toggleSound(); }} />
      </div>

      <MedicalDisclaimer />

      {/* Target Configuration Card */}
      <div className="card brock-config-card">
        <h2 className="config-title">Cấu hình khoảng cách hạt mục tiêu (Brock String Beads)</h2>
        <div className="config-grid">
          <div className="config-item">
            <label htmlFor="nearInput">Hạt Gần (NEAR):</label>
            <div className="input-group">
              <input
                id="nearInput"
                type="number"
                min="10"
                max="35"
                value={nearDist}
                onChange={(e) => setNearDist(Number(e.target.value))}
                disabled={isTesting}
              />
              <span>cm</span>
            </div>
          </div>

          <div className="config-item">
            <label htmlFor="midInput">Hạt Giữa (MID):</label>
            <div className="input-group">
              <input
                id="midInput"
                type="number"
                min="35"
                max="75"
                value={midDist}
                onChange={(e) => setMidDist(Number(e.target.value))}
                disabled={isTesting}
              />
              <span>cm</span>
            </div>
          </div>

          <div className="config-item">
            <label htmlFor="farInput">Hạt Xa (FAR):</label>
            <div className="input-group">
              <input
                id="farInput"
                type="number"
                min="75"
                max="200"
                value={farDist}
                onChange={(e) => setFarDist(Number(e.target.value))}
                disabled={isTesting}
              />
              <span>cm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Testing View */}
      <div className="card stage-card-main">
        <div className="brock-test-layout">
          {/* Camera Feed Column */}
          <div className="cam-column">
            <CameraView
              videoRef={videoRef}
              stream={stream}
              landmarks={rawLandmarks}
              quality={currentQuality}
              isActive={isActive}
              isLoading={isCamLoading}
              error={camError}
            />

            {/* Live Telemetry Status Bar */}
            <div className="telemetry-bar-brock">
              <span className={`telemetry-pill ${currentQuality?.isValid ? 'valid' : 'invalid'}`}>
                Theo dõi: <strong>{currentQuality?.isValid ? '● Ổn định' : '○ Đang tìm kiếm'}</strong>
              </span>
              <span className={`telemetry-pill ${isBothEyesOk ? 'valid' : 'invalid'}`}>
                Hai mắt: <strong>{isBothEyesOk ? '✓ Nhận diện tốt' : '✕ Chưa đủ'}</strong>
              </span>
              <span className={`telemetry-pill ${isHeadOk ? 'valid' : 'warning'}`}>
                Tư thế đầu: <strong>{isHeadOk ? '✓ Đạt chuẩn' : '⚠️ Nghiêng đầu'}</strong>
              </span>
              {liveVergence !== null && (
                <span className="telemetry-pill info">
                  Tỉ lệ quy tụ tức thời: <strong>{liveVergence.toFixed(2)}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Interactive Protocol Control Column */}
          <div className="brock-controls-column">
            {/* Visual String Graphic */}
            <div className="brock-string-visual" aria-hidden="true">
              <div className="string-line" />
              <div
                className={`bead bead-near ${currentTargetId === 'NEAR' ? 'active' : ''}`}
                title={`Hạt Gần (${nearDist}cm)`}
              >
                <span>GẦN</span>
              </div>
              <div
                className={`bead bead-mid ${currentTargetId === 'MID' ? 'active' : ''}`}
                title={`Hạt Giữa (${midDist}cm)`}
              >
                <span>GIỮA</span>
              </div>
              <div
                className={`bead bead-far ${currentTargetId === 'FAR' ? 'active' : ''}`}
                title={`Hạt Xa (${farDist}cm)`}
              >
                <span>XA</span>
              </div>
            </div>

            {/* Current Active Target Display */}
            <div className="target-status-card">
              <span className="target-label-mini">Mục tiêu hiện tại:</span>
              <h3 className="target-name">
                {currentTargetId === 'NEAR' && `Hạt Gần (NEAR) — ${nearDist} cm`}
                {currentTargetId === 'MID' && `Hạt Giữa (MID) — ${midDist} cm`}
                {currentTargetId === 'FAR' && `Hạt Xa (FAR) — ${farDist} cm`}
              </h3>
              {isTesting && (
                <div className="countdown-pill">
                  Thời gian quan sát: <strong>{countdownSec}s</strong>
                </div>
              )}
            </div>

            <div className="status-box" role="status">
              {statusMessage}
            </div>

            {/* Action Buttons */}
            <div className="actions-row">
              {!isTesting ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleStartTest}
                  disabled={isCamLoading}
                >
                  {!isActive ? 'Bật Camera & Bắt đầu Đo' : 'Bắt đầu đo Brock String'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleCancelTest}
                >
                  Hủy kiểm tra
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Measurement Results Section */}
      {sessionResults && (
        <div className="card results-card-main">
          <div className="results-header-row">
            <div>
              <h2 className="results-title">Kết quả đo lường Brock String</h2>
              <p className="results-subtitle">Chỉ số quang học phản ánh mức độ dịch chuyển của mống mắt giữa các hạt.</p>
            </div>
            <span
              className={`verdict-badge ${
                sessionResults.measurements.verdict === BINOCULAR_VERDICT.MEASURABLE ? 'measurable' : 'inconclusive'
              }`}
            >
              {sessionResults.measurements.verdict === BINOCULAR_VERDICT.MEASURABLE ? 'MEASURABLE' : 'INCONCLUSIVE'}
            </span>
          </div>

          {/* Target Breakdown Table */}
          <div className="table-responsive">
            <table className="brock-results-table">
              <thead>
                <tr>
                  <th>Hạt mục tiêu</th>
                  <th>Khoảng cách</th>
                  <th>Tỉ lệ quy tụ (Median)</th>
                  <th>Độ ổn định (IQR)</th>
                  <th>Thời gian ổn định</th>
                  <th>Chất lượng dữ liệu</th>
                </tr>
              </thead>
              <tbody>
                {['NEAR', 'MID', 'FAR'].map((key) => {
                  const m = targetMeasurements[key];
                  return (
                    <tr key={key}>
                      <td><strong>{key === 'NEAR' ? 'Hạt Gần' : key === 'MID' ? 'Hạt Giữa' : 'Hạt Xa'}</strong></td>
                      <td>{m ? `${m.targetDistanceCm} cm` : '--'}</td>
                      <td>{m?.medianVergenceRatio ? m.medianVergenceRatio.toFixed(3) : '--'}</td>
                      <td>{m?.fixationStabilityIqr ? m.fixationStabilityIqr.toFixed(3) : '--'}</td>
                      <td>{m?.transitionLatencyMs ? `${m.transitionLatencyMs} ms` : '--'}</td>
                      <td>
                        <span className={`status-tag ${m?.dataQuality?.isValid ? 'valid' : 'inconclusive'}`}>
                          {m?.dataQuality?.isValid ? 'Đạt chuẩn' : 'Chưa đạt mẫu'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vergence Chart */}
          <div className="brock-chart-container">
            <h3 className="chart-heading">Đồ thị biến thiên quy tụ hai mắt theo khoảng cách</h3>
            <canvas ref={chartCanvasRef} className="brock-canvas-chart" />
          </div>

          {/* Clinical Safe Note */}
          <div className="clinical-notice-box">
            <p>
              ℹ️ <strong>Nguyên lý đo lường:</strong> Khi mắt người chuyển từ nhìn xa sang nhìn gần, trục thị giác hai mắt sinh lý sẽ hội tụ (convergence), làm giảm tỉ lệ khoảng cách tương quan giữa hai mống mắt so với khoảng cách khóe mắt trong.
            </p>
            <p className="notice-sub">
              Hệ thống ghi nhận thuần túy các chỉ số cơ học quang học và chưa hiệu chuẩn độ lăng kính hay góc quy tụ lâm sàng. Không đưa ra kết luận bệnh lý hay suy giảm chức năng quy tụ.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
