import { EyeCoverDetector } from '../cv/eyeCoverDetector.js';
import { getEyeAnatomicalFrame } from '../cv/strabismusEngine.js';
import { getCanthalMovementCoordinates, COVER_EVENT_LIMITS } from './coverEventMeasurementService.js';
import { getEyePairCropRegions } from './eyeCropGeometry.js';

// All limits describe engineering evidence, not clinical confidence.
export const EYE_APPEARANCE_LIMITS = Object.freeze({
  minCorrelation: 0.65, minBaselineSamples: 5, minContrastRatio: 0.65,
  maxTextureRatio: 1.8, minOpenMs: COVER_EVENT_LIMITS.minOpenMs, minOpenFrames: COVER_EVENT_LIMITS.minOpenFrames,
});

export function isUncoverCaptureEligible(features, quality) {
  return Boolean(features && quality?.faceDetected && quality.irisValid &&
    quality.leftEyeDetected && quality.rightEyeDetected && quality.headPoseValid !== false &&
    quality.blinkDetected !== true &&
    ['isBlinkMasked', 'isBlinking', 'isBlinkMaskedLeft', 'isBlinkMaskedRight', 'isBlinkLeft', 'isBlinkRight']
      .every(key => features[key] !== true));
}

export function appearanceCorrelation(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 48 || b.length !== 48 ||
      !a.every(Number.isFinite) || !b.every(Number.isFinite)) return null;
  const am = a.reduce((sum, v) => sum + v, 0) / a.length;
  const bm = b.reduce((sum, v) => sum + v, 0) / b.length;
  let covariance = 0, av = 0, bv = 0;
  for (let i = 0; i < a.length; i++) {
    covariance += (a[i] - am) * (b[i] - bm);
    av += (a[i] - am) ** 2;
    bv += (b[i] - bm) ** 2;
  }
  return av > 1 && bv > 1 ? Math.max(-1, Math.min(1, covariance / Math.sqrt(av * bv))) : null;
}

export function eyeAppearanceEvidence(patch, baseline, oppositePatch = null, oppositeBaseline = null) {
  if (!patch || !baseline) return null;
  // Common exposure changes should not look like an occluder on one eye.
  const oppositeReliable = oppositePatch && oppositeBaseline &&
    appearanceCorrelation(oppositePatch.appearance, oppositeBaseline.appearance) >= EYE_APPEARANCE_LIMITS.minCorrelation;
  const exposureShift = oppositeReliable ? oppositePatch.mean - oppositeBaseline.mean : 0;
  const contrastScale = oppositeReliable && oppositeBaseline?.pupilContrast > 0
    ? Math.min(1.8, Math.max(0.5, oppositePatch.pupilContrast / oppositeBaseline.pupilContrast)) : 1;
  return {
    correlation: appearanceCorrelation(patch.appearance, baseline.appearance),
    exposureShift,
    contrastThreshold: Math.max(11, baseline.pupilContrast * EYE_APPEARANCE_LIMITS.minContrastRatio * contrastScale),
    meanShift: patch.mean - baseline.mean - exposureShift,
    textureRatio: patch.stdDev / Math.max(1, baseline.stdDev),
    maxMeanShift: Math.max(25, baseline.stdDev * 1.5),
  };
}

// Scalar darkness alone cannot establish that an eye is actually visible.
export function classifyEyeVisibility(patch, frame, baseline, oppositePatch = null, _oppositeFrame = null, oppositeBaseline = null) {
  if (!patch || !frame || !baseline || !Number.isFinite(frame.canthalWidth) || frame.canthalWidth < 6 ||
      !Number.isFinite(frame.palpebralHeight) ||
      !['mean', 'stdDev', 'pupilContrast', 'minLum', 'dynamicRange'].every(key =>
        Number.isFinite(patch[key]) && Number.isFinite(baseline[key]))) return 'UNKNOWN';
  const aperture = frame.palpebralHeight / frame.canthalWidth;
  if (aperture < 0.14) return 'UNKNOWN';
  const evidence = eyeAppearanceEvidence(patch, baseline, oppositePatch, oppositeBaseline);
  const contrastLost = patch.pupilContrast < evidence.contrastThreshold;
  const structureLost = evidence.correlation === null || evidence.correlation < EYE_APPEARANCE_LIMITS.minCorrelation;
  const foreignSurface = evidence.textureRatio > EYE_APPEARANCE_LIMITS.maxTextureRatio &&
    evidence.meanShift > evidence.maxMeanShift;
  const flattened = patch.stdDev < Math.max(9, baseline.stdDev * 0.5) || patch.dynamicRange < 24;
  if (foreignSurface || (contrastLost && (structureLost || flattened || Math.abs(evidence.meanShift) > evidence.maxMeanShift))) {
    return 'OCCLUDED';
  }
  const hasDarkPupil = Number.isFinite(patch.minLum) && patch.minLum <= Math.min(115, baseline.minLum + 25 + evidence.exposureShift);
  if (!structureLost && !contrastLost && !foreignSurface && hasDarkPupil &&
      patch.dynamicRange >= 24 && patch.stdDev >= 9) return 'VISIBLE';
  return 'UNKNOWN';
}

