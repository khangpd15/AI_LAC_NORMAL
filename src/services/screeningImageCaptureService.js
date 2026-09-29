import { calculateEyeRoi, cropRollAlignedEye } from './cv/eyeRoiService.js';

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
  const normTarget = String(targetEye).toUpperCase() === 'RIGHT' ? 'RIGHT' : 'LEFT';
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

  // 1. Calculate precise anatomical ocular ROI
  const roi = calculateEyeRoi(landmarks, normTarget, 1.8, 2.0);

  if (!roi || !roi.isValid) {
    return {
      metadata: imageMetadata(filename, IMAGE_CAPTURE_STATUS.FAILED, { reason: 'EYE_LANDMARKS_INSUFFICIENT' }),
      blob: null,
    };
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;

    // Direct affine transformation centered on anatomical canthi midpoint
    const croppedCanvas = cropRollAlignedEye(video, roi, 256, 256, canvas);
    if (!croppedCanvas) throw new Error('CANVAS_RENDER_FAILED');

    const blob = await new Promise((resolve) => croppedCanvas.toBlob(resolve, 'image/jpeg', 0.90));
    if (!blob) throw new Error('JPEG_ENCODING_FAILED');

    return {
      metadata: imageMetadata(filename, IMAGE_CAPTURE_STATUS.CAPTURED, {
        width: 256,
        height: 256,
        cropRegion: {
          xMin: Math.round(roi.bboxNorm.xMin * width),
          yMin: Math.round(roi.bboxNorm.yMin * height),
          width: Math.round(roi.bboxNorm.width * width),
          height: Math.round(roi.bboxNorm.height * height),
          rollAngleDeg: roi.rollAngleDeg,
        },
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
