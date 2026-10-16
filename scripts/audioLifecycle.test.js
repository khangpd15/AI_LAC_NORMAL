import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioService } from '../src/services/audioService.js';

class FakeAudio {
  static instances = [];
  constructor() { FakeAudio.instances.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
}

globalThis.window = {};
globalThis.Audio = FakeAudio;

function createService() {
  FakeAudio.instances = [];
  const service = new AudioService({});
  service.waitForVoices = async () => [];
  return service;
}

test('replacing a streamed narration stops the old track and settles its promise', { timeout: 1000 }, async () => {
  const service = createService();
  const first = service.speak('Giai đoạn đầu.');
  await Promise.resolve();
  const oldAudio = service.currentAudio;
  const second = service.speak('Giai đoạn sau.');
  await Promise.resolve();
  assert.equal(await first, false);
  assert.equal(oldAudio.paused, true);
  assert.equal(oldAudio.src, '');
  assert.equal(oldAudio.onended, null);
  assert.equal(oldAudio.onerror, null);
  const currentAudio = service.currentAudio;
  assert.notEqual(currentAudio, oldAudio);
  currentAudio.onended();
  assert.equal(await second, true);
});

test('an error event and rejected play promise only start one fallback track', { timeout: 1000 }, async () => {
  const service = createService();
  let rejectPlay;
  const originalPlay = FakeAudio.prototype.play;
  FakeAudio.prototype.play = function () {
    this.paused = false;
    return new Promise((resolve, reject) => { rejectPlay = reject; });
  };
  try {
    const playback = service.speak('Lời dẫn.');
    await Promise.resolve();
    const firstAudio = service.currentAudio;
    const rejectFirst = rejectPlay;
    firstAudio.onerror(new Error('Network error'));
    const fallback = service.currentAudio;
    rejectFirst(new Error('Same network error'));
    await Promise.resolve();
    assert.equal(FakeAudio.instances.length, 2);
    assert.equal(service.currentAudio, fallback);
    assert.equal(firstAudio.paused, true);
    service.stop();
    assert.equal(await playback, false);
  } finally {
    FakeAudio.prototype.play = originalPlay;
  }
});

test('stopping between sentences cancels the delay and does not play the next sentence', { timeout: 1000 }, async () => {
  const service = createService();
  const playback = service.speak('Câu đầu!\nCâu sau!');
  await Promise.resolve();
  service.currentAudio.onended();
  await Promise.resolve();
  assert.ok(service.activeTimer);
  service.stop();
  assert.equal(await playback, false);
  assert.equal(service.activeTimer, null);
  assert.equal(FakeAudio.instances.length, 1);
});

test('stopping native speech settles even when the browser emits no cancel event', { timeout: 1000 }, async () => {
  const service = createService();
  service.selectedVoice = { name: 'Microsoft HoaiMy Online (Natural)', lang: 'vi-VN' };
  service.Utterance = class { constructor(text) { this.text = text; } };
  service.synth = { speak() {}, cancel() {} };
  const playback = service.speak('Lời dẫn native.');
  await Promise.resolve();
  assert.ok(service.currentUtterance);
  service.stop();
  assert.equal(await playback, false);
  assert.equal(service.currentUtterance, null);
});
