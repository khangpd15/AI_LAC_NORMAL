import { useState, useEffect, useRef, useCallback } from 'react';
import {
  initializeFaceMesh,
  sendFrameToFaceMesh,
  setFaceMeshResultsCallback,
} from '../services/faceMeshService';

/**
 * Custom hook for MediaPipe FaceMesh processing loop
 * @param {Function} onResults
 * @param {Object} options
 */
export function useFaceMesh(onResults, options = {}) {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const faceMeshRef = useRef(null);
  const rafIdRef = useRef(null);
  const isLoopRunningRef = useRef(false);
  const onResultsRef = useRef(onResults);

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

  const videoElementRef = useRef(null);
  const isSendingRef = useRef(false);
  const lastSendTimeRef = useRef(0);
  const rvfcIdRef = useRef(null);
  const lastFrameTimestampRef = useRef(performance.now());

  // Check support for requestVideoFrameCallback (Chrome 83+, Edge 83+, Firefox 132+)
  // Safari iOS < 18 requires requestAnimationFrame fallback
  const supportsRVFC = typeof HTMLVideoElement !== 'undefined' && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

  const stopLoop = useCallback(() => {
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

    // Check if video element is changed or remounted
    const isNewVideo = videoElementRef.current !== videoElement;
    videoElementRef.current = videoElement;

    if (isNewVideo) {
      isSendingRef.current = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (rvfcIdRef.current !== null && videoElementRef.current?.cancelVideoFrameCallback) {
        videoElementRef.current.cancelVideoFrameCallback(rvfcIdRef.current);
        rvfcIdRef.current = null;
      }
      isLoopRunningRef.current = false;
    }

    if (!faceMeshRef.current) {
      await init();
    }

    setFaceMeshResultsCallback((results) => {
      if (onResultsRef.current) {
        // Attach browser-decoded frame timestamp to results object
        // Note: presentationTime is a DOMHighResTimeStamp from the browser compositor,
        // avoiding JS event loop jitter. It is NOT a camera sensor hardware clock.
        if (results && typeof results === 'object') {
          results.presentationTime = lastFrameTimestampRef.current;
        }
        onResultsRef.current(results, lastFrameTimestampRef.current);
      }
    });

    if (isLoopRunningRef.current && (rafIdRef.current || rvfcIdRef.current !== null)) {
      return;
    }
    isLoopRunningRef.current = true;
    isSendingRef.current = false;

    // Common frame dispatch with lock & watchdog
    const processSingleFrame = async (frameTimestamp) => {
      const currentVideo = videoElementRef.current;
      if (!currentVideo || !isLoopRunningRef.current) return;

      // Auto-resume playback if stream is attached but video is paused
      if (currentVideo.paused && currentVideo.srcObject) {
        currentVideo.play().catch(() => {});
      }

      // Safety watchdog: if isSending was stuck for > 1000ms, unlock it
      const clockNow = performance.now();
      if (isSendingRef.current && clockNow - lastSendTimeRef.current > 1000) {
        console.warn('[FaceMesh] Watchdog: Resetting stuck isSending lock');
        isSendingRef.current = false;
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
        try {
          await sendFrameToFaceMesh(faceMeshRef.current, currentVideo);
        } catch (err) {
          console.warn('[FaceMesh] sendFrame error:', err);
        } finally {
          isSendingRef.current = false;
        }
      }
    };

    if (supportsRVFC && typeof videoElement.requestVideoFrameCallback === 'function') {
      // Progressive enhancement: requestVideoFrameCallback
      const tickRVFC = async (now, metadata) => {
        if (!isLoopRunningRef.current) return;
        const currentVideo = videoElementRef.current;
        if (!currentVideo) return;

        // Extract presentationTime from metadata when available
        const frameTimestamp = (metadata && typeof metadata.presentationTime === 'number')
          ? metadata.presentationTime
          : now;

        await processSingleFrame(frameTimestamp);

        if (isLoopRunningRef.current && currentVideo?.requestVideoFrameCallback) {
          rvfcIdRef.current = currentVideo.requestVideoFrameCallback(tickRVFC);
        }
      };

      rvfcIdRef.current = videoElement.requestVideoFrameCallback(tickRVFC);
    } else {
      // Fallback: requestAnimationFrame
      const tickRAF = async (rafTimestamp) => {
        if (!isLoopRunningRef.current) return;
        const currentVideo = videoElementRef.current;
        if (!currentVideo) return;

        const frameTimestamp = typeof rafTimestamp === 'number' ? rafTimestamp : performance.now();
        await processSingleFrame(frameTimestamp);

        if (isLoopRunningRef.current) {
          rafIdRef.current = requestAnimationFrame(tickRAF);
        }
      };

      rafIdRef.current = requestAnimationFrame(tickRAF);
    }
  }, [init, supportsRVFC]);

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
    init,
    startLoop,
    stopLoop,
  };
}
