import { useState, useCallback, useRef } from 'react';
import {
  validateEyeTrackingQuality,
  extractEyeFeatures,
  buildFrameQualityGate,
} from '../services/eyeFeatureService';

/**
 * Custom hook to process FaceMesh results and extract valid eye tracking features
 */
export function useEyeTracking() {
  const [quality, setQuality] = useState({
    isValid: false,
    reason: 'Chưa khởi động camera',
    faceDetected: false,
    leftEyeDetected: false,
    rightEyeDetected: false,
    irisValid: false,
  });

  const [features, setFeatures] = useState(null);
  const [rawLandmarks, setRawLandmarks] = useState(null);
  const [smoothedLandmarks, setSmoothedLandmarks] = useState(null);

  const latestFeaturesRef = useRef(null);
  const latestLandmarksRef = useRef(null);
  const latestRawLandmarksRef = useRef(null);
  const latestQualityRef = useRef(quality);
  const lastStateSyncRef = useRef(0);
  const frameTimeWindowRef = useRef([]);
  const lastFrameTimestampRef = useRef(null);
  const invalidFrameStreakRef = useRef(0);

  const withRecoveryState = (qualityReport) => {
    // ERROR RECOVERY
    if (qualityReport.frameValid || qualityReport.isValid) {
      const wasInvalid = invalidFrameStreakRef.current > 0;
      invalidFrameStreakRef.current = 0;
      return {
        ...qualityReport,
        recoveryState: wasInvalid ? 'RECOVERING' : 'RUNNING',
        invalidFrameStreak: 0,
      };
    }
    invalidFrameStreakRef.current += 1;
    const streak = invalidFrameStreakRef.current;
    return {
      ...qualityReport,
      recoveryState: streak >= 10 ? 'TEMPORARILY_INVALID' : streak >= 3 ? 'WARNING' : 'RUNNING',
      invalidFrameStreak: streak,
    };
  };

  const processResults = useCallback((results, frameTimestamp = null, qualityOptions = {}) => {
    const multiLm = results?.multiFaceLandmarks;
    const baseQualityReport = validateEyeTrackingQuality(multiLm, qualityOptions);
    const now = performance.now();

    if (!multiLm || multiLm.length === 0 || !multiLm[0]) {
      const qualityReport = withRecoveryState(buildFrameQualityGate(baseQualityReport, null, qualityOptions));
      const previousQuality = latestQualityRef.current;
      latestQualityRef.current = qualityReport;
      const becameInvalid = previousQuality?.isValid !== false && qualityReport.isValid === false;
      const shouldSyncState = now - lastStateSyncRef.current >= 100 || becameInvalid;
      if (shouldSyncState) {
        lastStateSyncRef.current = now;
        setQuality(qualityReport);
        setFeatures(null);
        setRawLandmarks(null);
        setSmoothedLandmarks(null);
      }
      latestFeaturesRef.current = null;
      latestLandmarksRef.current = null;
      latestRawLandmarksRef.current = null;
      return null;
    }

    const lm = multiLm[0];
    // Resolve timestamp: prefer explicit frameTimestamp or results.presentationTime (rVFC), fallback to performance.now()
    const timestamp = (typeof frameTimestamp === 'number' && Number.isFinite(frameTimestamp))
      ? frameTimestamp
      : ((results && typeof results.presentationTime === 'number' && Number.isFinite(results.presentationTime))
          ? results.presentationTime
          : performance.now());

    // FPS CALCULATION
    if (lastFrameTimestampRef.current !== null) {
      const dt = timestamp - lastFrameTimestampRef.current;
      if (dt > 0 && dt < 1000) {
        frameTimeWindowRef.current.push(1000 / dt);
        if (frameTimeWindowRef.current.length > 30) frameTimeWindowRef.current.shift();
      }
    }
    lastFrameTimestampRef.current = timestamp;
    const trackingFps = frameTimeWindowRef.current.length
      ? frameTimeWindowRef.current.reduce((a, b) => a + b, 0) / frameTimeWindowRef.current.length
      : null;

    const extracted = extractEyeFeatures(lm, timestamp, {
      applySmoothing: true,
      coveredEye: qualityOptions.coveredEye || null,
    });
    const qualityReport = withRecoveryState(buildFrameQualityGate(baseQualityReport, extracted, {
      ...qualityOptions,
      fps: trackingFps,
    }));

    const previousQuality = latestQualityRef.current;
    latestQualityRef.current = qualityReport;
    const becameInvalid = previousQuality?.isValid !== false && qualityReport.isValid === false;
    const shouldSyncState = now - lastStateSyncRef.current >= 100 || becameInvalid;

    latestFeaturesRef.current = extracted;
    latestLandmarksRef.current = lm;
    latestRawLandmarksRef.current = lm;

    if (shouldSyncState) {
      lastStateSyncRef.current = now;
      setQuality(qualityReport);
      setFeatures(extracted);
      setRawLandmarks(lm);
      setSmoothedLandmarks(lm);
    }

    return { features: extracted, landmarks: lm, quality: qualityReport, timestamp };
  }, []);

  const reset = useCallback(() => {
    setFeatures(null);
    setRawLandmarks(null);
    setSmoothedLandmarks(null);
    setQuality({
      isValid: false,
      reason: 'Chưa bắt đầu',
      faceDetected: false,
      leftEyeDetected: false,
      rightEyeDetected: false,
      irisValid: false,
    });
    latestFeaturesRef.current = null;
    latestLandmarksRef.current = null;
    latestRawLandmarksRef.current = null;
    frameTimeWindowRef.current = [];
    lastFrameTimestampRef.current = null;
    invalidFrameStreakRef.current = 0;
  }, []);

  return {
    quality,
    features,
    rawLandmarks,
    smoothedLandmarks,
    latestFeaturesRef,
    latestLandmarksRef,
    latestRawLandmarksRef,
    latestQualityRef,
    processResults,
    reset,
  };
}
