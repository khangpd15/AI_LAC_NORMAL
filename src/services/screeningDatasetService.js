export const PARTICIPANT_IDENTITY_NOTICE = 'Participant identity unavailable.';
export const DATASET_SCHEMA_VERSION = '1.0.0';

const STATUS_FOLDERS = Object.freeze({
  SCREENING_CLEAR: 'NORMAL',
  SCREENING_ATTENTION: 'ATTENTION',
  SCREENING_INCONCLUSIVE: 'INCONCLUSIVE',
});

const samples = new Map();
const listeners = new Set();
const finiteOrNull = (value) => Number.isFinite(value) ? value : null;
const notify = () => listeners.forEach((listener) => listener(getDatasetCounts()));

export function generateSampleId() {
  if (!globalThis.crypto?.randomUUID) throw new Error('crypto.randomUUID() is required for screening sample IDs.');
  return globalThis.crypto.randomUUID();
}

export function beginScreeningSample(sampleId, startedAt = new Date().toISOString()) {
  const draft = { sampleId, startedAt, coverImage: null, brockImage: null, finalized: null };
  samples.set(sampleId, draft);
  return draft;
}

export function setScreeningImage(sampleId, test, artifact) {
  const draft = samples.get(sampleId);
  if (!draft || !['cover', 'brock'].includes(test) || draft[`${test}Image`]) return false;
  draft[`${test}Image`] = artifact;
  return true;
}

const mapBaseline = (baseline) => ({
  x: finiteOrNull(baseline?.normalizedBaselineX), y: finiteOrNull(baseline?.normalizedBaselineY),
  eyeWidth: finiteOrNull(baseline?.eyeWidth), sampleCount: finiteOrNull(baseline?.sampleCount),
  stability: finiteOrNull(baseline?.stability),
});

const mapEyeCycle = (cycle, eye, coveredEye, baseline) => {
  const measurement = cycle?.[`${eye}Eye`];
  const initial = measurement?.initialPosition;
  const final = measurement?.finalPosition;
  return {
    cycleNumber: cycle?.cycleIndex ?? null, coveredEye, trackedEye: eye.toUpperCase(),
    baseline: mapBaseline(baseline),
    metrics: {
      dx: Number.isFinite(initial?.normalizedX) && Number.isFinite(final?.normalizedX) ? final.normalizedX - initial.normalizedX : null,
      dy: Number.isFinite(initial?.normalizedY) && Number.isFinite(final?.normalizedY) ? final.normalizedY - initial.normalizedY : null,
      displacement: finiteOrNull(measurement?.displacement),
      normalizedDisplacement: finiteOrNull(measurement?.normalizedDisplacement),
      velocity: finiteOrNull(measurement?.meanVelocity), peakVelocity: finiteOrNull(measurement?.peakVelocity),
      timeToPeakMs: finiteOrNull(measurement?.timeToPeakMs ?? measurement?.timeToPeak),
      stability: finiteOrNull(measurement?.trajectoryStability), sampleCount: finiteOrNull(measurement?.sampleCount),
    },
    quality: {
      status: measurement?.dataQuality?.status ?? cycle?.quality?.status ?? null,
      isValid: measurement?.dataQuality?.isValid ?? false,
      faceDetected: null, irisValid: null, headPoseValid: null,
      reason: measurement?.dataQuality?.reason ?? cycle?.quality?.reason ?? null,
    },
  };
};

function coverJson(session, image) {
  const cycles = (session.coverTest?.cycles || []).flatMap((cycle) => [
    mapEyeCycle(cycle, 'right', 'LEFT', cycle?.baseline?.rightBaseline),
    mapEyeCycle(cycle, 'left', 'RIGHT', cycle?.baseline?.leftBaseline),
  ]);
  return { schemaVersion: DATASET_SCHEMA_VERSION, sampleId: session.sampleId, test: 'COVER_TEST', image: image?.metadata ?? null, cycles, result: { status: session.coverTest?.status ?? null, validCycles: session.coverTest?.validCycles ?? 0, quality: session.coverTest?.quality ?? null } };
}

