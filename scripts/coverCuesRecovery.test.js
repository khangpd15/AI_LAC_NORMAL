import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCoverTestCues } from '../src/services/coverTestCues.js';

test('interrupted audio resumes before a cue; cancelled and failed resumes never beep later', async () => {
  const original = globalThis.window;
  let context;
  let resume;
  let starts = 0;
  class Context {
    state = 'suspended'; currentTime = 0; destination = {};
    constructor() { context = this; }
    resume() { return new Promise(resolve => { resume = () => { this.state = 'running'; resolve(); }; }); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createOscillator() { return { frequency: {}, connect() {}, disconnect() {}, start() { starts++; }, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  globalThis.window = { AudioContext: Context };
  try {
    const cues = createCoverTestCues();
    const first = cues.play('uncover');
    assert.equal(starts, 0);
    resume();
    assert.equal(await first, true);
    assert.equal(starts, 2);
    context.state = 'interrupted';
    const interrupted = cues.play('uncover');
    cues.cancel(); resume();
    assert.equal(await interrupted, false);
    assert.equal(starts, 2);
    context.state = 'suspended';
    context.resume = () => Promise.reject(new Error('NotAllowedError'));
    assert.equal(await cues.play('uncover'), false);
    assert.equal(starts, 2);
    cues.close();
  } finally { globalThis.window = original; }
});
