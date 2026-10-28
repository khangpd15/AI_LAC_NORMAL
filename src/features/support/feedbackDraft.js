import { contactEmail } from '../../content/contact.js';

export function createFeedbackDraft({ name, email, topic, message, rating }) {
  const body = [
    'PHẢN HỒI REMICARE', '', `Họ và tên: ${name.trim()}`, `Email liên hệ: ${email.trim()}`,
    `Chủ đề: ${topic}`, `Đánh giá: ${rating ? `${rating}/5` : 'Không đánh giá'}`, '',
    'Nội dung:', message.trim(),
  ].join('\n');
  return { body, href: `mailto:${contactEmail}?subject=${encodeURIComponent(`[RemiCare] ${topic}`)}&body=${encodeURIComponent(body)}` };
}
