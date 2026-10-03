import React, { useState, useEffect, useRef, useCallback } from 'react';
import ScreeningProgress from './ScreeningProgress';
import ScreeningPreparationStep from './ScreeningPreparationStep';
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
  updatePreparationData,
  updateGazePositionCheckData,
  updateGazeTrackingData,
  updateCoverPositionCheckData,
  updateCoverTestData,
  generateScreeningSummary,
  logScreeningEvent,
} from '../../services/binocularScreeningService.js';
import {
  SCREENING_EVENTS,
  POSITION_STATUS,
} from '../../constants/binocularScreeningConfig.js';
import { finalizeScreeningSample, setScreeningImage } from '../../services/screeningDatasetService.js';
import { verifyFrameFreshness } from '../../services/cameraService.js';
import {
  RESEARCH_SCREENING_FLOW_ENABLED,
  getScreeningCameraConstraints,
  tryEnableTorchForResearch,
  validateResearchCameraSettings,
} from '../../constants/researchScreeningConfig.js';

/**
 * BinocularVisionScreening Component
 * Master Orchestrator for the unified Digital Binocular Vision Screening protocol:
 * GAZE_POSITION (20–25 cm) -> HIRSCHBERG PHOTO ->
 * COVER_POSITION (33–40 cm) -> COVER TEST -> BROCK_POSITION (20–25 cm) -> BROCK STRING -> SUMMARY
 */