function brockJson(session, image) {
  const source = session.brockString?.targets || {};
  const targets = [['NEAR', source.near20cm], ['MID', source.mid50cm], ['FAR', source.far100cm]].map(([target, value]) => ({
    target, distanceCm: finiteOrNull(value?.targetDistanceCm),
    metrics: { vergenceRatio: finiteOrNull(value?.medianVergenceRatio), interIrisDistance: finiteOrNull(value?.medianInterIrisDist), leftRatio: finiteOrNull(value?.medianLeftRatio), rightRatio: finiteOrNull(value?.medianRightRatio), fixationStabilityIqr: finiteOrNull(value?.fixationStabilityIqr), transitionLatencyMs: finiteOrNull(value?.transitionLatencyMs), sampleCount: finiteOrNull(value?.sampleCount) },
    quality: value?.dataQuality ?? null,
  }));
  return { schemaVersion: DATASET_SCHEMA_VERSION, sampleId: session.sampleId, test: 'BROCK_STRING', image: image?.metadata ?? null, targets, result: { status: session.brockString?.status ?? null, quality: session.brockString?.quality ?? null } };
}

export function finalizeScreeningSample(session, questionnaire = null) {
  const draft = samples.get(session.sampleId) || beginScreeningSample(session.sampleId, session.startedAt);
  const screeningStatus = session.summary?.screeningStatus;
  const classification = STATUS_FOLDERS[screeningStatus];
  if (!classification) throw new Error(`Unsupported final screening status: ${screeningStatus}`);
  const sample = {
    schemaVersion: DATASET_SCHEMA_VERSION, sampleId: session.sampleId, startedAt: session.startedAt,
    completedAt: session.completedAt, classification, screeningStatus,
    screeningLabelNotice: 'Screening label only — not a diagnosis.',
    participantIdentity: PARTICIPANT_IDENTITY_NOTICE, clinicalReference: null,
    questionnaire: questionnaire ?? null,
    coverTest: coverJson(session, draft.coverImage), brockString: brockJson(session, draft.brockImage),
    images: { cover: draft.coverImage, brock: draft.brockImage },
  };
  draft.finalized = sample;
  notify();
  return sample;
}

export function attachIndependentClinicalReference(sampleId, reference) {
  const sample = samples.get(sampleId)?.finalized;
  if (!sample) throw new Error('Finalized screening sample not found.');
  if (reference?.label !== 'STRABISMUS' || reference?.source !== 'CLINICAL_EXAM') throw new Error('Clinical reference must be independently confirmed by CLINICAL_EXAM.');
  sample.clinicalReference = { label: 'STRABISMUS', source: 'CLINICAL_EXAM' };
  return sample;
}

export function getDatasetCounts() {
  const result = { total: 0, normal: 0, attention: 0, inconclusive: 0 };
  for (const draft of samples.values()) {
    const label = draft.finalized?.classification;
    if (!label) continue;
    result.total += 1;
    result[label.toLowerCase()] += 1;
  }
  return result;
}

export function subscribeDatasetCounts(listener) { listeners.add(listener); return () => listeners.delete(listener); }

const encoder = new TextEncoder();
const u16 = (value) => [value & 255, (value >>> 8) & 255];
const u32 = (value) => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }

export async function buildDatasetZip() {
  const files = [];
  for (const draft of samples.values()) {
    const sample = draft.finalized;
    if (!sample) continue;
    const roots = [`dataset/${sample.classification}/${sample.sampleId}/`];
    if (sample.clinicalReference?.label === 'STRABISMUS' && sample.clinicalReference?.source === 'CLINICAL_EXAM') roots.push(`dataset/CLINICAL_LAC/${sample.sampleId}/`);
    const publicSample = { ...sample, images: { cover: sample.coverTest.image, brock: sample.brockString.image } };
    for (const root of roots) {
      files.push([`${root}cover_test.json`, new Blob([JSON.stringify(sample.coverTest, null, 2)])], [`${root}brock_string.json`, new Blob([JSON.stringify(sample.brockString, null, 2)])], [`${root}sample.json`, new Blob([JSON.stringify(publicSample, null, 2)])]);
      if (sample.images.cover?.blob) files.push([`${root}cover_test.jpg`, sample.images.cover.blob]);
      if (sample.images.brock?.blob) files.push([`${root}brock_string.jpg`, sample.images.brock.blob]);
    }
  }
  const localParts = []; const centralParts = []; let offset = 0;
  for (const [name, blob] of files) {
    const nameBytes = encoder.encode(name); const data = new Uint8Array(await blob.arrayBuffer()); const crc = crc32(data);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...nameBytes]);
    localParts.push(local, data);
    centralParts.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes]));
    offset += local.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}

export async function downloadDatasetZip() {
  const blob = await buildDatasetZip(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `remicare-screening-dataset-${new Date().toISOString().slice(0, 10)}.zip`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
