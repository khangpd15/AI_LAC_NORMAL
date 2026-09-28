/**
 * RemiCare System Health API
 */

import { apiClient } from './client.js';

const HEALTH_TIMEOUT_MS = 5000;
const HEALTH_CACHE_TTL_MS = 10000; // 10s TTL cache to avoid redundant network pings

/**
 * Checks operational health status with 10s client cache.
 * 
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Object>}
 */
export async function checkBackendHealthApi(options = {}) {
  try {
    return await apiClient('/health', {
      method: 'GET',
      timeoutMs: HEALTH_TIMEOUT_MS,
      cacheTtlMs: HEALTH_CACHE_TTL_MS,
      deduplicate: true,
      signal: options.signal || null,
    });
  } catch (err) {
    return {
      status: 'unavailable',
      error: err.message,
    };
  }
}
