import { IRIS_VOICE, getIrisAudioUrls } from '../constants/irisVoice.js';
import { AUDIO_CONFIG, AUDIO_MESSAGES, AUDIO_STATES, SPEECH_RATE_PRESETS } from '../constants/audioConfig.js';

/** Shared Iris narration service. Uses the same Vietnamese stream as listening guides
 * on every device; browser voice availability never changes the narrator. */
export class AudioService {
  constructor(browserWindow = typeof window !== 'undefined' ? window : null) {
    this.window = browserWindow;
    this.synth = browserWindow?.speechSynthesis || null;
    this.Utterance = browserWindow?.SpeechSynthesisUtterance || null;
    this.voices = [];
    this.selectedVoice = null;
    this.currentUtterance = null;
    this.currentAudio = null;
    this.currentText = '';
    this.state = AUDIO_STATES.IDLE;
    this.errorCount = 0;
    this.errorMessage = '';
    this.listeners = new Set();
    this.requestId = 0;
    this.activeTimer = null;
    this.cancelPlayback = null;
    this.resolveDelay = null;
    this.unlocked = true;
    this.initialized = false;
    this.audioPrimed = false;
    this.handleVoicesChanged = this.loadVoices.bind(this);

    if (this.isSupported()) {
      this.initializeVoices();
      if (this.window && typeof this.window.addEventListener === 'function') {
        const autoUnlock = () => { this.unlock(); };
        this.window.addEventListener('pointerdown', autoUnlock, { once: true, passive: true });
        this.window.addEventListener('keydown', autoUnlock, { once: true, passive: true });
        this.window.addEventListener('click', autoUnlock, { once: true, passive: true });
      }
    }
  }

  isSupported() {
    if (typeof window === 'undefined') return false;
    return typeof Audio !== 'undefined';
  }

  getVoices() {
    return [...this.voices];
  }

