import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeHirschbergResult, toHirschbergSessionResult } from '../src/services/hirschbergResultService.js';
import { predictHirschberg } from '../src/api/hirschbergApi.js';

const scored = {
  status: 'HUMAN_REVIEW', predictedClass: 'EXOTROPIA', confidence: .81,
  probabilities: null, uncalibratedModelScores: { normal: .05, esotropia: .14, exotropia: .81 },
  screening: { status: 'HUMAN_REVIEW', classifier_called: true, requires_human_review: true },
  modelId: 'screening_eyelid_branch_20261011_v1', model: { calibrated_probabilities: false },
};

test('current backend HUMAN_REVIEW preserves three uncalibrated class scores', () => {
  const result = normalizeHirschbergResult(scored);
  assert.equal(result.proposal, 'EXOTROPIA');
  assert.equal(result.hasScores, true);
  assert.deepEqual(result.scores.map(s => [s.key, s.value]), [['NORMAL', .05], ['ESOTROPIA', .14], ['EXOTROPIA', .81]]);
  assert.match(result.scoreLabel, /chưa hiệu chuẩn/);
});
test('INCONCLUSIVE without scores never becomes 0 percent or normal', () => {
  const result = normalizeHirschbergResult({ status: 'INCONCLUSIVE', predictedClass: 'INCONCLUSIVE', probabilities: null, confidence: null, uncalibratedModelScores: null, screening: { classifier_called: false }, message: 'Chưa thấy phản quang.' });
  assert.equal(result.hasScores, false);
  assert.equal(result.confidence, null);
  assert.equal(result.proposal, null);
  assert.match(result.message, /chụp lại/);
  assert.doesNotMatch(result.message, /phản quang/);
});
test('INCONCLUSIVE hides scores while retaining inconclusive status', () => {
  const result = normalizeHirschbergResult({ ...scored, status: 'INCONCLUSIVE' });
  assert.equal(result.hasScores, false);
  assert.equal(result.confidence, null);
  assert.deepEqual(result.scores, []);
  assert.equal(result.proposal, null);
  assert.equal(result.status, 'INCONCLUSIVE');
  assert.match(result.title, /Chưa thể đánh giá/);
});
test('class labels cannot override an INCONCLUSIVE backend status', () => {
  assert.equal(normalizeHirschbergResult({ ...scored, status: 'INCONCLUSIVE', predictedClass: 'NORMAL' }).proposal, null);
});
test('missing/invalid scores are not coerced into percentages', () => {
  const result = normalizeHirschbergResult({ ...scored, confidence: '0.9', uncalibratedModelScores: { normal: null, esotropia: Infinity, exotropia: NaN } });
  assert.equal(result.hasScores, false);
});
test('a real zero score remains available', () => {
  const result = normalizeHirschbergResult({ ...scored, confidence: 0, uncalibratedModelScores: { normal: 0 } });
  assert.equal(result.hasScores, true);
  assert.equal(result.scores[0].value, 0);
});
test('classifier_called=false hides stray scores from rejected inputs', () => {
  const result = normalizeHirschbergResult({ ...scored, screening: { classifier_called: false } });
  assert.equal(result.hasScores, false);
  assert.equal(result.proposal, null);
});
test('final session stores current status, scores and raw backend fields', () => {
  const session = toHirschbergSessionResult(scored);
  assert.equal(session.strabismusResult.status, 'HUMAN_REVIEW');
  assert.deepEqual(session.hirschbergResult.aiPrediction, scored);
  assert.deepEqual(normalizeHirschbergResult(session.strabismusResult).scores, normalizeHirschbergResult(scored).scores);
});
test('system failures cannot display a clinical class or stale percentages', () => {
  const result = normalizeHirschbergResult({ ...scored, status: 'UNAVAILABLE' });
  assert.equal(result.hasScores, false);
  assert.equal(result.proposal, null);
});
test('multipart request uses Hirschberg endpoint, preserves image bytes and sends actual capture metadata', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify(scored), { status: 200 });
  };
  try {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const result = await predictHirschberg(new Blob([bytes], { type: 'image/png' }), { orientation: 'mirrored', fixation: 'confirmed', sessionId: 'client-123' });
    assert.deepEqual(result, scored);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/api\/v1\/hirschberg\/predict$/);
    const form = calls[0].options.body;
    assert.equal(form.get('orientation'), 'mirrored');
    assert.equal(form.get('fixation'), 'confirmed');
    assert.equal(form.get('save_session'), 'false');
    assert.deepEqual(new Uint8Array(await form.get('image').arrayBuffer()), bytes);
    await predictHirschberg(new Blob([bytes], { type: 'image/png' }));
    assert.equal(calls[1].options.body.get('orientation'), 'auto');
    assert.equal(calls[1].options.body.get('fixation'), 'unknown');
  } finally { globalThis.fetch = originalFetch; }
});
test('busy HTTP response is a retryable system message, never a fabricated screening result', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Trained Hirschberg runtime unavailable' }), { status: 503 });
  try {
    await assert.rejects(predictHirschberg(new Blob(['image'], { type: 'image/png' })), error => error.status === 503 && /khởi động hoặc bận/.test(error.userMessage));
  } finally { globalThis.fetch = originalFetch; }
});

test('technical backend explanations never leak into an inconclusive result', () => {
  for (const reason of ['common_direction_ambiguous', 'invalid_input_contract', 'invalid_reflex_landmark']) {
    const result = normalizeHirschbergResult({ status: 'INCONCLUSIVE', reason,
      message: 'Hai vector phản xạ có thành phần cùng hướng. Invalid Landmark / Low Confidence',
      screening: { classifier_called: false } });
    assert.match(result.message, /chụp lại/);
    assert.doesNotMatch(result.message, /vector|Landmark|Confidence/);
    assert.equal(result.hasScores, false);
    assert.equal(result.proposal, null);
  }
});
