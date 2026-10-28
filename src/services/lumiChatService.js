import { lumiAnswers } from '../content/lumiAnswers.js';

const normalize = (value) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Replace this provider with an API call when a trained model is available.
// The component only needs { answer, action?, actionLabel? } from a reply.
export function getLumiReply(message, answerId) {
  const preset = lumiAnswers.find((item) => item.id === answerId);
  if (preset) return preset;
  const text = normalize(message);
  if (/^(xin chao|chao|hello|hi|lumi)( lumi)?$/.test(text)) {
    return { answer: 'Lumi chào bạn! Bạn cần mình hướng dẫn sàng lọc, mở camera hay tìm hiểu các trải nghiệm của RemiCare?' };
  }
  if (/^(cam on|thanks|thank you)( lumi| ban| nhe)?$/.test(text)) {
    return { answer: 'Rất vui được giúp bạn. Khi cần hướng dẫn thêm, cứ nhắn Lumi nhé!' };
  }
  const ranked = lumiAnswers.map((item) => ({ item, score: item.keywords.reduce((score, keyword) => score + (` ${text} `.includes(` ${keyword} `) ? keyword.split(' ').length : 0), 0) })).sort((a, b) => b.score - a.score);
  if (ranked[0].score > 0) return ranked[0].item;
  return { answer: 'Mình chưa có câu trả lời phù hợp cho câu hỏi này. Bạn có thể hỏi về cách sàng lọc, quyền camera, trải nghiệm hoặc chăm sóc mắt. Hãy chọn một câu hỏi gợi ý bên dưới để mình hướng dẫn nhé.' };
}
