import { LANDMARKS } from '../constants/screeningConfig.js';

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
    cropRegion: details.cropRegion ?? null,
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

/**
 * Protocol-Triggered Eye-Region Crop Capture
 * Crops strictly the eye region (approx 30% padding, 256x256 JPEG) based on existing MediaPipe landmarks.
 * 
 * @param {HTMLVideoElement} video - Active camera video node
 * @param {Array<Object>} landmarks - 468/478 FaceMesh landmarks from existing tracker
 * @param {'LEFT'|'RIGHT'} targetEye - Eye to crop ('LEFT' or 'RIGHT')
 * @returns {Promise<{ metadata: Object, blob: Blob|null }>}
 */
export async function captureEyeRegionCrop(video, landmarks, targetEye = 'LEFT') {
  const width = video?.videoWidth || 0;
  const height = video?.videoHeight || 0;
  const normTarget = String(targetEye).toUpperCase();
  const filename = `${normTarget.toLowerCase()}_eye.jpg`;

  if (!video || video.readyState < 2 || width <= 0 || height <= 0) {
    return {
      metadata: imageMetadata(filename, IMAGE_CAPTURE_STATUS.FAILED, { reason: 'CAMERA_FRAME_UNAVAILABLE' }),
      blob: null,
    };
  }

  if (!landmarks || !Array.isArray(landmarks)) {
    return {
      metadata: imageMetadata(filename, IMAGE_CAPTURE_STATUS.FAILED, { reason: 'LANDMARKS_UNAVAILABLE' }),
      blob: null,
    };
  }

  const indices = normTarget === 'LEFT'
    ? [LANDMARKS.LEFT_INNER_CORNER, LANDMARKS.LEFT_OUTER_CORNER, LANDMARKS.LEFT_TOP_LID, LANDMARKS.LEFT_BOTTOM_LID, LANDMARKS.LEFT_IRIS_CENTER]
    : [LANDMARKS.RIGHT_INNER_CORNER, LANDMARKS.RIGHT_OUTER_CORNER, LANDMARKS.RIGHT_TOP_LID, LANDMARKS.RIGHT_BOTTOM_LID, LANDMARKS.RIGHT_IRIS_CENTER];

  const points = indices
    .map((idx) => landmarks[idx])
    .filter((pt) => pt && Number.isFinite(pt.x) && Number.isFinite(pt.y));

  if (points.length < 3) {
    return {
      metadata: imageMetadata(filename, IMAGE_CAPTURE_STATUS.FAILED, { reason: 'EYE_LANDMARKS_INSUFFICIENT' }),
      blob: null,
    };
  }

  // Calculate bounding box in pixel coordinates
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const boxW = (maxX - minX) * width;
  const boxH = (maxY - minY) * height;
  const centerX = ((minX + maxX) / 2) * width;
  const centerY = ((minY + maxY) / 2) * height;

  // Add ~30-40% padding and enforce square aspect ratio
  const maxDim = Math.max(boxW, boxH);
  const paddedDim = Math.max(30, maxDim * 1.5);
  const cropSize = Math.round(paddedDim);

  let cropX = Math.round(centerX - cropSize / 2);
  let cropY = Math.round(centerY - cropSize / 2);

  // Clamp within video bounds
  cropX = Math.max(0, Math.min(width - cropSize, cropX));
  cropY = Math.max(0, Math.min(height - cropSize, cropY));
  const finalW = Math.min(width - cropX, cropSize);
  const finalH = Math.min(height - cropY, cropSize);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('CANVAS_CONTEXT_UNAVAILABLE');

    // Draw eye-region crop to 256x256
    context.drawImage(video, cropX, cropY, finalW, finalH, 0, 0, 256, 256);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.90));
    if (!blob) throw new Error('JPEG_ENCODING_FAILED');

    return {
      metadata: imageMetadata(filename, IMAGE_CAPTURE_STATUS.CAPTURED, {
        width: 256,
        height: 256,
        cropRegion: { xMin: cropX, yMin: cropY, width: finalW, height: finalH },
      }),
      blob,
    };
  } catch (error) {
    return {
      metadata: imageMetadata(filename, IMAGE_CAPTURE_STATUS.FAILED, {
        reason: error?.message || 'CROP_CAPTURE_FAILED',
      }),
      blob: null,
    };
  }
}
