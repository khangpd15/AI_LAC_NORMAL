import { clinicalCalibrationGuard } from './clinicalCalibrationGuard.js';

let registeredModel = null;
let registeredMetadata = null;

export function registerClinicalCalibrationModel(model, metadata) {
  registeredModel = model;
  registeredMetadata = structuredClone(metadata);
}

export function clearClinicalCalibrationModel() {
  registeredModel = null;
  registeredMetadata = null;
}

export function predictClinicalDeviation(measurement, context = {}, options = {}) {
  return clinicalCalibrationGuard({
    model: options.model ?? registeredModel,
    metadata: options.metadata ?? registeredMetadata,
    measurement,
    context,
    production: options.production !== false,
    enabled: options.enabled,
  });
}

export function getClinicalCalibrationRegistry() {
  return { hasModel: Boolean(registeredModel), metadata: registeredMetadata ? structuredClone(registeredMetadata) : null };
}
