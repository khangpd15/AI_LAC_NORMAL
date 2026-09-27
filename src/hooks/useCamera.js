import { useState, useEffect, useRef, useCallback } from 'react';
import { startCameraStream, stopCameraStream, attachStreamToVideo, getCameraErrorMessage } from '../services/cameraService';

/**
 * Custom hook for webcam stream management
 * Ensures MediaStreamTrack.stop() is executed on component unmount
 */
export function useCamera() {
  const [stream, setStream] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const videoElementRef = useRef(null);

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
    setIsLoading(true);
    setError(null);
    videoElementRef.current = videoElement;

    try {
      // If we already have a live, healthy stream, attach it directly instead of re-prompting getUserMedia
      if (streamRef.current) {
        const liveTracks = streamRef.current.getVideoTracks().filter((t) => t.readyState === 'live');
        if (liveTracks.length > 0) {
          if (videoElement) {
            await attachStreamToVideo(videoElement, streamRef.current);
          }
          setIsActive(true);
          setIsLoading(false);
          return streamRef.current;
        } else {
          // Stream tracks ended, clean up
          stopCameraStream(streamRef.current, videoElementRef.current);
          streamRef.current = null;
        }
      }

      const mediaStream = await startCameraStream(videoElement, constraints);
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsActive(true);
      setIsLoading(false);
      return mediaStream;
    } catch (err) {
      console.error('Camera startup error:', err);
      const message = getCameraErrorMessage(err);
      setError(message);
      setIsActive(false);
      setIsLoading(false);
      throw err;
    }
  }, []);

  const stop = useCallback(() => {
    if (streamRef.current) {
      stopCameraStream(streamRef.current, videoElementRef.current);
      streamRef.current = null;
    }
    setStream(null);
    setIsActive(false);
    setIsLoading(false);
  }, []);

  // MANDATORY: Stop camera tracks when unmounting
  useEffect(() => {
    return () => {
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
  };
}
