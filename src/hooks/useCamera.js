import { useState, useEffect, useRef, useCallback } from 'react';
import {
  startCameraStream,
  stopCameraStream,
  attachStreamToVideo,
  getCameraErrorMessage,
  checkCameraHealth,
} from '../services/cameraService';

/**
 * Custom hook for webcam stream management with iOS lifecycle recovery support.
 * Guarantees:
 * - EXACTLY ONE ACTIVE CAMERA STREAM (concurrency mutex)
 * - Safe recovery with maximum 3 retry attempts
 * - MediaStreamTrack.stop() executed on unmount
 */
export function useCamera() {
  const [stream, setStream] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const videoElementRef = useRef(null);
  const isStartingRef = useRef(false);
  const retryCountRef = useRef(0);

  const checkHealth = useCallback(() => {
    return checkCameraHealth(streamRef.current, videoElementRef.current);
  }, []);

  const attachVideo = useCallback(async (videoElement) => {
    if (!videoElement) return false;
    videoElementRef.current = videoElement;
    if (streamRef.current) {
      const activeTracks = streamRef.current.getVideoTracks().filter((t) => t.readyState === 'live');
      if (activeTracks.length > 0) {
        await attachStreamToVideo(videoElement, streamRef.current);
        return true;
      }
    }
    return false;
  }, []);

  const start = useCallback(async (videoElement, constraints = null) => {
    if (isStartingRef.current) {
      return streamRef.current;
    }
    isStartingRef.current = true;
    setIsLoading(true);
    setError(null);
    videoElementRef.current = videoElement;

    try {
      // If we already have a healthy active stream, attach it directly instead of re-prompting getUserMedia
      if (streamRef.current) {
        const health = checkCameraHealth(streamRef.current, videoElement);
        if (health.healthy || (!health.needsRestart && streamRef.current.getVideoTracks().some(t => t.readyState === 'live'))) {
          if (videoElement) {
            await attachStreamToVideo(videoElement, streamRef.current);
          }
          setIsActive(true);
          setIsLoading(false);
          isStartingRef.current = false;
          retryCountRef.current = 0;
          return streamRef.current;
        } else {
          // Stream tracks ended or unrecoverable, clean up before starting fresh
          stopCameraStream(streamRef.current, videoElementRef.current);
          streamRef.current = null;
        }
      }

      const mediaStream = await startCameraStream(videoElement, constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsActive(true);
      setIsLoading(false);
      retryCountRef.current = 0;
      isStartingRef.current = false;
      return mediaStream;
    } catch (err) {
      console.error('[useCamera] Startup error:', err);
      const message = getCameraErrorMessage(err);
      setError(message);
      setIsActive(false);
      setIsLoading(false);
      isStartingRef.current = false;
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    isStartingRef.current = false;
    retryCountRef.current = 0;
    if (streamRef.current) {
      stopCameraStream(streamRef.current, videoElementRef.current);
      streamRef.current = null;
    }
    setStream(null);
    setIsActive(false);
    setIsLoading(false);
  }, []);

  /**
   * Recovers camera stream upon foreground or freeze.
   * Checks health first. If unhealthy, restarts up to 3 times maximum.
   * @param {HTMLVideoElement|null} videoElement
   * @returns {Promise<MediaStream|null>}
   */
  const recover = useCallback(async (videoElement = null) => {
    const videoEl = videoElement || videoElementRef.current;
    if (isStartingRef.current) {
      return streamRef.current;
    }

    const health = checkCameraHealth(streamRef.current, videoEl);

    // If stream is still live and healthy, just re-attach and ensure playback
    if (health.healthy) {
      if (videoEl) {
        await attachStreamToVideo(videoEl, streamRef.current);
      }
      retryCountRef.current = 0;
      setIsActive(true);
      return streamRef.current;
    }

    // If stream is unhealthy or tracks ended, restart camera (max 3 retries)
    if (retryCountRef.current >= 3) {
      console.warn('[useCamera] Max recovery retries (3) reached. Halting auto-restart.');
      setError('Camera mất kết nối sau khi chuyển ứng dụng. Vui lòng bấm thử lại.');
      setIsActive(false);
      return null;
    }

    retryCountRef.current += 1;
    console.log(`[useCamera] Recovering camera stream (attempt ${retryCountRef.current}/3)... Reason: ${health.reason}`);

    isStartingRef.current = true;
    setIsLoading(true);

    try {
      if (streamRef.current) {
        stopCameraStream(streamRef.current, videoEl);
        streamRef.current = null;
      }

      const mediaStream = await startCameraStream(videoEl);
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsActive(true);
      setIsLoading(false);
      retryCountRef.current = 0; // Reset counter on successful recovery
      isStartingRef.current = false;
      return mediaStream;
    } catch (err) {
      console.error(`[useCamera] Recovery attempt ${retryCountRef.current} failed:`, err);
      setIsLoading(false);
      isStartingRef.current = false;
      if (retryCountRef.current >= 3) {
        setError(getCameraErrorMessage(err));
        setIsActive(false);
      }
      return null;
    }
  }, []);

  // MANDATORY: Stop camera tracks when unmounting
  useEffect(() => {
    return () => {
      isStartingRef.current = false;
      if (streamRef.current) {
        stopCameraStream(streamRef.current, videoElementRef.current);
        streamRef.current = null;
      }
    };
  }, []);

  return {
    stream,
    isActive,
    isLoading,
    error,
    start,
    stop,
    attachVideo,
    checkHealth,
    recover,
  };
}
