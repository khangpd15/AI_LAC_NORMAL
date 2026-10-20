import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderContinuousEye, renderSimulatedEye, STRABISMUS_TYPES } from '../src/services/cv/strabismusEngine.js';

// Synthetic captured eye with contrasting iris/skin: check the actual output
// pixels in both renderers, for either eye direction and a tilted head.
for (const renderEye of [renderContinuousEye, renderSimulatedEye]) {
  for (const angle of [0, 0.35, -0.35]) {
    for (const sign of [-1, 1]) {
      test(`${renderEye.name} preserves lids at tilt ${angle}, direction ${sign}`, () => {
        const rotate = (x, y) => ({ x: 50 + x * Math.cos(angle) - y * Math.sin(angle), y: 40 + x * Math.sin(angle) + y * Math.cos(angle) });
        const contour = Array.from({ length: 16 }, (_, i) => rotate(22 * Math.cos(i * Math.PI / 8), 9 * Math.sin(i * Math.PI / 8)));
        const distance = point => Math.min(...contour.map((a, i) => {
          const b = contour[(i + 1) % contour.length];
          const dx = b.x - a.x, dy = b.y - a.y;
          const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
          return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
        }));
        let captured, output;
        const ctx = {
          canvas: { width: 100, height: 80 },
          getImageData(x, y, width, height) {
            const data = new Uint8ClampedArray(width * height * 4);
            for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
              const value = Math.hypot(x + col - 50, y + row - 40) < 8 ? 30 : 190 + (col % 3);
              data.set([value, value, value, 255], (row * width + col) * 4);
            }
            captured = { x, y, width, height, data: new Uint8ClampedArray(data) };
            return { data, width, height };
          },
          putImageData(image) { output = image; },
        };
        const frame = { pIris: { x: 50, y: 40 }, rIris: 8, canthalWidth: 44, contourPts: contour, isBlinking: false };
        renderEye(ctx, frame, { x: sign * 13 * Math.cos(angle), y: sign * 13 * Math.sin(angle), distance: 13, angleDeg: 35 }, { type: STRABISMUS_TYPES.ESOTROPIA });
        assert.ok(output, 'effect rendered');
        assert.notDeepEqual(output.data, captured.data, 'effect is visible');
        let protectedPixels = 0;
        for (let row = 0; row < captured.height; row++) for (let col = 0; col < captured.width; col++) {
          const x = captured.x + col, y = captured.y + row;
          const u = (x - 50) * Math.cos(angle) + (y - 40) * Math.sin(angle);
          const v = -(x - 50) * Math.sin(angle) + (y - 40) * Math.cos(angle);
          if ((u / 22) ** 2 + (v / 9) ** 2 >= 1 || distance({ x, y }) <= 0.75) {
            const index = (row * captured.width + col) * 4;
            assert.deepEqual(output.data.slice(index, index + 4), captured.data.slice(index, index + 4));
            protectedPixels++;
          }
        }
        assert.ok(protectedPixels > 30);
      });
    }
  }
}