  getSnapshot() {
    return {
      supported: this.isSupported(),
      state: this.state,
      voice: { name: IRIS_VOICE.name, lang: IRIS_VOICE.lang, type: 'iris-stream' },
      text: this.currentText,
      errorCount: this.errorCount,
      errorMessage: this.errorMessage,
      unlocked: this.unlocked,
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  emit() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  initializeVoices() {
    if (this.initialized || !this.isSupported()) return;
    this.initialized = true;
    this.loadVoices();
    if (this.synth) {
      if (typeof this.synth.addEventListener === 'function') {
        this.synth.addEventListener('voiceschanged', this.handleVoicesChanged);
      } else {
        this.synth.onvoiceschanged = this.handleVoicesChanged;
      }
    }
  }

  loadVoices() {
    this.voices = this.synth?.getVoices?.() || [];
    this.emit();
    return this.voices;
  }

  unlock() {
    this.unlocked = true;
    this.initializeVoices();
    try {
      this.synth?.resume?.();
    } catch {}

    // Kích hoạt audio context trên thiết bị di động / Safari / Chrome
    if (!this.audioPrimed && typeof Audio !== 'undefined') {
      try {
        const dummy = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        dummy.volume = 0.01;
        const p = dummy.play();
        if (p !== undefined) {
          p.then(() => {
            dummy.pause();
            this.audioPrimed = true;
          }).catch(() => {});
        }
      } catch {}
    }

    this.emit();
    return this.isSupported();
  }

  /**
   * Tách văn bản thành các phân đoạn nói tự nhiên, hỗ trợ SSML <break time="..." />
   * và điều chỉnh khoảng nghỉ giữa các câu theo nhịp điệu đàm thoại y tế ấm áp.
   */
  parseSpeechSegments(rawText, options = {}) {
    if (!rawText || typeof rawText !== 'string') return [];

    let text = rawText.trim();

    // Check for SSML tags: <break time="(\d+)ms"/>
    const breakRegex = /<break\s+time=["']?(\d+)ms["']?\s*\/?>/gi;
    const partsWithBreaks = [];
    let lastIndex = 0;
    let match;

    while ((match = breakRegex.exec(text)) !== null) {
      const preText = text.substring(lastIndex, match.index);
      const pauseDuration = parseInt(match[1], 10) || AUDIO_CONFIG.pauseNormalSentenceMs;
      if (preText.trim()) {
        partsWithBreaks.push({ raw: preText.trim(), pause: pauseDuration });
      }
      lastIndex = match.index + match[0].length;
    }

    const remainingText = text.substring(lastIndex).trim();
    if (remainingText) {
      partsWithBreaks.push({ raw: remainingText, pause: AUDIO_CONFIG.pauseNormalSentenceMs });
    }

    // Strip any remaining XML/SSML tags
    const stripXml = (str) => str.replace(/<[^>]+>/g, '').trim();

    const segments = [];

    for (const item of partsWithBreaks) {
      const cleanPart = stripXml(item.raw);
      if (!cleanPart) continue;

      // Phân tách câu theo dấu chấm, chấm hỏi, chấm than, ba chấm
      const rawSentences = cleanPart.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
      const mergedSentences = [];
      let tempBuffer = '';

      for (const s of rawSentences) {
        if (!tempBuffer) {
          tempBuffer = s;
        } else if ((tempBuffer.length + s.length) < 140 && !/[!?]/.test(tempBuffer)) {
          tempBuffer = `${tempBuffer} ${s}`;
        } else {
          mergedSentences.push(tempBuffer);
          tempBuffer = s;
        }
      }
      if (tempBuffer) {
        mergedSentences.push(tempBuffer);
      }

      for (let i = 0; i < mergedSentences.length; i++) {
        const sentence = mergedSentences[i].trim();
        if (!sentence) continue;

        const isLastSentenceInItem = i === mergedSentences.length - 1;
        let pause = isLastSentenceInItem ? item.pause : AUDIO_CONFIG.pauseNormalSentenceMs;

        const isWarning = /cảnh\s*báo|lưu\s*ý|nếu|nguy\s*hiểm|ngay|không\s*được|chú\s*ý/i.test(sentence);
        const isEmergency = /cấp\s*cứu|hóa\s*chất|vòi\s*nước/i.test(sentence);

        if (options.type === 'EMERGENCY' || isEmergency) {
          pause = Math.max(pause, AUDIO_CONFIG.pauseEmergencyMs);
        } else if (options.type === 'WARNING' || isWarning) {
          pause = Math.max(pause, AUDIO_CONFIG.pauseWarningMs);
        }

        segments.push({
          text: sentence,
          pauseAfterMs: pause,
        });
      }
    }

    return segments.length > 0 ? segments : [{ text: stripXml(text), pauseAfterMs: AUDIO_CONFIG.pauseNormalSentenceMs }];
  }

  /**
   * Chia nhỏ đoạn văn bản thành các câu con <= maxChars để tương thích hoàn hảo
   * với API phát âm Google TTS mà không làm ngắt cụm từ.
   */
  splitIntoSmallChunks(text, maxChars = 180) {
    if (!text || text.length <= maxChars) return [text];

    const chunks = [];
    const parts = text.split(/(?<=[,;:\-—])\s+/);
    let current = '';

    for (const part of parts) {
      if (!current) {
        current = part;
      } else if ((current + ' ' + part).length <= maxChars) {
        current = `${current} ${part}`;
      } else {
        chunks.push(current);
        current = part;
      }
    }
    if (current) {
      chunks.push(current);
    }

    const finalChunks = [];
    for (const c of chunks) {
      if (c.length <= maxChars) {
        finalChunks.push(c);
      } else {
        const words = c.split(/\s+/);
        let wordBuf = '';
        for (const w of words) {
          if (!wordBuf) {
            wordBuf = w;
          } else if ((wordBuf + ' ' + w).length <= maxChars) {
            wordBuf = `${wordBuf} ${w}`;
          } else {
            finalChunks.push(wordBuf);
            wordBuf = w;
          }
        }
        if (wordBuf) finalChunks.push(wordBuf);
      }
    }

    return finalChunks.length > 0 ? finalChunks : [text];
  }

  /**
   * Phát một đoạn âm thanh ngắn qua HTML5 Audio sử dụng giọng nữ tiếng Việt chuẩn Google TTS.
   */
  playSingleAudioChunk(text, rate = 1.02, volume = 1.0, requestId) {
    return new Promise((resolve) => {
      if (this.requestId !== requestId) {
        resolve();
        return;
      }

      const clean = text.trim();
      if (!clean) {
        resolve();
        return;
      }

      const urls = getIrisAudioUrls(clean);

      let urlIndex = 0;
      let resolved = false;
      let activeAudio = null;

      const releaseAudio = () => {
        if (!activeAudio) return;
        activeAudio.onplay = activeAudio.onended = activeAudio.onerror = null;
        try { activeAudio.pause(); activeAudio.removeAttribute('src'); } catch {}
        if (this.currentAudio === activeAudio) this.currentAudio = null;
        activeAudio = null;
      };

      const finish = () => {
        if (!resolved) {
          resolved = true;
          releaseAudio();
          if (this.cancelPlayback === finish) this.cancelPlayback = null;
          resolve();
        }
      };
      this.cancelPlayback = finish;

      const tryNextUrl = () => {
        if (resolved) return;
        releaseAudio();
        if (this.requestId !== requestId) {
          finish();
          return;
        }

        if (urlIndex >= urls.length) {
          this.fail(AUDIO_MESSAGES.failed);
          console.warn('[AudioService] All TTS stream URLs exhausted for chunk:', clean.slice(0, 30));
          finish();
          return;
        }

        const url = urls[urlIndex++];
        const audio = new Audio();
        activeAudio = audio;
        this.currentAudio = audio;
        audio.referrerPolicy = 'no-referrer';
        audio.playbackRate = Math.max(0.75, Math.min(1.25, rate));
        audio.volume = Math.max(0, Math.min(1, volume));

        audio.onplay = () => {
          if (this.requestId !== requestId) {
            try { audio.pause(); } catch {}
            finish();
            return;
          }
          this.state = AUDIO_STATES.SPEAKING;
          this.emit();
        };

        audio.onended = () => {
          finish();
        };

        let failed = false;
        const retry = () => {
          if (failed || resolved || activeAudio !== audio) return;
          failed = true;
          tryNextUrl();
        };
        audio.onerror = (e) => {
          console.warn(`[AudioService] Audio stream URL failed (${url}):`, e);
          retry();
        };

        audio.src = url;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn(`[AudioService] Audio play error for URL (${url}):`, err?.message || err);
            retry();
          });
        }
      };

      tryNextUrl();
    });
  }

