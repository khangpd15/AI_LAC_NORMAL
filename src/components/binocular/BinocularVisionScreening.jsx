import React, { useState, useEffect, useRef, useCallback } from 'react';
import ScreeningProgress from './ScreeningProgress';
import PositionCheck from './PositionCheck';
import Gaze4DirectionsStep from './Gaze4DirectionsStep';
import CoverTestStep from './CoverTestStep';
import ScreeningSummary from './ScreeningSummary';
import { useCamera } from '../../hooks/useCamera.js';
import { useFaceMesh } from '../../hooks/useFaceMesh.js';
import { useEyeTracking } from '../../hooks/useEyeTracking.js';
import { useSpeech } from '../../hooks/useSpeech.js';
import { useStrabismusAI } from '../../hooks/useStrabismusAI.js';
import {
  DistanceStabilityTracker,
  estimateCameraDistance,
} from '../../services/positionCalibrationService.js';
import {
  createBinocularSession,
  updateGazePositionCheckData,
  updateGazeTrackingData,
  updateCoverPositionCheckData,
  updateCoverTestData,
  generateScreeningSummary,
  logScreeningEvent,
} from '../../services/binocularScreeningService.js';
import {
  SCREENING_EVENTS,
} from '../../constants/binocularScreeningConfig.js';
import { finalizeScreeningSample, setScreeningImage } from '../../services/screeningDatasetService.js';

/**
 * BinocularVisionScreening Component
 * Master Orchestrator for the unified Digital Binocular Vision Screening protocol:
 * GAZE_POSITION (15–20 cm) -> GAZE 4 DIRECTIONS (Left, Right, Up, Down) ->
 * COVER_POSITION (33–40 cm) -> COVER TEST -> BROCK_POSITION (20–25 cm) -> BROCK STRING -> SUMMARY
 */
