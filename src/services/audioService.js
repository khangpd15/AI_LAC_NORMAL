import { AUDIO_CONFIG, AUDIO_MESSAGES, AUDIO_STATES, DIALECT_VOICE_PRIORITY, SPEECH_RATE_PRESETS } from '../constants/audioConfig.js';

/**
 * AudioService - RemiCare Text-To-Speech (TTS)
 * Hỗ trợ 3 phương ngữ Việt: Miền Nam, Miền Trung, Miền Bắc.
 *
 * Features:
 * - Chọn giọng theo miền: options.dialect = 'south' | 'central' | 'north'
 * - Tốc độ đọc có thể điều chỉnh: options.rate hoặc dùng SPEECH_RATE_PRESETS
 * - Tốc độ mặc định 0.88x; Chậm: 0.90x; Rất chậm: 0.85x
 * - Intelligent sentence pause cadence (350-450ms giữa câu; 500-800ms trước cảnh báo)
 * - SSML tag parsing & <break time="..." /> pause translation
 * - Full audio state management with reactive snapshot listener
 */
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
    this.activeTimer = null;
    this.unlocked = true;
    this.initialized = false;
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
    return Boolean(this.synth && this.Utterance);
  }

  getVoices() {
    return [...this.voices];
  }

  getSnapshot() {
    return {
      supported: this.isSupported(),
      state: this.state,
      voice: this.selectedVoice ? { name: this.selectedVoice.name, lang: this.selectedVoice.lang } : null,
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
    if (typeof this.synth.addEventListener === 'function') {
      this.synth.addEventListener('voiceschanged', this.handleVoicesChanged);
    } else {
      this.synth.onvoiceschanged = this.handleVoicesChanged;
    }
  }

  loadVoices() {
    this.voices = this.synth?.getVoices?.() || [];
    this.selectedVoice = this.selectVietnameseVoice(this.voices);
    if (this.selectedVoice) {
      console.info('[AudioService] Selected RemiCare voice:', this.selectedVoice.name, this.selectedVoice.lang);
    }
    this.emit();
    return this.voices;
  }

  /**
   * Chọn giọng tiếng Việt tốt nhất theo danh sách ưu tiên.
   * Ưu tiên tuyệt đối: Giọng Nữ ấm áp (Google Tiếng Việt, Microsoft HoaiMy Online Natural, Apple Linh/Mai/Chi).
   * Loại bỏ giọng Nam (Microsoft An, NamMinh, male).
   *
   * @param {SpeechSynthesisVoice[]} voices
   * @param {string[]|Object[]} priorityKeywords - mảng {pattern, score}
   */
  selectVietnameseVoice(voices = this.voices, priorityKeywords = AUDIO_CONFIG.voicePriorityKeywords) {
    if (!voices || !voices.length) return null;

    // Lọc tất cả giọng tiếng Việt
    const viVoices = voices.filter((v) => {
      const lang = (v.lang || '').toLowerCase().replace('_', '-');
      return lang === 'vi-vn' || lang.startsWith('vi') || /vietnam/i.test(v.name || '');
    });

    if (viVoices.length > 0) {
      let bestVoice = viVoices[0];
      let bestScore = -Infinity;

      for (const voice of viVoices) {
        let score = 100;
        const name = (voice.name || '').toLowerCase();

        for (const { pattern, score: bonus } of priorityKeywords) {
          if (pattern.test(name)) {
            score += bonus;
          }
        }

        // Tăng ưu tiên cho giọng Online / Natural của Edge/Chrome
        if (/online.*natural|natural.*online/i.test(name)) {
          score += 50;
        }

        // Loại bỏ giọng NAM (Microsoft An trên Windows là giọng nam, NamMinh là giọng nam)
        const isMale = (
          /\bmicrosoft\s+an\b/i.test(name) ||
          /namminh/i.test(name) ||
          (/\b(male|man)\b/i.test(name) && !/vietnam/i.test(name) && !/nam\s*bộ/i.test(name))
        );

        if (isMale) {
          score -= 500;
        }

        if (voice.default) score += 10;

        if (score > bestScore) {
          bestScore = score;
          bestVoice = voice;
        }
      }

      return bestVoice;
    }

    return voices.find((v) => v.default) || voices[0] || null;
  }

  /**
   * Chọn giọng theo phương ngữ (dialect).
   *
   * @param {'south'|'central'|'north'} dialect
   * @param {SpeechSynthesisVoice[]} voices
   * @returns {SpeechSynthesisVoice|null}
   */
  selectVoiceByDialect(dialect, voices = this.voices) {
    const keywords = DIALECT_VOICE_PRIORITY[dialect];
    if (!keywords) {
      console.warn(`[AudioService] Dialect '${dialect}' không hợp lệ, dùng giọng mặc định (south).`);
      return this.selectVietnameseVoice(voices, DIALECT_VOICE_PRIORITY.south);
    }
    return this.selectVietnameseVoice(voices, keywords);
  }

  waitForVoices(timeoutMs = AUDIO_CONFIG.voiceLoadTimeoutMs) {
    this.initializeVoices();
    if (this.voices.length) return Promise.resolve(this.getVoices());
    return new Promise((resolve) => {
      let finished = false;
      let timer;
      let unsubscribe = () => {};
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(this.getVoices());
      };
      unsubscribe = this.subscribe((snapshot) => {
        if (snapshot.voice || this.voices.length) finish();
      });
      timer = setTimeout(finish, timeoutMs);
    });
  }

  unlock() {
    this.unlocked = true;
    this.initializeVoices();
    try {
      this.synth?.resume?.();
    } catch {}
    this.emit();
    return this.isSupported();
  }

  /**
   * Parses text into speech segments, honoring SSML <break time="..." />,
   * ellipsis (...), and sentence boundaries with appropriate pause timings.
   *
   * @param {string} rawText
   * @param {Object} options
   * @returns {Array<{ text: string, pauseAfterMs: number }>}
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

    // Strip any remaining XML/SSML tags like <speak>, </speak>, <prosody...>, <emphasis>
    const stripXml = (str) => str.replace(/<[^>]+>/g, '').trim();

    const segments = [];

    for (const item of partsWithBreaks) {
      const cleanPart = stripXml(item.raw);
      if (!cleanPart) continue;

      // Split into sentences, then merge very short fragments (< 35 chars)
      // to keep speech smooth, natural, and avoid fragmented robot pauses
      const rawSentences = cleanPart.split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
      const mergedSentences = [];
      let tempBuffer = '';

      for (const s of rawSentences) {
        if (!tempBuffer) {
          tempBuffer = s;
        } else if (tempBuffer.length < 35 && !/[!?]/.test(tempBuffer)) {
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

        // Check if next part is an important warning or emergency
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
   * Speaks the given text using gentle Southern Vietnamese female speech parameters.
   *
   * @param {string} text - Plain text or text with natural pauses / SSML
   * @param {Object} options - { rate, pitch, volume, voice, type, userGesture }
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

    // Stop ongoing speech & clear timers
    this.stop(false);

    const requestId = ++this.requestId;
    await this.waitForVoices(options.voiceLoadTimeoutMs);
    if (requestId !== this.requestId) return false;

    // Chọn giọng theo dialect nếu được chỉ định
    const voice = options.voice ||
      (options.dialect ? this.selectVoiceByDialect(options.dialect) : this.selectedVoice);

    // Tốc độ đọc: options.rate > SPEECH_RATE_PRESETS[options.ratePreset] > mặc định 0.95x
    const rate = options.rate ??
      (options.ratePreset ? (SPEECH_RATE_PRESETS[options.ratePreset] ?? AUDIO_CONFIG.rate) : AUDIO_CONFIG.rate);
    const pitch = options.pitch ?? AUDIO_CONFIG.pitch;   // 1.02
    const volume = options.volume ?? AUDIO_CONFIG.volume; // 1.0

    console.info(`[AudioService] Giọng đọc: "${voice?.name || 'Mặc định'}" | Tốc độ: ${rate}x | Cao độ: ${pitch}`);

    const segments = this.parseSpeechSegments(cleanText, options);
    if (!segments.length) return false;

    this.currentText = cleanText;
    this.state = AUDIO_STATES.SPEAKING;
    this.errorMessage = '';
    this.emit();

    try {
      for (let i = 0; i < segments.length; i++) {
        if (requestId !== this.requestId) return false;

        const segment = segments[i];

        await new Promise((resolve, reject) => {
          if (requestId !== this.requestId) {
            resolve();
            return;
          }

          const utterance = new this.Utterance(segment.text);
          utterance.lang = options.lang || AUDIO_CONFIG.lang;
          utterance.rate = rate;
          utterance.pitch = pitch;
          utterance.volume = volume;
          if (voice) utterance.voice = voice;

          utterance.onstart = () => {
            if (this.requestId !== requestId) return;
            this.state = AUDIO_STATES.SPEAKING;
            this.errorMessage = '';
            this.emit();
          };

          utterance.onend = () => {
            if (this.requestId !== requestId) {
              resolve();
              return;
            }
            this.currentUtterance = null;
            resolve();
          };

          utterance.onerror = (event) => {
            if (this.requestId !== requestId) {
              resolve();
              return;
            }
            // Ignore canceled errors triggered by user stop
            if (event.error === 'canceled' || event.error === 'interrupted') {
              resolve();
              return;
            }
            console.error('[AudioService] Utterance error:', event.error || event);
            reject(event);
          };

          this.currentUtterance = utterance;
          this.synth.speak(utterance);
        });

        // Insert calibrated pause between sentences
        if (i < segments.length - 1 && requestId === this.requestId) {
          const pauseMs = segment.pauseAfterMs || AUDIO_CONFIG.pauseNormalSentenceMs;
          await new Promise((res) => {
            this.activeTimer = setTimeout(res, pauseMs);
          });
        }
      }

      if (requestId === this.requestId) {
        this.clearCurrent(AUDIO_STATES.IDLE);
      }
      return true;
    } catch (error) {
      if (requestId === this.requestId) {
        console.error('[AudioService] Playback error:', error);
        this.fail(AUDIO_MESSAGES.failed);
      }
      return false;
    }
  }

  stop(emit = true) {
    this.requestId += 1;
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
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
      this.synth?.pause();
      this.state = AUDIO_STATES.PAUSED;
      this.emit();
    }
  }

  resume() {
    if (this.state === AUDIO_STATES.PAUSED) {
      this.synth?.resume();
      this.state = AUDIO_STATES.SPEAKING;
      this.emit();
    }
  }

  clearCurrent(state) {
    this.currentUtterance = null;
    this.currentText = '';
    this.state = state;
    this.emit();
  }

  fail(message) {
    this.currentUtterance = null;
    this.currentText = '';
    this.state = AUDIO_STATES.ERROR;
    this.errorMessage = message;
    this.errorCount += 1;
    this.emit();
  }
}

const audioService = new AudioService();
export default audioService;
