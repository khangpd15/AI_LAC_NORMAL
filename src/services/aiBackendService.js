/**
 * RemiCare Strabismus AI Backend Service
 * 
 * Manages communication between AI_CHECK_LAC frontend and the Python FastAPI
 * AI Backend for Phase 4.2 Research Transfer Inference.
 * 
 * CRITICAL SCIENTIFIC & ARCHITECTURAL PRINCIPLES:
 * 1. Sends RAW time-series sampling only. Feature extraction occurs strictly on backend.
 * 2. PROHIBITS sending clinical labels, target diagnoses, or ground truth (prevents leakage).
 * 3. Does NOT continuously stream camera frames; dispatches exactly ONE request after Cover Test completion.
 * 4. All model outputs are labeled as TRANSFER_EXPERIMENT (domain shift warning active, clinical meaning: null).
 */

import { generateUUIDv4 } from './coverTestProtocolService.js';
import { getApiBaseUrl, apiClient } from '../api/client.js';
import { transferStrabismusApi } from '../api/transferApi.js';
import { checkBackendHealthApi } from '../api/healthApi.js';

const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Resolves the configured AI backend URL from environment variables.
 * Fallback to http://localhost:8000 for local development.
 * 
 * @returns {string} Clean base URL without trailing slash
 */
export function getBackendBaseUrl() {
  return getApiBaseUrl();
}

/**
 * Builds a standardized observation-only transfer request payload from Cover Test summary.
 * Strictly excludes clinical labels, ground truth, or verdict predictions.
 * 
 * @param {Object} coverSummary - Summary object containing completed cycles
 * @param {string} [sampleId] - Unique sample UUID
 * @returns {Object} Standardized Cover Test transfer request payload
 */
export function buildTransferPayload(coverSummary, sampleId = null) {
  const effectiveSampleId =
    sampleId ||
    coverSummary?.sampleId ||
    generateUUIDv4();

  const rawCycles = coverSummary?.cycles || coverSummary?.accumulatedCycles || [];

  const cycles = rawCycles.map((cycle, idx) => {
    const cycleNum = cycle.cycleIndex || cycle.cycleNumber || cycle.cycle || (idx + 1);
    const coveredEye = String(cycle.coveredEye || (cycleNum % 2 === 1 ? 'LEFT' : 'RIGHT')).toUpperCase();
    const trackedEye = String(cycle.trackedEye || (cycleNum % 2 === 1 ? 'RIGHT' : 'LEFT')).toUpperCase();

    const rawSamples = cycle.samples || cycle.rawTrajectory || [];
    const formattedSamples = rawSamples.map((s, sIdx) => ({
      index: typeof s.index === 'number' ? s.index : sIdx,
      t: typeof s.t === 'number' ? s.t : (typeof s.timestamp === 'number' ? s.timestamp : 0),
      phase: s.phase || 'BASELINE',
      leftX: typeof s.leftX === 'number' ? s.leftX : (s.left?.x ?? null),
      leftY: typeof s.leftY === 'number' ? s.leftY : (s.left?.y ?? null),
      leftValid: Boolean(s.leftValid ?? s.left?.valid ?? false),
      rightX: typeof s.rightX === 'number' ? s.rightX : (s.right?.x ?? null),
      rightY: typeof s.rightY === 'number' ? s.rightY : (s.right?.y ?? null),
      rightValid: Boolean(s.rightValid ?? s.right?.valid ?? false),
      trackingQuality: typeof s.trackingQuality === 'number' ? s.trackingQuality : 0.95,
    }));

    return {
      cycle: cycleNum,
      coveredEye,
      trackedEye,
      samples: formattedSamples,
    };
  });

  return {
    schemaVersion: '1.0.0',
    sampleId: effectiveSampleId,
    test: 'COVER_TEST',
    source: {
      device: 'WEBCAM',
      tracker: 'MEDIAPIPE_IRIS',
      samplingRateHz: coverSummary?.datasetSampleRateHz || 15,
    },
    cycles,
  };
}

/**
 * Sends a single completed Cover Test payload to the FastAPI AI Backend.
 * 
 * @param {Object} payloadOrSummary - Formatted ScreeningRequest or completed coverSummary
 * @param {Object} [options] - Configuration options
 * @param {number} [options.timeoutMs=60000] - Request timeout in milliseconds
 * @param {AbortSignal} [options.signal] - Optional caller AbortSignal
 * @returns {Promise<Object>} Structured inference result or error state
 */
