import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createGunzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { UncoverCaptureObserver, UncoverTransition, EYE_APPEARANCE_LIMITS, isUncoverCaptureEligible } from '../src/services/coverTest/uncoverCaptureService.js';
import { createCoverEventMeasurementRecorder, COVER_EVENT_LIMITS } from '../src/services/coverTest/coverEventMeasurementService.js';
import { createCoverFrame, createObservedCycleRecord, aggregateCoverCycles } from '../src/services/coverTestProtocolService.js';
import { extractEyeFeatures, validateEyeTrackingQuality, buildFrameQualityGate } from '../src/services/eyeFeatureService.js';

const root = path.resolve(import.meta.dirname, '..');
const inputDir = path.join(root, 'tracking-benchmark.local', 'iphone-cover');
const correctedWindows = !process.argv.includes('--fixed-windows');
const resultVersion = process.argv.includes('--v3') ? 'v3' : 'v2';
const suffix = correctedWindows ? `.${resultVersion}` : `.${resultVersion}-fixed`;
// Coarse phase windows were manually inspected on one-second video contact sheets.
// They indicate expected side/phase only; event timestamps come from the detector.
// Input mirroring is undocumented: anatomical side names assume unmirrored pixels.
const plans = {
  '4K_30FPS': [[4, 12, 15], [15, 23, 26], [26, 34, 36], [36, 45, 47], [47, 55, 57], [57, 66, 71]],
  '4K_60FPS': [[9, 17, 19], [19, 27, 29], [29, 37, 39], [39, 47, 49], [49, 57, 59], [59, 67, 71]],
  'HD_30FPS': [[3.5, 12, 15.5], [15.5, 24, 26.5], [26.5, 35, 36.5], [36.5, 45, 49], [49, 57, 59], [59, 67, 71]],
};
const sources = ['src/services/coverTest/uncoverCaptureService.js', 'src/services/coverTest/coverEventMeasurementService.js',
  'src/services/coverTestMeasurementService.js', 'src/services/coverTestProtocolService.js',
  'src/services/cv/eyeCoverDetector.js', 'src/services/eyeFeatureService.js',
  'src/services/coverTestTimeline.js', 'src/services/coverTest/eyeCropGeometry.js',
  'scripts/replayIphoneCover.mjs', 'scripts/extractIphoneCoverReplay.py'];
