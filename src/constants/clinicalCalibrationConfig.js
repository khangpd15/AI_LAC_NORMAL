export const CLINICAL_CALIBRATION_STATUS = Object.freeze({
  NOT_CALIBRATED: 'NOT_CALIBRATED',
  RESEARCH_ONLY: 'RESEARCH_ONLY',
  INTERNAL_VALIDATION: 'INTERNAL_VALIDATION',
  CLINICALLY_VALIDATED: 'CLINICALLY_VALIDATED',
  RETIRED: 'RETIRED',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
});

export const CLINICAL_DIRECTIONS = Object.freeze({
  HORIZONTAL: ['ESO', 'EXO', 'NONE'],
  VERTICAL: ['HYPER', 'HYPO', 'NONE'],
});

export const CLINICAL_CALIBRATION_FEATURES = Object.freeze([
  'normalizedDisplacement',
  'displacementX',
  'displacementY',
  'peakVelocity',
  'timeToPeak',
  'trajectoryStability',
  'baselineStability',
  'eyeWidth',
  'sampleCount',
]);

export const CLINICAL_CALIBRATION_CONFIG = Object.freeze({
  enabled: false,
  status: CLINICAL_CALIBRATION_STATUS.NOT_CALIBRATED,
  referenceMethod: 'PACT',
  nearTestDistanceCm: 33,
  modelVersion: null,
  // Engineering research gates; these are not diagnostic thresholds.
  minQuality: 0.8,
  minSamples: 15,
  minSubjectsForTraining: 30,
  split: Object.freeze({ train: 0.7, validation: 0.15, test: 0.15, seed: 42 }),
});

export const EMPTY_CLINICAL_CALIBRATION_RESULT = Object.freeze({
  status: CLINICAL_CALIBRATION_STATUS.NOT_CALIBRATED,
  horizontalDeviationPD: null,
  verticalDeviationPD: null,
  horizontalDirection: null,
  verticalDirection: null,
  modelVersion: null,
  predictionConfidence: null,
  referenceMethod: 'PACT',
});
