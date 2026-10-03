import { useState, useEffect, useRef, useCallback } from 'react';
import {
  initializeFaceMesh,
  sendFrameToFaceMesh,
  setFaceMeshResultsCallback,
} from '../services/faceMeshService';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function getDeviceProcessingProfile() {
  if (typeof navigator === 'undefined') {
    return { tier: 'mid', targetLandmarkFps: 30, minLandmarkFps: 24 };
  }

  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

  if (!isMobile && cores >= 8 && memory >= 8) {
    return { tier: 'high', targetLandmarkFps: 60, minLandmarkFps: 30 };
  }
  if (cores <= 4 || memory <= 3) {
    return { tier: 'low', targetLandmarkFps: 24, minLandmarkFps: 18 };
  }
  return { tier: 'mid', targetLandmarkFps: isMobile ? 30 : 45, minLandmarkFps: 24 };
}

function resolveAdaptiveIntervalMs(profile, avgLatencyMs, configuredMaxFps = null) {
  const maxFps = configuredMaxFps || profile.targetLandmarkFps;
  const minFps = profile.minLandmarkFps;
  let targetFps = maxFps;

  if (avgLatencyMs > 45) {
    targetFps = Math.min(targetFps, minFps);
  } else if (avgLatencyMs > 28) {
    targetFps = Math.min(targetFps, 30);
  }

  targetFps = clamp(targetFps, minFps, maxFps);
  return 1000 / targetFps;
}

/**
 * Custom hook for MediaPipe FaceMesh processing loop
 * @param {Function} onResults
 * @param {Object} options
 */
