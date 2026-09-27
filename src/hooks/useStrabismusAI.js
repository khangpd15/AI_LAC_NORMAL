import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getOrInitAISession,
  runAIInference,
} from '../services/aiInferenceService';

const INFERENCE_THROTTLE_MS = 100; // ~10 FPS target (range 5-15 FPS)
const SMOOTHING_WINDOW_SIZE = 8;    // moving average over last 8 predictions

/**
 * Custom hook for managing ONNX AI model lifecycle, throttled real-time inference, and smoothing
 */
export function useStrabismusAI(modelUrl = '/models/strabismus_model.onnx') {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Smoothed prediction exposed to React UI
  const [smoothedPrediction, setSmoothedPrediction] = useState({
    normalScore: 0.5,
    strabismusScore: 0.5,
    confidence: 0.5,
    predictedClass: 0,
    signalLabel: 'Đang theo dõi',
  });
  const [inferenceFps, setInferenceFps] = useState(0);

  // High-frequency mutable refs (Prevents expensive re-renders on every frame)
  const sessionRef = useRef(null);
  const isInferringRef = useRef(false);
  const lastInferenceTimeRef = useRef(0);
  const historyRef = useRef([]);
  const frameCountRef = useRef(0);
  const lastFpsCalcTimeRef = useRef(0);
  const latestRawRef = useRef(null);
  const latestSmoothedRef = useRef(smoothedPrediction);

  // 1. Initialize ONNX Model once on mount
  useEffect(() => {
    let isMounted = true;

    getOrInitAISession(modelUrl)
      .then((session) => {
        if (!isMounted) return;
        sessionRef.current = session;
        setIsReady(true);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[useStrabismusAI] AI Model load failed (Cover test will continue in fallback mode):', err);
        setError(err.message || 'Mô hình AI chưa sẵn sàng');
        setIsLoading(false);
        setIsReady(false);
      });

    return () => {
      isMounted = false;
    };
  }, [modelUrl]);

  /**
   * Throttled prediction function called from camera loop
   * @param {Object} eyeFeatures - Features object from extractEyeFeatures
   */
  const processFrameAI = useCallback(async (eyeFeatures) => {
    if (!sessionRef.current || !eyeFeatures) {
      return latestSmoothedRef.current;
    }

    const now = performance.now();

    // Throttle to 5-15 FPS (default 10 FPS = 100ms interval)
    if (now - lastInferenceTimeRef.current < INFERENCE_THROTTLE_MS) {
      return latestSmoothedRef.current;
    }

    if (isInferringRef.current) {
      return latestSmoothedRef.current; // Skip if previous run is still in-flight
    }

    isInferringRef.current = true;
    lastInferenceTimeRef.current = now;

    try {
      const pred = await runAIInference(eyeFeatures, sessionRef.current);
      latestRawRef.current = pred;

      // Maintain circular buffer for moving average smoothing
      const history = historyRef.current;
      history.push(pred);
      if (history.length > SMOOTHING_WINDOW_SIZE) {
        history.shift();
      }

      // Moving average calculation
      const avgStrabismus = history.reduce((acc, p) => acc + p.strabismusScore, 0) / history.length;
      const avgNormal = history.reduce((acc, p) => acc + p.normalScore, 0) / history.length;
      const avgConf = history.reduce((acc, p) => acc + p.confidence, 0) / history.length;

      const smoothed = {
        normalScore: Number(avgNormal.toFixed(3)),
        strabismusScore: Number(avgStrabismus.toFixed(3)),
        confidence: Number(avgConf.toFixed(3)),
        predictedClass: avgStrabismus >= 0.5 ? 1 : 0,
        signalLabel: avgStrabismus >= 0.5 ? 'Ghi nhận độ lệch AI' : 'Hướng nhìn cân đối',
        inferenceTimeMs: pred.inferenceTimeMs,
      };

      latestSmoothedRef.current = smoothed;

      // Measure FPS every 1000ms
      frameCountRef.current += 1;
      if (now - lastFpsCalcTimeRef.current >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / (now - lastFpsCalcTimeRef.current));
        setInferenceFps(fps);
        frameCountRef.current = 0;
        lastFpsCalcTimeRef.current = now;

        // Periodic state sync to avoid 60fps React render storms
        setSmoothedPrediction(smoothed);
      }
    } catch (err) {
      console.debug('[useStrabismusAI] Frame inference skipped:', err);
    } finally {
      isInferringRef.current = false;
    }

    return latestSmoothedRef.current;
  }, []);

  const reset = useCallback(() => {
    historyRef.current = [];
    latestRawRef.current = null;
    const initial = {
      normalScore: 0.5,
      strabismusScore: 0.5,
      confidence: 0.5,
      predictedClass: 0,
      signalLabel: 'Đang theo dõi',
    };
    latestSmoothedRef.current = initial;
    setSmoothedPrediction(initial);
  }, []);

  return {
    isReady,
    isLoading,
    error,
    smoothedPrediction,
    latestSmoothedRef,
    latestRawRef,
    inferenceFps,
    processFrameAI,
    reset,
  };
}
