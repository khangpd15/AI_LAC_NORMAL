import assert from 'node:assert/strict';
import test from 'node:test';
import { validateHirschbergQuality } from '../src/services/hirschbergQualityPrescreenService.js';

function eyes() {
  const points = new Array(478);
  for (const [indices, x] of [[[33, 133, 159, 145, 468], .35], [[362, 263, 386, 374, 473], .65]]) {
    for (const i of indices) points[i] = { x, y: .4 };
    points[indices[0]].x -= .05;
    points[indices[1]].x += .05;
    points[indices[2]].y -= .02;
    points[indices[3]].y += .02;
  }
  return points;
}

test('eye-pair crop passes without forehead, chin or nose landmarks', () => {
  const result = validateHirschbergQuality({ landmarks: eyes() });
  assert.equal(result.isAcceptable, true);
  assert.equal(result.requiresBackendEyeValidation, false);
  assert.equal(result.metrics.headPose.pitchDeg, null);
  assert.ok(result.passedChecks.some(check => check.code === 'EYES_OPEN_AND_CLEAR'));
});

test('missing FaceMesh defers eye detection without claiming eyes are verified', () => {
  const result = validateHirschbergQuality();
  assert.equal(result.isAcceptable, true);
  assert.equal(result.requiresBackendEyeValidation, true);
  assert.equal(result.status, 'WARNING');
  assert.ok(result.warnings.some(check => check.code === 'EYE_DETECTION_DEFERRED'));
  assert.equal(result.passedChecks.some(check => check.code === 'EYES_OPEN_AND_CLEAR'), false);
});

test('full face with both eyes remains accepted', () => {
  const points = eyes();
  for (const i of [10, 152, 234, 454, 1, 168]) points[i] = { x: .5, y: .4 };
  points[1].y = .5;
  const result = validateHirschbergQuality({ landmarks: points });
  assert.equal(result.isAcceptable, true);
  assert.ok(result.passedChecks.some(check => check.code === 'HEAD_POSE_CENTERED'));
});

test('cropped face outline does not trigger unreliable full-face pose checks', () => {
  const points = eyes();
  for (const i of [10, 152, 234, 454, 1, 168]) points[i] = { x: .5, y: .4 };
  points[152].y = 1.5;
  points[1].x = .9;
  const result = validateHirschbergQuality({ landmarks: points });
  assert.equal(result.isAcceptable, true);
  assert.equal(result.metrics.headPose.yawDeg, null);
});

test('visible eye landmarks still reject closed eyes and missing irises', () => {
  const closed = eyes();
  closed[159].y = closed[145].y;
  assert.equal(validateHirschbergQuality({ landmarks: closed }).errors[0].code, 'EYES_CLOSED_OR_BLINKING');
  const missing = eyes();
  missing[473] = { x: NaN, y: .4 };
  assert.equal(validateHirschbergQuality({ landmarks: missing }).errors[0].code, 'EYES_NOT_VISIBLE');
});

test('missing full face does not bypass blur and exposure checks', () => {
  const original = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = class {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() {
      return { drawImage() {}, getImageData: () => ({ width: this.width, height: this.height, data: new Uint8ClampedArray(this.width * this.height * 4) }) };
    }
  };
  try {
    const result = validateHirschbergQuality({ element: { width: 640, height: 240 } });
    assert.equal(result.isAcceptable, false);
    assert.ok(result.errors.some(check => check.code === 'IMAGE_BLURRY'));
    assert.ok(result.errors.some(check => check.code === 'IMAGE_TOO_DARK'));
  } finally {
    if (original === undefined) delete globalThis.OffscreenCanvas;
    else globalThis.OffscreenCanvas = original;
  }
});
