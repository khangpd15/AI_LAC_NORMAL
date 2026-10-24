import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractEyeFeatures } from '../src/services/eyeFeatureService.js';
import { createCoverFrame } from '../src/services/coverTestProtocolService.js';

function eyeLandmarks(width, height, opening, roll = 0) {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  for (const [cx, inner, outer, iris, tops, bottoms] of [
    [width * 0.6, 362, 263, 473, [385, 386], [380, 374]],
    [width * 0.4, 133, 33, 468, [158, 159], [153, 145]],
  ]) {
    const put = (id, x, y) => { points[id] = {
      x: (cx + x * Math.cos(roll) - y * Math.sin(roll)) / width,
      y: (height / 2 + x * Math.sin(roll) + y * Math.cos(roll)) / height,
    }; };
    put(inner, -30, 0); put(outer, 30, 0); put(iris, 0, 0);
    tops.forEach((id, i) => put(id, i * 10 - 5, -opening / 2));
    bottoms.forEach((id, i) => put(id, i * 10 - 5, opening / 2));
  }
  return points;
}

for (const [width, height] of [[480, 640], [720, 1280], [640, 480]]) {
  for (const roll of [0, 0.2]) {
    test(`open eyes produce baseline samples at ${width}x${height}, roll ${roll}`, () => {
      const features = extractEyeFeatures(eyeLandmarks(width, height, 15, roll), 1000, {
        videoWidth: width, videoHeight: height, resetBlinkBuffer: true,
      });
      assert.equal(features.leftEar, 0.25);
      assert.equal(features.rightEar, 0.25);
      assert.equal(features.isBlinkMasked, false);
      const quality = { faceDetected: true, irisValid: true, leftEyeDetected: true, rightEyeDetected: true };
      for (const eye of ['left', 'right']) assert.ok(createCoverFrame(features, quality, eye, 1000, 0).frame);
    });
  }
  test(`closed eyes are still rejected at ${width}x${height}`, () => {
    const features = extractEyeFeatures(eyeLandmarks(width, height, 3), 1000, {
      videoWidth: width, videoHeight: height, resetBlinkBuffer: true,
    });
    assert.equal(features.isBlinkLeft, true);
    assert.equal(features.isBlinkRight, true);
  });
}
