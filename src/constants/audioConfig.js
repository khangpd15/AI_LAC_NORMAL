export const AUDIO_CONFIG = Object.freeze({
  lang: 'vi-VN',
  rate: 0.9,
  pitch: 1,
  volume: 1,
  voiceLoadTimeoutMs: 2000,
});

export const AUDIO_STATES = Object.freeze({
  IDLE: 'IDLE',
  SPEAKING: 'SPEAKING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
});

export const AUDIO_MESSAGES = Object.freeze({
  unsupported: 'Thiết bị này không hỗ trợ đọc tự động. Hãy thử trên Chrome hoặc Edge.',
  failed: 'Không phát được âm thanh. Hãy thử lại.',
});
