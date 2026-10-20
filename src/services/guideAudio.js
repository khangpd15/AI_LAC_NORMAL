import { getIrisAudioUrls } from '../constants/irisVoice.js';

export function splitGuideText(text, limit = 140) {
  const chunks = [];
  let chunk = '';
  for (const word of text.trim().split(/\s+/)) {
    if (chunk && `${chunk} ${word}`.length > limit) { chunks.push(chunk); chunk = ''; }
    chunk = chunk ? `${chunk} ${word}` : word;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

// Encode decoded speech as one seekable, mono WAV; no simulated timeline.
export function encodeGuideWav(samples, sampleRate) {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const write = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((value, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, value)) * 32767, true));
  return new Blob([bytes], { type: 'audio/wav' });
}

export async function loadGuideAudio(text, signal) {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) throw new Error('Trình duyệt này chưa hỗ trợ trình phát. Bạn có thể đọc bản nội dung bên dưới.');
  const context = new Context();
  try {
    // Sequential requests keep the existing TTS endpoint from being overloaded.
    const buffers = [];
    for (const chunk of splitGuideText(text)) {
      signal.throwIfAborted();
      const response = await fetch(getIrisAudioUrls(chunk)[0], { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
      if (!response.ok) throw new Error('Chưa tải được giọng đọc. Hãy kiểm tra kết nối và thử lại.');
      buffers.push(await context.decodeAudioData(await response.arrayBuffer()));
    }
    signal.throwIfAborted();
    const samples = new Float32Array(buffers.reduce((length, buffer) => length + buffer.length, 0));
    let offset = 0;
    for (const buffer of buffers) { samples.set(buffer.getChannelData(0), offset); offset += buffer.length; }
    const peaks = Array.from({ length: 56 }, (_, i) => {
      const start = Math.floor(i * samples.length / 56);
      const end = Math.floor((i + 1) * samples.length / 56);
      let peak = 0;
      for (let j = start; j < end; j += 32) peak = Math.max(peak, Math.abs(samples[j]));
      return Math.max(0.08, peak);
    });
    return { blob: encodeGuideWav(samples, context.sampleRate), duration: samples.length / context.sampleRate, peaks };
  } finally { await context.close(); }
}
