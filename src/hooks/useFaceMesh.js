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

  const stopLoop = useCallback(() => {
    isLoopRunningRef.current = false;
    isSendingRef.current = false;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
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
      isLoopRunningRef.current = false;
    }

    if (!faceMeshRef.current) {
      await init();
    }

    setFaceMeshResultsCallback((results) => {
      if (onResultsRef.current) {
        onResultsRef.current(results);
      }
    });

    if (isLoopRunningRef.current && rafIdRef.current) {
      return;
    }
    isLoopRunningRef.current = true;
    isSendingRef.current = false;

    const tick = async () => {
      if (!isLoopRunningRef.current) return;

      const currentVideo = videoElementRef.current;
      if (currentVideo) {
        // Auto-resume playback if stream is attached but video is paused
        if (currentVideo.paused && currentVideo.srcObject) {
          currentVideo.play().catch(() => {});
        }

        // Safety watchdog: if isSending was stuck for > 1000ms, unlock it
        const now = performance.now();
        if (isSendingRef.current && now - lastSendTimeRef.current > 1000) {
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
          lastSendTimeRef.current = performance.now();
          try {
            await sendFrameToFaceMesh(faceMeshRef.current, currentVideo);
          } catch (err) {
            console.warn('[FaceMesh] sendFrame error:', err);
          } finally {
            isSendingRef.current = false;
          }
        }
      }

      if (isLoopRunningRef.current) {
        rafIdRef.current = requestAnimationFrame(tick);
      }
    };

    tick();
  }, [init]);

  // Clean up loop on unmount (shared instance is preserved)
  useEffect(() => {
    return () => {
      isLoopRunningRef.current = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    isReady,
    isLoading,
    error,
    init,
    startLoop,
    stopLoop,
  };
}
