/**
 * Attaches an existing MediaStream to a video element and ensures playback.
 * Used when a video element mounts or remounts while stream is already active.
 * @param {HTMLVideoElement} videoElement
 * @param {MediaStream} stream
 * @returns {Promise<boolean>}
 */
export function getCameraErrorMessage(error) {
  if (error?.name === 'NotAllowedError') return 'Bạn chưa cấp quyền truy cập camera trong trình duyệt.';
  if (error?.name === 'NotFoundError') return 'Không tìm thấy camera trên thiết bị.';
  if (error?.name === 'NotReadableError') return 'Camera đang bận hoặc trình duyệt chưa mở được luồng hình. Hãy đóng ứng dụng khác đang dùng camera rồi thử lại.';
  if (error?.name === 'OverconstrainedError') return 'Thiết bị không đáp ứng cấu hình camera được yêu cầu. Vui lòng thử bật lại camera.';
  if (error?.name === 'SecurityError') return 'Trình duyệt đang chặn camera. Hãy mở trang bằng HTTPS hoặc cấp quyền camera cho trang này.';
  return error?.message || 'Không thể khởi động camera.';
}

export async function attachStreamToVideo(videoElement, stream) {
  if (!videoElement || !stream) return false;

  try {
    videoElement.muted = true;
    videoElement.defaultMuted = true;
    videoElement.playsInline = true;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    videoElement.setAttribute('muted', '');

    if (videoElement.srcObject !== stream) {
      videoElement.srcObject = stream;
    }

    const tryPlay = () => {
      if (videoElement.paused) {
        return videoElement.play().catch((err) => {
          console.warn('[Camera] videoElement.play() warning:', err);
        });
      }
      return Promise.resolve();
    };

    await tryPlay();
    if (videoElement.readyState < 2) {
      videoElement.addEventListener('loadedmetadata', tryPlay, { once: true });
      videoElement.addEventListener('canplay', tryPlay, { once: true });
    }

    console.debug('[Camera] Stream attached to video', {
      readyState: videoElement.readyState,
      videoWidth: videoElement.videoWidth,
      videoHeight: videoElement.videoHeight,
      paused: videoElement.paused,
      srcObject: !!videoElement.srcObject,
    });
    return true;
  } catch (err) {
    console.error('[Camera] attachStreamToVideo error:', err);
    return false;
  }
}

export function getDefaultCameraConstraints() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const lowMemory = (navigator.deviceMemory || 4) <= 3;
  const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;

  if (isIOS) {
    return {
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };
  }

  // CAMERA PERFORMANCE & ORIENTATION
  // Avoid high-resolution capture on mobile/low-end devices.
  // Match portrait orientation when held vertically to prevent video distortion or cropping.
  if (isMobile || lowMemory) {
    return {
      video: {
        width: isPortrait ? { ideal: 480, max: 720 } : { ideal: 640, max: 960 },
        height: isPortrait ? { ideal: 640, max: 960 } : { ideal: 480, max: 720 },
        facingMode: 'user',
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    };
  }

  return {
    video: {
      width: isPortrait ? { ideal: 720, max: 960 } : { ideal: 960, max: 1280 },
      height: isPortrait ? { ideal: 960, max: 1280 } : { ideal: 540, max: 720 },
      facingMode: 'user',
      frameRate: { ideal: 30, max: 60 },
    },
    audio: false,
  };
}

function getFallbackCameraConstraints() {
  const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
  return {
    video: {
      width: isPortrait ? { ideal: 360, max: 480 } : { ideal: 480, max: 640 },
      height: isPortrait ? { ideal: 480, max: 640 } : { ideal: 360, max: 480 },
      facingMode: { ideal: 'user' },
      frameRate: { ideal: 24, max: 30 },
    },
    audio: false,
  };
}

function shouldRetryWithFallback(error, isFallbackCandidate = false) {
  // If user explicitly denied permission or security violation, never retry
  if (['NotAllowedError', 'SecurityError'].includes(error?.name)) {
    return false;
  }
  // If fallback candidate itself got NotFoundError, no camera available on system
  if (isFallbackCandidate && error?.name === 'NotFoundError') {
    return false;
  }
  // Otherwise (OverconstrainedError, NotFoundError on specific facingMode/resolution), allow fallback
  return true;
}

