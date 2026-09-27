import { AudioService } from './audioService.js';
import { AUDIO_STATES } from '../constants/audioConfig.js';

class MockUtterance { constructor(text) { this.text = text; } }
class MockSynth {
  constructor(voices = []) { this.voices = voices; this.spoken = []; this.cancelCount = 0; this.listeners = new Set(); this.speaking = false; }
  getVoices() { return this.voices; }
  addEventListener(type, listener) { if (type === 'voiceschanged') this.listeners.add(listener); }
  speak(utterance) { this.spoken.push(utterance); this.speaking = true; utterance.onstart?.(); }
  cancel() { this.cancelCount += 1; this.speaking = false; }
  pause() {}
  resume() {}
  setVoices(voices) { this.voices = voices; this.listeners.forEach((listener) => listener()); }
}

const create = (voices = [{ name: 'Vietnamese', lang: 'vi-VN', default: false }]) => { const synth = new MockSynth(voices); const service = new AudioService({ speechSynthesis: synth, SpeechSynthesisUtterance: MockUtterance }); return { service, synth }; };

export async function runAudioServiceTestCases() {
  const first = create(); first.service.unlock(); await first.service.speak('Xin chào');
  const rapid = create(); rapid.service.unlock(); const a = rapid.service.speak('Câu một', { voiceLoadTimeoutMs: 0 }); const b = rapid.service.speak('Câu hai', { voiceLoadTimeoutMs: 0 }); await Promise.all([a, b]);
  const changed = create(); changed.service.unlock(); await changed.service.speak('Câu cũ'); await changed.service.speak('Câu mới');
  const stopped = create(); stopped.service.unlock(); await stopped.service.speak('Đang đọc'); stopped.service.stop();
  const fallback = create([{ name: 'Default', lang: 'en-US', default: true }]); fallback.service.unlock(); await fallback.service.speak('Hướng dẫn');
  const delayed = create([]); delayed.service.unlock(); const waiting = delayed.service.speak('Chờ giọng', { voiceLoadTimeoutMs: 50 }); delayed.synth.setVoices([{ name: 'HoaiMy', lang: 'vi-VN' }]); await waiting;
  const unsupported = new AudioService({}); await unsupported.speak('Không hỗ trợ', { userGesture: true });
  const rerender = create(); rerender.service.unlock(); await rerender.service.speak('Một lần'); const before = rerender.synth.spoken.length; rerender.service.getSnapshot(); rerender.service.getSnapshot();
  return [
    { id: 1, passed: first.synth.spoken.length === 1 && first.service.state === AUDIO_STATES.SPEAKING },
    { id: 2, passed: rapid.synth.spoken.length === 1 && rapid.synth.spoken[0].text === 'Câu hai' },
    { id: 3, passed: changed.synth.spoken.at(-1).text === 'Câu mới' && changed.synth.cancelCount >= 2 },
    { id: 4, passed: stopped.service.state === AUDIO_STATES.IDLE && stopped.synth.cancelCount >= 2 },
    { id: 5, passed: fallback.synth.spoken[0].voice?.lang === 'en-US' },
    { id: 6, passed: delayed.synth.spoken[0].voice?.lang === 'vi-VN' },
    { id: 7, passed: unsupported.state === AUDIO_STATES.ERROR },
    { id: 8, passed: rerender.synth.spoken.length === before, note: 'Snapshot/re-render does not replay speech.' },
  ];
}
