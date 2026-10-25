import { EyeCoverDetector } from '../cv/eyeCoverDetector.js';
import { getEyeAnatomicalFrame } from '../cv/strabismusEngine.js';

// Evidence is heuristic, never a claim that a hidden iris was measured.
export function classifyEyeVisibility(patch, frame, baseline, oppositePatch = null, oppositeFrame = null) {
  if (!patch || !frame || !baseline || frame.canthalWidth < 6) {
    if (patch && frame && baseline && frame.canthalWidth < 6 && (patch.pupilContrast < 9 || (frame.palpebralHeight / Math.max(1, frame.canthalWidth)) < 0.11)) {
      return 'OCCLUDED';
    }
    return 'UNKNOWN';
  }

  const aperture = frame.palpebralHeight / frame.canthalWidth;
  const contrast = Math.max(8, baseline.pupilContrast * 0.4);

  // 1. Evidence of an occluded / covered eye:
  // - Hand covering the eye eliminates pupil-to-sclera radial contrast.
  // - Low pupil contrast + reduced variation / skin chrominance / collapsed aperture.
  const isContrastLoss = patch.pupilContrast < contrast * 0.75 || patch.pupilContrast < 9.5;
  const isTextureLoss = patch.dynamicRange < baseline.dynamicRange * 0.65 || patch.stdDev < baseline.stdDev * 0.65;
  const isLuminanceShift = patch.mean > baseline.mean + 20 || patch.mean < baseline.mean - 25;
  const isSkinOccluded = (patch.skinRatio >= 0.45 && patch.pupilContrast < 12);
  const isNoPupil = (patch.minLum > 90 && patch.pupilContrast < 11);
  const isApertureClosed = (aperture < 0.11 && patch.pupilContrast < 12);
  const isAsymmetricOccluded = oppositePatch && oppositePatch.pupilContrast >= 10 && patch.pupilContrast < oppositePatch.pupilContrast * 0.55;

  if (isContrastLoss && (isTextureLoss || isLuminanceShift || isSkinOccluded || isNoPupil || isApertureClosed || isAsymmetricOccluded)) {
    return 'OCCLUDED';
  }
  if (isSkinOccluded || (isApertureClosed && patch.pupilContrast < 9)) {
    return 'OCCLUDED';
  }

  // 2. Closed lids or blink without hand occlusion evidence
  if (aperture < 0.12) return 'UNKNOWN';

  // 3. Clear open eye:
  if (
    (patch.pupilContrast >= contrast && patch.dynamicRange >= 24 && patch.stdDev >= 9 && aperture >= 0.12) ||
    (patch.isEyeLike && aperture >= 0.12) ||
    (patch.pupilContrast >= 9.5 && patch.minLum < 95 && aperture >= 0.12)
  ) {
    return 'VISIBLE';
  }

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

    // 1. Arming during cover: Expected eye is OCCLUDED and opposite eye is visible or non-occluded
    if (visibility[this.eye] === 'OCCLUDED' && (visibility[opposite] === 'VISIBLE' || (this.armed && visibility[opposite] !== 'OCCLUDED'))) {
      this.coverStart ??= timestampMs;
      this.lastCovered = timestampMs;
      if (timestampMs - this.coverStart >= 120) this.armed = true;
      this.candidate = null;
      return null;
    }

    // 2. Both eyes not yet clearly open:
    if (visibility.left !== 'VISIBLE' || visibility.right !== 'VISIBLE') {
      this.coverStart = null;
      // Preserve armed state through brief transient blink of opposite eye or within transition window
      this.armed = this.armed && (visibility[opposite] === 'VISIBLE' || (timestampMs - this.lastCovered <= 350)) &&
        timestampMs - this.lastCovered <= UNCOVER_WINDOW_MS;
      this.candidate = null;
      return null;
    }

    // 3. Both eyes are VISIBLE: Check if armed and within uncover window
    if (!this.armed || (!this.candidate && timestampMs - this.lastCovered > UNCOVER_WINDOW_MS)) {
      this.armed = false;
      this.coverStart = null;
      return null;
    }

    // 4. First clear frame after uncover: capture candidate image pair
    if (!this.candidate) {
      const image = candidate();
      if (image) this.candidate = { image, timestampMs, lastCoveredMs: this.lastCovered };
      return null;
    }

    // 5. Second clear frame: confirm uncover event and return
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
    const frames = {};
    const patches = {};

    // Pass 1: Extract frames & patches where landmarks exist
    for (const [side, offset] of [['left', 0], ['right', 32]]) {
      const frame = getEyeAnatomicalFrame(landmarks, side.toUpperCase(), source.width, source.height);
      frames[side] = frame;
      if (frame) {
        patches[side] = this.sampler.sampleEyePatch(source, frame.pIris.x, frame.pIris.y,
          frame.canthalWidth * 1.5, frame.canthalWidth * 1.05, offset, 0, 32, 24);
      }
    }

    // Pass 2: Classify visibility with fallback and opposite-eye awareness
    const hasFace = Boolean(landmarks && (landmarks[1] || landmarks[168] || landmarks[152] || landmarks[10]));

    for (const side of ['left', 'right']) {
      const opposite = side === 'left' ? 'right' : 'left';
      const frame = frames[side];
      const patch = patches[side];

      if (!frame || !patch) {
        // If face landmarks or opposite eye landmarks exist, but this eye has no frame,
        // it means the eye is completely covered / occluded by the hand!
        if (hasFace || frames[opposite]) {
          visibility[side] = 'OCCLUDED';
        } else {
          visibility[side] = 'UNKNOWN';
        }
        continue;
      }

      // Update baseline during BASELINE or PREPARING phase when eye is open
      if ((phase === 'BASELINE' || phase === 'PREPARING') &&
          frame.palpebralHeight / frame.canthalWidth >= 0.11 &&
          patch.isEyeLike && patch.stdDev >= 9) {
        const previous = this.baselines[side];
        this.baselines[side] = Object.fromEntries(['pupilContrast', 'dynamicRange', 'stdDev', 'mean']
          .map(key => [key, previous ? previous[key] * 0.8 + patch[key] * 0.2 : patch[key]]));
        this.baselineCounts[side] = (this.baselineCounts[side] || 0) + 1;
      }

      // Provide robust fallback baseline so classification never stalls on null baseline
      const baseline = (this.baselineCounts[side] >= 1 ? this.baselines[side] : null) ||
        (phase === 'COVER' || phase === 'TRACKING' ? { pupilContrast: 18, dynamicRange: 45, stdDev: 15, mean: 110 } : null);

      visibility[side] = classifyEyeVisibility(patch, frame, baseline, patches[opposite], frames[opposite]);
    }

    // Pass 3: Cross-validate with AI EyeCoverDetector during COVER/PREPARING phase
    if (this.transition.eye && (phase === 'COVER' || phase === 'PREPARING')) {
      const expectedCover = this.transition.eye;
      const opposite = expectedCover === 'left' ? 'right' : 'left';
      if (visibility[expectedCover] !== 'OCCLUDED' && landmarks) {
        const aiDet = this.sampler.detect(source, [landmarks]);
        if (aiDet.isCovered && (aiDet.side === expectedCover || aiDet.side === 'both' || aiDet.side === 'one_eye')) {
          visibility[expectedCover] = 'OCCLUDED';
          if (visibility[opposite] === 'OCCLUDED' && aiDet.side === expectedCover) {
            visibility[opposite] = 'VISIBLE';
          }
        }
      }
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
    let cropRegion = null;
    const frame = getEyeAnatomicalFrame(landmarks, side.toUpperCase(), source.width, source.height);
    if (frame && frame.canthalWidth >= 6) {
      const xs = frame.contourPts.map(p => p.x), ys = frame.contourPts.map(p => p.y);
      const pad = frame.canthalWidth * 0.3;
      const x = Math.max(0, Math.floor(Math.min(...xs) - pad));
      const y = Math.max(0, Math.floor(Math.min(...ys) - pad));
      const width = Math.min(source.width - x, Math.ceil(Math.max(...xs) + pad) - x);
      const height = Math.min(source.height - y, Math.ceil(Math.max(...ys) + pad) - y);
      if (width >= 8 && height >= 8) {
        cropRegion = { x, y, width, height };
      }
    }

    // Robust fallback if some perimeter contour landmarks are missing
    if (!cropRegion && landmarks && landmarks.length > 0) {
      const isLeft = side.toLowerCase() === 'left';
      const innerIdx = isLeft ? 362 : 133;
      const outerIdx = isLeft ? 263 : 33;
      const topIdx = isLeft ? 386 : 159;
      const botIdx = isLeft ? 374 : 145;
      const pIn = landmarks[innerIdx];
      const pOut = landmarks[outerIdx];
      if (pIn && pOut && Number.isFinite(pIn.x) && Number.isFinite(pOut.x)) {
        const pTop = landmarks[topIdx] || { y: (pIn.y + pOut.y) / 2 - 0.03 };
        const pBot = landmarks[botIdx] || { y: (pIn.y + pOut.y) / 2 + 0.03 };
        const minX = Math.min(pIn.x, pOut.x) * source.width;
        const maxX = Math.max(pIn.x, pOut.x) * source.width;
        const minY = Math.min(pTop.y, pBot.y, pIn.y, pOut.y) * source.height;
        const maxY = Math.max(pTop.y, pBot.y, pIn.y, pOut.y) * source.height;
        const eyeW = Math.max(12, maxX - minX);
        const padX = Math.max(8, eyeW * 0.35);
        const padY = Math.max(8, (maxY - minY) * 0.5);
        const x = Math.max(0, Math.floor(minX - padX));
        const y = Math.max(0, Math.floor(minY - padY));
        const width = Math.min(source.width - x, Math.ceil(maxX + padX) - x);
        const height = Math.min(source.height - y, Math.ceil(maxY + padY) - y);
        if (width >= 8 && height >= 8) {
          cropRegion = { x, y, width, height };
        }
      }
    }

    if (!cropRegion) return null;

    const { x, y, width, height } = cropRegion;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
    eyes[side] = { canvas, cropRegion };
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