async function requestCameraWithFallback(primaryConstraints) {
  const defaultConstraints = getDefaultCameraConstraints();
  const fallbackConstraints = getFallbackCameraConstraints();
  const candidates = [
    primaryConstraints || defaultConstraints,
    defaultConstraints,
    fallbackConstraints,
    { video: { facingMode: { ideal: 'user' } }, audio: false },
    { video: true, audio: false },
  ];
  const seen = new Set();
  let lastError = null;

  for (let i = 0; i < candidates.length; i++) {
    const constraints = candidates[i];
    const key = JSON.stringify(constraints);
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
      console.warn('[Camera] getUserMedia failed, checking fallback:', {
        name: err?.name,
        message: err?.message,
        constraints,
      });

      const isLastCandidate = i === candidates.length - 1;
      if (!shouldRetryWithFallback(err, isLastCandidate)) {
        throw err;
      }
    }
  }

  throw lastError || new Error('Không thể khởi động camera.');
}

/**
 * Requests webcam access and binds the stream to a video element
 * @param {HTMLVideoElement} videoElement
 * @param {MediaStreamConstraints} customConstraints
 * @returns {Promise<MediaStream>}
 */
export async function startCameraStream(videoElement, customConstraints = null) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Trình duyệt không hỗ trợ WebRTC / getUserMedia.');
  }

  const stream = await requestCameraWithFallback(customConstraints);

  if (videoElement) {
    await attachStreamToVideo(videoElement, stream);
  }

  console.debug('[Camera] Stream started successfully', {
    tracks: stream.getVideoTracks().map((t) => ({
      label: t.label,
      enabled: t.enabled,
      readyState: t.readyState,
      settings: t.getSettings ? t.getSettings() : null,
    })),
  });

  return stream;
}

export function stopCameraStream(stream, videoElement = null) {
  if (stream) {
    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      try {
        track.stop();
      } catch (err) {
        console.warn('Error stopping camera track:', err);
      }
    });
  }

  if (videoElement) {
    try {
      videoElement.pause();
    } catch {
      // ignore
    }
    videoElement.srcObject = null;
  }
}

/**
 * Evaluates live stream and video element health on iOS and Android.
 * Checks tracks, readyState, enabled, muted, paused, and dimensions.
 * @param {MediaStream|null} stream
 * @param {HTMLVideoElement|null} videoElement
 * @returns {{ healthy: boolean, needsRestart: boolean, reason: string, track: MediaStreamTrack|null }}
 */
export function checkCameraHealth(stream, videoElement = null) {
  if (!stream) {
    return { healthy: false, needsRestart: true, reason: 'STREAM_NULL', track: null };
  }
  if (!stream.active) {
    return { healthy: false, needsRestart: true, reason: 'STREAM_INACTIVE', track: null };
  }

  const tracks = stream.getVideoTracks();
  if (!tracks || tracks.length === 0) {
    return { healthy: false, needsRestart: true, reason: 'NO_VIDEO_TRACKS', track: null };
  }

  const track = tracks[0];
  if (track.readyState === 'ended') {
    return { healthy: false, needsRestart: true, reason: 'TRACK_ENDED', track };
  }
  if (!track.enabled) {
    return { healthy: false, needsRestart: true, reason: 'TRACK_DISABLED', track };
  }

  if (videoElement) {
    if (videoElement.srcObject !== stream) {
      return { healthy: false, needsRestart: false, reason: 'SRC_OBJECT_MISMATCH', track };
    }
    if (videoElement.ended) {
      return { healthy: false, needsRestart: true, reason: 'VIDEO_ENDED', track };
    }
    if (videoElement.readyState < 2) {
      return { healthy: false, needsRestart: false, reason: 'VIDEO_NOT_READY', track };
    }
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      return { healthy: false, needsRestart: false, reason: 'ZERO_DIMENSIONS', track };
    }
  }

  // iOS Safari temporary mute when backgrounded
  if (track.muted) {
    return { healthy: false, needsRestart: false, reason: 'TRACK_MUTED', track };
  }

  return { healthy: true, needsRestart: false, reason: 'HEALTHY', track };
}

/**
 * Checks if video element is actively rendering fresh frames.
 * Returns true if video.currentTime advances or new video frame is received within timeoutMs.
 * @param {HTMLVideoElement} videoElement
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
export async function verifyFrameFreshness(videoElement, timeoutMs = 600) {
  if (!videoElement || videoElement.readyState < 2) return false;

  const startCurrentTime = videoElement.currentTime;

  return new Promise((resolve) => {
    let resolved = false;
    let rvfcId = null;
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (rvfcId !== null && videoElement.cancelVideoFrameCallback) {
        videoElement.cancelVideoFrameCallback(rvfcId);
      }
    };

    if (typeof videoElement.requestVideoFrameCallback === 'function') {
      rvfcId = videoElement.requestVideoFrameCallback(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(true);
        }
      });
    }

    timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        const progressed =
          videoElement.currentTime > startCurrentTime ||
          (videoElement.readyState >= 2 && !videoElement.paused && videoElement.videoWidth > 0);
        resolve(progressed);
      }
    }, timeoutMs);
  });
}
