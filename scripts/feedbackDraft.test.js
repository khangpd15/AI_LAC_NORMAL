import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedbackDraft } from '../src/features/support/feedbackDraft.js';

test('email draft preserves Vietnamese and safely encodes URL punctuation', () => {
  const draft = createFeedbackDraft({ name: ' Nguyễn An ', email: 'an@example.com',
    topic: 'Báo lỗi kỹ thuật / Camera', message: ' Máy báo lỗi A&B?\nDòng thứ hai #1 ', rating: 4 });
  const url = new URL(draft.href);
  assert.equal(url.pathname, 'remicare.visionhealth@gmail.com');
  assert.equal(url.searchParams.get('body'), draft.body);
  assert.equal(url.searchParams.get('subject'), '[RemiCare] Báo lỗi kỹ thuật / Camera');
  assert.match(draft.body, /Họ và tên: Nguyễn An/);
  assert.match(draft.body, /Đánh giá: 4\/5/);
  assert.match(draft.body, /A&B\?\nDòng thứ hai #1/);
});

test('optional rating does not become an invented zero-star review', () => {
  const draft = createFeedbackDraft({ name: 'An', email: 'an@example.com', topic: 'Góp ý tính năng', message: 'Góp ý', rating: 0 });
  assert.match(draft.body, /Không đánh giá/);
  assert.doesNotMatch(draft.body, /0\/5/);
});
