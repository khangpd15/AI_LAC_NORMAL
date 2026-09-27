/**
 * CALIBRATION SERVICE
 * Architectural interface for future clinical calibration between Camera Measurements
 * and Prism Alternate Cover Test (PACT) Prism Diopters (Δ).
 * 
 * STRICT CLINICAL SAFETY RULE:
 * This system is currently NOT calibrated with empirical clinical PACT data.
 * Under NO circumstances should unvalidated camera displacements be converted
 * into clinical Prism Diopter values (Δ) or displayed as such.
 */

import { CALIBRATION_STATUS } from '../constants/screeningConfig.js';
import { predictClinicalDeviation } from './clinicalCalibrationService.js';

/**
 * Interface converting digital camera measurement to estimated Prism Diopters (Δ).
 * Returns NOT_CALIBRATED until empirical PACT calibration data is integrated.
 * 
 * @param {Object} measurement - Digital Cover Test measurement object
 * @param {Object} [calibrationProfile] - Optional clinical calibration parameters
 * @param {number} [calibrationProfile.patientDistanceMm] - Distance from camera to subject
 * @param {number} [calibrationProfile.targetDistanceMm] - Fixation target distance
 * @param {number} [calibrationProfile.interpupillaryDistanceMm] - Anatomical IPD in mm
 * @param {Object} [calibrationProfile.clinicalPACT] - Ground truth PACT values for study
 * @returns {{
 *   status: string,
 *   prismDiopters: number | null,
 *   horizontalDelta: number | null,
 *   verticalDelta: number | null,
 *   confidenceInterval: [number, number] | null,
 *   clinicalNote: string
 * }}
 */
export function cameraMeasurementToPrismDiopters(
  measurement,
  calibrationProfile = null
) {
  const result = predictClinicalDeviation(measurement, calibrationProfile?.context || {}, {
    model: calibrationProfile?.model,
    metadata: calibrationProfile?.metadata,
    production: calibrationProfile?.production !== false,
  });
  return {
    ...result,
    prismDiopters: result.horizontalDeviationPD,
    horizontalDelta: result.horizontalDeviationPD,
    verticalDelta: result.verticalDeviationPD,
    confidenceInterval: null,
    clinicalNote: result.disclaimer || 'Chưa có dữ liệu hiệu chuẩn lâm sàng. Hệ thống hiện chỉ ghi nhận chuyển động mắt.',
  };
}

/**
 * Interface converting Cover Test measurement to calibrated Prism Diopters.
 * Strictly returns NOT_CALIBRATED until empirical PACT calibration data is integrated.
 * @param {Object} measurement
 * @param {Object} [profile]
 * @returns {{
 *   status: string,
 *   value: number | null,
 *   prismDiopters: number | null,
 *   clinicalNote: string
 * }}
 */
export function calibrateCoverTestMeasurement(_measurement, _profile = null) {
  return {
    status: CALIBRATION_STATUS.NOT_CALIBRATED,
    value: null,
    prismDiopters: null,
    clinicalNote:
      'Hệ thống chưa có bộ dữ liệu ghép cặp lâm sàng (paired dataset) để hiệu chuẩn sang Prism Diopter (Δ). Dữ liệu chỉ mang tính chất chuyển động vật lý quan sát được.',
  };
}

/**
 * Interface converting Brock String measurement to calibrated clinical convergence angle.
 * Strictly returns NOT_CALIBRATED until empirical synoptophore/clinical validation is integrated.
 * @param {Object} [_measurement]
 * @param {Object} [_profile]
 * @returns {{
 *   status: string,
 *   value: number | null,
 *   convergenceAngleDegrees: number | null,
 *   clinicalNote: string
 * }}
 */
export function calibrateBrockStringMeasurement(_measurement, _profile = null) {
  return {
    status: CALIBRATION_STATUS.NOT_CALIBRATED,
    value: null,
    convergenceAngleDegrees: null,
    clinicalNote:
      'Hệ thống chưa có bộ dữ liệu ghép cặp lâm sàng để hiệu chuẩn sang góc quy tụ lâm sàng (clinical convergence angle). Dữ liệu chỉ phản ánh tỉ lệ tương quan khoảng cách mống mắt quan sát được qua camera.',
  };
}

/**
 * Creates a structured study profile for clinical validation datasets
 * @param {Object} params
 * @param {string} params.studyId
 * @param {number} params.patientDistanceMm
 * @param {number} params.targetDistanceMm
 * @param {number} [params.interpupillaryDistanceMm]
 * @param {Object} [params.clinicalPACT]
 * @returns {Object} Structured calibration record
 */
export function createClinicalCalibrationRecord({
  studyId,
  patientDistanceMm,
  targetDistanceMm,
  interpupillaryDistanceMm = 62,
  clinicalPACT = null,
}) {
  return {
    studyId,
    patientDistanceMm,
    targetDistanceMm,
    interpupillaryDistanceMm,
    clinicalPACT,
    isCalibrated: false,
    timestamp: new Date().toISOString(),
  };
}
