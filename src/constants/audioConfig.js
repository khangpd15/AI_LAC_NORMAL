// Lumi uses the same streamed Vietnamese narrator across all screens and devices.
export const AUDIO_CONFIG = Object.freeze({
  lang: 'vi-VN',
  rate: 1.02,               // Tốc độ chuẩn 1.02x: lưu loát, dứt khoát, tự nhiên, không bị chậm chạp
  pitch: 1.02,              // Cao độ nữ ấm áp, gần gũi, truyền cảm
  volume: 1.0,
  voiceLoadTimeoutMs: 2500,

  // Khoảng nghỉ tự nhiên (Natural Speech Timing)
  pauseNormalSentenceMs: 40,  // 40ms: chuyển tiếp câu nhanh gọn, tức thì, không bị khựng đợi lâu
  pauseWarningMs: 100,        // 100ms: khoảng nhấn nhẹ trước lưu ý quan trọng
  pauseEmergencyMs: 80,       // 80ms: dứt khoát
});

/**
 * Preset tốc độ đọc (Speech Rate Presets)
 */
export const SPEECH_RATE_PRESETS = Object.freeze({
  DEFAULT:   1.02,  // 1.02x — lưu loát, ân cần, tự nhiên, không bị chậm
  NORMAL:    1.02,  // 1.02x
  GENTLE:    0.98,  // 0.98x — nhẹ nhàng thư thả
  SLOW:      0.92,  // 0.92x — khi cần lắng nghe kỹ
  VERY_SLOW: 0.88,  // 0.88x — cho người già hoặc thị lực kém
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
