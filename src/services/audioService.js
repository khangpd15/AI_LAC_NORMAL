import { AUDIO_CONFIG, AUDIO_MESSAGES, AUDIO_STATES } from '../constants/audioConfig.js';

export class AudioService {
  constructor(browserWindow = typeof window !== 'undefined' ? window : null) {
    this.window = browserWindow;
    this.synth = browserWindow?.speechSynthesis || null;
    this.Utterance = browserWindow?.SpeechSynthesisUtterance || null;
    this.voices = [];
    this.selectedVoice = null;
    this.currentUtterance = null;
    this.currentText = '';
    this.state = AUDIO_STATES.IDLE;
    this.errorCount = 0;
    this.errorMessage = '';
    this.listeners = new Set();
    this.requestId = 0;
    this.unlocked = false;
    this.initialized = false;
    this.handleVoicesChanged = this.loadVoices.bind(this);
  }

  isSupported() { return Boolean(this.synth && this.Utterance); }
  getVoices() { return [...this.voices]; }
  getSnapshot() { return { supported: this.isSupported(), state: this.state, voice: this.selectedVoice ? { name: this.selectedVoice.name, lang: this.selectedVoice.lang } : null, text: this.currentText, errorCount: this.errorCount, errorMessage: this.errorMessage, unlocked: this.unlocked }; }
  subscribe(listener) { this.listeners.add(listener); listener(this.getSnapshot()); return () => this.listeners.delete(listener); }
  emit() { const snapshot = this.getSnapshot(); this.listeners.forEach((listener) => listener(snapshot)); }

  initializeVoices() {
    if (this.initialized || !this.isSupported()) return;
    this.initialized = true;
    this.loadVoices();
    if (typeof this.synth.addEventListener === 'function') this.synth.addEventListener('voiceschanged', this.handleVoicesChanged);
    else this.synth.onvoiceschanged = this.handleVoicesChanged;
  }

  loadVoices() {
    this.voices = this.synth?.getVoices?.() || [];
    this.selectedVoice = this.selectVietnameseVoice(this.voices);
    if (this.selectedVoice) console.info('Selected voice:', this.selectedVoice.name, this.selectedVoice.lang);
    this.emit();
    return this.voices;
  }

  selectVietnameseVoice(voices = this.voices) {
    return voices.find((voice) => voice.lang?.toLowerCase().replace('_', '-') === 'vi-vn')
      || voices.find((voice) => voice.lang?.toLowerCase().startsWith('vi'))
      || voices.find((voice) => /vietnam/i.test(voice.name || ''))
      || voices.find((voice) => voice.default)
      || voices[0]
      || null;
  }

  waitForVoices(timeoutMs = AUDIO_CONFIG.voiceLoadTimeoutMs) {
    this.initializeVoices();
    if (this.voices.length) return Promise.resolve(this.getVoices());
    return new Promise((resolve) => {
      let finished = false;
      let timer;
      let unsubscribe = () => {};
      const finish = () => { if (finished) return; finished = true; clearTimeout(timer); unsubscribe(); resolve(this.getVoices()); };
      unsubscribe = this.subscribe((snapshot) => { if (snapshot.voice || this.voices.length) finish(); });
      timer = setTimeout(finish, timeoutMs);
    });
  }

  unlock() { this.unlocked = true; this.initializeVoices(); this.emit(); return this.isSupported(); }

  async speak(text, options = {}) {
    const cleanText = typeof text === 'string' ? text.trim() : '';
    if (!cleanText) return false;
    if (!this.isSupported()) { this.fail(AUDIO_MESSAGES.unsupported); return false; }
    if (options.userGesture) this.unlock();
    if (!this.unlocked) { this.fail(AUDIO_MESSAGES.failed); return false; }
    if (this.currentText === cleanText && [AUDIO_STATES.SPEAKING, AUDIO_STATES.PAUSED].includes(this.state)) return true;

    this.stop(false);
    const requestId = ++this.requestId;
    await this.waitForVoices(options.voiceLoadTimeoutMs);
    if (requestId !== this.requestId) return false;

    try {
      const utterance = new this.Utterance(cleanText);
      utterance.lang = options.lang || AUDIO_CONFIG.lang;
      utterance.rate = options.rate ?? AUDIO_CONFIG.rate;
      utterance.pitch = options.pitch ?? AUDIO_CONFIG.pitch;
      utterance.volume = options.volume ?? AUDIO_CONFIG.volume;
      const voice = options.voice || this.selectedVoice;
      if (voice) utterance.voice = voice;
      utterance.onstart = () => { if (this.currentUtterance !== utterance) return; this.state = AUDIO_STATES.SPEAKING; this.errorMessage = ''; this.emit(); };
      utterance.onend = () => { if (this.currentUtterance !== utterance) return; this.clearCurrent(AUDIO_STATES.IDLE); };
      utterance.onerror = (event) => { if (this.currentUtterance !== utterance) return; console.error('TTS playback error:', event.error || event); this.fail(AUDIO_MESSAGES.failed); };
      utterance.onpause = () => { if (this.currentUtterance === utterance) { this.state = AUDIO_STATES.PAUSED; this.emit(); } };
      utterance.onresume = () => { if (this.currentUtterance === utterance) { this.state = AUDIO_STATES.SPEAKING; this.emit(); } };
      this.currentUtterance = utterance;
      this.currentText = cleanText;
      this.state = AUDIO_STATES.SPEAKING;
      this.errorMessage = '';
      this.emit();
      this.synth.speak(utterance);
      return true;
    } catch (error) {
      console.error('TTS startup error:', error);
      this.fail(AUDIO_MESSAGES.failed);
      return false;
    }
  }

  stop(emit = true) {
    this.requestId += 1;
    try { this.synth?.cancel(); } catch (error) { console.error('TTS stop error:', error); }
    this.currentUtterance = null; this.currentText = ''; this.state = AUDIO_STATES.IDLE; this.errorMessage = '';
    if (emit) this.emit();
  }
  pause() { if (this.state === AUDIO_STATES.SPEAKING) { this.synth?.pause(); this.state = AUDIO_STATES.PAUSED; this.emit(); } }
  resume() { if (this.state === AUDIO_STATES.PAUSED) { this.synth?.resume(); this.state = AUDIO_STATES.SPEAKING; this.emit(); } }
  clearCurrent(state) { this.currentUtterance = null; this.currentText = ''; this.state = state; this.emit(); }
  fail(message) { this.currentUtterance = null; this.currentText = ''; this.state = AUDIO_STATES.ERROR; this.errorMessage = message; this.errorCount += 1; this.emit(); }
}

const audioService = new AudioService();
export default audioService;