const sourceHashes = Object.fromEntries(sources.map(p => [p, createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex')]));
const counts = () => ({ VISIBLE: 0, OCCLUDED: 0, UNKNOWN: 0 });
const countVisibility = (target, value) => { target[value || 'UNKNOWN'] = (target[value || 'UNKNOWN'] || 0) + 1; };
const pct = (n, total) => total ? Number((n * 100 / total).toFixed(3)) : null;
const percentile = (a, p) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)] ?? null;

for (const [name, rawPlan] of Object.entries(plans)) {
  const observer = new UncoverCaptureObserver();
  let currentPatch = null, maxPatchGeometryError = 0;
  // Run the actual JS pixel statistics and detector over decoded RGBA patches.
  // Only Canvas sampling is adapted to OpenCV, with a geometry-match assertion.
  observer.sampler.ctx = {
    drawImage(source, sx, sy, sw, sh) {
      const rect = [sx, sy, sw, sh];
      const candidates = source.patches.filter(Boolean).map(p => ({ ...p,
        error: Math.max(...p.rect.map((v, i) => Math.abs(v - rect[i]))) }));
      candidates.sort((a, b) => a.error - b.error);
      const chosen = candidates[0];
      if (!chosen || chosen.error > 0.001) throw new Error('PATCH_GEOMETRY_MISMATCH');
      maxPatchGeometryError = Math.max(maxPatchGeometryError, chosen.error);
      currentPatch = chosen;
    },
    getImageData() {
      if (!currentPatch) throw new Error('PATCH_NOT_SAMPLED');
      return { data: new Uint8ClampedArray(Buffer.from(currentPatch.rgba, 'base64')) };
    },
  };
  const plan = rawPlan.map(([start, track, end], i) => ({ startMs: start * 1000, trackingStartMs: track * 1000,
    endMs: end * 1000, eye: i % 2 === 0 ? 'right' : 'left', cycle: Math.floor(i / 2) + 1,
    screenSide: i % 2 === 0 ? 'IMAGE_LEFT' : 'IMAGE_RIGHT' }));
  const legs = [], photoEvents = [], frameTrace = [], latencies = [], intervals = [];
  let metadata = null, firstFeature = true, previousPts = null;
  let decoded = 0, detected = 0, headInvalid = 0, blinkFrames = 0, bothVisibleFrames = 0;
  const visibility = { left: counts(), right: counts() };
  const directVisibility = { left: counts(), right: counts() };
  const contexts = plan.map(p => ({ plan: p, recorder: createCoverEventMeasurementRecorder(),
    transition: new UncoverTransition(1800), started: false, finished: false,
    lastObservedMs: null, diagnostic: { frames: 0, validEyeSamples: { left: 0, right: 0 },
      visibility: { left: counts(), right: counts() }, firstUnsafeFrame: null } }));
  const finish = ctx => {
    if (!ctx.started || ctx.finished) return;
    ctx.finished = true;
    legs.push({ ...ctx.plan, actualEndMs: ctx.lastObservedMs,
      result: ctx.recorder.finishLeg(), diagnostics: ctx.diagnostic });
  };
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(inputDir, `${name}.jsonl.gz`)).pipe(createGunzip()) })) {
    const row = JSON.parse(line);
    if (!metadata) {
      metadata = row;
      if (metadata.maxEdge !== 960) throw new Error('REPLAY_INPUT_MUST_MATCH_CURRENT_960_CAPTURE_EDGE');
      continue;
    }
    decoded++;
    if (previousPts !== null) {
      if (row.ptsMs <= previousPts) throw new Error('NON_MONOTONIC_SOURCE_TIME');
      intervals.push(row.ptsMs - previousPts);
    }
    previousPts = row.ptsMs;
    latencies.push(row.nativeInferenceMs);
    const p = plan.find(p => row.ptsMs >= p.startMs && row.ptsMs < p.endMs);
    const phase = !p ? 'BASELINE' : row.ptsMs < p.trackingStartMs ? 'COVER' : 'TRACKING';
    const coveredEye = phase === 'COVER' ? p.eye : null;
    const trackedEye = phase === 'TRACKING' ? p.eye : null;
    const lm = row.landmarks?.map(([x, y, z]) => ({ x, y, z }));
    const options = { coveredEye, trackedEye, applySmoothing: false, resetBlinkBuffer: firstFeature,
      videoWidth: metadata.processingWidth, videoHeight: metadata.processingHeight };
    const features = lm ? extractEyeFeatures(lm, row.ptsMs, options) : null;
    if (features) firstFeature = false;
    const quality = buildFrameQualityGate(validateEyeTrackingQuality(lm ? [lm] : [], options), features,
      { ...options, fps: metadata.fps });
    const source = { width: metadata.processingWidth, height: metadata.processingHeight, patches: row.patches };
    // Learn pixel appearance only in the initial verified preparation window.
    // Later expected-side switches must not contaminate it with a hand/spoon.
    const observation = observer.observe(source, lm, row.ptsMs,
      row.ptsMs < plan[0].startMs ? 'BASELINE' : 'IDLE', () => null);
    const frames = {}, frameReasons = {};
    for (const side of ['left', 'right']) {
      countVisibility(visibility[side], observation.visibility[side]);
      countVisibility(directVisibility[side], observation.measurementVisibility[side]);
      if (observation.measurementVisibility[side] === 'VISIBLE' && observation.measurementCoordinates[side]) {
        const measured = createCoverFrame({ ...features, observedVisibility: observation.measurementVisibility },
          { ...quality, coveredEye: null, eyeVisibility: observation.measurementVisibility }, side, row.ptsMs,
          row.ptsMs - (p?.startMs || 0));
        if (measured.frame) frames[side] = { ...measured.frame, ...observation.measurementCoordinates[side] };
        frameReasons[side] = measured.reason;
      } else frameReasons[side] = observation.measurementVisibility[side];
    }
    const qualityValid = Boolean(features && quality.faceDetected && quality.headPoseValid !== false);
    for (const ctx of contexts) {
      if (ctx.finished) continue;
      if (!ctx.started && row.ptsMs >= ctx.plan.startMs) {
        ctx.started = true;
        ctx.recorder.beginCover(ctx.plan.eye, ctx.plan.cycle);
        ctx.transition.reset(ctx.plan.eye);
      }
      const progress = ctx.recorder.getProgress();
      const windowComplete = progress.uncoverEvent && row.ptsMs >= progress.uncoverEvent.timestampMs + COVER_EVENT_LIMITS.analysisMs;
      const endReached = row.ptsMs >= ctx.plan.endMs;
      if (ctx.started && endReached && (!correctedWindows || windowComplete || row.ptsMs >= ctx.plan.endMs + 3000)) {
        finish(ctx);
        continue;
      }
      ctx.recorder.observe({ timestampMs: row.ptsMs, frameId: row.index,
        visibility: observation.measurementVisibility, frames, qualityValid });
      if (!ctx.started) continue;
      ctx.lastObservedMs = row.ptsMs;
      const event = ctx.transition.update({ timestampMs: row.ptsMs, visibility: observation.measurementVisibility,
        candidate: () => isUncoverCaptureEligible(features, quality) ? { frameId: row.index } : null });
      if (event) photoEvents.push({ cycle: ctx.plan.cycle, coveredEye: ctx.plan.eye, sourceFrameId: event.image.frameId,
        timestampMs: event.timestampMs, confirmedAtMs: event.confirmedAtMs,
        onsetIntervalMs: [event.lastCoveredMs, event.timestampMs],
        status: 'CAPTURE_ELIGIBLE_SOURCE_FRAME', jpegEncoded: false });
      const diagnostic = ctx.diagnostic;
      diagnostic.frames++;
      for (const side of ['left', 'right']) {
        countVisibility(diagnostic.visibility[side], observation.measurementVisibility[side]);
        if (frames[side]) diagnostic.validEyeSamples[side]++;
      }
      const opposite = ctx.plan.eye === 'left' ? 'right' : 'left';
      if (!diagnostic.firstUnsafeFrame && (!qualityValid || observation.measurementVisibility[opposite] !== 'VISIBLE')) {
        diagnostic.firstUnsafeFrame = { frameId: row.index, timestampMs: row.ptsMs, qualityValid,
          visibility: observation.measurementVisibility, metrics: observation.debugMetrics };
      }
    }
    if (lm) detected++;
    if (quality.headPoseValid === false) headInvalid++;
    if (features?.isBlinkMasked || features?.isBlinking) blinkFrames++;
    if (observation.measurementVisibility.left === 'VISIBLE' && observation.measurementVisibility.right === 'VISIBLE') bothVisibleFrames++;
    frameTrace.push({ frameId: row.index, timestampMs: row.ptsMs, phase, expectedCoveredEye: p?.eye ?? null,
      faceDetected: Boolean(lm), qualityValid, headPoseValid: quality.headPoseValid ?? null,
      visibility: observation.visibility, measurementVisibility: observation.measurementVisibility,
      validSamples: { left: Boolean(frames.left), right: Boolean(frames.right) }, frameReasons,
      coordinates: observation.measurementCoordinates, metrics: observation.debugMetrics });
  }
  contexts.forEach(finish);
  legs.sort((a, b) => a.startMs - b.startMs);
  if (decoded !== metadata.expectedFrames) throw new Error(`FRAME_COUNT_MISMATCH:${name}:${decoded}`);
  const cycles = [1, 2, 3].map(c => createObservedCycleRecord(c, {},
    legs.find(l => l.cycle === c && l.eye === 'left')?.result,
    legs.find(l => l.cycle === c && l.eye === 'right')?.result));
  const summary = aggregateCoverCycles(cycles);
  const result = {
    schema: `iphone-cover-offline-replay-${resultVersion}`, evaluatedDate: '2026-10-28', source: metadata,
    method: { mode: 'ALL_FRAME_OFFLINE_REPLAY', phasePlanSource: 'MANUAL_COARSE_VISUAL_INSPECTION_1_SECOND_CONTACT_SHEETS',
      mirroring: 'UNKNOWN_ASSUME_UNMIRRORED_FOR_SIDE_NAMES', processingSize: [metadata.processingWidth, metadata.processingHeight],
      runtime: process.version, sourceHashes, engineeringLimits: COVER_EVENT_LIMITS, appearanceLimits: EYE_APPEARANCE_LIMITS,
      windowPolicy: correctedWindows ? 'OBSERVED_RECOVERY_WINDOW_WITH_3000MS_BOUND' : 'FIXED_COARSE_WINDOWS_ABLATION',
      pixelBaselinePolicy: 'INITIAL_PREPARATION_ONLY',
      adapters: ['Python MediaPipe FaceMesh refine_landmarks instead of Web MediaPipe',
        'OpenCV bilinear RGBA patch sampling instead of browser Canvas',
        'Manually annotated phase windows; no original app cue log',
        'All source frames processed offline; no mobile scheduling or inference backpressure'],
      excluded: ['iPhone/Safari runtime FPS', 'clinical diagnosis', 'server AI model', 'JPEG persistence'],
    },
    statistics: { decodedFrames: decoded, faceDetectedFrames: detected, faceDetectionPercent: pct(detected, decoded),
      actualDurationSeconds: (previousPts + (percentile(intervals, 0.5) || 0)) / 1000,
      headPoseRejectedFrames: headInvalid, blinkMaskedFrames: blinkFrames, bothDirectlyVisibleFrames: bothVisibleFrames,
      captureEligibleEvents: photoEvents.length, procedureValidLegs: legs.filter(l => l.result.evidence.procedureValid).length,
      primaryValidLegs: legs.filter(l => l.result.coverOn.dataQuality.isValid).length,
      recoveryValidLegs: legs.filter(l => l.result.uncoverRecovery.dataQuality.isValid).length,
      visibility, directVisibility,
      sourceFrameIntervalMedianMs: percentile(intervals, 0.5), sourceFrameIntervalMaxMs: Math.max(...intervals),
      nativeInferenceMedianMs: percentile(latencies, 0.5), nativeInferenceP95Ms: percentile(latencies, 0.95),
      maxPatchGeometryErrorPixels: maxPatchGeometryError,
    }, summary, legs, captureEligibleEvents: photoEvents,
  };
  fs.writeFileSync(path.join(inputDir, `${name}${suffix}.result.json`), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(inputDir, `${name}${suffix}.trace.json`), JSON.stringify(frameTrace));
  console.log(JSON.stringify({ file: name, ...result.statistics, verdict: summary.verdict }));
}
