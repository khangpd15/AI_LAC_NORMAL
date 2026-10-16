import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderContinuousEye, updateSimulationBlink } from '../src/services/cv/strabismusEngine.js';

const frame = {
  pIris: { x: 40, y: 30 }, rIris: 8, canthalWidth: 40, palpebralHeight: 14, isBlinking: false,
  contourPts: Array.from({ length: 16 }, (_, i) => ({ x: 40 + 20 * Math.cos(i * Math.PI / 8), y: 30 + 7 * Math.sin(i * Math.PI / 8) })),
};

function render({ light = 190, distance = 7, blinking = false } = {}) {
  let result;
  let original;
  const context = {
    canvas: { width: 80, height: 60 },
    getImageData(x, y, width, height) {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const index = (row * width + col) * 4;
          const value = Math.hypot(x + col - 40, y + row - 30) < 7 ? light * 0.2 : light;
          data[index] = data[index + 1] = data[index + 2] = value;
          data[index + 3] = 255;
        }
      }
      original = new Uint8ClampedArray(data);
      return { data, width, height };
    },
    putImageData(image, x, y) { result = { ...image, x, y }; },
  };
  renderContinuousEye(context, { ...frame, isBlinking: blinking }, { x: distance, y: 0, distance, angleDeg: 25 });
  return { result, original };
}

test('narrow-eye lid noise does not toggle the simulation across the old blink cutoff', () => {
  let state;
  for (const ratio of [0.15, 0.17, 0.145, 0.16, 0.14, 0.165]) {
    state = updateSimulationBlink({ canthalWidth: 40, palpebralHeight: ratio * 40 }, state);
    assert.equal(state.closed, false);
  }
  state = updateSimulationBlink({ canthalWidth: 40, palpebralHeight: 0.02 * 40 }, state);
  assert.equal(state.closed, true);
  state = updateSimulationBlink({ canthalWidth: 40, palpebralHeight: 0.07 * 40 }, state);
  assert.equal(state.closed, true);
  state = updateSimulationBlink({ canthalWidth: 40, palpebralHeight: 0.15 * 40 }, state);
  assert.equal(state.closed, false);
});

test('continuous warp remains active in dim light without reliable sclera donors', () => {
  const { result, original } = render({ light: 8 });
  assert.ok(result);
  assert.notDeepEqual(result.data, original);
  for (let index = 3; index < result.data.length; index += 4) assert.equal(result.data[index], 255);
});

test('subpixel movement changes texture gradually and leaves pixels outside the lids intact', () => {
  const first = render({ distance: 7 });
  const second = render({ distance: 7.05 });
  let sum = 0;
  for (let row = 0; row < first.result.height; row++) {
    for (let col = 0; col < first.result.width; col++) {
      const index = (row * first.result.width + col) * 4;
      sum += Math.abs(first.result.data[index] - second.result.data[index]);
      const x = first.result.x + col, y = first.result.y + row;
      if (((x - 40) / 20) ** 2 + ((y - 30) / 7) ** 2 >= 1) {
        assert.equal(first.result.data[index], first.original[index]);
      }
    }
  }
  assert.ok(sum / (first.result.width * first.result.height) < 1);
});

test('a true blink and the original-view setting leave the image untouched', () => {
  assert.equal(render({ blinking: true }).result, undefined);
  assert.equal(render({ distance: 0 }).result, undefined);
});