/** Keeps the FIRST clear frame while confirming sustained visibility.
 * The event time is bounded by the last occluded and first clear frames.
 */
export class UncoverTransition {
  constructor(windowMs = 500) {
    this.windowMs = windowMs;
    this.reset();
  }
  reset(expectedEye = null) {
    this.eye = expectedEye;
    this.coverStart = null;
    this.armed = false;
    this.candidate = null;
    this.lastTimestamp = null;
    this.lastCovered = null;
    this.done = false;
    this.clearFrames = 0;
  }
  update({ timestampMs, visibility, candidate }) {
    if (this.done || !this.eye || !Number.isFinite(timestampMs) ||
        (this.lastTimestamp !== null && timestampMs <= this.lastTimestamp)) return null;
    if (this.lastTimestamp !== null && timestampMs - this.lastTimestamp > COVER_EVENT_LIMITS.maxGapMs) {
      this.coverStart = null;
      this.armed = false;
      this.candidate = null;
      this.clearFrames = 0;
    }
    this.lastTimestamp = timestampMs;
    const opposite = this.eye === 'left' ? 'right' : 'left';

    // 1. Arming during cover: Expected eye is OCCLUDED.
    if (visibility[this.eye] === 'OCCLUDED' && visibility[opposite] === 'VISIBLE') {
      this.coverStart ??= timestampMs;
      this.lastCovered = timestampMs;
      if (timestampMs - this.coverStart >= 120) this.armed = true;
      this.candidate = null;
      this.clearFrames = 0;
      return null;
    }

    // 2. Both eyes not yet clearly open:
    if (visibility.left !== 'VISIBLE' || visibility.right !== 'VISIBLE') {
      this.coverStart = null;
      // UNKNOWN never refreshes occlusion time. A short blink may recover;
      // a long gap requires observed occlusion again before another capture.
      this.armed = this.armed && timestampMs - this.lastCovered <= 250;
      this.candidate = null;
      this.clearFrames = 0;
      return null;
    }

    // 3. Both eyes are VISIBLE: Check if armed and within uncover window
    if (!this.armed || (!this.candidate && timestampMs - this.lastCovered > Math.min(this.windowMs, COVER_EVENT_LIMITS.maxGapMs))) {
      this.armed = false;
      this.coverStart = null;
      return null;
    }

    // 4. First clear frame after uncover: capture candidate image pair
    if (!this.candidate) {
      const image = candidate();
      if (image) {
        this.candidate = { image, timestampMs, lastCoveredMs: this.lastCovered };
        this.clearFrames = 1;
      }
      return null;
    }

    // Confirm sustained opening, while preserving the FIRST clear source image.
    this.clearFrames++;
    if (this.clearFrames < EYE_APPEARANCE_LIMITS.minOpenFrames ||
        timestampMs - this.candidate.timestampMs < EYE_APPEARANCE_LIMITS.minOpenMs) return null;
    this.done = true;
    return { ...this.candidate, confirmedAtMs: timestampMs, uncoveredEye: this.eye };
  }
}

