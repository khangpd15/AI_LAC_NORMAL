/**
 * UNIFIED MEASUREMENT RESULT SERVICE
 * Standardizes output across all 3 protocols:
 * 1. STATIC_EYE
 * 2. COVER_TEST
 * 3. BROCK_STRING
 * 
 * Strict Clinical Safety & Architecture Rules:
 * - Protocols are never mixed into a single combined score.
 * - AI support is strictly optional research context and never overrides
 *   measurements or quality gating.
 */

import { PROTOCOLS, QUALITY_STATUS } from '../constants/screeningConfig.js';
import { EMPTY_CLINICAL_CALIBRATION_RESULT } from '../constants/clinicalCalibrationConfig.js';

/**
 * Creates a unique session identifier
 * @returns {string}
 */
export function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Factory for creating a standardized unified measurement result
 * 
 * @param {Object} params
 * @param {string} params.protocol - 'STATIC_EYE' | 'COVER_TEST' | 'BROCK_STRING'
 * @param {Object} [params.quality] - { status, score, reasons }
 * @param {Object} [params.measurements] - protocol-specific measurements
 * @param {Array} [params.cycles] - cycles or targets data
 * @param {Object} [params.aiSupport] - optional AI research telemetry
 * @param {string} [params.sessionId] - optional session identifier
 * @returns {Object} Unified measurement report
 */
export function createUnifiedMeasurementResult({
  protocol = PROTOCOLS.COVER_TEST,
  quality = {},
  measurements = {},
  cycles = [],
  aiSupport = null,
  sessionId = null,
}) {
  const finalSessionId = sessionId || generateSessionId();
  const timestamp = new Date().toISOString();

  // Validate protocol
  const validProtocols = Object.values(PROTOCOLS);
  const validatedProtocol = validProtocols.includes(protocol) ? protocol : PROTOCOLS.COVER_TEST;

  // Format data quality
  const formattedQuality = {
    status: quality.status || (quality.isValid === false ? QUALITY_STATUS.INCONCLUSIVE : QUALITY_STATUS.VALID),
    score: typeof quality.score === 'number' ? quality.score : quality.isValid ? 1.0 : 0.0,
    reasons: Array.isArray(quality.reasons)
      ? quality.reasons
      : quality.reason
      ? [quality.reason]
      : [],
  };

  // Format optional AI support (never overrides physical measurements)
  const formattedAISupport = {
    enabled: !!(aiSupport && aiSupport.enabled !== false && typeof aiSupport.strabismusScore === 'number'),
    normalScore: aiSupport?.normalScore ?? null,
    strabismusScore: aiSupport?.strabismusScore ?? null,
    confidence: aiSupport?.confidence ?? null,
    role: 'SECONDARY_SUPPORTING_RESEARCH_SIGNAL',
    overridesMeasurement: false,
  };

  return {
    sessionId: finalSessionId,
    protocol: validatedProtocol,
    timestamp,
    quality: formattedQuality,
    measurements,
    cycles,
    aiSupport: formattedAISupport,
    clinicalCalibration: protocol === PROTOCOLS.COVER_TEST
      ? { ...EMPTY_CLINICAL_CALIBRATION_RESULT, ...(measurements.clinicalCalibration || {}) }
      : null,
    disclaimer:
      'Kết quả đo lường sinh trắc học quang học thời gian thực mang tính chất giáo dục và nghiên cứu. Không thay thế chẩn đoán y khoa chuyên khoa mắt.',
  };
}
