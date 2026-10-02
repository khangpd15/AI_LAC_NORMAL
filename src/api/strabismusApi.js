/**
 * RemiCare Strabismus Deep Learning Screening API Client
 *
 * Communicates with the ONNX Runtime screening backend:
 * POST /api/v1/strabismus/predict
 * GET /api/v1/strabismus/health
 */

import { apiClient } from './client.js';

/**
 * Utility: Convert a base64 Data URL to a binary Blob.
 *
 * @param {string} dataUrl
 * @returns {Blob}
 */
export function dataUrlToBlob(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid Data URL provided for image conversion.');
  }

  const [header, base64Data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binaryStr = atob(base64Data);
  const len = binaryStr.length;
  const u8arr = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    u8arr[i] = binaryStr.charCodeAt(i);
  }

  return new Blob([u8arr], { type: mime });
}

/**
 * Sends a bilateral eye image captured during STRAIGHT gaze to the backend.
 *
 * @param {Blob|File|string} imageSource - Image as Blob, File, or Data URL
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal] - Optional caller AbortSignal
 * @param {number} [options.timeoutMs=60000] - Timeout in milliseconds (default 60s)
 * @returns {Promise<Object>} Screening outcome:
 *   { status: 'NORMAL'|'SUSPICIOUS'|'INCONCLUSIVE', confidence, quality_score, threshold, model_version, inference_latency_ms }
 */
export async function predictStrabismusImage(imageSource, options = {}) {
  let fileBlob;

  if (typeof imageSource === 'string') {
    fileBlob = dataUrlToBlob(imageSource);
  } else if (imageSource instanceof Blob || imageSource instanceof File) {
    fileBlob = imageSource;
  } else {
    throw new Error('Invalid image source: must be a Blob, File, or Data URL.');
  }

  const formData = new FormData();
  // Name defaults to straight_gaze.jpg if not a File
  const filename = fileBlob.name || 'straight_gaze.jpg';
  formData.append('image', fileBlob, filename);

  try {
    // Note: Do NOT set Content-Type header so browser automatically sets multipart/form-data with boundary
    const response = await apiClient('/api/v1/strabismus/predict', {
      method: 'POST',
      body: formData,
      timeoutMs: options.timeoutMs || 60000,
      signal: options.signal,
    });

    // Check for INCONCLUSIVE status
    if (response?.status === 'INCONCLUSIVE') {
      response.userMessage = 'Ảnh chưa đủ rõ để phân tích. Vui lòng nhìn thẳng và chụp lại.';
    }

    return response;
  } catch (error) {
    // Map status codes to localized medical screening error messages
    if (error.status === 413) {
      error.userMessage = 'Ảnh quá lớn. Vui lòng thử lại.';
    } else if (error.status === 415) {
      error.userMessage = 'Định dạng ảnh không được hỗ trợ.';
    } else if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      error.userMessage = 'Yêu cầu quá thời gian chờ (60s). Vui lòng thử lại.';
    } else {
      error.userMessage = 'Không thể kết nối hệ thống AI. Vui lòng kiểm tra đường truyền và thử lại.';
    }
    throw error;
  }
}

/**
 * Checks if the ONNX strabismus screening model is ready and resident in backend RAM.
 *
 * @param {Object} [options]
 * @returns {Promise<Object>} { status: 'ok'|'error', model_loaded: boolean, model_version: string, threshold: number }
 */
export async function checkStrabismusHealthApi(options = {}) {
  try {
    return await apiClient('/api/v1/strabismus/health', {
      method: 'GET',
      timeoutMs: options.timeoutMs || 10000,
      signal: options.signal,
    });
  } catch (error) {
    return {
      status: 'error',
      model_loaded: false,
      error: error.message,
    };
  }
}
