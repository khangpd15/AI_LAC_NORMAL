import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { createGunzip } from 'node:zlib';
import { createHash } from 'node:crypto';
import { getEyePairCropRegions } from '../src/services/coverTest/eyeCropGeometry.js';

const root = path.resolve(import.meta.dirname, '..');
const data = path.join(root, 'tracking-benchmark.local', 'iphone-cover');
const output = path.join(root, 'docs', 'reports', 'iphone-cover-test-2026-10-28-v3');
const geometrySource = 'src/services/coverTest/eyeCropGeometry.js';
const geometrySha256 = createHash('sha256').update(fs.readFileSync(path.join(root, geometrySource))).digest('hex');
const names = ['4K_30FPS', '4K_60FPS', 'HD_30FPS'];

for (const name of names) {
  const result = JSON.parse(fs.readFileSync(path.join(data, `${name}.v3.result.json`), 'utf8'));
  const trace = JSON.parse(fs.readFileSync(path.join(data, `${name}.v3.trace.json`), 'utf8'));
  const dir = path.join(output, name);
  fs.mkdirSync(path.join(dir, 'crops'), { recursive: true });
  const snapshots = [];
  const request = (leg, kind, source, offsetMs = 0, imageEvent = null) => {
    const legNumber = (leg.cycle - 1) * 2 + (leg.eye === 'right' ? 1 : 2);
    snapshots.push({ snapshotId: `L${legNumber}_${kind}`, leg: legNumber, cycle: leg.cycle,
      kind, coveredEye: leg.eye, trackedEye: leg.eye === 'left' ? 'right' : 'left',
      requestedTimestampMs: source ? source.timestampMs + offsetMs : null,
      requestedFrameId: source && offsetMs === 0 ? (source.frameId ?? source.sourceFrameId) : null,
      imageEvent, measurementValid: leg.result.coverOn.dataQuality.isValid,
      status: source ? 'PENDING' : 'MISSING_SOURCE_EVENT', eyes: null });
  };
  for (const leg of result.legs) {
    const e = leg.result.evidence;
    const photo = result.captureEligibleEvents.find(p => p.cycle === leg.cycle && p.coveredEye === leg.eye);
    request(leg, 'baseline', e.baselineSource);
    request(leg, 'cover_on', e.coverEvent);
    request(leg, 'cover_500ms', e.coverEvent, 500);
    request(leg, 'uncover', photo, 0, photo ? `c${leg.cycle}_${leg.eye}_uncover` : null);
    request(leg, 'uncover_500ms', photo, 500);
  }
  const assign = (item, row) => {
    const state = trace[row.index];
    if (state.frameId !== row.index || state.timestampMs !== row.ptsMs) throw new Error('CROP_TRACE_FRAME_MISMATCH');
    const lm = row.landmarks?.map(([x, y, z]) => ({ x, y, z }));
    const regions = getEyePairCropRegions(lm, result.source.width, result.source.height);
    Object.assign(item, { sourceFrameId: row.index, timestampMs: row.ptsMs,
      timeOffsetMs: row.ptsMs - item.requestedTimestampMs,
      sourceVisibility: state.measurementVisibility, sourceValidSamples: state.validSamples,
      status: regions ? 'REGIONS_READY' : 'MISSING_CROP_GEOMETRY' });
    if (!regions) return;
    item.eyes = Object.fromEntries(['left', 'right'].map(side => [side, {
      file: `crops/${item.snapshotId}_f${row.index}_${side}.png`, cropRegion: regions[side],
      imageSide: side === 'right' ? 'IMAGE_LEFT' : 'IMAGE_RIGHT',
      visibility: state.measurementVisibility[side],
      role: ['cover_on', 'cover_500ms'].includes(item.kind)
        ? side === item.trackedEye ? 'OBSERVED_FELLOW_EYE' : 'EXPECTED_COVERED_NOT_MEASURED'
        : item.kind === 'baseline' ? 'REFERENCE_EYE' : 'UNCOVER_IMAGE_EVIDENCE',
    }]));
  };
  let previous = null, metadata;
  for await (const line of readline.createInterface({ input: fs.createReadStream(path.join(data, `${name}.jsonl.gz`)).pipe(createGunzip()) })) {
    const row = JSON.parse(line);
    if (!metadata) {
      metadata = row;
      if (metadata.sha256 !== result.source.sha256) throw new Error('CROP_VIDEO_SOURCE_MISMATCH');
      continue;
    }
    for (const item of snapshots.filter(s => s.status === 'PENDING')) {
      if (item.requestedFrameId != null) {
        if (row.index === item.requestedFrameId) assign(item, row);
      } else if (row.ptsMs >= item.requestedTimestampMs) {
        const closest = previous && Math.abs(previous.ptsMs - item.requestedTimestampMs) <= Math.abs(row.ptsMs - item.requestedTimestampMs)
          ? previous : row;
        assign(item, closest);
      }
    }
    previous = row;
  }
  for (const item of snapshots.filter(s => s.status === 'PENDING')) item.status = 'SOURCE_FRAME_UNAVAILABLE';
  const manifest = { schema: 'cover-eye-crops-v1', source: result.source,
    geometrySource, geometrySha256, outputCoordinateSpace: 'ORIGINAL_ENCODED_SOURCE_PIXELS',
    processingLandmarkSize: [result.source.processingWidth, result.source.processingHeight],
    sourceMirroring: 'UNKNOWN', pixelTransform: 'NONE',
    note: 'Covered-eye crops may show an occluder; no hidden iris is measured. Half-second crops are diagnostic source frames, not substitutes for rejected samples.',
    snapshots };
  fs.writeFileSync(path.join(dir, 'crop_manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 2));
  console.log(`${name}: ${snapshots.filter(s => s.status === 'REGIONS_READY').length}/${snapshots.length} source pairs ready`);
}