export class UncoverCaptureObserver {
  constructor() {
    this.sampler = new EyeCoverDetector();
    this.transition = new UncoverTransition(1800);
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

    // Pass 2: Classify observed appearance against each eye's own baseline.
    for (const side of ['left', 'right']) {
      const opposite = side === 'left' ? 'right' : 'left';
      const frame = frames[side];
      const patch = patches[side];

      if (!frame || !patch) {
        visibility[side] = 'UNKNOWN';
        continue;
      }

      // Update baseline during BASELINE or PREPARING phase when eye is open
      if ((phase === 'BASELINE' || phase === 'PREPARING') &&
          frame.palpebralHeight / frame.canthalWidth >= 0.11 &&
          patch.isEyeLike && patch.stdDev >= 9) {
        const previous = this.baselines[side];
        this.baselines[side] = Object.fromEntries(['pupilContrast', 'dynamicRange', 'stdDev', 'mean', 'minLum']
          .filter(key => patch[key] !== undefined)
          .map(key => [key, previous && previous[key] !== undefined ? previous[key] * 0.8 + patch[key] * 0.2 : patch[key]]));
        this.baselineCounts[side] = (this.baselineCounts[side] || 0) + 1;
        if (patch.appearance) this.baselines[side].appearance = patch.appearance.map((value, i) =>
          previous?.appearance ? previous.appearance[i] * 0.8 + value * 0.2 : value);
      }

      const baseline = this.baselineCounts[side] >= EYE_APPEARANCE_LIMITS.minBaselineSamples ? this.baselines[side] : null;

      visibility[side] = classifyEyeVisibility(patch, frame, baseline, patches[opposite], frames[opposite], this.baselines[opposite]);
    }

    // Measurements require sampled image evidence, independent of fallback hints
    // used for capture feedback. Missing landmarks and closed lids stay unknown.
    const measurementVisibility = Object.fromEntries(['left', 'right'].map(side => [side,
      frames[side] && patches[side] && this.baselineCounts[side] >= EYE_APPEARANCE_LIMITS.minBaselineSamples &&
        frames[side].palpebralHeight / frames[side].canthalWidth >= 0.14
        ? visibility[side] : 'UNKNOWN',
    ]));

    const debugMetrics = {
      timestampMs,
      left: patches.left ? {
        minLum: patches.left.minLum,
        pupilContrast: Number(patches.left.pupilContrast?.toFixed(2)),
        dynamicRange: Number(patches.left.dynamicRange?.toFixed(2)),
        stdDev: Number(patches.left.stdDev?.toFixed(2)),
        mean: Number(patches.left.mean?.toFixed(2)),
        aperture: frames.left && frames.left.canthalWidth > 0 ? Number((frames.left.palpebralHeight / frames.left.canthalWidth).toFixed(3)) : null,
        skinRatio: Number(patches.left.skinRatio?.toFixed(3)),
        isLuminanceShift: this.baselines?.left ? Boolean(patches.left.mean > this.baselines.left.mean + 20 || patches.left.mean < this.baselines.left.mean - 25) : false,
        visibility: visibility.left,
        appearance: eyeAppearanceEvidence(patches.left, this.baselines.left, patches.right, this.baselines.right),
      } : { visibility: visibility.left },
      right: patches.right ? {
        minLum: patches.right.minLum,
        pupilContrast: Number(patches.right.pupilContrast?.toFixed(2)),
        dynamicRange: Number(patches.right.dynamicRange?.toFixed(2)),
        stdDev: Number(patches.right.stdDev?.toFixed(2)),
        mean: Number(patches.right.mean?.toFixed(2)),
        aperture: frames.right && frames.right.canthalWidth > 0 ? Number((frames.right.palpebralHeight / frames.right.canthalWidth).toFixed(3)) : null,
        skinRatio: Number(patches.right.skinRatio?.toFixed(3)),
        isLuminanceShift: this.baselines?.right ? Boolean(patches.right.mean > this.baselines.right.mean + 20 || patches.right.mean < this.baselines.right.mean - 25) : false,
        visibility: visibility.right,
        appearance: eyeAppearanceEvidence(patches.right, this.baselines.right, patches.left, this.baselines.left),
      } : { visibility: visibility.right },
    };

    const event = this.transition.update({ timestampMs, visibility: measurementVisibility, candidate: makeCandidate });
    const measurementCoordinates = Object.fromEntries(['left', 'right'].map(side =>
      [side, getCanthalMovementCoordinates(frames[side])]));
    return { visibility, measurementVisibility, measurementCoordinates, event, debugMetrics };
  }
}

/** Copy BOTH crops synchronously, before the inference canvas is reused.
 * JPEG encoding may complete later; frame metadata must never be re-timestamped.
 */
export function freezeEyePair(source, landmarks, frameMetadata) {
  const regions = getEyePairCropRegions(landmarks, source?.width, source?.height);
  if (!regions) return null;
  const eyes = {};
  for (const side of ['left', 'right']) {
    const cropRegion = regions[side];
    const { x, y, width, height } = cropRegion;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
    eyes[side] = { canvas, cropRegion };
  }
  return { frame: { ...frameMetadata, sourceWidth: source.width, sourceHeight: source.height }, eyes };
}

export async function encodeEyePair(event, cycle, cycleStartMs) {
  if (!Number.isFinite(event?.timestampMs) || event.image?.frame?.timestampMs !== event.timestampMs ||
      event.image.frame.frameId == null) throw new Error('CROP_SOURCE_FRAME_MISMATCH');
  const eventId = `c${cycle}_${event.uncoveredEye}_uncover`;
  const images = {};
  const crops = {};
  await Promise.all(['left', 'right'].map(async side => {
    const { canvas, cropRegion } = event.image.eyes[side];
    if (!canvas || !cropRegion || canvas.width !== cropRegion.width || canvas.height !== cropRegion.height ||
        cropRegion.x < 0 || cropRegion.y < 0 || cropRegion.x + cropRegion.width > event.image.frame.sourceWidth ||
        cropRegion.y + cropRegion.height > event.image.frame.sourceHeight) throw new Error('INVALID_EYE_CROP');
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
      trigger: 'OBSERVED_OCCLUDED_TO_VISIBLE', detector: 'pixel-appearance-v2',
      cropGeometryVersion: 'source-eye-contour-v1', cropCoordinateSpace: 'SOURCE_PIXELS',
      ...event.image.frame,
      t: Number((event.timestampMs - cycleStartMs).toFixed(3)),
      timestampMs: event.timestampMs, confirmedAtMs: event.confirmedAtMs,
      onsetIntervalMs: [event.lastCoveredMs, event.timestampMs],
      timingUncertaintyMs: event.timestampMs - event.lastCoveredMs,
      mirrored: false, crops,
    },
  };
}
