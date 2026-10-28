import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getEyeCropRegion, getEyePairCropRegions } from '../src/services/coverTest/eyeCropGeometry.js';
import { LEFT_EYE_CONTOUR, RIGHT_EYE_CONTOUR } from '../src/services/cv/strabismusEngine.js';
import { freezeEyePair, encodeEyePair } from '../src/services/coverTest/uncoverCaptureService.js';

function landmarks() {
  const lm = Array.from({ length: 478 }, () => ({ x: NaN, y: NaN }));
  for (const [side, center, contour] of [['left', 0.65, LEFT_EYE_CONTOUR], ['right', 0.35, RIGHT_EYE_CONTOUR]]) {
    for (const i of contour) lm[i] = { x: center, y: 0.4 };
    const [inner, outer, top, bottom, iris] = side === 'left' ? [362, 263, 386, 374, 473] : [133, 33, 159, 145, 468];
    lm[inner] = { x: center + (side === 'left' ? -0.05 : 0.05), y: 0.4 };
    lm[outer] = { x: center + (side === 'left' ? 0.05 : -0.05), y: 0.4 };
    lm[top] = { x: center, y: 0.39 }; lm[bottom] = { x: center, y: 0.41 };
    lm[iris] = { x: center, y: 0.4 };
  }
  return lm;
}

test('portrait crops use original source pixels and anatomical side without preview mirroring', () => {
  const pair = getEyePairCropRegions(landmarks(), 720, 1280);
  assert.ok(pair.left.x > pair.right.x);
  for (const [side, iris] of [['left', 473], ['right', 468]]) {
    const r = pair[side], p = landmarks()[iris];
    assert.ok(r.width >= 108 && r.width <= 110);
    assert.ok(p.x * 720 >= r.x && p.x * 720 < r.x + r.width);
    assert.ok(p.y * 1280 >= r.y && p.y * 1280 < r.y + r.height);
  }
});

test('crop geometry scales with source resolution rather than the processing canvas', () => {
  const small = getEyePairCropRegions(landmarks(), 540, 960);
  const full = getEyePairCropRegions(landmarks(), 720, 1280);
  for (const side of ['left', 'right']) for (const key of ['x', 'y', 'width', 'height']) {
    assert.ok(Math.abs(full[side][key] - small[side][key] * 4 / 3) < 2);
  }
});

test('cropping clips at image bounds and rejects absent or completely off-frame eyes', () => {
  const lm = landmarks();
  for (const i of [...LEFT_EYE_CONTOUR, 473]) lm[i] = { ...lm[i], x: lm[i].x - 0.6 };
  const crop = getEyeCropRegion(lm, 'left', 720, 1280);
  assert.equal(crop.x, 0);
  assert.ok(crop.x + crop.width <= 720 && crop.y + crop.height <= 1280);
  lm[473] = null;
  assert.equal(getEyePairCropRegions(lm, 720, 1280), null);
  assert.equal(getEyeCropRegion(landmarks(), 'left', 0, 1280), null);
  assert.equal(getEyeCropRegion(landmarks(), 'other', 720, 1280), null);
});

test('both crop canvases freeze synchronously and JPEG metadata retains source frame and rectangle', async () => {
  const original = globalThis.document;
  const calls = [];
  globalThis.document = { createElement() { return {
    width: 0, height: 0,
    getContext() { return { drawImage(...args) { calls.push(args); } }; },
    toBlob(callback) { callback(new Blob([new Uint8Array([1, 2])], { type: 'image/jpeg' })); },
  }; } };
  try {
    const source = { width: 720, height: 1280 };
    const meta = { frameId: 42, timestampMs: 1500 };
    const pair = freezeEyePair(source, landmarks(), meta);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(args => args[0] === source));
    meta.timestampMs = 9999;
    const event = { image: pair, timestampMs: 1500, lastCoveredMs: 1467, confirmedAtMs: 1633, uncoveredEye: 'left' };
    const encoded = await encodeEyePair(event, 1, 1000);
    assert.equal(encoded.metadata.timestampMs, 1500);
    assert.equal(encoded.metadata.frameId, 42);
    assert.equal(encoded.metadata.t, 500);
    assert.deepEqual(encoded.metadata.crops.left.cropRegion, getEyePairCropRegions(landmarks(), 720, 1280).left);
    assert.equal(Object.keys(encoded.images).length, 2);
    await assert.rejects(encodeEyePair({ ...event, timestampMs: 1510 }, 1, 1000), /CROP_SOURCE_FRAME_MISMATCH/);
  } finally { globalThis.document = original; }
});