export default function BinocularVisionScreening() {
  // Global Screening Step: 'GAZE_POSITION' | 'GAZE_4_DIRECTIONS' (Hirschberg) | 'COVER_POSITION' | 'COVER' | 'SUMMARY'
  const [currentStep, setCurrentStep] = useState(
    RESEARCH_SCREENING_FLOW_ENABLED ? 'PRECHECK' : 'GAZE_POSITION'
  );
  const [session, setSession] = useState(() => createBinocularSession());
  const [positionReport, setPositionReport] = useState(null);
  const [cameraValidationError, setCameraValidationError] = useState(null);

  // Stateful distance stability tracker for consecutive frame smoothing
  const distanceTrackerRef = useRef(new DistanceStabilityTracker('GAZE_4_DIRECTIONS'));

  // Video element ref
  const videoRef = useRef(null);
  const coverTrackingContextRef = useRef({ phase: null, coveredEye: null, trackedEye: null });
  const preparationDeviceRef = useRef(null);
  const lastDetectionTimeRef = useRef(0);
  const isRecoveringRef = useRef(false);

  // Vision, Hardware & Assistant Hooks
  const {
    stream,
    isActive,
    isLoading: isCamLoading,
    error: camError,
    start: startCam,
    stop: stopCam,
    attachVideo,
    checkHealth,
    recover: recoverCam,
  } = useCamera();
  const { quality, features, latestFeaturesRef, latestQualityRef, rawLandmarks, processResults } = useEyeTracking();
  const { speak, cancel: cancelSpeech, isVoiceEnabled, toggleSound } = useSpeech(true);
  const { smoothedPrediction, processFrameAI, inferenceFps, avgInferenceLatencyMs } = useStrabismusAI();

  // Frame results receiver (Runs MediaPipe Face Mesh, throttled AI, and active test distance calibration)
  const handleResults = useRef(null);
  useEffect(() => {
    handleResults.current = (results) => {
      const coverContext = currentStep === 'COVER' ? coverTrackingContextRef.current : null;
      const res = processResults(results, null, {
        coveredEye: coverContext?.coveredEye || null,
        trackedEye: coverContext?.trackedEye || null,
      });
      const aiFrameUsable =
        res?.features &&
        res?.quality?.aiFrameEligible &&
        currentStep !== 'COVER';
      if (aiFrameUsable) {
        processFrameAI(res.features);
      }

      // Evaluate distance with the active test's independent configuration
      const isGazePos = currentStep === 'GAZE_POSITION' || currentStep === 'GAZE_4_DIRECTIONS';
      const isCoverPos = currentStep === 'COVER_POSITION' || currentStep === 'POSITION';

      if (isGazePos || isCoverPos) {
        const testType = isGazePos ? 'GAZE_4_DIRECTIONS' : 'COVER_TEST';
        if (distanceTrackerRef.current.testType !== testType) {
          distanceTrackerRef.current.reset(testType);
        }

        const landmarks = results?.multiFaceLandmarks?.[0] || null;
        if (landmarks) {
          lastDetectionTimeRef.current = performance.now();
          const vW = videoRef.current?.videoWidth || 640;
          const vH = videoRef.current?.videoHeight || 480;
          const report = distanceTrackerRef.current.update(landmarks, vW, vH);
          setPositionReport(report);
        } else {
          lastDetectionTimeRef.current = 0;
          // No face detected fallback
          const vW = videoRef.current?.videoWidth || 640;
          const vH = videoRef.current?.videoHeight || 480;
          const report = estimateCameraDistance(null, vW, vH, testType);
          setPositionReport(report);
        }
      }
    };
  }, [currentStep, processResults, processFrameAI]);

  // Watchdog: Clear stale position report immediately if no face detected for > 350ms or video stalls
  useEffect(() => {
    const watchdog = setInterval(() => {
      const now = performance.now();
      const isPositionStep =
        currentStep === 'GAZE_POSITION' ||
        currentStep === 'COVER_POSITION' ||
        currentStep === 'POSITION' ||
        currentStep === 'BROCK_POSITION';
      if (!isPositionStep) return;

      const testType = currentStep === 'GAZE_POSITION' ? 'GAZE_4_DIRECTIONS' : 'COVER_TEST';
      const videoEl = videoRef.current;
      const vW = videoEl?.videoWidth || 640;
      const vH = videoEl?.videoHeight || 480;
      const isVideoStalled =
        !isActive || isCamLoading || !stream || !videoEl || videoEl.readyState < 2 || videoEl.paused;

      if (isVideoStalled || (lastDetectionTimeRef.current > 0 && now - lastDetectionTimeRef.current > 350)) {
        setPositionReport((prev) => {
          if (!prev || prev.status === POSITION_STATUS.NO_FACE || prev.status === POSITION_STATUS.INITIALIZING) {
            return prev;
          }
          const base = estimateCameraDistance(null, vW, vH, testType);
          return isVideoStalled
            ? { ...base, status: POSITION_STATUS.INITIALIZING, feedbackMessage: 'Đang kết nối camera...' }
            : base;
        });
        distanceTrackerRef.current.reset(testType);
      }
    }, 120);

    return () => clearInterval(watchdog);
  }, [currentStep, isActive, isCamLoading, stream]);

  const startLoopRef = useRef(null);
  const stopLoopRef = useRef(null);

  // Recovery handler for frozen/stale frames detected by useFaceMesh
  const handleStaleFrame = useCallback(async () => {
    if (isRecoveringRef.current) return;
    const videoEl = videoRef.current;
    if (!videoEl || !isActive) return;

    isRecoveringRef.current = true;
    console.warn('[BinocularVisionScreening] Stale frame detected. Attempting recovery...');
    stopLoopRef.current?.();

    try {
      const recoveredStream = await recoverCam(videoEl);
      if (recoveredStream && videoEl) {
        await startLoopRef.current?.(videoEl);
      }
    } catch (err) {
      console.error('[BinocularVisionScreening] Stale frame recovery failed:', err);
    } finally {
      isRecoveringRef.current = false;
    }
  }, [isActive, recoverCam]);

  const { startLoop, stopLoop, metrics: faceMeshMetrics } = useFaceMesh(
    (r) => handleResults.current?.(r),
    { onStaleFrame: handleStaleFrame }
  );

  useEffect(() => {
    startLoopRef.current = startLoop;
    stopLoopRef.current = stopLoop;
  }, [startLoop, stopLoop]);

  // Initialize camera or attach existing stream to newly mounted video node
  const initCamera = useCallback(async (videoNode = null) => {
    const videoEl = videoNode || videoRef.current;
    if (!videoEl) return;

    try {
      setCameraValidationError(null);
      let activeStream = stream;
      if (!isActive) {
        activeStream = await startCam(videoEl, getScreeningCameraConstraints());
      } else {
        await attachVideo(videoEl);
      }

      const track = activeStream?.getVideoTracks?.()[0] || null;
      const settings = track?.getSettings ? track.getSettings() : {};
      const validation = validateResearchCameraSettings(settings, videoEl);
      const torch = await tryEnableTorchForResearch(activeStream, preparationDeviceRef.current);

      setSession((prev) => ({
        ...prev,
        preparation: {
          ...(prev?.preparation || {}),
          cameraRuntime: {
            settings,
            validation,
            torch,
            checkedAt: new Date().toISOString(),
          },
        },
      }));

      if (!validation.valid && validation.width > 0) {
        console.warn(
          `[BinocularVisionScreening] Camera resolution ${validation.width}x${validation.height} is below recommended pilot target (${validation.minWidth}x${validation.minHeight}). Proceeding with current stream.`
        );
      }

      await startLoop(videoEl);
    } catch (err) {
      console.error('Camera startup error:', err);
      setCameraValidationError(
        err?.message || 'Không thể khởi động camera. Vui lòng kiểm tra quyền camera trong trình duyệt.'
      );
    }
  }, [isActive, startCam, attachVideo, startLoop, stream]);

  // iOS Safari / Mobile Browser Lifecycle: Handle Home, Control Center, App Switch, and Screen Lock
  useEffect(() => {
    let foregroundDebounceTimer = null;

    const handleBackground = () => {
      console.log('[BinocularVisionScreening] Background event: pausing detection loop.');
      if (foregroundDebounceTimer) {
        clearTimeout(foregroundDebounceTimer);
        foregroundDebounceTimer = null;
      }
      // 1. Pause detection loop so MediaPipe/ONNX do not execute in background
      stopLoop();
    };

    const handleForeground = () => {
      console.log('[BinocularVisionScreening] Foreground event: verifying camera & stream health.');
      if (foregroundDebounceTimer) clearTimeout(foregroundDebounceTimer);

      foregroundDebounceTimer = setTimeout(async () => {
        if (isRecoveringRef.current) return;
        const videoEl = videoRef.current;
        if (!videoEl) return;

        isRecoveringRef.current = true;
        try {
          // Step 1 - 5: Check MediaStream, tracks, readyState, enabled, muted, video dimensions
          const health = checkHealth();
          console.debug('[BinocularVisionScreening] Foreground camera health:', health);

          if (health.healthy) {
            // Step 6: Verify frame update
            await attachVideo(videoEl);
            if (videoEl.paused) {
              await videoEl.play().catch(() => {});
            }
            const isFresh = await verifyFrameFreshness(videoEl, 500);

            if (isFresh) {
              console.log('[BinocularVisionScreening] Camera is healthy and frames are updating. Resuming loop.');
              await startLoop(videoEl);
            } else {
              console.warn('[BinocularVisionScreening] Stream is live but frames stalled. Recovering camera...');
              stopLoop();
              const recovered = await recoverCam(videoEl);
              if (recovered) {
                await startLoop(videoEl);
              }
            }
          } else if (health.needsRestart || health.reason === 'TRACK_ENDED' || health.reason === 'STREAM_NULL') {
            // Step 8: Unhealthy -> restart camera (max 3 retries) -> attach stream -> wait for frame -> resume
            console.log('[BinocularVisionScreening] Camera unhealthy. Initiating restart recovery...');
            stopLoop();
            const recovered = await recoverCam(videoEl);
            if (recovered) {
              await startLoop(videoEl);
            }
          } else if (health.reason === 'TRACK_MUTED') {
            // iOS Safari temporary mute: wait up to 400ms for unmute
            console.log('[BinocularVisionScreening] Track temporarily muted on iOS Safari. Waiting for unfreeze...');
            await new Promise((r) => setTimeout(r, 350));
            const recheck = checkHealth();
            if (recheck.healthy) {
              await attachVideo(videoEl);
              await startLoop(videoEl);
            } else {
              const recovered = await recoverCam(videoEl);
              if (recovered) {
                await startLoop(videoEl);
              }
            }
          } else {
            // Re-attach video and start loop
            await attachVideo(videoEl);
            await startLoop(videoEl);
          }
        } catch (err) {
          console.error('[BinocularVisionScreening] Foreground recovery error:', err);
        } finally {
          isRecoveringRef.current = false;
        }
      }, 150);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        handleBackground();
      } else {
        handleForeground();
      }
    };

    const onPageHide = () => handleBackground();
    const onPageShow = () => handleForeground();
    const onWindowBlur = () => {
      if (document.hidden) {
        handleBackground();
      }
    };
    const onWindowFocus = () => {
      if (!document.hidden) {
        handleForeground();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);

    return () => {
      if (foregroundDebounceTimer) clearTimeout(foregroundDebounceTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [checkHealth, attachVideo, recoverCam, startLoop, stopLoop]);

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
    const testType = isGazePos ? 'GAZE_4_DIRECTIONS' : 'COVER_TEST';
    distanceTrackerRef.current.reset(testType);
    setPositionReport(null);
  }, [currentStep]);

  const handlePreparationComplete = useCallback((metadata) => {
    if (!session) return;

    updatePreparationData(session.sessionId, metadata);
    preparationDeviceRef.current = metadata.device;
    setSession((prev) => ({
      ...prev,
      preparation: metadata,
    }));
    setCurrentStep('GAZE_POSITION');
  }, [session]);

  // Handler: Proceed from Hirschberg position check (20–25 cm) to Hirschberg capture.
  const handleGazePositionProceed = useCallback(() => {
    if (!session || !positionReport || positionReport.status !== 'READY') return;

    updateGazePositionCheckData(session.sessionId, positionReport);
    logScreeningEvent(session.sessionId, 'GAZE_POSITION_READY', {
      estimatedDistanceCm: positionReport.estimatedDistanceCm,
      stableDistanceCm: positionReport.stableDistanceCm,
    });

    setCurrentStep('GAZE_4_DIRECTIONS');
  }, [session, positionReport]);

  // Handler: Complete Hirschberg capture and transition to Cover Test Position Check (33–40 cm)
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

  // Handler: Complete Step 2 (Cover Test) -> Proceed to Summary with both Gaze 4 Directions and Cover Test results
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
        gazeTracking: finalSession?.gazeTracking || session.gazeTracking,
        strabismusResult: finalSession?.strabismusResult || session.strabismusResult || session.gazeTracking?.strabismusResult,
      });
      setCurrentStep('SUMMARY');
    },
    [session, smoothedPrediction]
  );

  const handleCoverImageCaptured = useCallback((artifact) => {
    if (session) setScreeningImage(session.sampleId, 'cover', artifact);
  }, [session]);

  const handleCoverTrackingContextChange = useCallback((context) => {
    coverTrackingContextRef.current = context || { phase: null, coveredEye: null, trackedEye: null };
  }, []);

  // Handler: Restart entire screening flow
  const handleRestart = useCallback(() => {
    cancelSpeech();
    distanceTrackerRef.current.reset('GAZE_4_DIRECTIONS');
    const newSession = createBinocularSession();
    setSession(newSession);
    setPositionReport(null);
    setCameraValidationError(null);
    setCurrentStep(RESEARCH_SCREENING_FLOW_ENABLED ? 'PRECHECK' : 'GAZE_POSITION');
  }, [cancelSpeech]);

  return (
    <div className="binocular-screening-page">
      {/* Top Protocol Title Bar */}
      <div className="screening-page-header">
        <div className="screening-header-text">
          <h1 className="screening-page-title">RemiCare Eye Screening</h1>
          <p className="screening-page-subtitle">
            Làm theo giọng nói và giữ mắt trong khung camera.
          </p>
        </div>
      </div>

      {/* Persistent Step Progress Indicator */}
      <ScreeningProgress currentStep={currentStep} />

      {/* Active Step Container */}
      <div className="screening-step-container">
        {currentStep === 'PRECHECK' && (
          <ScreeningPreparationStep
            onComplete={handlePreparationComplete}
            speak={speak}
            isVoiceEnabled={isVoiceEnabled}
          />
        )}

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
            error={cameraValidationError || camError}
            onCameraActivate={initCamera}
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
            preparationData={session?.preparation}
            sessionId={session?.sessionId}
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
            error={cameraValidationError || camError}
            onCameraActivate={initCamera}
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
            faceMeshMetrics={faceMeshMetrics}
            aiMetrics={{ inferenceFps, avgInferenceLatencyMs }}
            onImageCaptured={handleCoverImageCaptured}
            onTrackingContextChange={handleCoverTrackingContextChange}
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
