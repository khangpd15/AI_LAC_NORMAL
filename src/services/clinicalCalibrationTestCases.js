import { CLINICAL_CALIBRATION_STATUS } from '../constants/clinicalCalibrationConfig.js';
import { clinicalCalibrationGuard } from './clinicalCalibrationGuard.js';
import { assertNoSubjectLeakage, createClinicalCalibrationSample, validateClinicalCalibrationSample } from './calibrationDatasetService.js';
import { createUnifiedMeasurementResult } from './measurementResultService.js';
import { PROTOCOLS } from '../constants/screeningConfig.js';

const measurement = { normalizedDisplacement: 0.04, initialPosition: { normalizedX: 0.4, normalizedY: 0.5 }, finalPosition: { normalizedX: 0.44, normalizedY: 0.5 }, peakVelocity: 0.3, timeToPeakMs: 120, trajectoryStability: 0.92, baselinePosition: { isStable: true }, eyeWidth: 0.08, sampleCount: 30, confidence: 0.95, dataQuality: { isValid: true } };
const model = { predict: () => ({ horizontalDeviationPD: 8.4, verticalDeviationPD: 0.5 }) };
const metadata = (status, validation = 'NOT_VALIDATED', productionEnabled = false) => ({ status, clinicalValidationStatus: validation, productionEnabled, version: '1.0.0', referenceMethod: 'PACT' });

export function runClinicalCalibrationTestCases() {
  const noModel = clinicalCalibrationGuard({ measurement });
  const research = clinicalCalibrationGuard({ model, metadata: metadata(CLINICAL_CALIBRATION_STATUS.RESEARCH_ONLY), measurement, enabled: true });
  const validated = clinicalCalibrationGuard({ model, metadata: metadata(CLINICAL_CALIBRATION_STATUS.CLINICALLY_VALIDATED, 'VALIDATED', true), measurement, enabled: true });
  const poor = clinicalCalibrationGuard({ model, metadata: metadata(CLINICAL_CALIBRATION_STATUS.CLINICALLY_VALIDATED, 'VALIDATED', true), measurement: { ...measurement, dataQuality: { isValid: false } }, enabled: true });
  const missingPact = validateClinicalCalibrationSample(createClinicalCalibrationSample({ subjectId: 'SUBJECT_A', consentStatus: 'CONSENTED', webcamFeatures: { normalizedDisplacement: 0.04, peakVelocity: 0.3, sampleCount: 30 } }));
  const missingWebcam = validateClinicalCalibrationSample(createClinicalCalibrationSample({ subjectId: 'SUBJECT_A', consentStatus: 'CONSENTED', clinicalReference: { horizontalDeviationPD: 8, verticalDeviationPD: 0, horizontalDirection: 'EXO', verticalDirection: 'NONE' } }));
  let leakageRejected = false; try { assertNoSubjectLeakage({ train: [{ subjectId: 'SUBJECT_A' }], validation: [], test: [{ subjectId: 'SUBJECT_A' }] }); } catch { leakageRejected = true; }
  const brockResult = clinicalCalibrationGuard({ model, metadata: metadata(CLINICAL_CALIBRATION_STATUS.CLINICALLY_VALIDATED, 'VALIDATED', true), measurement: { protocol: PROTOCOLS.BROCK_STRING }, enabled: true });
  const staticResult = createUnifiedMeasurementResult({ protocol: PROTOCOLS.STATIC_EYE, measurements: { staticDifference: 0.1 } });
  const coverResult = createUnifiedMeasurementResult({ protocol: PROTOCOLS.COVER_TEST, measurements: { normalizedDisplacement: 0.04 } });
  return [
    { id: 1, passed: noModel.status === CLINICAL_CALIBRATION_STATUS.NOT_CALIBRATED },
    { id: 2, passed: research.status === CLINICAL_CALIBRATION_STATUS.NOT_CALIBRATED && research.horizontalDeviationPD === null },
    { id: 3, passed: validated.status === CLINICAL_CALIBRATION_STATUS.CLINICALLY_VALIDATED && validated.horizontalDeviationPD === 8.4 },
    { id: 4, passed: poor.status === CLINICAL_CALIBRATION_STATUS.INSUFFICIENT_DATA },
    { id: 5, passed: !missingPact.isValid },
    { id: 6, passed: !missingWebcam.isValid },
    { id: 7, passed: leakageRejected },
    { id: 8, passed: brockResult.horizontalDeviationPD === null && brockResult.status === CLINICAL_CALIBRATION_STATUS.INSUFFICIENT_DATA, note: 'Brock String cannot produce Cover Test PD.' },
    { id: 9, passed: staticResult.measurements.staticDifference === 0.1 && staticResult.clinicalCalibration === null, note: 'Static Eye result remains independent.' },
    { id: 10, passed: coverResult.measurements.normalizedDisplacement === 0.04 && coverResult.clinicalCalibration.status === CLINICAL_CALIBRATION_STATUS.NOT_CALIBRATED, note: 'Existing Cover Test field retained; calibration is additive.' },
  ];
}
