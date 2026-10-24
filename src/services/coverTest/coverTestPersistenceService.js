/**
 * Cover Test Cloud Data Storage Service
 * Handles multipart packaging and dispatch of 3-cycle Cover Test raw trajectories
 * and protocol-triggered eye crop images to the Render FastAPI backend.
 * 
 * STRICT ARCHITECTURAL PRINCIPLES:
 * 1. Supabase credentials are NEVER exposed to the frontend.
 * 2. Uses canonical parent UUID v4 as sessionId.
 * 3. Never transmits PII (name, phone, email, etc.).
 * 4. Observational raw time-series data only.
 */

import { isValidUUIDv4 } from '../coverTestProtocolService.js';
import { saveCoverTestSessionApi } from '../../api/coverTestApi.js';

/**
 * Persists complete 3-cycle Cover Test session to cloud storage via FastAPI backend.
 * 
 * @param {Object} params
 * @param {string} params.sessionId - Canonical UUID v4 session ID
 * @param {Object} [params.clientMetadata] - Non-PII client diagnostic telemetry
 * @param {Array<Object>} params.cycles - Array of 3 completed cycle objects with samples
 * @param {Object} params.images - Map of images: { 'c1_left': Blob, 'c1_right': Blob, ... }
 * @param {boolean} [params.runInference=true] - Whether to trigger AI inference
 * @param {AbortSignal} [params.signal] - Optional AbortSignal for unmount cancellation
 * @returns {Promise<{ success: boolean, saved: boolean, sessionId: string, processingStatus?: string, aiResult?: Object, error?: string, message?: string }>}
 */
export async function saveCoverTestSession({
  sessionId,
  clientMetadata = {},
  cycles = [],
  images = {},
  runInference = true,
  signal = null,
}) {
  if (!sessionId) {
    return {
      success: false,
      saved: false,
      error: 'MISSING_SESSION_ID',
      message: 'Thiếu mã định danh phiên kiểm tra hợp lệ (sessionId).',
    };
  }

  if (!isValidUUIDv4(sessionId)) {
    return {
      success: false,
      saved: false,
      sessionId,
      error: 'INVALID_SESSION_UUID',
      message: `Mã phiên kiểm tra không phải là UUID v4 hợp lệ (${sessionId}).`,
    };
  }

  if (!Array.isArray(cycles) || cycles.length === 0) {
    return {
      success: false,
      saved: false,
      error: 'NO_CYCLES_DATA',
      message: 'Không tìm thấy dữ liệu chu kỳ kiểm tra để lưu trữ.',
    };
  }

  try {
    const data = await saveCoverTestSessionApi({
      sessionId,
      clientMetadata,
      cycles,
      images,
      runInference,
      signal,
    });

    const capturedEvents = cycles.flatMap(cycle => cycle.uncoverEvents || []).filter(event => event.status === 'CAPTURED');
    const modalities = data?.aiResult?.inputModalities || [];
    const acknowledged = new Set(data?.aiResult?.analyzedEventIds || []);
    const multimodalConfirmed = modalities.includes('time_series') && modalities.includes('uncover_eye_images') &&
      capturedEvents.length > 0 && capturedEvents.every(event => acknowledged.has(event.eventId));
    const aiResult = clientMetadata.protocolVersion === 'cover-test-multimodal-v2' && !multimodalConfirmed
      ? {
          ...data?.aiResult,
          status: 'INCONCLUSIVE', prediction: 'INCONCLUSIVE',
          reason: data?.aiResult?.reason || (capturedEvents.length ? 'MULTIMODAL_ANALYSIS_UNCONFIRMED' : 'UNCOVER_IMAGES_UNAVAILABLE'),
          classProbabilities: null, confidence: null, isReliable: false,
          notice: data?.aiResult?.notice || (capturedEvents.length
            ? 'Chưa có xác nhận backend đã phân tích đồng thời ảnh bỏ che và chuỗi chuyển động.'
            : 'Chưa ghi được ảnh hai mắt lúc bỏ che. Cần thực hiện lại để phân tích kết hợp.'),
          model: data?.aiResult?.model || { loaded: false },
        }
      : data?.aiResult || null;
    return {
      success: true,
      saved: Boolean(data?.saved),
      sessionId: data?.sessionId || sessionId,
      processingStatus: data?.processingStatus || 'COMPLETED',
      storageRoot: data?.storageRoot,
      cyclesSaved: data?.cyclesSaved || cycles.length,
      imagesSaved: data?.imagesSaved || 0,
      aiResult,
      multimodalConfirmed,
      capturedPairs: capturedEvents.length,
      message: data?.saved ? 'Máy chủ đã lưu dữ liệu.' : 'Đã xử lý phiên kiểm tra, không lưu trữ dữ liệu.',
    };
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (err.name === 'TimeoutError' || err.isTimeout) {
      return {
        success: false,
        saved: false,
        sessionId,
        error: 'TIMEOUT',
        message: err.message || 'Quá thời gian kết nối máy chủ. Vui lòng thử lại.',
      };
    }

    if (err.status && err.status >= 400) {
      const errDetail = err.data?.detail || err.message || `HTTP ${err.status}`;
      return {
        success: false,
        saved: false,
        sessionId,
        error: 'SERVER_REJECTED',
        message: `Máy chủ chưa xử lý được phiên kiểm tra: ${errDetail}`,
        detail: err.data,
      };
    }

    return {
      success: false,
      saved: false,
      sessionId,
      error: 'NETWORK_ERROR',
      message: 'Không thể kết nối đến máy chủ phân tích. Vui lòng kiểm tra mạng và thử lại.',
      detail: err.message,
    };
  }
}
