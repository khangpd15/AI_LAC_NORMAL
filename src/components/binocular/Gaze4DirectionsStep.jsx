import React, { useState, useEffect, useRef } from 'react';
import { GAZE_DIRECTIONS_CONFIG } from '../../constants/binocularScreeningConfig.js';
import {
  Gaze4DirectionsQualityGate,
  captureGazeFrameDataUrl,
} from '../../services/cv/gaze4DirectionsQualityGate.js';
import CameraView from '../CameraView';
import AudioButton from '../audio/AudioButton';

/**
 * Gaze4DirectionsStep Component
 * Captures 4 gaze directions (LEFT, RIGHT, UP, STRAIGHT) with fixed non-moving targets
 * at close distance (15–20 cm) prior to Cover Test.
 * 
 * Auto-captures with a distinct rhythm:
 * 1. Speaks direction: "Nhìn thẳng sang trái nghen."
 * 2. Gives a 1.8s grace period to orient eyes.
 * 3. Once user locks gaze onto fixed target: counts "Một...", "Hai...", "Chụp!" (~2s total).
 * 4. Captures photo, transitions to next direction.
 */
export default function Gaze4DirectionsStep({
  videoRef,
  stream,
  landmarks,
  positionReport,
  onComplete,
  speak,
  isVoiceEnabled = true,
  toggleSound,
  onVideoReady,
}) {
  // Current direction index: 0 (LEFT), 1 (RIGHT), 2 (UP), 3 (STRAIGHT)
  const [directionIndex, setDirectionIndex] = useState(0);

  // Status state: 'OBSERVING' | 'CAPTURING' | 'SUCCESS_TRANSITION' | 'COMPLETED'
  const [stepStatus, setStepStatus] = useState('OBSERVING');

  // Real-time quality gate feedback
  const [progressRatio, setProgressRatio] = useState(0);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isPassing, setIsPassing] = useState(false);
  const [countdownPhase, setCountdownPhase] = useState(null); // null | '1' | '2' | 'snap'
  const [isOrienting, setIsOrienting] = useState(true);

  // Captured images store
  const [captures, setCaptures] = useState({});

  // Quality gate instance (2100ms stable hold for 1... 2... Chụp!)
  const gateRef = useRef(new Gaze4DirectionsQualityGate({ requiredStableMs: 2100 }));

  // Audio speech tracking refs to avoid duplicate speaks
  const spokenIntroRef = useRef(false);
  const spokenOneRef = useRef(false);
  const spokenTwoRef = useRef(false);
  const spokenSnapRef = useRef(false);
  const orientTimeoutRef = useRef(null);

  // Flash animation state
  const [showShutterFlash, setShowShutterFlash] = useState(false);

  const activeConfig = GAZE_DIRECTIONS_CONFIG[directionIndex];
  const estimatedDistanceCm = positionReport?.stableDistanceCm ?? positionReport?.estimatedDistanceCm ?? null;

  // When direction changes: announce direction and give 1.8s grace period to orient eyes
  useEffect(() => {
    gateRef.current.reset();
    spokenIntroRef.current = false;
    spokenOneRef.current = false;
    spokenTwoRef.current = false;
    spokenSnapRef.current = false;
    setCountdownPhase(null);
    setProgressRatio(0);
    setIsPassing(false);
    setIsOrienting(true);

    if (activeConfig && isVoiceEnabled && speak) {
      speak(activeConfig.voiceText);
      spokenIntroRef.current = true;
    }

    if (orientTimeoutRef.current) clearTimeout(orientTimeoutRef.current);
    // For 'straight' gaze: start evaluating immediately (250ms) so AI captures right away!
    const isStraight = activeConfig?.id === 'straight' || activeConfig?.id === 'center';
    const orientDelay = isStraight ? 250 : 1600;
    orientTimeoutRef.current = setTimeout(() => {
      setIsOrienting(false);
    }, orientDelay);

    return () => {
      if (orientTimeoutRef.current) clearTimeout(orientTimeoutRef.current);
    };
  }, [directionIndex, activeConfig, isVoiceEnabled, speak]);

  // Main evaluation frame loop
  useEffect(() => {
    if (stepStatus !== 'OBSERVING') return;

    if (isOrienting) {
      const targetHint = activeConfig.id === 'straight' || activeConfig.id === 'center'
        ? 'ở giữa màn hình'
        : `bên ${activeConfig.label.toLowerCase()}`;
      setFeedbackMessage(`Đang hướng dẫn... Cô chú nhìn thẳng vào mục tiêu ${targetHint} nghen.`);
      return;
    }

    const gate = gateRef.current;
    const res = gate.evaluate({
      landmarks,
      targetDirection: activeConfig.id,
      distanceCm: estimatedDistanceCm,
      timestampMs: performance.now(),
    });

    setProgressRatio(res.progressRatio);
    setIsPassing(res.isPassing);
    setCountdownPhase(res.countdownPhase);
    setFeedbackMessage(res.feedbackText);

    // Audible Countdown Rhythm: "Một..." -> "Hai..." -> "Chụp!"
    if (res.countdownPhase === '1' && !spokenOneRef.current) {
      spokenOneRef.current = true;
      if (isVoiceEnabled && speak) {
        speak('Một...');
      }
    } else if (res.countdownPhase === '2' && !spokenTwoRef.current) {
      spokenTwoRef.current = true;
      if (isVoiceEnabled && speak) {
        speak('Hai...');
      }
    } else if (res.countdownPhase === null) {
      // User looked away, blinked, or lost alignment -> reset countdown speech triggers
      spokenOneRef.current = false;
      spokenTwoRef.current = false;
      spokenSnapRef.current = false;
    }

    // Trigger auto-capture if Quality Gate is fulfilled (~2.1s stable hold)
    if (res.isReadyToCapture) {
      setStepStatus('CAPTURING');
      setShowShutterFlash(true);

      if (isVoiceEnabled && speak && !spokenSnapRef.current) {
        spokenSnapRef.current = true;
        speak('Chụp!');
      }

      const capturedDataUrl = captureGazeFrameDataUrl(videoRef.current);

      const captureRecord = {
        direction: activeConfig.id,
        directionName: activeConfig.name,
        timestamp: new Date().toISOString(),
        image: capturedDataUrl,
        landmarks: landmarks ? landmarks.slice(0, 478).map((p) => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) })) : null,
        qualityScore: res.qualityScore,
        distanceCm: estimatedDistanceCm,
        gazeOffsets: res.gazeOffsets,
      };

      setCaptures((prev) => ({
        ...prev,
        [activeConfig.id]: captureRecord,
      }));

      // Short shutter visual
      setTimeout(() => setShowShutterFlash(false), 250);

      // Transition to next direction or complete flow
      setStepStatus('SUCCESS_TRANSITION');
      gate.reset();

      setTimeout(() => {
        if (directionIndex < GAZE_DIRECTIONS_CONFIG.length - 1) {
          setDirectionIndex((idx) => idx + 1);
          setStepStatus('OBSERVING');
          setProgressRatio(0);
          setCountdownPhase(null);
        } else {
          // All 4 directions completed!
          setStepStatus('COMPLETED');
          if (isVoiceEnabled && speak) {
            speak('Giờ mình lùi ra xa một chút nghen.');
          }

          const fullGazeTrackingData = {
            distanceCm: '15-20',
            completedAt: new Date().toISOString(),
            captures: {
              ...captures,
              [activeConfig.id]: captureRecord,
            },
          };

          if (onComplete) {
            onComplete(fullGazeTrackingData);
          }
        }
      }, 1200);
    }
  }, [landmarks, stepStatus, isOrienting, activeConfig, estimatedDistanceCm, directionIndex, videoRef, captures, isVoiceEnabled, speak, onComplete]);

  // Click-to-snap handler: allows instant capture on clicking the target
  const handleManualSnap = () => {
    if (stepStatus !== 'OBSERVING') return;
    setStepStatus('CAPTURING');
    setShowShutterFlash(true);

    if (isVoiceEnabled && speak && !spokenSnapRef.current) {
      spokenSnapRef.current = true;
      speak('Chụp!');
    }

    const capturedDataUrl = captureGazeFrameDataUrl(videoRef.current);

    const captureRecord = {
      direction: activeConfig.id,
      directionName: activeConfig.name,
      timestamp: new Date().toISOString(),
      image: capturedDataUrl,
      landmarks: landmarks ? landmarks.slice(0, 478).map((p) => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) })) : null,
      qualityScore: 0.95,
      distanceCm: estimatedDistanceCm,
      gazeOffsets: { meanDx: 0, meanDy: 0 },
    };

    setCaptures((prev) => ({
      ...prev,
      [activeConfig.id]: captureRecord,
    }));

    setTimeout(() => setShowShutterFlash(false), 250);

    setStepStatus('SUCCESS_TRANSITION');
    gateRef.current.reset();

    setTimeout(() => {
      if (directionIndex < GAZE_DIRECTIONS_CONFIG.length - 1) {
        setDirectionIndex((idx) => idx + 1);
        setStepStatus('OBSERVING');
        setProgressRatio(0);
        setCountdownPhase(null);
      } else {
        setStepStatus('COMPLETED');
        if (isVoiceEnabled && speak) {
          speak('Giờ mình lùi ra xa một chút nghen.');
        }

        const fullGazeTrackingData = {
          distanceCm: '15-20',
          completedAt: new Date().toISOString(),
          captures: {
            ...captures,
            [activeConfig.id]: captureRecord,
          },
        };

        if (onComplete) {
          onComplete(fullGazeTrackingData);
        }
      }
    }, 1000);
  };

  // Circumference for circular progress ring (r = 36, perimeter = 2 * PI * 36 ~= 226)
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <div className="card stage-card-main gaze-4-directions-card">
      {/* Shutter flash overlay */}
      {showShutterFlash && <div className="gaze-shutter-flash" />}

      {/* Header bar with direction and step counter */}
      <div className="gaze-step-header">
        <div className="gaze-header-left">
          <span className="badge badge-primary">BƯỚC 1 • CHỤP 4 HƯỚNG MẮT</span>
          <span className="badge badge-secondary">{activeConfig.stepNumber}</span>
        </div>

        <div className="gaze-header-center">
          <h2 className="gaze-current-direction-title">
            HƯỚNG: <span className="highlight-dir">{activeConfig.label}</span>
          </h2>
        </div>

        <div className="gaze-header-right">
          {toggleSound && (
            <AudioButton
              isVoiceEnabled={isVoiceEnabled}
              onToggle={toggleSound}
              variant="compact"
            />
          )}
        </div>
      </div>

      {/* Main Video Viewport with Fixed Target Overlay */}
      <div className="gaze-camera-viewport">
        <CameraView
          videoRef={videoRef}
          stream={stream}
          landmarks={landmarks}
          onVideoReady={onVideoReady}
          showLandmarkPoints={false}
          showMeshConnections={false}
        />

        {/* 1 FIXED NON-MOVING TARGET */}
        {stepStatus !== 'COMPLETED' && (
          <div
            className={`gaze-fixed-target-wrapper target-${activeConfig.id}`}
            style={{ ...activeConfig.targetPosition, pointerEvents: 'auto', cursor: 'pointer' }}
            onClick={handleManualSnap}
            title={`${activeConfig.arrowHint} (AI tự chụp hoặc bấm vào để chụp ngay)`}
          >
            <div className="target-ring-container">
              {/* SVG Circular Progress Ring */}
              <svg className="target-progress-ring" width="88" height="88" viewBox="0 0 88 88">
                <circle
                  className="target-ring-bg"
                  cx="44"
                  cy="44"
                  r={radius}
                  fill="none"
                />
                <circle
                  className="target-ring-fill"
                  cx="44"
                  cy="44"
                  r={radius}
                  fill="none"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset,
                  }}
                />
              </svg>

              {/* Glowing Target Core with Countdown Number (1, 2, 📸) */}
              <div className={`target-glowing-core ${countdownPhase ? 'counting' : ''} ${isPassing ? 'core-locking' : ''}`}>
                {countdownPhase === 'snap' ? (
                  <span className="core-counter-text">📸</span>
                ) : countdownPhase === '2' ? (
                  <span className="core-counter-text">2</span>
                ) : countdownPhase === '1' ? (
                  <span className="core-counter-text">1</span>
                ) : (
                  <span className="core-bullseye-icon">🎯</span>
                )}
              </div>
            </div>

            {/* Direction Arrow Hint */}
            <div className="target-floating-hint">
              <span>{activeConfig.arrowHint}</span>
              {activeConfig.id === 'straight' && (
                <span style={{ fontSize: '0.72rem', opacity: 0.85, marginLeft: '6px' }}>• Tự chụp</span>
              )}
            </div>
          </div>
        )}

        {/* Success Capture Overlay Badge */}
        {stepStatus === 'SUCCESS_TRANSITION' && (
          <div className="gaze-success-overlay fade-in">
            <div className="success-pill-box">
              <span className="success-icon">✓</span>
              <div className="success-text-block">
                <strong>ĐÃ CHỤP THÀNH CÔNG!</strong>
                <small>Tiếp theo...</small>
              </div>
            </div>
          </div>
        )}

        {/* Distance Range Indicator Banner */}
        <div className="gaze-distance-badge">
          {estimatedDistanceCm !== null ? (
            estimatedDistanceCm > 20 ? (
              <span className="dist-pill dist-far">
                📏 Đưa mặt lại gần camera một chút ({estimatedDistanceCm} cm &gt; 20 cm)
              </span>
            ) : estimatedDistanceCm < 15 ? (
              <span className="dist-pill dist-close">
                📏 Lùi ra xa camera một chút ({estimatedDistanceCm} cm &lt; 15 cm)
              </span>
            ) : (
              <span className="dist-pill dist-ok">
                ✓ Khoảng cách chuẩn ({estimatedDistanceCm} cm)
              </span>
            )
          ) : (
            <span className="dist-pill dist-detecting">Đang xác định cự ly 15–20 cm...</span>
          )}
        </div>

        {/* Real-time Voice Guidance & Feedback Subtitle Bar */}
        <div className="gaze-feedback-bottom-bar">
          <div className="feedback-voice-bubble">
            <span className="voice-icon">🔊</span>
            <span className="feedback-text">{feedbackMessage || activeConfig.voiceText}</span>
          </div>

          {/* Linear Progress Bar for Hold Stability */}
          <div className="gaze-hold-progress-bar-bg">
            <div
              className="gaze-hold-progress-bar-fill"
              style={{ width: `${progressRatio * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bottom thumbnails of captured directions */}
      <div className="gaze-capture-strip">
        {GAZE_DIRECTIONS_CONFIG.map((dir, idx) => {
          const cap = captures[dir.id];
          const isCurrent = idx === directionIndex;
          const isDone = Boolean(cap);

          return (
            <div
              key={dir.id}
              className={`gaze-strip-card ${isCurrent ? 'active' : ''} ${isDone ? 'done' : ''}`}
            >
              <div className="gaze-strip-thumb">
                {isDone && cap?.image ? (
                  <img src={cap.image} alt={dir.label} className="gaze-strip-img" />
                ) : (
                  <span className="gaze-strip-placeholder">
                    {dir.id === 'left' ? '←' : dir.id === 'right' ? '→' : dir.id === 'up' ? '↑' : '⦿'}
                  </span>
                )}
              </div>
              <span className="gaze-strip-title">{dir.label}</span>
              <span className="gaze-strip-badge">
                {isDone ? '✓ Đã chụp' : isCurrent ? 'Đang chụp' : 'Chờ'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
