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
  return error?.message || 'Không thể khởi động camera.';
}

export async function attachStreamToVideo(videoElement, stream) {
  if (!videoElement || !stream) return false;

  try {
    if (videoElement.srcObject !== stream) {
      videoElement.srcObject = stream;
    }
    videoElement.muted = true;
    videoElement.playsInline = true;

    if (videoElement.paused) {
      await videoElement.play().catch((err) => {
        console.warn('[Camera] videoElement.play() warning:', err);
      });
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

function getDefaultCameraConstraints() {
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const lowMemory = (navigator.deviceMemory || 4) <= 3;

  // CAMERA PERFORMANCE
  // Avoid high-resolution capture on mobile/low-end devices; iris tracking uses
  // landmarks and eye ROI, not 4K full-frame pixels.
  if (isMobile || lowMemory) {
    return {
      video: {
        width: { ideal: 640, max: 960 },
        height: { ideal: 480, max: 720 },
        facingMode: 'user',
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    };
  }

  return {
    video: {
      width: { ideal: 960, max: 1280 },
      height: { ideal: 540, max: 720 },
      facingMode: 'user',
      frameRate: { ideal: 30, max: 60 },
    },
    audio: false,
  };
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

  const defaultConstraints = getDefaultCameraConstraints();

  const constraints = customConstraints || defaultConstraints;
  const stream = await navigator.mediaDevices.getUserMedia(constraints);

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

/**
 * Stops all tracks in a MediaStream and detaches from video element
 * @param {MediaStream} stream
 * @param {HTMLVideoElement} videoElement
 */
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
    videoElement.srcObject = null;
  }
}
