import { CLINICAL_CALIBRATION_CONFIG, CLINICAL_CALIBRATION_FEATURES, CLINICAL_DIRECTIONS } from '../constants/clinicalCalibrationConfig.js';

const isFiniteOrNull = (value) => value === null || Number.isFinite(value);
const nullableNumber = (value) => value === '' || value == null ? null : Number(value);
const cleanText = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;

export function createClinicalCalibrationSample(input = {}) {
  const reference = input.clinicalReference || {};
  const features = input.webcamFeatures || {};
  const sample = {
    id: cleanText(input.id) || `cal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    subjectId: cleanText(input.subjectId),
    sessionId: cleanText(input.sessionId),
    demographics: {
      age: nullableNumber(input.age),
      sex: cleanText(input.sex),
    },
    eyeSide: cleanText(input.eyeSide),
    testMethod: cleanText(input.testMethod) || 'PACT',
    fixationDistanceCm: nullableNumber(input.fixationDistanceCm),
    consentStatus: cleanText(input.consentStatus),
    clinicalReference: {
      horizontalDeviationPD: nullableNumber(reference.horizontalDeviationPD),
      verticalDeviationPD: nullableNumber(reference.verticalDeviationPD),
      horizontalDirection: cleanText(reference.horizontalDirection),
      verticalDirection: cleanText(reference.verticalDirection),
      examinerId: cleanText(reference.examinerId),
    },
    webcamFeatures: {
      normalizedDisplacement: nullableNumber(features.normalizedDisplacement),
      displacementX: nullableNumber(features.displacementX),
      displacementY: nullableNumber(features.displacementY),
      velocity: nullableNumber(features.velocity),
      peakVelocity: nullableNumber(features.peakVelocity),
      timeToPeak: nullableNumber(features.timeToPeak),
      trajectoryStability: nullableNumber(features.trajectoryStability),
      baselineStability: nullableNumber(features.baselineStability),
      eyeWidth: nullableNumber(features.eyeWidth),
      sampleCount: nullableNumber(features.sampleCount),
    },
    quality: {
      faceTrackingQuality: nullableNumber(input.quality?.faceTrackingQuality),
      irisTrackingQuality: nullableNumber(input.quality?.irisTrackingQuality),
      headPoseQuality: nullableNumber(input.quality?.headPoseQuality),
      fixationQuality: nullableNumber(input.quality?.fixationQuality),
      overallQuality: nullableNumber(input.quality?.overallQuality),
    },
    device: {
      cameraType: cleanText(input.device?.cameraType),
      resolution: cleanText(input.device?.resolution),
      fps: nullableNumber(input.device?.fps),
    },
    missingFields: [],
    timestamp: input.timestamp || new Date().toISOString(),
  };
  sample.missingFields = collectMissingFields(sample);
  return sample;
}

export function collectMissingFields(sample) {
  const missing = [];
  if (!sample.subjectId) missing.push('subjectId');
  if (!Number.isFinite(sample.clinicalReference?.horizontalDeviationPD)) missing.push('clinicalReference.horizontalDeviationPD');
  if (!Number.isFinite(sample.clinicalReference?.verticalDeviationPD)) missing.push('clinicalReference.verticalDeviationPD');
  if (!sample.clinicalReference?.horizontalDirection) missing.push('clinicalReference.horizontalDirection');
  if (!sample.clinicalReference?.verticalDirection) missing.push('clinicalReference.verticalDirection');
  for (const feature of CLINICAL_CALIBRATION_FEATURES) if (!Number.isFinite(sample.webcamFeatures?.[feature])) missing.push(`webcamFeatures.${feature}`);
  if (!Number.isFinite(sample.quality?.overallQuality)) missing.push('quality.overallQuality');
  return missing;
}

export function validateClinicalCalibrationSample(sample) {
  const errors = collectMissingFields(sample);
  const ref = sample.clinicalReference || {};
  if (sample.testMethod !== 'PACT') errors.push('testMethod must be PACT');
  if (!CLINICAL_DIRECTIONS.HORIZONTAL.includes(ref.horizontalDirection)) errors.push('invalid horizontalDirection');
  if (!CLINICAL_DIRECTIONS.VERTICAL.includes(ref.verticalDirection)) errors.push('invalid verticalDirection');
  if (!isFiniteOrNull(ref.horizontalDeviationPD) || ref.horizontalDeviationPD < 0) errors.push('invalid horizontalDeviationPD');
  if (!isFiniteOrNull(ref.verticalDeviationPD) || ref.verticalDeviationPD < 0) errors.push('invalid verticalDeviationPD');
  if (sample.consentStatus !== 'CONSENTED') errors.push('consentStatus must be CONSENTED');
  if (sample.subjectId && !/^[A-Za-z0-9_-]+$/.test(sample.subjectId)) errors.push('subjectId must be pseudonymous (letters, numbers, _ or - only)');
  return { isValid: errors.length === 0, errors };
}

function hashSubject(subjectId, seed) {
  let hash = seed | 0;
  for (const char of subjectId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

export function splitDatasetBySubject(samples, config = CLINICAL_CALIBRATION_CONFIG.split) {
  const result = { train: [], validation: [], test: [], metadata: { subjectLevelSplit: true, config } };
  for (const sample of samples) {
    if (!sample.subjectId) throw new Error('Cannot split a sample without subjectId.');
    const bucket = hashSubject(sample.subjectId, config.seed ?? 42);
    if (bucket < config.train) result.train.push(sample);
    else if (bucket < config.train + config.validation) result.validation.push(sample);
    else result.test.push(sample);
  }
  assertNoSubjectLeakage(result);
  return result;
}

export function assertNoSubjectLeakage(split) {
  const owners = new Map();
  for (const group of ['train', 'validation', 'test']) {
    for (const sample of split[group] || []) {
      const previous = owners.get(sample.subjectId);
      if (previous && previous !== group) throw new Error(`Subject leakage: ${sample.subjectId} occurs in ${previous} and ${group}.`);
      owners.set(sample.subjectId, group);
    }
  }
  return true;
}

export function exportCalibrationDataset(samples, format = 'json') {
  const safeSamples = samples.map((sample) => structuredClone(sample));
  if (format === 'json') return JSON.stringify({ schemaVersion: '1.0.0', referenceMethod: 'PACT', samples: safeSamples }, null, 2);
  if (format !== 'csv') throw new Error('Supported export formats are json and csv.');
  const header = ['id','subjectId','sessionId','age','sex','eyeSide','testMethod','fixationDistanceCm','horizontalDeviationPD','verticalDeviationPD','horizontalDirection','verticalDirection','normalizedDisplacement','peakVelocity','trajectoryStability','sampleCount','overallQuality','cameraType','resolution','fps','consentStatus','timestamp'];
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = safeSamples.map((s) => [s.id,s.subjectId,s.sessionId,s.demographics.age,s.demographics.sex,s.eyeSide,s.testMethod,s.fixationDistanceCm,s.clinicalReference.horizontalDeviationPD,s.clinicalReference.verticalDeviationPD,s.clinicalReference.horizontalDirection,s.clinicalReference.verticalDirection,s.webcamFeatures.normalizedDisplacement,s.webcamFeatures.peakVelocity,s.webcamFeatures.trajectoryStability,s.webcamFeatures.sampleCount,s.quality.overallQuality,s.device.cameraType,s.device.resolution,s.device.fps,s.consentStatus,s.timestamp].map(quote).join(','));
  return [header.join(','), ...rows].join('\n');
}
