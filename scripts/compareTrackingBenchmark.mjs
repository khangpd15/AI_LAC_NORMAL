import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { extractEyeFeatures, sharedLandmarkFilter } from '../src/services/eyeFeatureService.js';
import { stabilizeSimulationLandmarks } from '../src/services/cv/simulationTracking.js';
import { LEFT_EYE_CONTOUR, RIGHT_EYE_CONTOUR, getEyeAnatomicalFrame, updateSimulationBlink } from '../src/services/cv/strabismusEngine.js';
import { LANDMARKS } from '../src/constants/screeningConfig.js';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'docs', 'tracking-benchmark');
fs.mkdirSync(output, { recursive: true });
const mean = values => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)] ?? null;
const indices = [...new Set([...LEFT_EYE_CONTOUR, ...RIGHT_EYE_CONTOUR, 468, 473])];
const summaries = [];
const traces = [];

// Estimate delay relative to shared unfiltered FaceMesh, not human ground truth.
function lag(rows, method, key) {
  const gaze = (points, side) => {
    const inner = points[LANDMARKS[`${side}_INNER_CANTHUS`]];
    const outer = points[LANDMARKS[`${side}_OUTER_CANTHUS`]];
    const iris = points[LANDMARKS[`${side}_IRIS_CENTER`]];
    const dx = inner.x - outer.x, dy = inner.y - outer.y;
    return ((iris.x - outer.x) * dx + (iris.y - outer.y) * dy) / Math.max(1e-8, dx * dx + dy * dy);
  };
  const scores = [];
  for (let offset = 0; offset <= 10; offset++) {
    const errors = [];
    for (let i = 10; i < rows.length; i++) {
      const a = rows[i], b = rows[i - offset];
      if (!a?.[method] || !b?.raw || a.index - b.index !== offset) continue;
      if (rows.slice(i - 10, i + 1).some(row => !row.raw)) continue;
      for (const side of ['LEFT', 'RIGHT']) {
        if (key === 'GAZE') {
          errors.push((gaze(a[method], side) - gaze(b.raw, side)) ** 2);
          continue;
        }
        const idx = LANDMARKS[`${side}_${key}`];
        errors.push((a[method][idx].x - b.raw[idx].x) ** 2 + (a[method][idx].y - b.raw[idx].y) ** 2);
      }
    }
    scores.push({ frames: offset, mse: mean(errors), n: errors.length });
  }
  const best = scores.filter(row => row.n).sort((a, b) => a.mse - b.mse)[0];
  return best?.frames ?? null;
}

for (const file of fs.readdirSync(path.join(root, 'tracking-benchmark.local')).filter(name => name.endsWith('.jsonl'))) {
  let metadata, previous = null, previousTime = null;
  const rows = [], inference = [], dt = [];
  let detected = 0, simClosed = 0, coverMasked = 0;
  const blink = {};
  sharedLandmarkFilter.reset();
  const input = readline.createInterface({ input: fs.createReadStream(path.join(root, 'tracking-benchmark.local', file)) });
  for await (const line of input) {
    const record = JSON.parse(line);
    if (!metadata) { metadata = record; continue; }
    const { index, ptsMs, landmarks, nativeInferenceMs } = record;
    if (rows.length) dt.push(ptsMs - rows.at(-1).ptsMs);
    inference.push(nativeInferenceMs);
    if (!landmarks) {
      previous = null;
      rows.push({ index, ptsMs });
      continue;
    }
    const raw = landmarks.map(([x, y, z]) => ({ x, y, z }));
    const sim = stabilizeSimulationLandmarks(raw, previous, previousTime === null ? 1000 / 30 : ptsMs - previousTime, { mobile: true });
    const cover = extractEyeFeatures(raw, ptsMs, { applySmoothing: true, resetBlinkBuffer: detected === 0 });
    previous = sim;
    previousTime = ptsMs;
    detected++;
    for (const side of ['LEFT', 'RIGHT']) {
      const frame = getEyeAnatomicalFrame(sim, side, metadata.width, metadata.height);
      blink[side] = updateSimulationBlink(frame, blink[side]);
      if (blink[side].closed) simClosed++;
      if (cover[`isBlinkMasked${side === 'LEFT' ? 'Left' : 'Right'}`]) coverMasked++;
    }
    rows.push({ index, ptsMs, raw, sim, cover: cover.raw.landmarks });
  }
  const summary = {
    ...metadata, frames: rows.length, detected, detectionPercent: 100 * detected / rows.length,
    ptsMedianIntervalMs: percentile(dt, 0.5), ptsMinIntervalMs: Math.min(...dt), ptsMaxIntervalMs: Math.max(...dt),
    nativeInferenceMedianMs: percentile(inference, 0.5),
    // These durations are CPU native measurements, not browser/mobile measurements.
    nativeInferenceP95Ms: percentile(inference, 0.95),
    simulationLidLagFrames: lag(rows, 'sim', 'TOP_LID'),
    coverLidLagFrames: lag(rows, 'cover', 'TOP_LID'),
    simulationIrisLagFrames: lag(rows, 'sim', 'IRIS_CENTER'),
    coverIrisLagFrames: lag(rows, 'cover', 'IRIS_CENTER'),
    simulationRelativeGazeLagFrames: lag(rows, 'sim', 'GAZE'),
    coverRelativeGazeLagFrames: lag(rows, 'cover', 'GAZE'),
    simulationClosedEyePercent: 100 * simClosed / (2 * detected),
    coverMaskedEyePercent: 100 * coverMasked / (2 * detected),
  };
  summaries.push(summary);
  traces.push({
    file: metadata.file, fps: metadata.fps,
    frames: rows.map(row => ({
      index: row.index, ptsMs: row.ptsMs,
      ...Object.fromEntries(['raw', 'sim', 'cover'].map(method => [
        method, row[method] ? Object.fromEntries(indices.map(i => [i, [row[method][i].x, row[method][i].y]])) : null,
      ])),
    })),
  });
  console.log(JSON.stringify(summary));
}

// Reproduce the phase-loop's repeated reads with 60Hz display / 30Hz camera.
// Artificial delivery delay is explicit; this is a scheduling model, not a device measurement.
const clockScenarios = [0, 15, 40, 70].map(latencyMs => {
  const source = Array.from({ length: 300 }, (_, i) => i * 1000 / 30);
  const samples = [];
  for (let tick = 0; tick < 600; tick++) {
    const now = tick * 1000 / 60;
    if (now < latencyMs) continue;
    const index = Math.min(299, Math.floor((now - latencyMs + 1e-7) / (1000 / 30)));
    if (index >= 0) samples.push({ index, writtenMs: now, sourceMs: source[index] });
  }
  return {
    latencyMs, cameraFps: 30, displayHz: 60, reads: samples.length,
    uniqueFrames: new Set(samples.map(s => s.index)).size,
    duplicatePercent: 100 * (samples.length - new Set(samples.map(s => s.index)).size) / samples.length,
    medianTimestampErrorMs: percentile(samples.map(s => s.writtenMs - s.sourceMs), 0.5),
    maxTimestampErrorMs: Math.max(...samples.map(s => s.writtenMs - s.sourceMs)),
  };
});
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ summaries, clockScenarios }, null, 2));
fs.writeFileSync(path.join(root, 'tracking-benchmark.local', 'overlay-traces.json'), JSON.stringify(traces));
const columns = Object.keys(summaries[0]);
fs.writeFileSync(path.join(output, 'results.csv'), columns.join(',') + '\n' + summaries.map(row => columns.map(key => row[key]).join(',')).join('\n') + '\n');