export async function analyzeCoverTest(payloadOrSummary, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  // Validate or build standard payload
  let payload;
  if (payloadOrSummary && Array.isArray(payloadOrSummary.cycles) && payloadOrSummary.sampleId && payloadOrSummary.test) {
    // Already structured payload - strip any accidental target leakage
    const sanitized = { ...payloadOrSummary };
    delete sanitized.clinicalLabel;
    delete sanitized.diagnosis;
    delete sanitized.target;
    delete sanitized.groundTruth;
    delete sanitized.verdict;
    payload = sanitized;
  } else if (payloadOrSummary && (payloadOrSummary.cycles || payloadOrSummary.accumulatedCycles)) {
    payload = buildTransferPayload(payloadOrSummary, options.sampleId);
  } else {
    return {
      status: 'INVALID_PAYLOAD',
      error: 'INVALID_PAYLOAD',
      inputCompatible: false,
      message: 'Dữ liệu kiểm tra che mắt không đúng định dạng.',
    };
  }

  try {
    const data = await transferStrabismusApi(payload, {
      timeoutMs,
      signal: options.signal || null,
    });
    return data;
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError' || err.isTimeout) {
      return {
        status: 'BACKEND_TIMEOUT',
        error: 'TIMEOUT',
        inputCompatible: false,
        message: 'Hệ thống AI phản hồi quá thời gian cho phép (1 phút).',
      };
    }

    if (err.status === 422) {
      return {
        status: 'INPUT_INCOMPATIBLE',
        error: 'INVALID_TIME_SERIES',
        inputCompatible: false,
        message: 'Dữ liệu chuỗi thời gian không hợp lệ hoặc không tương thích mô hình.',
        detail: err.data?.detail || err.message,
      };
    }

    if (err.status && err.status >= 500) {
      return {
        status: 'SERVER_ERROR',
        error: 'MODEL_ERROR',
        inputCompatible: false,
        message: 'Không thể xử lý suy luận mô hình AI.',
        detail: err.data?.detail || `HTTP ${err.status}`,
      };
    }

    return {
      status: 'BACKEND_UNAVAILABLE',
      error: 'BACKEND_UNAVAILABLE',
      inputCompatible: false,
      message: 'Không thể kết nối tới hệ thống AI. Vui lòng thử lại.',
      detail: err.message,
    };
  }
}

/**
 * Diagnostics helper: checks backend operational health status.
 * 
 * @param {Object} [options]
 * @returns {Promise<Object>} Health check status or error
 */
export async function checkBackendHealth(options = {}) {
  return checkBackendHealthApi(options);
}

/**
 * Automatically persists a completed Cover Test session (metadata and raw sampling)
 * to the legacy backend storage endpoint under /api/cover-test/sessions.
 * 
 * @param {Object} sessionData - { sessionId, metadata, samples }
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=60000]
 * @returns {Promise<{ success: boolean, sessionId: string, saved: boolean, message?: string, error?: string, sessionPath?: string }>}
 */
export async function saveCoverTestSession(sessionData, options = {}) {
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

  if (!sessionData || !sessionData.sessionId || !Array.isArray(sessionData.samples)) {
    return {
      success: false,
      saved: false,
      error: 'INVALID_PAYLOAD',
      message: 'Không thể lưu dữ liệu kiểm tra do cấu trúc không hợp lệ.',
    };
  }

  // Sanitize to prevent accidental PII leakage
  const sanitizedMetadata = { ...(sessionData.metadata || {}) };
  delete sanitizedMetadata.name;
  delete sanitizedMetadata.phone;
  delete sanitizedMetadata.email;
  delete sanitizedMetadata.address;
  delete sanitizedMetadata.cccd;

  const payload = {
    sessionId: sessionData.sessionId,
    metadata: sanitizedMetadata,
    samples: sessionData.samples,
  };

  try {
    const data = await apiClient('/api/cover-test/sessions', {
      method: 'POST',
      body: payload,
      timeoutMs,
      signal: options.signal || null,
    });

    if (!data?.saved) {
      return {
        success: false,
        saved: false,
        sessionId: sessionData.sessionId,
        error: data?.detail || 'SAVE_FAILED',
        message: 'Không thể lưu dữ liệu kiểm tra. Vui lòng thử lại.',
      };
    }

    return {
      success: true,
      saved: true,
      sessionId: data.sessionId || sessionData.sessionId,
      sessionPath: data.sessionPath,
      sampleCount: data.sampleCount,
      message: 'Dữ liệu kiểm tra đã được lưu trữ thành công.',
    };
  } catch (err) {
    const isTimeout = err.name === 'AbortError' || err.name === 'TimeoutError' || err.isTimeout;
    return {
      success: false,
      saved: false,
      sessionId: sessionData.sessionId,
      error: isTimeout ? 'TIMEOUT' : (err.data?.detail || 'NETWORK_ERROR'),
      message: 'Không thể lưu dữ liệu kiểm tra. Vui lòng thử lại.',
      detail: err.message,
    };
  }
}
