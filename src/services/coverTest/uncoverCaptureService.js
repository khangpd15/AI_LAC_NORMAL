import { EyeCoverDetector } from '../cv/eyeCoverDetector.js';
import { getEyeAnatomicalFrame } from '../cv/strabismusEngine.js';

// Evidence is heuristic, never a claim that a hidden iris was measured.
export function classifyEyeVisibility(patch, frame, baseline) {
  if (!patch || !frame || !baseline || frame.canthalWidth < 6) return 'UNKNOWN';
  const aperture = frame.palpebralHeight / frame.canthalWidth;
  const contrast = Math.max(9, baseline.pupilContrast * 0.4);
  // Hidden-eye landmarks can collapse while a hand covers the eye. Evaluate
  // pixel evidence first; lid aperture alone is never evidence of a cover.
  if (patch.pupilContrast < contrast * 0.7 &&
      (patch.dynamicRange < baseline.dynamicRange * 0.6 ||
       patch.stdDev < baseline.stdDev * 0.65 ||
       patch.mean > baseline.mean + 22 || patch.mean < baseline.mean - 25)) return 'OCCLUDED';
  if (aperture < 0.12) return 'UNKNOWN';
  if (patch.pupilContrast >= contrast && patch.dynamicRange >= 28 && patch.stdDev >= 10) return 'VISIBLE';
  return 'UNKNOWN';
}

/** Keeps the FIRST clear frame while waiting for a second clear observation.
 * The event time is bounded by the last occluded and first clear frames.
 */
const UNCOVER_WINDOW_MS = 700;

export class UncoverTransition {
  constructor() { this.reset(); }
  reset(expectedEye = null) {
    this.eye = expectedEye;
    this.coverStart = null;
    this.armed = false;
    this.candidate = null;
    this.lastTimestamp = null;
    this.lastCovered = null;
    this.done = false;
  }
  update({ timestampMs, visibility, candidate }) {
    if (this.done || !this.eye || !Number.isFinite(timestampMs) ||
        (this.lastTimestamp !== null && timestampMs <= this.lastTimestamp)) return null;
    if (this.lastTimestamp !== null && timestampMs - this.lastTimestamp > 500) {
      this.coverStart = null;
      this.armed = false;
      this.candidate = null;
    }
    this.lastTimestamp = timestampMs;
    const opposite = this.eye === 'left' ? 'right' : 'left';
    if (visibility[this.eye] === 'OCCLUDED' && visibility[opposite] === 'VISIBLE') {
      this.coverStart ??= timestampMs;
      this.lastCovered = timestampMs;
      if (timestampMs - this.coverStart >= 200) this.armed = true;
      this.candidate = null;
      return null;
    }
    if (visibility.left !== 'VISIBLE' || visibility.right !== 'VISIBLE') {
      this.coverStart = null;
      // A hand passing away from an already-confirmed cover may briefly be
      // ambiguous. Preserve evidence only while the other eye stays visible.
      this.armed = this.armed && visibility[opposite] === 'VISIBLE' &&
        timestampMs - this.lastCovered <= UNCOVER_WINDOW_MS;
      this.candidate = null;
      return null;
    }
    if (!this.armed || (!this.candidate && timestampMs - this.lastCovered > UNCOVER_WINDOW_MS)) {
      this.armed = false;
      this.coverStart = null;
      return null;
    }
    if (!this.candidate) {
      const image = candidate();
      if (image) this.candidate = { image, timestampMs, lastCoveredMs: this.lastCovered };
      return null;
    }
    this.done = true;
    return { ...this.candidate, confirmedAtMs: timestampMs, uncoveredEye: this.eye };
  }
}

export class UncoverCaptureObserver {
  constructor() {
    this.sampler = new EyeCoverDetector();
    this.transition = new UncoverTransition();
    this.baselines = {};
    this.baselineCounts = {};
  }
  reset() {
    this.baselines = {};
    this.baselineCounts = {};
    this.transition.reset();
  }
  observe(source, landmarks, timestampMs, phase, makeCandidate) {
    const visibility = {};
    for (const [side, offset] of [['left', 0], ['right', 32]]) {
      const frame = getEyeAnatomicalFrame(landmarks, side.toUpperCase(), source.width, source.height);
      if (!frame) { visibility[side] = 'UNKNOWN'; continue; }
      const patch = this.sampler.sampleEyePatch(source, frame.pIris.x, frame.pIris.y,
        frame.canthalWidth * 1.5, frame.canthalWidth * 1.05, offset, 0, 32, 24);
      if (phase === 'BASELINE' && frame.palpebralHeight / frame.canthalWidth >= 0.12 &&
          patch.isEyeLike && patch.stdDev >= 10) {
        const previous = this.baselines[side];
        this.baselines[side] = Object.fromEntries(['pupilContrast', 'dynamicRange', 'stdDev', 'mean']
          .map(key => [key, previous ? previous[key] * 0.8 + patch[key] * 0.2 : patch[key]]));
        this.baselineCounts[side] = (this.baselineCounts[side] || 0) + 1;
      }
      visibility[side] = classifyEyeVisibility(patch, frame,
        this.baselineCounts[side] >= 5 ? this.baselines[side] : null);
    }
    const event = this.transition.update({ timestampMs, visibility, candidate: makeCandidate });
    return { visibility, event };
  }
}

/** Copy BOTH crops synchronously, before the inference canvas is reused.
 * JPEG encoding may complete later; frame metadata must never be re-timestamped.
 */
export function freezeEyePair(source, landmarks, frameMetadata) {
  const eyes = {};
  for (const side of ['left', 'right']) {
    const frame = getEyeAnatomicalFrame(landmarks, side.toUpperCase(), source.width, source.height);
    if (!frame || frame.canthalWidth < 6) return null;
    const xs = frame.contourPts.map(p => p.x), ys = frame.contourPts.map(p => p.y);
    const pad = frame.canthalWidth * 0.3;
    const x = Math.max(0, Math.floor(Math.min(...xs) - pad));
    const y = Math.max(0, Math.floor(Math.min(...ys) - pad));
    const width = Math.min(source.width - x, Math.ceil(Math.max(...xs) + pad) - x);
    const height = Math.min(source.height - y, Math.ceil(Math.max(...ys) + pad) - y);
    if (width < 8 || height < 8) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
    eyes[side] = { canvas, cropRegion: { x, y, width, height } };
  }
  return { frame: { ...frameMetadata }, eyes };
}

export async function encodeEyePair(event, cycle, cycleStartMs) {
  const eventId = `c${cycle}_${event.uncoveredEye}_uncover`;
  const images = {};
  const crops = {};
  await Promise.all(['left', 'right'].map(async side => {
    const { canvas, cropRegion } = event.image.eyes[side];
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('JPEG_ENCODING_FAILED');
    const field = `${eventId}_${side}_eye`;
    images[field] = blob;
    crops[side] = { field, file: `${field}.jpg`, width: canvas.width, height: canvas.height, cropRegion };
  }));
  return {
    images,
    metadata: {
      eventId, cycle, uncoveredEye: event.uncoveredEye.toUpperCase(), status: 'CAPTURED',
      trigger: 'OBSERVED_OCCLUDED_TO_VISIBLE', detector: 'pixel-contrast-v1',
      ...event.image.frame,
      t: event.timestampMs - cycleStartMs,
      timestampMs: event.timestampMs, confirmedAtMs: event.confirmedAtMs,
      onsetIntervalMs: [event.lastCoveredMs, event.timestampMs],
      timingUncertaintyMs: event.timestampMs - event.lastCoveredMs,
      mirrored: false, crops,
    },
  };
}
