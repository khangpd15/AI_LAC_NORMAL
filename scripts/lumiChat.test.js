import test from 'node:test';
import assert from 'node:assert/strict';
import { getLumiReply } from '../src/services/lumiChatService.js';
import { lumiAnswers } from '../src/content/lumiAnswers.js';

test('all suggested questions return their curated answer and navigation action', () => {
  for (const entry of lumiAnswers) assert.deepEqual(getLumiReply(entry.question, entry.id), entry);
});

test('typed questions match Vietnamese accents, uppercase and unaccented input', () => {
  for (const text of ['CHUẨN BỊ SÀNG LỌC THẾ NÀO?', 'chuan bi sang loc the nao']) {
    assert.equal(getLumiReply(text).id, 'screening');
  }
  assert.equal(getLumiReply('CAMERA KHÔNG MỞ ĐƯỢC').id, 'camera');
  assert.equal(getLumiReply('ĐỌC SÁCH nên chú ý gì?').id, 'care');
});

test('greetings match whole phrases rather than fragments in other words', () => {
  assert.match(getLumiReply('Xin chào Lumi!').answer, /Lumi chào bạn/);
  assert.equal(getLumiReply('nhược thị có chữa được không?').id, 'result');
});

test('unrecognized questions use a transparent fallback without a navigation action', () => {
  const result = getLumiReply('thời tiết ngày mai thế nào?');
  assert.match(result.answer, /chưa có câu trả lời phù hợp/);
  assert.equal(result.action, undefined);
});

test('treatment questions use the curated non-diagnostic answer', () => {
  assert.equal(getLumiReply('Cho bé dùng thuốc nhỏ mắt nào?').id, 'result');
});