export default function BinocularVisionScreening() {
  // Global Screening Step: 'GAZE_POSITION' | 'GAZE_4_DIRECTIONS' | 'COVER_POSITION' | 'COVER' | 'BROCK_POSITION' | 'BROCK' | 'SUMMARY'
  const [currentStep, setCurrentStep] = useState('GAZE_POSITION');
  const [session, setSession] = useState(() => createBinocularSession());
  const [positionReport, setPositionReport] = useState(null);

  // Stateful distance stability tracker for consecutive frame smoothing
  const distanceTrackerRef = useRef(new DistanceStabilityTracker('GAZE_4_DIRECTIONS'));

  // Video element ref
  const videoRef = useRef(null);

  // Vision, Hardware & Assistant Hooks
  const { stream, isActive, isLoading: isCamLoading, error: camError, start: startCam, stop: stopCam, attachVideo } = useCamera();
  const { quality, features, latestFeaturesRef, latestQualityRef, rawLandmarks, processResults } = useEyeTracking();
  const { speak, cancel: cancelSpeech, isVoiceEnabled, toggleSound } = useSpeech(true);
  const { smoothedPrediction, processFrameAI } = useStrabismusAI();

  // Frame results receiver (Runs MediaPipe Face Mesh, throttled AI, and active test distance calibration)
  const handleResults = useRef(null);
  useEffect(() => {
    handleResults.current = (results) => {
      const res = processResults(results);
      if (res && res.features) {
        processFrameAI(res.features);
      }

      // Evaluate distance with the active test's independent configuration
      const isGazePos = currentStep === 'GAZE_POSITION' || currentStep === 'GAZE_4_DIRECTIONS';
      const isCoverPos = currentStep === 'COVER_POSITION' || currentStep === 'POSITION';
      const isBrockPos = currentStep === 'BROCK_POSITION';

      if (isGazePos || isCoverPos || isBrockPos) {
        const testType = isGazePos ? 'GAZE_4_DIRECTIONS' : isBrockPos ? 'BROCK_STRING' : 'COVER_TEST';
        if (distanceTrackerRef.current.testType !== testType) {
          distanceTrackerRef.current.reset(testType);
        }

        const landmarks = results?.multiFaceLandmarks?.[0] || null;
        if (landmarks) {
          const report = distanceTrackerRef.current.update(landmarks);
          setPositionReport(report);
        } else {
          // No face detected fallback
          const report = estimateCameraDistance(null, 640, 480, testType);
          setPositionReport(report);
        }
      }
    };
  }, [currentStep, processResults, processFrameAI]);

  const { startLoop, stopLoop } = useFaceMesh((r) => handleResults.current?.(r));

  // Initialize camera or attach existing stream to newly mounted video node
  const initCamera = useCallback(async (videoNode = null) => {
    const videoEl = videoNode || videoRef.current;
    if (!videoEl) return;

    try {
      if (!isActive) {
        await startCam(videoEl);
      } else {
        await attachVideo(videoEl);
      }
      await startLoop(videoEl);
    } catch (err) {
      console.error('Camera startup error:', err);
    }
  }, [isActive, startCam, attachVideo, startLoop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLoop();
      stopCam();
      cancelSpeech();
    };
  }, [stopLoop, stopCam, cancelSpeech]);

  // Reset distance tracker when retrying position check
  const handlePositionRetry = useCallback(() => {
    const isGazePos = currentStep === 'GAZE_POSITION';
    const isBrockPos = currentStep === 'BROCK_POSITION';
    const testType = isGazePos ? 'GAZE_4_DIRECTIONS' : isBrockPos ? 'BROCK_STRING' : 'COVER_TEST';
    distanceTrackerRef.current.reset(testType);
    setPositionReport(null);
  }, [currentStep]);

  // Handler: Proceed from Gaze Position Check (15–20 cm) to Gaze 4 Directions
  const handleGazePositionProceed = useCallback(() => {
    if (!session || !positionReport || positionReport.status !== 'READY') return;

    updateGazePositionCheckData(session.sessionId, positionReport);
    logScreeningEvent(session.sessionId, 'GAZE_POSITION_READY', {
      estimatedDistanceCm: positionReport.estimatedDistanceCm,
      stableDistanceCm: positionReport.stableDistanceCm,
    });

    setCurrentStep('GAZE_4_DIRECTIONS');
  }, [session, positionReport]);

  // Handler: Complete Gaze 4 Directions and transition to Cover Test Position Check (33–40 cm)
  const handleGaze4DirectionsComplete = useCallback((gazeData) => {
    if (!session) return;

    updateGazeTrackingData(session.sessionId, gazeData);

    setSession((prev) => ({
      ...prev,
      gazeTracking: gazeData,
      strabismusResult: gazeData.strabismusResult || prev?.strabismusResult,
    }));

    // Switch tracker to Cover Test target range (33–40 cm)
    distanceTrackerRef.current.reset('COVER_TEST');
    setPositionReport(null);
    setCurrentStep('COVER_POSITION');

    if (speak) {
      speak('Giờ mình lùi ra xa một chút nghen.');
    }
  }, [session, speak]);

  // Handler: Proceed from Cover Test Position Check to Cover Test
  const handleCoverPositionProceed = useCallback(() => {
    if (!session || !positionReport || positionReport.status !== 'READY') return;

    updateCoverPositionCheckData(session.sessionId, positionReport);
    logScreeningEvent(session.sessionId, SCREENING_EVENTS.COVER_TEST_START, {
      estimatedDistanceCm: positionReport.estimatedDistanceCm,
      stableDistanceCm: positionReport.stableDistanceCm,
    });

    setCurrentStep('COVER');
  }, [session, positionReport]);

  // Handler: Complete Step 2 (Cover Test) -> Brock String is temporarily closed for improvement -> Go to Summary
  const handleCoverTestComplete = useCallback(
    (coverResult) => {
      if (!session) return;

      updateCoverTestData(session.sessionId, coverResult);
      logScreeningEvent(session.sessionId, SCREENING_EVENTS.COVER_TEST_COMPLETE, {
        validCycles: coverResult.validCycles,
      });

      const aiSignal = smoothedPrediction
        ? {
            normalScore: smoothedPrediction.normalScore,
            strabismusScore: smoothedPrediction.strabismusScore,
            confidence: smoothedPrediction.confidence,
          }
        : null;

      const finalSession = generateScreeningSummary(session.sessionId, aiSignal);
      finalizeScreeningSample(finalSession);
      setSession({
        ...finalSession,
        strabismusResult: session.strabismusResult || session.gazeTracking?.strabismusResult,
      });
      setCurrentStep('SUMMARY');
    },
    [session, smoothedPrediction]
  );

  const handleCoverImageCaptured = useCallback((artifact) => {
    if (session) setScreeningImage(session.sampleId, 'cover', artifact);
  }, [session]);

  // Handler: Restart entire screening flow
  const handleRestart = useCallback(() => {
    cancelSpeech();
    distanceTrackerRef.current.reset('GAZE_4_DIRECTIONS');
    const newSession = createBinocularSession();
    setSession(newSession);
    setPositionReport(null);
    setCurrentStep('GAZE_POSITION');
  }, [cancelSpeech]);

  return (
    <div className="binocular-screening-page">
      {/* Top Protocol Title Bar */}
      <div className="screening-page-header">
        <div className="screening-header-text">
          <h1 className="screening-page-title">Digital Binocular Vision Screening</h1>
          <p className="screening-page-subtitle">
            Quy trình sàng lọc tích hợp: Chụp 4 hướng mắt (15–20 cm) &rarr; Cover Test (33–40 cm) &rarr; Kết quả tổng hợp
          </p>
        </div>
      </div>

      {/* Persistent Step Progress Indicator */}
      <ScreeningProgress currentStep={currentStep} />

      {/* Active Step Container */}
      <div className="screening-step-container">
        {(currentStep === 'GAZE_POSITION' || currentStep === 'GAZE_POSITION_CHECK') && (
          <PositionCheck
            testType="GAZE_4_DIRECTIONS"
            videoRef={videoRef}
            stream={stream}
            landmarks={rawLandmarks}
            features={features}
            positionReport={positionReport}
            onProceed={handleGazePositionProceed}
            onRetry={handlePositionRetry}
            isActive={isActive}
            isLoading={isCamLoading}
            error={camError}
            onVideoReady={initCamera}
            speak={speak}
            isVoiceEnabled={isVoiceEnabled}
          />
        )}

        {currentStep === 'GAZE_4_DIRECTIONS' && (
          <Gaze4DirectionsStep
            videoRef={videoRef}
            stream={stream}
            landmarks={rawLandmarks}
            positionReport={positionReport}
            onComplete={handleGaze4DirectionsComplete}
            speak={speak}
            isVoiceEnabled={isVoiceEnabled}
            toggleSound={toggleSound}
            onVideoReady={initCamera}
          />
        )}

        {(currentStep === 'COVER_POSITION' || currentStep === 'POSITION') && (
          <PositionCheck
            testType="COVER_TEST"
            videoRef={videoRef}
            stream={stream}
            landmarks={rawLandmarks}
            features={features}
            positionReport={positionReport}
            onProceed={handleCoverPositionProceed}
            onRetry={handlePositionRetry}
            isActive={isActive}
            isLoading={isCamLoading}
            error={camError}
            onVideoReady={initCamera}
            speak={speak}
            isVoiceEnabled={isVoiceEnabled}
          />
        )}

        {currentStep === 'COVER' && (
          <CoverTestStep
            sessionId={session.sessionId}
            videoRef={videoRef}
            stream={stream}
            landmarks={rawLandmarks}
            quality={quality}
            latestFeaturesRef={latestFeaturesRef}
            latestQualityRef={latestQualityRef}
            onComplete={handleCoverTestComplete}
            speak={speak}
            isVoiceEnabled={isVoiceEnabled}
            toggleSound={toggleSound}
            onVideoReady={initCamera}
            positionReport={positionReport}
            onImageCaptured={handleCoverImageCaptured}
          />
        )}

        {(currentStep === 'BROCK_POSITION' || currentStep === 'BROCK') && (
          <div className="card stage-card-main" style={{ maxWidth: 640, margin: '40px auto', textAlign: 'center', padding: '36px 24px', background: 'var(--bg-surface, #0f172a)', borderRadius: 20, border: '1.5px solid rgba(245, 158, 11, 0.4)' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>⚙️</div>
            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 800, padding: '4px 14px', borderRadius: 999 }}>
              TÍNH NĂNG ĐANG CẢI TIẾN
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '16px 0 10px', color: '#ffffff' }}>
              Brock String đang được nâng cấp
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.94rem', lineHeight: 1.55, marginBottom: 26 }}>
              Hệ thống đang bảo trì và tinh chỉnh thuật toán mô phỏng 3D dây Brock String để đạt tiêu chuẩn y khoa cao nhất. Quý phụ huynh vui lòng bấm nút bên dưới để xem kết quả kiểm tra Che mắt (Cover Test).
            </p>
            <button
              type="button"
              className="btn btn-primary btn-large"
              style={{ width: '100%', maxWidth: 360, margin: '0 auto' }}
              onClick={() => {
                const finalSession = generateScreeningSummary(session.sessionId, null);
                finalizeScreeningSample(finalSession);
                setSession({ ...finalSession });
                setCurrentStep('SUMMARY');
              }}
            >
              Xem kết quả sàng lọc Cover Test ➜
            </button>
          </div>
        )}

        {currentStep === 'SUMMARY' && (
          <ScreeningSummary
            sessionData={session}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
