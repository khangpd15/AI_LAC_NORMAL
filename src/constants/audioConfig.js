/**
 * AUDIO & TEXT-TO-SPEECH (TTS) CONFIGURATION - REMICARE
 * Hỗ trợ 3 phương ngữ: Miền Nam, Miền Trung, Miền Bắc.
 *
 * Speech characteristics:
 * - Tone: Bình tĩnh, ân cần, nhẹ nhàng (phù hợp bệnh nhân người lớn tuổi)
 * - Rate: 0.88x mặc định | Đọc chậm: 0.90x | Rất chậm: 0.85x
 * - Pitch: 1.0 (giọng nữ tự nhiên, không kim loại)
 * - Pause: 350-450ms giữa câu hướng dẫn; 500-800ms trước cảnh báo quan trọng
 *
 * Phương ngữ được hỗ trợ (dialect option):
 * - 'south'   → Miền Nam / Miền Tây (mặc định)
 * - 'central' → Miền Trung
 * - 'north'   → Miền Bắc
 */

export const AUDIO_CONFIG = Object.freeze({
  lang: 'vi-VN',
  rate: 0.88,               // Tốc độ vừa phải (0.85-0.95x), rõ chữ, không nuốt âm cuối
  pitch: 1.0,               // Cao độ nữ tự nhiên, ấm áp, gần gũi
  volume: 1.0,
  voiceLoadTimeoutMs: 2500,

  // Khoảng nghỉ tự nhiên (Natural Speech Timing)
  pauseNormalSentenceMs: 380, // Khoảng nghỉ giữa các câu hướng dẫn thông thường (300-500ms)
  pauseWarningMs: 650,        // Khoảng nghỉ trước câu cảnh báo quan trọng (500-800ms)
  pauseEmergencyMs: 500,      // Khoảng nghỉ trước câu cấp cứu

  // Danh sách ưu tiên giọng mặc định (Miền Nam — tương thích ngược)
  // Dùng DIALECT_VOICE_PRIORITY để chọn giọng theo miền.
  voicePriorityKeywords: [
    { pattern: /an\s*online/i,      score: 250, label: 'Microsoft An Online (Nam Bộ Female)' },
    { pattern: /phuong\s*online/i,  score: 240, label: 'Microsoft Phuong Online (Nam Bộ Female)' },
    { pattern: /(south|nam\s*bộ|miền\s*tây)/i, score: 230, label: 'Explicit Southern Vietnamese' },
    { pattern: /google\s*tiếng\s*việt/i, score: 200, label: 'Google Tiếng Việt (Female)' },
    { pattern: /linh/i,             score: 180, label: 'Linh (Apple Vietnamese Female)' },
    { pattern: /mai/i,              score: 170, label: 'Mai (Vietnamese Female)' },
    { pattern: /chi/i,              score: 160, label: 'Chi (Vietnamese Female)' },
    { pattern: /hoaimy/i,           score: 120, label: 'Microsoft HoaiMy (Fallback)' },
  ],
});

/**
 * Preset tốc độ đọc (Speech Rate Presets)
 * Truyền vào options.rate khi gọi audioService.speak(text, { rate: SPEECH_RATE_PRESETS.SLOW })
 */
export const SPEECH_RATE_PRESETS = Object.freeze({
  NORMAL:    0.88,  // Tốc độ bình thường — rõ ràng, tự nhiên
  SLOW:      0.90,  // Đọc chậm nhẹ — dễ theo dõi hơn
  VERY_SLOW: 0.85,  // Đọc rất chậm — phù hợp người cao tuổi, thị lực yếu
});

/**
 * Cấu hình giọng theo 3 miền (Dialect Voice Priority)
 *
 * Mỗi miền có danh sách ưu tiên giọng riêng.
 * Nếu không tìm thấy giọng của miền đó, sẽ fallback sang giọng tiếng Việt bất kỳ.
 *
 * Sử dụng: audioService.speak(text, { dialect: 'north' })
 * Giá trị hợp lệ: 'south' | 'central' | 'north'
 */