  /**
   * Đọc chuỗi các phân đoạn văn bản thông qua Stream giọng Nữ chuẩn y tế (rate 0.95x, pause 120ms).
   */
  async speakViaAudioStream(segments, options = {}, requestId) {
    const rate = options.rate ?? AUDIO_CONFIG.rate; // 0.95
    const volume = options.volume ?? AUDIO_CONFIG.volume; // 1.0

    try {
      for (let i = 0; i < segments.length; i++) {
        if (requestId !== this.requestId) return false;

        const segment = segments[i];
        const textToSpeak = segment.text.trim();
        if (!textToSpeak) continue;

        const subChunks = this.splitIntoSmallChunks(textToSpeak, 140);

        for (let c = 0; c < subChunks.length; c++) {
          if (requestId !== this.requestId) return false;
          const chunk = subChunks[c];
          if (!chunk.trim()) continue;

          await this.playSingleAudioChunk(chunk, rate, volume, requestId);
          if (this.state === AUDIO_STATES.ERROR) return false;

          if (c < subChunks.length - 1 && requestId === this.requestId) {
            await this.waitForPause(20);
          }
        }

        if (i < segments.length - 1 && requestId === this.requestId) {
          const pauseMs = segment.pauseAfterMs || AUDIO_CONFIG.pauseNormalSentenceMs;
          await this.waitForPause(pauseMs);
        }
      }

      if (requestId === this.requestId) {
        this.clearCurrent(AUDIO_STATES.IDLE);
      }
      return requestId === this.requestId;
    } catch (err) {
      console.error('[AudioService] Stream speech error:', err);
      if (requestId === this.requestId) {
        this.clearCurrent(AUDIO_STATES.IDLE);
      }
      return false;
    }
  }

