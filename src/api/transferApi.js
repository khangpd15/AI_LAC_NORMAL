/**
 * RemiCare AI Transfer Inference API
 */

import { apiClient } from './client.js';

const INFERENCE_TIMEOUT_MS = 15000;

/**
 * Sends Cover Test raw observation trajectories to FastAPI AI Transfer endpoint.
 * 
 * @param {Object} payload - Standardized transfer payload
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=15000]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>}
 */
export async function transferStrabismusApi(payload, options = {}) {
  const { timeoutMs = INFERENCE_TIMEOUT_MS, signal = null } = options;

  // Sanitize target leakage
  const sanitized = { ...payload };
  delete sanitized.clinicalLabel;
  delete sanitized.diagnosis;
  delete sanitized.target;
  delete sanitized.groundTruth;
  delete sanitized.verdict;

  return apiClient('/api/v1/transfer/strabismus', {
    method: 'POST',
    body: sanitized,
    timeoutMs,
    signal,
  });
}
