import assert from 'node:assert/strict';
import test from 'node:test';
import { measureResearchGeometry } from '../src/api/researchMeasurementApi.js';
import { saveCoverTestSessionApi } from '../src/api/coverTestApi.js';

test('warm server before inference; keep POSTs single and respect cancellation', async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const calls = [];
  const deadlines = [];
  globalThis.setTimeout = (callback, ms, ...args) => {
    deadlines.push(ms);
    return originalSetTimeout(callback, ms, ...args);
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const body = url.endsWith('/ping') ? { status: 'alive' }
      : url.includes('/cover-test/') ? { saved: true, aiResult: { reason: 'MODEL_NOT_LOADED' } }
        : { status: 'INCONCLUSIVE', testType: 'HIRSCHBERG' };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  try {
    const result = await measureResearchGeometry({ testType: 'HIRSCHBERG' });
    assert.equal(result.testType, 'HIRSCHBERG');
    assert.ok(calls[0].url.endsWith('/ping'));
    assert.ok(calls[1].url.endsWith('/api/v1/research/measurements'));
    assert.deepEqual(deadlines, [90000, 60000]);
    const saved = await saveCoverTestSessionApi({
      sessionId: '11111111-1111-4111-8111-111111111111',
      cycles: [{ cycleNumber: 1, samples: [{ t: 0, phase: 'BASELINE' }] }],
    });
    assert.equal(saved.aiResult.reason, 'MODEL_NOT_LOADED');
    assert.equal(calls.length, 3);
    assert.equal(calls[2].options.method, 'POST');
    assert.ok(calls[2].options.body instanceof FormData);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(measureResearchGeometry({}, { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});
