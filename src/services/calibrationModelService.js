import { CLINICAL_CALIBRATION_CONFIG, CLINICAL_CALIBRATION_FEATURES, CLINICAL_CALIBRATION_STATUS } from '../constants/clinicalCalibrationConfig.js';

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const targetKeys = ['horizontalDeviationPD', 'verticalDeviationPD'];

function solve(matrix, vector) {
  const a = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < a.length; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < a.length; row += 1) if (Math.abs(a[row][column]) > Math.abs(a[pivot][column])) pivot = row;
    [a[column], a[pivot]] = [a[pivot], a[column]];
    if (Math.abs(a[column][column]) < 1e-12) throw new Error('Calibration matrix is singular.');
    const divisor = a[column][column];
    for (let j = column; j <= a.length; j += 1) a[column][j] /= divisor;
    for (let row = 0; row < a.length; row += 1) {
      if (row === column) continue;
      const factor = a[row][column];
      for (let j = column; j <= a.length; j += 1) a[row][j] -= factor * a[column][j];
    }
  }
  return a.map((row) => row[a.length]);
}

function vectorFromSample(sample, features) {
  return features.map((key) => sample.webcamFeatures?.[key]);
}

function regressionMetrics(actual, predicted) {
  if (!actual.length) return { mae: null, rmse: null, r2: null, bias: null, limitsOfAgreement95: null };
  const errors = predicted.map((value, index) => value - actual[index]);
  const bias = mean(errors);
  const mae = mean(errors.map(Math.abs));
  const rmse = Math.sqrt(mean(errors.map((error) => error ** 2)));
  const actualMean = mean(actual);
  const total = actual.reduce((sum, value) => sum + (value - actualMean) ** 2, 0);
  const residual = errors.reduce((sum, value) => sum + value ** 2, 0);
  const r2 = total === 0 ? null : 1 - residual / total;
  const sd = errors.length > 1 ? Math.sqrt(errors.reduce((sum, value) => sum + (value - bias) ** 2, 0) / (errors.length - 1)) : 0;
  return { mae, rmse, r2, bias, limitsOfAgreement95: [bias - 1.96 * sd, bias + 1.96 * sd] };
}

export class CalibrationModel {
  constructor({ modelName = 'cover-test-clinical-calibration', version = '0.1.0', status = CLINICAL_CALIBRATION_STATUS.RESEARCH_ONLY, features = CLINICAL_CALIBRATION_FEATURES, ridgeAlpha = 1 } = {}) {
    this.metadata = { modelName, version, status, clinicalValidationStatus: 'NOT_VALIDATED', referenceMethod: 'PACT', features: [...features], targets: [...targetKeys], trainedAt: null, trainingSubjectCount: 0 };
    this.ridgeAlpha = ridgeAlpha;
    this.parameters = null;
  }

  fit(samples) {
    const subjectCount = new Set(samples.map((sample) => sample.subjectId)).size;
    if (subjectCount < CLINICAL_CALIBRATION_CONFIG.minSubjectsForTraining) throw new Error(`Insufficient dataset: ${subjectCount}/${CLINICAL_CALIBRATION_CONFIG.minSubjectsForTraining} subjects.`);
    const rows = samples.map((sample) => [1, ...vectorFromSample(sample, this.metadata.features)]);
    if (rows.some((row) => row.some((value) => !Number.isFinite(value)))) throw new Error('Training features contain missing values.');
    const targets = targetKeys.map((key) => samples.map((sample) => sample.clinicalReference?.[key]));
    if (targets.some((values) => values.some((value) => !Number.isFinite(value)))) throw new Error('Training targets contain missing PACT values.');
    const size = rows[0].length;
    const xtx = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => rows.reduce((sum, row) => sum + row[i] * row[j], 0) + (i === j && i > 0 ? this.ridgeAlpha : 0)));
    this.parameters = Object.fromEntries(targetKeys.map((key, targetIndex) => {
      const xty = Array.from({ length: size }, (_, i) => rows.reduce((sum, row, rowIndex) => sum + row[i] * targets[targetIndex][rowIndex], 0));
      return [key, solve(xtx, xty)];
    }));
    this.metadata = { ...this.metadata, trainedAt: new Date().toISOString(), trainingSubjectCount: subjectCount };
    return this;
  }

  predict(webcamFeatures) {
    if (!this.parameters) throw new Error('Calibration model has not been fitted or loaded.');
    const row = [1, ...this.metadata.features.map((key) => webcamFeatures?.[key])];
    if (row.some((value) => !Number.isFinite(value))) throw new Error('Prediction features are incomplete.');
    return Object.fromEntries(targetKeys.map((key) => [key, Math.max(0, this.parameters[key].reduce((sum, weight, index) => sum + weight * row[index], 0))]));
  }

  evaluate(samples) {
    const predictions = samples.map((sample) => this.predict(sample.webcamFeatures));
    const byTarget = Object.fromEntries(targetKeys.map((key) => [key, regressionMetrics(samples.map((sample) => sample.clinicalReference[key]), predictions.map((prediction) => prediction[key]))]));
    return { sampleCount: samples.length, subjectCount: new Set(samples.map((sample) => sample.subjectId)).size, byTarget, predictions };
  }

  save() { return JSON.stringify({ metadata: this.metadata, ridgeAlpha: this.ridgeAlpha, parameters: this.parameters }, null, 2); }
  load(serialized) { const data = typeof serialized === 'string' ? JSON.parse(serialized) : serialized; this.metadata = data.metadata; this.ridgeAlpha = data.ridgeAlpha; this.parameters = data.parameters; return this; }
  getMetadata() { return structuredClone(this.metadata); }
}

export function analyzeCalibrationPerformance(samples, predictions) {
  const enriched = samples.map((sample, index) => ({ sample, prediction: predictions[index] }));
  const groupBy = (selector) => Object.groupBy(enriched, ({ sample }) => selector(sample) ?? 'MISSING');
  const summarize = (items) => Object.fromEntries(targetKeys.map((key) => [key, regressionMetrics(items.map(({ sample }) => sample.clinicalReference[key]), items.map(({ prediction }) => prediction[key]))]));
  const magnitude = (sample) => { const value = sample.clinicalReference.horizontalDeviationPD; return value < 10 ? '<10Δ' : value < 20 ? '10–19Δ' : '≥20Δ'; };
  const summaries = {};
  for (const [name, groups] of Object.entries({ ageGroup: groupBy((s) => s.demographics?.age == null ? null : s.demographics.age < 12 ? '<12' : s.demographics.age < 18 ? '12–17' : '≥18'), testDistance: groupBy((s) => s.fixationDistanceCm), device: groupBy((s) => s.device?.cameraType), magnitude: groupBy(magnitude) })) summaries[name] = Object.fromEntries(Object.entries(groups).map(([key, items]) => [key, summarize(items)]));
  return summaries;
}
