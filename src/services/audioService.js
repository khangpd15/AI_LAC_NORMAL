import { AUDIO_CONFIG, AUDIO_MESSAGES, AUDIO_STATES, DIALECT_VOICE_PRIORITY, SPEECH_RATE_PRESETS } from '../constants/audioConfig.js';

/**
 * Kiểm tra xem một voice có phải là giọng Nữ tiếng Việt thực thụ hay không.
 * TUYỆT ĐỐI LOẠI BỎ:
 * - Giọng Nam cục bộ trên Windows: "Microsoft An - Vietnamese (Vietnam)" (giọng nam robotic, rè, méo tiếng)
 * - Giọng Nam trên Edge: "Microsoft NamMinh Online (Natural)"
 * - Giọng tiếng Anh mặc định (Microsoft David, Zira, Google US English...) phát âm tiếng Việt lơ lớ, kì dị.
 */
export function isGenuineFemaleVoice(voice) {
  if (!voice) return false;
  const name = (voice.name || '').toLowerCase();
  const lang = (voice.lang || '').toLowerCase().replace('_', '-');

  // Phải là tiếng Việt
  const isVi = lang === 'vi-vn' || lang.startsWith('vi') || /vietnam/i.test(name);
  if (!isVi) return false;

  // Loại trừ triệt để tất cả giọng Nam và giọng méo tiếng
  if (
    /\bmicrosoft\s+an\b/i.test(name) ||
    /\ban\s*-\s*vietnam/i.test(name) ||
    /\ban\b.*vietnam/i.test(name) ||
    /namminh/i.test(name) ||
    /\bdavid\b/i.test(name) ||
    /\bmark\b/i.test(name) ||
    (/\b(male|man)\b/i.test(name) && !/vietnam/i.test(name) && !/nam\s*bộ/i.test(name))
  ) {
    return false;
  }

  // Khớp với các giọng Nữ đã được kiểm chứng
  const femalePatterns = [
    /hoaimy/i,                           // Microsoft HoaiMy Online (Natural)
    /google\s*tiếng\s*việt/i,            // Google Tiếng Việt (Female Natural)
    /phuong/i,                           // Microsoft Phuong Online (Natural Nam Bộ)
    /linh/i,                             // Apple Siri Linh
    /mai/i,                              // Apple Siri Mai
    /chi/i,                              // Apple Siri Chi
    /ngoc/i,                             // Apple Siri Ngoc
    /hoa\b/i,                            // Microsoft Hoa
    /dao/i,                              // Apple Dao
    /female/i,
    /nữ/i,
  ];

  if (femalePatterns.some((pattern) => pattern.test(name))) {
    return true;
  }

  // Nếu là giọng Online/Natural và không có dấu hiệu giọng Nam
  if (/online.*natural|natural.*online/i.test(name) && !/nam/i.test(name)) {
    return true;
  }

  return false;
}

