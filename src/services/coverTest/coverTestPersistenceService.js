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

    return {
      success: true,
      saved: Boolean(data?.saved),
      sessionId: data?.sessionId || sessionId,
      processingStatus: data?.processingStatus || 'COMPLETED',
      storageRoot: data?.storageRoot,
      cyclesSaved: data?.cyclesSaved || cycles.length,
      imagesSaved: data?.imagesSaved || 0,
      aiResult: data?.aiResult || null,
      message: 'Dữ liệu chuyển động mắt đã được lưu trữ thành công.',
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
        message: `Máy chủ từ chối lưu dữ liệu: ${errDetail}`,
        detail: err.data,
      };
    }

    return {
      success: false,
      saved: false,
      sessionId,
      error: 'NETWORK_ERROR',
      message: 'Không thể kết nối đến máy chủ lưu trữ. Vui lòng kiểm tra mạng và thử lại.',
      detail: err.message,
    };
  }
}