  /**
   * Phát âm thanh hướng dẫn với giọng Nữ Việt Nam chuẩn, tốc độ 0.95x, cao độ 1.02, ngắt nghỉ 120ms.
   *
   * @param {string} text - Văn bản cần đọc
   * @param {Object} options - { rate, volume, userGesture }
   * @returns {Promise<boolean>}
   */
  async speak(text, options = {}) {
    const cleanText = typeof text === 'string' ? text.trim() : '';
    if (!cleanText) return false;

    if (!this.isSupported()) {
      this.fail(AUDIO_MESSAGES.unsupported);
      return false;
    }

    if (!this.unlocked || options.userGesture) {
      this.unlock();
    }

    // Dừng ngay mọi âm thanh đang phát trước đó
    this.stop(false);

    const requestId = ++this.requestId;
    const rate = options.rate ??
      (options.ratePreset ? (SPEECH_RATE_PRESETS[options.ratePreset] ?? AUDIO_CONFIG.rate) : AUDIO_CONFIG.rate);
    const volume = options.volume ?? AUDIO_CONFIG.volume; // 1.0

    const segments = this.parseSpeechSegments(cleanText, options);
    if (!segments.length) return false;

    this.currentText = cleanText;
    this.state = AUDIO_STATES.SPEAKING;
    this.errorMessage = '';
    this.emit();

    return this.speakViaAudioStream(segments, { ...options, rate, volume }, requestId);
  }

  waitForPause(durationMs) {
    return new Promise((resolve) => {
      const finish = () => {
        this.activeTimer = null;
        this.resolveDelay = null;
        resolve();
      };
      this.resolveDelay = finish;
      this.activeTimer = setTimeout(finish, durationMs);
    });
  }

  stop(emit = true) {
    this.requestId += 1;
    this.cancelPlayback?.();
    this.cancelPlayback = null;
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    this.resolveDelay?.();
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch {}
      this.currentAudio = null;
    }
    try {
      this.synth?.cancel();
    } catch (error) {
      console.error('[AudioService] Stop error:', error);
    }
    this.currentUtterance = null;
    this.currentText = '';
    this.state = AUDIO_STATES.IDLE;
    this.errorMessage = '';
    if (emit) this.emit();
  }

  pause() {
    if (this.state === AUDIO_STATES.SPEAKING) {
      if (this.currentAudio) {
        try { this.currentAudio.pause(); } catch {}
      }
      try { this.synth?.pause(); } catch {}
      this.state = AUDIO_STATES.PAUSED;
      this.emit();
    }
  }

  resume() {
    if (this.state === AUDIO_STATES.PAUSED) {
      if (this.currentAudio) {
        try { this.currentAudio.play(); } catch {}
      }
      try { this.synth?.resume(); } catch {}
      this.state = AUDIO_STATES.SPEAKING;
      this.emit();
    }
  }

  clearCurrent(state) {
    this.currentUtterance = null;
    this.currentAudio = null;
    this.currentText = '';
    this.state = state;
    this.emit();
  }

  fail(message) {
    this.currentUtterance = null;
    this.currentAudio = null;
    this.currentText = '';
    this.state = AUDIO_STATES.ERROR;
    this.errorMessage = message;
    this.errorCount += 1;
    this.emit();
  }
}

const audioService = new AudioService();
export default audioService;
