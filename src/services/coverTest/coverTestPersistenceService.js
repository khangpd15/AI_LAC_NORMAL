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

import { getBackendBaseUrl } from '../aiBackendService.js';
import { isValidUUIDv4 } from '../coverTestProtocolService.js';

const PERSISTENCE_TIMEOUT_MS = 30000;

/**
 * Persists complete 3-cycle Cover Test session to cloud storage via FastAPI backend.
 * 
 * @param {Object} params
 * @param {string} params.sessionId - Canonical UUID v4 session ID
 * @param {Object} [params.clientMetadata] - Non-PII client diagnostic telemetry
 * @param {Array<Object>} params.cycles - Array of 3 completed cycle objects with samples
 * @param {Object} params.images - Map of images: { 'c1_left': Blob, 'c1_right': Blob, ... }
 * @param {boolean} [params.runInference=true] - Whether to trigger AI inference
 * @returns {Promise<{ success: boolean, saved: boolean, sessionId: string, processingStatus?: string, aiResult?: Object, error?: string, message?: string }>}
 */
export async function saveCoverTestSession({
  sessionId,
  clientMetadata = {},
  cycles = [],
  images = {},
  runInference = true,
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

  // Sanitize client metadata to ensure zero PII
  const cleanMetadata = { ...clientMetadata };
  delete cleanMetadata.name;
  delete cleanMetadata.phone;
  delete cleanMetadata.email;
  delete cleanMetadata.cccd;
  delete cleanMetadata.dob;
  delete cleanMetadata.dateOfBirth;
  delete cleanMetadata.address;

  // Build FormData multipart package
  const formData = new FormData();

  // 1. Session Metadata
  const sessionMetaPayload = {
    sessionId,
    cycleCount: cycles.length,
    samplingRateHz: 15.0,
    sourceDevice: 'WEBCAM',
    tracker: 'MEDIAPIPE_IRIS',
    rawSchemaVersion: '1.0.0',
    clientMetadata: cleanMetadata,
  };
  formData.append('session_metadata', JSON.stringify(sessionMetaPayload));

  // 2. Cycle raw trajectories
  cycles.forEach((cycle, idx) => {
    const cycleNum = cycle.cycleIndex || cycle.cycleNumber || cycle.cycle || (idx + 1);
    const rawSamples = cycle.samples || cycle.rawTrajectory || [];
    const cyclePayload = {
      schemaVersion: '1.0.0',
      sessionId,
      cycle: cycleNum,
      coveredEye: String(cycle.coveredEye || (cycleNum % 2 === 1 ? 'LEFT' : 'RIGHT')).toUpperCase(),
      trackedEye: String(cycle.trackedEye || (cycleNum % 2 === 1 ? 'RIGHT' : 'LEFT')).toUpperCase(),
      samplingRateHz: 15.0,
      durationMs: cycle.durationMs || 0,
      samples: rawSamples,
    };
    const jsonBlob = new Blob([JSON.stringify(cyclePayload)], { type: 'application/json' });
    formData.append(`cycle_${cycleNum}_raw`, jsonBlob, `cycle_${cycleNum}_raw.json`);
  });

  // 3. Eye crop images
  for (let c = 1; c <= 3; c++) {
    const leftKey = `${c}_left`;
    const rightKey = `${c}_right`;

    if (images[leftKey] instanceof Blob) {
      formData.append(`cycle_${c}_left_eye`, images[leftKey], `cycle_${c}_left_eye.jpg`);
    }
    if (images[rightKey] instanceof Blob) {
      formData.append(`cycle_${c}_right_eye`, images[rightKey], `cycle_${c}_right_eye.jpg`);
    }
  }

  const baseUrl = getBackendBaseUrl();
  const endpoint = `${baseUrl}/api/v1/cover-test/sessions?run_inference=${runInference ? 'true' : 'false'}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PERSISTENCE_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errDetail = data?.detail || `HTTP ${response.status}: ${response.statusText}`;
      return {
        success: false,
        saved: false,
        sessionId,
        error: 'SERVER_REJECTED',
        message: `Máy chủ từ chối lưu dữ liệu: ${errDetail}`,
        detail: data,
      };
    }

    return {
      success: true,
      saved: Boolean(data?.saved),
      sessionId: data?.sessionId || sessionId,
      processingStatus: data?.processingStatus || 'COMPLETED',
      storageRoot: data?.storageRoot,
      cyclesSaved: data?.cyclesSaved || cycles.length,
      imagesSaved: data?.imagesSaved || 0,
      aiResult: data?.aiResult || null,
      message: 'Dữ liệu kiểm tra và ảnh vùng mắt đã được lưu trữ thành công.',
    };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return {
        success: false,
        saved: false,
        sessionId,
        error: 'TIMEOUT',
        message: 'Quá thời gian kết nối máy chủ (30 giây). Vui lòng thử lại.',
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
