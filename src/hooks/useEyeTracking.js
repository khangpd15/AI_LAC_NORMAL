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

  const latestFeaturesRef = useRef(null);
  const latestLandmarksRef = useRef(null);
  const latestQualityRef = useRef(quality);

  const processResults = useCallback((results) => {
    const multiLm = results?.multiFaceLandmarks;
    const qualityReport = validateEyeTrackingQuality(multiLm);

    latestQualityRef.current = qualityReport;
    setQuality(qualityReport);

    if (!multiLm || multiLm.length === 0 || !multiLm[0]) {
      setFeatures(null);
      setRawLandmarks(null);
      latestFeaturesRef.current = null;
      latestLandmarksRef.current = null;
      return null;
    }

    const lm = multiLm[0];
    const extracted = extractEyeFeatures(lm, performance.now());

    latestFeaturesRef.current = extracted;
    latestLandmarksRef.current = lm;

    setFeatures(extracted);
    setRawLandmarks(lm);

    return { features: extracted, landmarks: lm, quality: qualityReport };
  }, []);

  const reset = useCallback(() => {
    setFeatures(null);
    setRawLandmarks(null);
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
    latestFeaturesRef,
    latestLandmarksRef,
    latestQualityRef,
    processResults,
    reset,
  };
}
