import { useState, useCallback, useRef } from 'react';
import {
  validateEyeTrackingQuality,
  extractEyeFeatures,
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

  const processResults = useCallback((results, frameTimestamp = null, qualityOptions = {}) => {
    const multiLm = results?.multiFaceLandmarks;
    const qualityReport = validateEyeTrackingQuality(multiLm, qualityOptions);

    const previousQuality = latestQualityRef.current;
    latestQualityRef.current = qualityReport;
    const now = performance.now();
    const becameInvalid = previousQuality?.isValid !== false && qualityReport.isValid === false;
    const shouldSyncState = now - lastStateSyncRef.current >= 100 || becameInvalid;

    if (!multiLm || multiLm.length === 0 || !multiLm[0]) {
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

    const extracted = extractEyeFeatures(lm, timestamp, { applySmoothing: true });

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