export function useFaceMesh(onResults, options = {}) {
  const maxLandmarkFps = options?.maxLandmarkFps ?? null;
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState({
    deviceTier: 'mid',
    cameraFps: 0,
    processingFps: 0,
    landmarkFps: 0,
    avgLandmarkLatencyMs: 0,
    droppedFramePercent: 0,
    totalFrames: 0,
    processedFrames: 0,
  });

  const faceMeshRef = useRef(null);
  const rafIdRef = useRef(null);
  const isLoopRunningRef = useRef(false);
  const onResultsRef = useRef(onResults);
  const deviceProfileRef = useRef(getDeviceProcessingProfile());
  const metricsRef = useRef({
    decodedFrames: 0,
    processedFrames: 0,
    droppedFrames: 0,
    lastMetricsTime: 0,
    lastFrameTimestamp: null,
    cameraFpsWindow: [],
    latencyWindow: [],
    avgLatencyMs: 0,
  });

  // Keep callback ref and service callback updated without triggering re-initialization
  useEffect(() => {
    onResultsRef.current = onResults;
    setFaceMeshResultsCallback((results) => {
      if (onResultsRef.current) {
        onResultsRef.current(results);
      }
    });
  }, [onResults]);

  const init = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const instance = await initializeFaceMesh((results) => {
        if (onResultsRef.current) {
          onResultsRef.current(results);
        }
      }, options);

      faceMeshRef.current = instance;
      setIsReady(true);
      setIsLoading(false);
      return instance;
    } catch (err) {
      console.error('FaceMesh init error:', err);
      setError(err.message || 'Không thể khởi tạo MediaPipe Face Mesh.');
      setIsLoading(false);
      throw err;
    }
  }, [options]);

  const onStaleFrameRef = useRef(options?.onStaleFrame);
  useEffect(() => {
    onStaleFrameRef.current = options?.onStaleFrame;
  }, [options?.onStaleFrame]);

  const videoElementRef = useRef(null);
  const isSendingRef = useRef(false);
  const lastSendTimeRef = useRef(0);
  const lastProcessedFrameTimestampRef = useRef(-Infinity);
  const rvfcIdRef = useRef(null);
  const lastFrameTimestampRef = useRef(0);
  const lastFreshFrameTimeRef = useRef(performance.now());
  const lastVideoCurrentTimeRef = useRef(-1);
  const loopGenerationRef = useRef(0);
  const isPausedRef = useRef(false);

  // Listen to visibilitychange to immediately suspend MediaPipe/ONNX execution in background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        isPausedRef.current = true;
      } else {
        isPausedRef.current = false;
        lastFreshFrameTimeRef.current = performance.now();
        // Resume video playback if needed
        if (videoElementRef.current?.paused && videoElementRef.current?.srcObject) {
          videoElementRef.current.play().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Frame freshness watchdog (runs every 600ms to detect frozen video frames)
  useEffect(() => {
    const freshnessTimer = setInterval(() => {
      if (
        isLoopRunningRef.current &&
        !isPausedRef.current &&
        typeof document !== 'undefined' &&
        !document.hidden
      ) {
        const v = videoElementRef.current;
        if (v && v.readyState >= 2 && !v.paused) {
          const now = performance.now();
          if (now - lastFreshFrameTimeRef.current > 2400) {
            console.warn('[FaceMesh] Stale frame detected (> 2.4s without advance). Triggering recovery.');
            lastFreshFrameTimeRef.current = now - 1000; // throttle repeated alarms
            onStaleFrameRef.current?.();
          }
        }
      }
    }, 600);
    return () => clearInterval(freshnessTimer);
  }, []);

  // Check support for requestVideoFrameCallback (Chrome 83+, Edge 83+, Firefox 132+)
  // Safari iOS < 18 requires requestAnimationFrame fallback
  const supportsRVFC = typeof HTMLVideoElement !== 'undefined' && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

  const stopLoop = useCallback(() => {
    loopGenerationRef.current += 1;
    isLoopRunningRef.current = false;
    isSendingRef.current = false;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (rvfcIdRef.current !== null && videoElementRef.current?.cancelVideoFrameCallback) {
      videoElementRef.current.cancelVideoFrameCallback(rvfcIdRef.current);
      rvfcIdRef.current = null;
    }
  }, []);

  const startLoop = useCallback(async (videoElement) => {
    if (!videoElement) return;

    // Increment loop generation counter: guarantees ONLY ONE ACTIVE DETECTION LOOP
    loopGenerationRef.current += 1;
    const currentLoopGen = loopGenerationRef.current;

    videoElementRef.current = videoElement;
    isSendingRef.current = false;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (rvfcIdRef.current !== null && videoElement.cancelVideoFrameCallback) {
      videoElement.cancelVideoFrameCallback(rvfcIdRef.current);
      rvfcIdRef.current = null;
    }

    if (!faceMeshRef.current) {
      await init();
    }

    setFaceMeshResultsCallback((results) => {
      if (onResultsRef.current) {
        if (results && typeof results === 'object') {
          results.presentationTime = lastFrameTimestampRef.current;
        }
        onResultsRef.current(results, lastFrameTimestampRef.current);
      }
    });

    isLoopRunningRef.current = true;
    isPausedRef.current = false;
    lastFreshFrameTimeRef.current = performance.now();
    lastVideoCurrentTimeRef.current = -1;

    if (!metricsRef.current.lastMetricsTime) {
      metricsRef.current.lastMetricsTime = performance.now();
    }

    // Common frame dispatch with lock, adaptive pacing, and watchdog
    const processSingleFrame = async (frameTimestamp) => {
      // Abort immediately if backgrounded, loop stopped, or superseded by newer loop instance
      if (
        isPausedRef.current ||
        (typeof document !== 'undefined' && document.hidden) ||
        !isLoopRunningRef.current ||
        loopGenerationRef.current !== currentLoopGen
      ) {
        return;
      }

      const currentVideo = videoElementRef.current;
      if (!currentVideo) return;

      const clockNow = performance.now();

      // Track frame freshness via video.currentTime progress
      const curTime = currentVideo.currentTime;
      if (curTime !== lastVideoCurrentTimeRef.current) {
        lastFreshFrameTimeRef.current = clockNow;
        lastVideoCurrentTimeRef.current = curTime;
      }

      const metric = metricsRef.current;
      metric.decodedFrames += 1;

      if (metric.lastFrameTimestamp !== null) {
        const frameDt = frameTimestamp - metric.lastFrameTimestamp;
        if (frameDt > 0 && frameDt < 1000) {
          metric.cameraFpsWindow.push(1000 / frameDt);
          if (metric.cameraFpsWindow.length > 45) metric.cameraFpsWindow.shift();
        }
      }
      metric.lastFrameTimestamp = frameTimestamp;

      const flushMetricsIfNeeded = () => {
        if (clockNow - metric.lastMetricsTime < 1000) return;
        const elapsedSec = Math.max(0.001, (clockNow - metric.lastMetricsTime) / 1000);
        const totalFrames = metric.decodedFrames;
        const processedFrames = metric.processedFrames;
        const cameraFps = metric.cameraFpsWindow.length
          ? Math.round(metric.cameraFpsWindow.reduce((a, b) => a + b, 0) / metric.cameraFpsWindow.length)
          : 0;
        const processingFps = Math.round(processedFrames / elapsedSec);
        const droppedPercent = totalFrames > 0
          ? Math.round((metric.droppedFrames / totalFrames) * 100)
          : 0;

        setMetrics({
          deviceTier: deviceProfileRef.current.tier,
          cameraFps,
          processingFps,
          landmarkFps: processingFps,
          avgLandmarkLatencyMs: Number(metric.avgLatencyMs.toFixed(1)),
          droppedFramePercent: droppedPercent,
          totalFrames,
          processedFrames,
        });

        metric.decodedFrames = 0;
        metric.processedFrames = 0;
        metric.droppedFrames = 0;
        metric.lastMetricsTime = clockNow;
      };

      // Auto-resume playback if stream is attached but video is paused
      if (currentVideo.paused && currentVideo.srcObject) {
        currentVideo.play().catch(() => {});
      }

      // Safety watchdog: if isSending was stuck for > 2000ms, unlock it
      if (isSendingRef.current && clockNow - lastSendTimeRef.current > 2000) {
        console.warn('[FaceMesh] Watchdog: Resetting stuck isSending lock');
        isSendingRef.current = false;
      }

      const adaptiveIntervalMs = resolveAdaptiveIntervalMs(
        deviceProfileRef.current,
        metric.avgLatencyMs,
        maxLandmarkFps
      );
      const elapsedSinceLastProcess = frameTimestamp - lastProcessedFrameTimestampRef.current;
      if (elapsedSinceLastProcess < adaptiveIntervalMs) {
        metric.droppedFrames += 1;
        flushMetricsIfNeeded();
        return;
      }

      if (
        !isSendingRef.current &&
        currentVideo.readyState >= 2 &&
        currentVideo.videoWidth > 0 &&
        !currentVideo.paused &&
        faceMeshRef.current
      ) {
        isSendingRef.current = true;
        lastSendTimeRef.current = clockNow;
        lastFrameTimestampRef.current = frameTimestamp;
        lastProcessedFrameTimestampRef.current = frameTimestamp;
        const sendStart = performance.now();
        try {
          await sendFrameToFaceMesh(faceMeshRef.current, currentVideo);
          const latency = performance.now() - sendStart;
          metric.latencyWindow.push(latency);
          if (metric.latencyWindow.length > 30) metric.latencyWindow.shift();
          metric.avgLatencyMs = metric.latencyWindow.reduce((a, b) => a + b, 0) / metric.latencyWindow.length;
          metric.processedFrames += 1;
        } catch (err) {
          console.warn('[FaceMesh] sendFrame error:', err);
        } finally {
          isSendingRef.current = false;
        }
      } else if (isSendingRef.current) {
        metric.droppedFrames += 1;
      }

      flushMetricsIfNeeded();
    };

    if (supportsRVFC && typeof videoElement.requestVideoFrameCallback === 'function') {
      // Progressive enhancement: requestVideoFrameCallback
      const tickRVFC = async (now, metadata) => {
        if (!isLoopRunningRef.current || loopGenerationRef.current !== currentLoopGen) return;
        const currentVideo = videoElementRef.current;
        if (!currentVideo) return;

        lastFreshFrameTimeRef.current = performance.now();

        // Extract presentationTime from metadata when available
        const frameTimestamp = (metadata && typeof metadata.presentationTime === 'number')
          ? metadata.presentationTime
          : now;

        await processSingleFrame(frameTimestamp);

        if (isLoopRunningRef.current && loopGenerationRef.current === currentLoopGen && currentVideo?.requestVideoFrameCallback) {
          rvfcIdRef.current = currentVideo.requestVideoFrameCallback(tickRVFC);
        }
      };

      rvfcIdRef.current = videoElement.requestVideoFrameCallback(tickRVFC);
    } else {
      // Fallback: requestAnimationFrame
      const tickRAF = async (rafTimestamp) => {
        if (!isLoopRunningRef.current || loopGenerationRef.current !== currentLoopGen) return;
        const currentVideo = videoElementRef.current;
        if (!currentVideo) return;

        const frameTimestamp = typeof rafTimestamp === 'number' ? rafTimestamp : performance.now();
        await processSingleFrame(frameTimestamp);

        if (isLoopRunningRef.current && loopGenerationRef.current === currentLoopGen) {
          rafIdRef.current = requestAnimationFrame(tickRAF);
        }
      };

      rafIdRef.current = requestAnimationFrame(tickRAF);
    }
  }, [init, supportsRVFC, maxLandmarkFps]);

  // Clean up loop on unmount (shared instance is preserved)
  useEffect(() => {
    return () => {
      isLoopRunningRef.current = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (rvfcIdRef.current !== null && videoElementRef.current?.cancelVideoFrameCallback) {
        videoElementRef.current.cancelVideoFrameCallback(rvfcIdRef.current);
        rvfcIdRef.current = null;
      }
    };
  }, []);

  return {
    isReady,
    isLoading,
    error,
    supportsRVFC,
    metrics,
    init,
    startLoop,
    stopLoop,
  };
}
