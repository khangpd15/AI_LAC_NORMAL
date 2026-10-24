import assert from 'node:assert/strict';
import { test } from 'node:test';
import { saveCoverTestSession } from '../src/services/coverTest/coverTestPersistenceService.js';
import { createCoverTestCues } from '../src/services/coverTestCues.js';

test('stateless backend success is accepted without claiming data was saved', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => new Response(JSON.stringify(url.endsWith('/ping')
    ? { status: 'alive' } : { success: true, saved: false, storageMode: 'STATELESS',
      aiResult: { reason: 'MULTIMODAL_MODEL_NOT_LOADED', prediction: 'INCONCLUSIVE' } }), { status: 200 });
  try {
    const result = await saveCoverTestSession({ sessionId: '11111111-1111-4111-8111-111111111111',
      cycles: [{ cycle: 1, samples: [{ t: 0 }] }] });
    assert.equal(result.success, true);
    assert.equal(result.saved, false);
    assert.equal(result.aiResult.reason, 'MULTIMODAL_MODEL_NOT_LOADED');
    assert.match(result.message, /không lưu trữ/);
  } finally { globalThis.fetch = original; }
});

test('cover, uncover and completion use distinct locally generated cues', async () => {
  const original = globalThis.window;
  const starts = [];
  class Context {
    state = 'running'; currentTime = 0; destination = {};
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    createOscillator() { return { frequency: {}, connect() {}, disconnect() {},
      start(time) { starts.push(time); }, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  globalThis.window = { AudioContext: Context };
  try {
    const cues = createCoverTestCues();
    cues.unlock();
    await cues.play('cover'); assert.equal(starts.length, 1);
    await cues.play('uncover'); assert.equal(starts.length, 3);
    await cues.play('complete'); assert.equal(starts.length, 6);
    cues.close();
  } finally { globalThis.window = original; }
});
