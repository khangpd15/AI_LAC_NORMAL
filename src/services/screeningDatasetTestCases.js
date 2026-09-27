import { attachIndependentClinicalReference, beginScreeningSample, buildDatasetZip, finalizeScreeningSample, generateSampleId, getDatasetCounts, PARTICIPANT_IDENTITY_NOTICE, setScreeningImage } from './screeningDatasetService.js';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const baseSession = (sampleId, status) => ({
  sampleId, startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:01:00.000Z',
  summary: { screeningStatus: status },
  coverTest: { status: 'NO_SIGNIFICANT_REFIXATION', validCycles: 1, quality: { status: 'GOOD' }, cycles: [{ cycleIndex: 1, baseline: { rightBaseline: { normalizedBaselineX: 0.5, normalizedBaselineY: 0.5, sampleCount: 20 }, leftBaseline: null }, rightEye: { initialPosition: { normalizedX: 0.5, normalizedY: 0.5 }, finalPosition: { normalizedX: 0.51, normalizedY: 0.49 }, displacement: 0.014, normalizedDisplacement: 0.1, sampleCount: 20, dataQuality: { isValid: true } }, leftEye: null, quality: { isValid: false, reason: 'INSUFFICIENT_SAMPLES' } }] },
  brockString: { status: 'MEASURABLE', quality: { status: 'GOOD' }, targets: { near20cm: { targetDistanceCm: 20, medianVergenceRatio: 1.2, sampleCount: 20, dataQuality: { isValid: true } }, mid50cm: null, far100cm: null } },
});

export async function runScreeningDatasetTestCases() {
  const results = [];
  const test = async (name, fn) => { try { await fn(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.message }); } };
  await test('sample IDs are UUIDs and independent', () => { const a = generateSampleId(); const b = generateSampleId(); assert(a !== b && /^[0-9a-f-]{36}$/i.test(a), 'Expected unique UUIDs'); });
  await test('classification uses final screening status', () => { const id = generateSampleId(); beginScreeningSample(id); const sample = finalizeScreeningSample(baseSession(id, 'SCREENING_CLEAR')); assert(sample.classification === 'NORMAL', 'Wrong folder label'); });
  await test('participant identity is explicitly unavailable', () => { assert(PARTICIPANT_IDENTITY_NOTICE === 'Participant identity unavailable.', 'Notice changed'); });
  await test('capture slots accept only one image per test', () => { const id = generateSampleId(); beginScreeningSample(id); assert(setScreeningImage(id, 'cover', { metadata: { status: 'FAILED' }, blob: null }), 'First rejected'); assert(!setScreeningImage(id, 'cover', {}), 'Duplicate accepted'); });
  await test('clinical labels are never automatic', () => { const id = generateSampleId(); beginScreeningSample(id); const sample = finalizeScreeningSample(baseSession(id, 'SCREENING_ATTENTION')); assert(sample.clinicalReference === null, 'Auto label found'); let rejected = false; try { attachIndependentClinicalReference(id, { label: 'STRABISMUS', source: 'MODEL' }); } catch { rejected = true; } assert(rejected, 'Unconfirmed label accepted'); });
  await test('nulls are preserved instead of fabricated metrics', () => { const id = generateSampleId(); beginScreeningSample(id); const sample = finalizeScreeningSample(baseSession(id, 'SCREENING_INCONCLUSIVE')); assert(sample.coverTest.cycles[1].metrics.displacement === null, 'Missing metric was fabricated'); });
  await test('ZIP preserves dataset folder structure', async () => { const zip = await buildDatasetZip(); const text = new TextDecoder().decode(await zip.arrayBuffer()); assert(text.includes('dataset/NORMAL/') && text.includes('cover_test.json') && text.includes('sample.json'), 'ZIP paths missing'); });
  await test('development counters group final labels', () => { const counts = getDatasetCounts(); assert(counts.total >= 3 && counts.normal >= 1 && counts.attention >= 1 && counts.inconclusive >= 1, 'Counters incorrect'); });
  return { passed: results.filter((item) => item.passed).length, total: results.length, results };
}
