import { CLINICAL_CALIBRATION_CONFIG, CLINICAL_CALIBRATION_STATUS, EMPTY_CLINICAL_CALIBRATION_RESULT } from '../constants/clinicalCalibrationConfig.js';

function insufficient(reason) {
  return { ...EMPTY_CLINICAL_CALIBRATION_RESULT, status: CLINICAL_CALIBRATION_STATUS.INSUFFICIENT_DATA, reason };
}

export function validateCalibrationInferenceQuality(measurement = {}, context = {}) {
  if (context.faceTrackingValid === false) return insufficient('FACE_TRACKING_LOW');
  if (context.irisTrackingValid === false) return insufficient('IRIS_TRACKING_LOW');
  if (context.headPoseValid === false) return insufficient('HEAD_MOVEMENT');
  if (context.cameraDistanceValid === false) return insufficient('CAMERA_DISTANCE_INVALID');
  if (measurement.dataQuality?.isValid !== true) return insufficient('MEASUREMENT_QUALITY_LOW');
  if (measurement.baselinePosition?.isStable !== true) return insufficient('BASELINE_UNSTABLE');
  if (!Number.isFinite(measurement.sampleCount) || measurement.sampleCount < CLINICAL_CALIBRATION_CONFIG.minSamples) return insufficient('INSUFFICIENT_FRAMES');
  if (!Number.isFinite(measurement.eyeWidth) && !Number.isFinite(context.eyeWidth)) return insufficient('EYE_WIDTH_MISSING');
  if (Number.isFinite(measurement.confidence) && measurement.confidence < CLINICAL_CALIBRATION_CONFIG.minQuality) return insufficient('QUALITY_SCORE_LOW');
  return { status: 'QUALITY_ACCEPTED' };
}

export function extractCalibrationFeatures(measurement = {}, context = {}) {
  return {
    normalizedDisplacement: measurement.normalizedDisplacement ?? null,
    displacementX: measurement.finalPosition && measurement.initialPosition ? measurement.finalPosition.normalizedX - measurement.initialPosition.normalizedX : null,
    displacementY: measurement.finalPosition && measurement.initialPosition ? measurement.finalPosition.normalizedY - measurement.initialPosition.normalizedY : null,
    peakVelocity: measurement.peakVelocity ?? null,
    timeToPeak: measurement.timeToPeakMs ?? null,
    trajectoryStability: measurement.trajectoryStability ?? null,
    baselineStability: measurement.baselinePosition?.isStable ? 1 : 0,
    eyeWidth: measurement.eyeWidth ?? context.eyeWidth ?? null,
    sampleCount: measurement.sampleCount ?? null,
  };
}

export function clinicalCalibrationGuard({ model = null, metadata = null, measurement = {}, context = {}, production = true, enabled = CLINICAL_CALIBRATION_CONFIG.enabled } = {}) {
  const quality = validateCalibrationInferenceQuality(measurement, context);
  if (quality.status === CLINICAL_CALIBRATION_STATUS.INSUFFICIENT_DATA) return quality;
  if (!model || !metadata) return { ...EMPTY_CLINICAL_CALIBRATION_RESULT };
  if (!enabled && production) return { ...EMPTY_CLINICAL_CALIBRATION_RESULT, reason: 'PRODUCTION_DISABLED' };
  if (metadata.status === CLINICAL_CALIBRATION_STATUS.RETIRED) return { ...EMPTY_CLINICAL_CALIBRATION_RESULT, reason: 'MODEL_RETIRED' };
  if (production && (metadata.status !== CLINICAL_CALIBRATION_STATUS.CLINICALLY_VALIDATED || metadata.clinicalValidationStatus !== 'VALIDATED' || metadata.productionEnabled !== true)) return { ...EMPTY_CLINICAL_CALIBRATION_RESULT, reason: 'MODEL_NOT_CLINICALLY_VALIDATED' };
  if (!production && ![CLINICAL_CALIBRATION_STATUS.RESEARCH_ONLY, CLINICAL_CALIBRATION_STATUS.INTERNAL_VALIDATION, CLINICAL_CALIBRATION_STATUS.CLINICALLY_VALIDATED].includes(metadata.status)) return { ...EMPTY_CLINICAL_CALIBRATION_RESULT, reason: 'MODEL_NOT_AVAILABLE_FOR_RESEARCH' };
  const prediction = model.predict(extractCalibrationFeatures(measurement, context));
  return {
    status: metadata.status,
    horizontalDeviationPD: prediction.horizontalDeviationPD,
    verticalDeviationPD: prediction.verticalDeviationPD,
    horizontalDirection: context.horizontalDirection ?? measurement.horizontalDirection ?? null,
    verticalDirection: context.verticalDirection ?? measurement.verticalDirection ?? null,
    modelVersion: metadata.version,
    predictionConfidence: null,
    referenceMethod: metadata.referenceMethod || 'PACT',
    disclaimer: 'Giá trị trên là ước tính từ dữ liệu sàng lọc, không thay thế phép đo lâm sàng.',
  };
}
