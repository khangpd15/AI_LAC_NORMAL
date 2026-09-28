import React, { useState, useEffect, useRef, useCallback } from 'react';
import ScreeningProgress from './ScreeningProgress';
import PositionCheck from './PositionCheck';
import CoverTestStep from './CoverTestStep';
import BrockStringStep from './BrockStringStep';
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
  updateCoverPositionCheckData,
  updateBrockPositionCheckData,
  updateCoverTestData,
  updateBrockStringData,
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
 * COVER_POSITION (33–40 cm) -> COVER TEST -> BROCK_POSITION (20–25 cm) -> BROCK STRING -> SUMMARY
 */
export default function BinocularVisionScreening() {
  // Global Screening Step: 'COVER_POSITION' | 'COVER' | 'BROCK_POSITION' | 'BROCK' | 'SUMMARY'
  const [currentStep, setCurrentStep] = useState('COVER_POSITION');
  const [session, setSession] = useState(() => createBinocularSession());
  const [positionReport, setPositionReport] = useState(null);

  // Stateful distance stability tracker for consecutive frame smoothing
  const distanceTrackerRef = useRef(new DistanceStabilityTracker('COVER_TEST'));

  // Video element ref
  const videoRef = useRef(null);

  // Vision, Hardware & Assistant Hooks
  const { stream, isActive, isLoading: isCamLoading, error: camError, start: startCam, stop: stopCam, attachVideo } = useCamera();
  const { quality, latestFeaturesRef, latestQualityRef, rawLandmarks, processResults } = useEyeTracking();
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

      // If in a Position Check step, evaluate distance with the active test's independent configuration
      const isCoverPos = currentStep === 'COVER_POSITION' || currentStep === 'POSITION';
      const isBrockPos = currentStep === 'BROCK_POSITION';

      if (isCoverPos || isBrockPos) {
        const testType = isBrockPos ? 'BROCK_STRING' : 'COVER_TEST';
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
    const isBrockPos = currentStep === 'BROCK_POSITION';
    const testType = isBrockPos ? 'BROCK_STRING' : 'COVER_TEST';
    distanceTrackerRef.current.reset(testType);
    setPositionReport(null);
  }, [currentStep]);

  // Handler: Proceed from Cover Test Position Check to Cover Test
  const handleCoverPositionProceed = useCallback(() => {
    if (!session || !positionReport || positionReport.status !== 'READY') return;

    updateCoverPositionCheckData(session.sessionId, positionReport);
    logScreeningEvent(session.sessionId, SCREENING_EVENTS.COVER_TEST_START, {
      estimatedDistanceCm: positionReport.estimatedDistanceCm,
      stableDistanceCm: positionReport.stableDistanceCm,
    });

    setCurrentStep('COVER');
    if (speak) {
      speak('Vị trí đã sẵn sàng. Chuyển sang bài kiểm tra Cover Test.');
    }
  }, [session, positionReport, speak]);

  // Handler: Complete Step 2 (Cover Test) and proceed to Step 3 (Brock String Position Check)
  const handleCoverTestComplete = useCallback(
    (coverResult) => {
      if (!session) return;

      updateCoverTestData(session.sessionId, coverResult);
      logScreeningEvent(session.sessionId, SCREENING_EVENTS.COVER_TEST_COMPLETE, {
        validCycles: coverResult.validCycles,
      });

      // Clear Cover Test distance state and switch tracker to Brock String target (20–25 cm)
      distanceTrackerRef.current.reset('BROCK_STRING');
      setPositionReport(null);
      setCurrentStep('BROCK_POSITION');

      if (speak) {
        speak('Cover Test hoàn tất. Hãy điều chỉnh khoảng cách cho bài kiểm tra Brock String.');
      }
    },
    [session, speak]
  );

  // Handler: Proceed from Brock String Position Check to Brock String
  const handleBrockPositionProceed = useCallback(() => {
    if (!session || !positionReport || positionReport.status !== 'READY') return;

    updateBrockPositionCheckData(session.sessionId, positionReport);
    logScreeningEvent(session.sessionId, SCREENING_EVENTS.BROCK_STRING_START, {
      estimatedDistanceCm: positionReport.estimatedDistanceCm,
      stableDistanceCm: positionReport.stableDistanceCm,
    });

    setCurrentStep('BROCK');
    if (speak) {
      speak('Vị trí đã sẵn sàng. Bắt đầu bài kiểm tra Brock String.');
    }
  }, [session, positionReport, speak]);

  const handleCoverImageCaptured = useCallback((artifact) => {
    if (session) setScreeningImage(session.sampleId, 'cover', artifact);
  }, [session]);

  const handleBrockImageCaptured = useCallback((artifact) => {
    if (session) setScreeningImage(session.sampleId, 'brock', artifact);
  }, [session]);

  // Handler: Complete Step 4 (Brock String) and proceed to Step 5 (Summary)
  const handleBrockStringComplete = useCallback(
    (brockResult) => {
      if (!session) return;

      updateBrockStringData(session.sessionId, brockResult);

      const aiSignal = smoothedPrediction
        ? {
            // BUG-02 FIX: correct field names from useStrabismusAI hook
            normalScore: smoothedPrediction.normalScore,
            strabismusScore: smoothedPrediction.strabismusScore,
            confidence: smoothedPrediction.confidence,
          }
        : null;

      const finalSession = generateScreeningSummary(session.sessionId, aiSignal);
      finalizeScreeningSample(finalSession);
      setSession({ ...finalSession });
      setCurrentStep('SUMMARY');

      if (speak) {
        speak('Hoàn tất toàn bộ quy trình sàng lọc. Đang hiển thị kết quả.');
      }
    },
    [session, smoothedPrediction, speak]
  );

  // Handler: Restart entire screening flow
  const handleRestart = useCallback(() => {
    cancelSpeech();
    distanceTrackerRef.current.reset('COVER_TEST');
    const newSession = createBinocularSession();
    setSession(newSession);
    setPositionReport(null);
    setCurrentStep('COVER_POSITION');
  }, [cancelSpeech]);

  return (
    <div className="binocular-screening-page">
      {/* Top Protocol Title Bar */}
      <div className="screening-page-header">
        <div className="screening-header-text">
          <h1 className="screening-page-title">Digital Binocular Vision Screening</h1>
          <p className="screening-page-subtitle">
            Quy trình sàng lọc thị giác hai mắt tích hợp: Vị trí Cover Test &rarr; Cover Test &rarr; Vị trí Brock String &rarr; Brock String &rarr; Tổng hợp kết quả
          </p>
        </div>
      </div>

      {/* Persistent Step Progress Indicator */}
      <ScreeningProgress currentStep={currentStep} />

      {/* Active Step Container */}
      <div className="screening-step-container">
        {(currentStep === 'COVER_POSITION' || currentStep === 'POSITION') && (
          <PositionCheck
            testType="COVER_TEST"
            videoRef={videoRef}
            stream={stream}
            landmarks={rawLandmarks}
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

        {currentStep === 'BROCK_POSITION' && (
          <PositionCheck
            testType="BROCK_STRING"
            videoRef={videoRef}
            stream={stream}
            landmarks={rawLandmarks}
            positionReport={positionReport}
            onProceed={handleBrockPositionProceed}
            onRetry={handlePositionRetry}
            isActive={isActive}
            isLoading={isCamLoading}
            error={camError}
            onVideoReady={initCamera}
            speak={speak}
            isVoiceEnabled={isVoiceEnabled}
          />
        )}

        {currentStep === 'BROCK' && (
          <BrockStringStep
            videoRef={videoRef}
            stream={stream}
            landmarks={rawLandmarks}
            quality={quality}
            positionReport={positionReport}
            onImageCaptured={handleBrockImageCaptured}
            onComplete={handleBrockStringComplete}
            speak={speak}
            isVoiceEnabled={isVoiceEnabled}
            toggleSound={toggleSound}
            onVideoReady={initCamera}
          />
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