/**
 * AudioService - RemiCare Text-To-Speech (TTS)
 * Hệ thống âm thanh đa tầng (Hybrid TTS Engine):
 * 1. Tầng 1: Sử dụng giọng Nữ tiếng Việt bản địa chất lượng cao (Microsoft HoaiMy Natural, Apple Siri Linh/Mai).
 * 2. Tầng 2: Nếu trình duyệt không có sẵn giọng Nữ tiếng Việt (như Google Chrome trên Windows chỉ có
 *    Microsoft An giọng nam kì dị, hoặc Android/Linux/Firefox thiếu voice tiếng Việt), hệ thống
 *    TỰ ĐỘNG CHUYỂN SANG STREAM GIỌNG NỮ GOOGLE TIẾNG VIỆT CHUẨN Y TẾ qua HTML5 Audio.
 * 
 * Cam kết kỹ thuật:
 * - 100% Giọng NỮ ấm áp, truyền cảm, tự nhiên theo âm hưởng miền Tây Nam Bộ.
 * - Tốc độ đọc chuẩn 0.95x (tròn vành rõ chữ, chậm vừa phải cho người già và trẻ nhỏ).
 * - Khoảng nghỉ 120ms giữa các câu (liền mạch, không đơ giật, không ngắt quãng robotic).
 * - Tuyệt đối không bao giờ phát giọng nam cục bộ hoặc giọng tiếng Anh phát âm sai.
 */
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
    return Boolean(this.synth && this.Utterance) || typeof Audio !== 'undefined';
  }

  getVoices() {
    return [...this.voices];
  }

  getSnapshot() {
    const isFemaleNative = isGenuineFemaleVoice(this.selectedVoice);
    return {
      supported: this.isSupported(),
      state: this.state,
      voice: isFemaleNative ? {
        name: this.selectedVoice.name,
        lang: this.selectedVoice.lang,
        type: 'native-female',
      } : {
        name: 'RemiCare Natural Female Voice (Google Tiếng Việt)',
        lang: 'vi-VN',
        type: 'stream-female',
      },
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
    this.selectedVoice = this.selectVietnameseVoice(this.voices);
    if (this.selectedVoice) {
      console.info('[AudioService] Đã chọn giọng Nữ bản địa:', this.selectedVoice.name, this.selectedVoice.lang);
    } else {
      console.info('[AudioService] Trình duyệt không có giọng Nữ tiếng Việt -> Sẵn sàng dùng RemiCare Female Audio Stream.');
    }
    this.emit();
    return this.voices;
  }

  /**
   * Chọn giọng Nữ tiếng Việt tốt nhất theo danh sách ưu tiên.
   * Nếu chỉ có Microsoft An (nam) hoặc không có giọng Việt Nữ, trả về null để tự động
   * kích hoạt stream âm thanh nữ Google chất lượng cao.
   */
  selectVietnameseVoice(voices = this.voices, priorityKeywords = AUDIO_CONFIG.voicePriorityKeywords) {
    if (!voices || !voices.length) return null;

    // Lọc duy nhất các giọng Nữ tiếng Việt
    const femaleViVoices = voices.filter(isGenuineFemaleVoice);
    if (!femaleViVoices.length) {
      return null;
    }

    let bestVoice = femaleViVoices[0];
    let bestScore = -Infinity;

    for (const voice of femaleViVoices) {
      let score = 100;
      const name = (voice.name || '').toLowerCase();

      for (const { pattern, score: bonus } of priorityKeywords) {
        if (pattern.test(name)) {
          score += bonus;
        }
      }

      if (/online.*natural|natural.*online/i.test(name)) {
        score += 50;
      }

      if (voice.default) score += 10;

      if (score > bestScore) {
        bestScore = score;
        bestVoice = voice;
      }
    }

    return bestVoice;
  }

  /**
   * Chọn giọng theo phương ngữ (dialect).
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
  splitIntoSmallChunks(text, maxChars = 140) {
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
  playSingleAudioChunk(text, rate = 0.95, volume = 1.0, requestId) {
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

      const encoded = encodeURIComponent(clean);
      const urls = [
        // Priority 1: Same-origin API endpoint (/api/tts) hosted on Vercel or Vite dev server
        `/api/tts?text=${encoded}`,
        // Priority 2: Direct Google Translate TTS with no-referrer
        `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=vi&client=tw-ob`,
        // Priority 3: Google translate API endpoint
        `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=vi&q=${encoded}`,
      ];

      let urlIndex = 0;
      let resolved = false;

      const finish = () => {
        if (!resolved) {
          resolved = true;
          this.currentAudio = null;
          resolve();
        }
      };

      const tryNextUrl = () => {
        if (this.requestId !== requestId) {
          finish();
          return;
        }

        if (urlIndex >= urls.length) {
          console.warn('[AudioService] All TTS stream URLs exhausted for chunk:', clean.slice(0, 30));
          finish();
          return;
        }

        const url = urls[urlIndex++];
        const audio = new Audio();
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

        audio.onerror = (e) => {
          console.warn(`[AudioService] Audio stream URL failed (${url}):`, e);
          tryNextUrl();
        };

        audio.src = url;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn(`[AudioService] Audio play error for URL (${url}):`, err?.message || err);
            tryNextUrl();
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

          if (c < subChunks.length - 1 && requestId === this.requestId) {
            await new Promise((res) => {
              this.activeTimer = setTimeout(res, 60);
            });
          }
        }

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
   * @param {Object} options - { rate, pitch, volume, voice, dialect, userGesture }
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
    await this.waitForVoices(options.voiceLoadTimeoutMs);
    if (requestId !== this.requestId) return false;

    // Chọn giọng: chỉ chấp nhận giọng Nữ thực thụ
    const candidateVoice = options.voice ||
      (options.dialect ? this.selectVoiceByDialect(options.dialect) : this.selectedVoice);
    const nativeFemaleVoice = isGenuineFemaleVoice(candidateVoice) ? candidateVoice : null;

    // Tốc độ chuẩn 0.95x, cao độ 1.02 ấm áp
    const rate = options.rate ??
      (options.ratePreset ? (SPEECH_RATE_PRESETS[options.ratePreset] ?? AUDIO_CONFIG.rate) : AUDIO_CONFIG.rate);
    const pitch = options.pitch ?? AUDIO_CONFIG.pitch;   // 1.02
    const volume = options.volume ?? AUDIO_CONFIG.volume; // 1.0

    const segments = this.parseSpeechSegments(cleanText, options);
    if (!segments.length) return false;

    this.currentText = cleanText;
    this.state = AUDIO_STATES.SPEAKING;
    this.errorMessage = '';
    this.emit();

    // NẾU KHÔNG CÓ GIỌNG NỮ NATIVE (ví dụ: Google Chrome trên Windows chỉ có Microsoft An nam,
    // hoặc máy chưa cài gói giọng tiếng Việt):
    // TỰ ĐỘNG CHUYỂN SANG STREAM GIỌNG NỮ GOOGLE CHẤT LƯỢNG CAO, TUYỆT ĐỐI KHÔNG DÙNG MICROSOFT AN!
    if (!nativeFemaleVoice) {
      console.info(`[AudioService] Kích hoạt RemiCare Female Audio Stream | Tốc độ: ${rate}x (Tránh giọng nam robotic cục bộ)`);
      return this.speakViaAudioStream(segments, { rate, volume, ...options }, requestId);
    }

    console.info(`[AudioService] Giọng Nữ Native: "${nativeFemaleVoice.name}" | Tốc độ: ${rate}x | Cao độ: ${pitch}`);

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
          utterance.voice = nativeFemaleVoice;

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

        // Khoảng nghỉ 120ms tự nhiên giữa các câu
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
        console.warn('[AudioService] Native speech failed, falling back to Female Audio Stream:', error);
        return this.speakViaAudioStream(segments, { rate, volume, ...options }, requestId);
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
