import { apiClient } from './client.js';

export async function ensureBackendReady(signal) {
  const result = await apiClient('/ping', {
    timeoutMs: 90000,
    cacheTtlMs: 30000,
    signal,
  });
  if (result?.status !== 'alive') {
    throw new Error('Máy chủ đang khởi động. Vui lòng thử lại sau ít phút.');
  }
}
