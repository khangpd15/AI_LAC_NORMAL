import { apiClient } from './client.js';
import { ensureBackendReady } from './backendReady.js';

export async function measureResearchGeometry(payload, options = {}) {
  try {
    await ensureBackendReady(options.signal);
    return await apiClient('/api/v1/research/measurements', {
      method: 'POST',
      body: payload,
      timeoutMs: options.timeoutMs ?? 60000,
      signal: options.signal,
      deduplicate: false,
    });
  } catch (error) {
    const detail = error?.data?.detail;
    error.userMessage = detail?.message || detail || error.message || 'Không thể đo Hirschberg trên backend nghiên cứu.';
    throw error;
  }
}
