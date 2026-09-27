export const IMAGE_CAPTURE_STATUS = Object.freeze({ CAPTURED: 'CAPTURED', FAILED: 'FAILED' });

function imageMetadata(file, status, details = {}) {
  return {
    imageId: crypto.randomUUID(),
    file,
    width: details.width ?? null,
    height: details.height ?? null,
    format: 'JPEG',
    capturedAt: new Date().toISOString(),
    status,
    reason: details.reason ?? null,
  };
}

export async function captureScreeningFrame(video, file) {
  const width = video?.videoWidth || 0;
  const height = video?.videoHeight || 0;
  if (!video || video.readyState < 2 || width <= 0 || height <= 0) {
    return { metadata: imageMetadata(file, IMAGE_CAPTURE_STATUS.FAILED, { reason: 'CAMERA_FRAME_UNAVAILABLE' }), blob: null };
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('CANVAS_CONTEXT_UNAVAILABLE');
    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) throw new Error('JPEG_ENCODING_FAILED');
    return { metadata: imageMetadata(file, IMAGE_CAPTURE_STATUS.CAPTURED, { width, height }), blob };
  } catch (error) {
    return { metadata: imageMetadata(file, IMAGE_CAPTURE_STATUS.FAILED, { width, height, reason: error?.message || 'CAPTURE_FAILED' }), blob: null };
  }
}