export const DIALECT_VOICE_PRIORITY = Object.freeze({
  /**
   * Miền Nam / Miền Tây — Giọng nữ ấm áp, nhẹ nhàng
   * Microsoft An Online > Microsoft Phuong Online > Google tiếng Việt > Apple Linh/Mai/Chi
   */
  south: [
    { pattern: /an\s*online/i,      score: 250, label: 'Microsoft An Online (Nam Bộ Female)' },
    { pattern: /phuong\s*online/i,  score: 240, label: 'Microsoft Phuong Online (Nam Bộ Female)' },
    { pattern: /(south|nam\s*bộ|miền\s*tây)/i, score: 230, label: 'Explicit Southern Vietnamese' },
    { pattern: /google\s*tiếng\s*việt/i, score: 200, label: 'Google Tiếng Việt (Female)' },
    { pattern: /linh/i,             score: 180, label: 'Linh (Apple Vietnamese Female)' },
    { pattern: /mai/i,              score: 170, label: 'Mai (Vietnamese Female)' },
    { pattern: /chi/i,              score: 160, label: 'Chi (Vietnamese Female)' },
    { pattern: /hoaimy/i,           score: 100, label: 'HoaiMy (Fallback)' },
  ],

  /**
   * Miền Trung — Giọng nữ nhẹ nhàng, trầm ấm
   * HoaiMy (Huế/Đà Nẵng) > Dao > Google tiếng Việt > fallback
   */
  central: [
    { pattern: /hoaimy/i,           score: 250, label: 'Microsoft HoaiMy (Central Female)' },
    { pattern: /dao/i,              score: 230, label: 'Dao (Central Vietnamese Female)' },
    { pattern: /(trung|central|hue|da\s*nang)/i, score: 220, label: 'Explicit Central Vietnamese' },
    { pattern: /google\s*tiếng\s*việt/i, score: 190, label: 'Google Tiếng Việt (Female)' },
    { pattern: /linh/i,             score: 160, label: 'Linh (Apple Vietnamese Female)' },
    { pattern: /mai/i,              score: 150, label: 'Mai (Vietnamese Female)' },
    { pattern: /an\s*online/i,      score: 100, label: 'Microsoft An (Fallback)' },
    { pattern: /phuong\s*online/i,  score: 100, label: 'Microsoft Phuong (Fallback)' },
  ],

  /**
   * Miền Bắc — Giọng nữ chuẩn phổ thông, rõ chữ
   * Ngoc / Hoa (Hà Nội) > Google tiếng Việt > HoaiMy > fallback
   * Lưu ý: NamMinh là giọng nam → bị loại trong selectVietnameseVoice
   */
  north: [
    { pattern: /ngoc/i,             score: 260, label: 'Ngoc (North Vietnamese Female)' },
    { pattern: /hoa\b/i,            score: 250, label: 'Hoa (North Vietnamese Female)' },
    { pattern: /(north|hà\s*nội|hanoi|bắc)/i, score: 230, label: 'Explicit Northern Vietnamese' },
    { pattern: /google\s*tiếng\s*việt/i, score: 200, label: 'Google Tiếng Việt (Female)' },
    { pattern: /hoaimy/i,           score: 180, label: 'Microsoft HoaiMy (Female)' },
    { pattern: /linh/i,             score: 160, label: 'Linh (Apple Vietnamese Female)' },
    { pattern: /an\s*online/i,      score: 100, label: 'Microsoft An (Fallback)' },
    { pattern: /phuong\s*online/i,  score: 100, label: 'Microsoft Phuong (Fallback)' },
  ],
});

export const AUDIO_STATES = Object.freeze({
  IDLE: 'IDLE',
  SPEAKING: 'SPEAKING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
});

export const AUDIO_MESSAGES = Object.freeze({
  unsupported: 'Thiết bị chưa hỗ trợ giọng đọc tự động. Hãy thử trên Google Chrome hoặc Microsoft Edge nghen cô chú.',
  failed: 'Chưa phát được âm thanh. Cô chú bấm thử lại giúp con nghen.',
});

/**
 * Thư viện câu thoại chuẩn y tế mang âm hưởng nữ miền Tây nhẹ nhàng, ấm áp.
 * Dùng cho người lớn tuổi, chăm sóc sau phẫu thuật, nhỏ thuốc, cảnh báo và cấp cứu.
 */
export const CLINICAL_AUDIO_PRESETS = Object.freeze({
  // 1. Hướng dẫn chăm sóc sau phẫu thuật
  POST_OP_CARE: {
    type: 'INSTRUCTION',
    speechText: 'Dạ, cô chú cứ bình tĩnh nghen. Mình nhớ đeo kính bảo vệ mắt cẩn thận. Tuyệt đối tránh để nước dính vào mắt trong tuần đầu tiên nha cô chú.',
  },

  // 2. Hướng dẫn nhỏ thuốc
  EYE_DROP_GUIDE: {
    type: 'INSTRUCTION',
    speechText: 'Dạ, trước tiên mình rửa sạch tay bằng xà bông nghen. Kế đó, cô chú ngửa nhẹ đầu ra sau, kéo nhẹ mi dưới rồi nhỏ đúng một giọt thuốc vào mắt nha. Nhớ đừng để đầu lọ chạm vào lông mi nghen.',
  },

  // 3. Do / Don't (Những điều nên làm và cần tránh)
  DO_AND_DONT: {
    type: 'WARNING',
    speechText: 'Dạ, cô chú lưu ý giúp con nghen. Mình tuyệt đối không được dụi tay vào mắt. Nếu thấy ngứa hoặc cộm, mình chớp mắt nhẹ nhàng thôi nha.',
  },

  // 4. Dấu hiệu cảnh báo
  WARNING_SIGNS: {
    type: 'WARNING',
    speechText: 'Dạ, nếu cô chú thấy mắt đau nhức nhiều, nhìn mờ đột ngột, hoặc thấy chói mắt bất thường... mình liên hệ bác sĩ hoặc bệnh viện mắt ngay nghen.',
  },

  // 5. Hướng dẫn cấp cứu
  EMERGENCY: {
    type: 'EMERGENCY',
    speechText: 'Nếu mắt bị hóa chất hoặc bụi bẩn bắn vào... hãy rửa mắt ngay dưới vòi nước sạch trong mười lăm phút. Sau đó đến cơ sở y tế gần nhất càng sớm càng tốt.',
  },

  // 6. Quy trình Sàng lọc thị giác hai mắt RemiCare
  SCREENING_POSITION: {
    type: 'INSTRUCTION',
    speechText: 'Dạ, cô chú đưa khuôn mặt vào ngay giữa khung hình nghen. Giữ đầu thẳng và nhìn vào chấm tròn nha.',
  },
  SCREENING_POSITION_READY: {
    type: 'INSTRUCTION',
    speechText: 'Dạ, vị trí đã rất tốt rồi nghen. Cô chú bấm nút bắt đầu nha.',
  },
  COVER_TEST_INTRO: {
    type: 'INSTRUCTION',
    speechText: 'Dạ, mình chuẩn bị bắt đầu bài kiểm tra che mắt nghen. Cô chú nhìn thẳng vào chấm tròn ở giữa nha.',
  },
  COVER_LEFT: {
    type: 'INSTRUCTION',
    speechText: 'Dạ, mình lấy tay che mắt trái lại nghen.',
  },
  UNCOVER_LEFT: {
    type: 'INSTRUCTION',
    speechText: 'Dạ, mình bỏ tay ra và tiếp tục nhìn thẳng vào chấm tròn nha.',
  },
  COVER_RIGHT: {
    type: 'INSTRUCTION',
    speechText: 'Dạ, mình đổi bên che mắt phải lại nghen.',
  },
  UNCOVER_RIGHT: {
    type: 'INSTRUCTION',
    speechText: 'Dạ, mình bỏ tay ra và tiếp tục nhìn thẳng nha.',
  },
  BROCK_INTRO: {
    type: 'INSTRUCTION',
    speechText: 'Dạ, mình chuyển sang bài kiểm tra nhìn chấm tròn nghen. Cô chú ngồi gần lại một chút và nhìn vào tâm chấm nha.',
  },
  SCREENING_COMPLETE: {
    type: 'INSTRUCTION',
    speechText: 'Dạ, đã hoàn tất toàn bộ bài kiểm tra rồi nghen cô chú. Kết quả đang hiển thị trên màn hình nha.',
  },
});
