/**
 * RemiCare Cover Test API Service
 * 
 * Manages multipart session packaging and persistence to Render FastAPI backend.
 */

import { apiClient } from './client.js';
import { ensureBackendReady } from './backendReady.js';
import { COVER_TEST_CONFIG } from '../constants/screeningConfig.js';

const PERSISTENCE_TIMEOUT_MS = 60000;

function endpoint(path) {
  const specificBase = (
    import.meta.env?.VITE_COVER_TEST_BACKEND_URL ||
    import.meta.env?.VITE_COVER_BACKEND_URL
  )?.trim().replace(/\/+$/, '');
  return specificBase ? `${specificBase}${path}` : path;
}


/**
 * Saves complete 3-cycle Cover Test session, trajectories, and eye crops.
 * 
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {Object} params.clientMetadata
 * @param {Array<Object>} params.cycles
 * @param {Object} params.images
 * @param {boolean} [params.runInference=true]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<Object>}
 */
export async function saveCoverTestSessionApi({
  sessionId,
  clientMetadata = {},
  cycles = [],
  images = {},
  runInference = true,
  signal = null,
}) {
  const formData = new FormData();

  // 1. Session Metadata (Sanitize zero PII)
  const cleanMetadata = { ...clientMetadata };
  delete cleanMetadata.name;
  delete cleanMetadata.phone;
  delete cleanMetadata.email;
  delete cleanMetadata.cccd;
  delete cleanMetadata.dob;
  delete cleanMetadata.dateOfBirth;
  delete cleanMetadata.address;

  // Existing servers retain clientMetadata but may whitelist raw-cycle fields.
  // Keep observed evidence here as well so it survives that compatible path.
  const observedMeasurements = cycles.filter(cycle => cycle.measurementProtocol === 'observed-cover-uncover-v1')
    .map(cycle => ({
      cycle: cycle.cycleIndex || cycle.cycleNumber || cycle.cycle,
      measurementProtocol: cycle.measurementProtocol,
      primaryMeasurement: cycle.primaryMeasurement,
      coverOn: { leftEye: cycle.leftEye, rightEye: cycle.rightEye },
      uncoverRecovery: cycle.uncoverRecovery,
      procedureEvidence: cycle.procedureEvidence,
      occlusionVerified: cycle.occlusionVerified,
      primaryOcclusionVerified: cycle.primaryOcclusionVerified,
      imageCaptureComplete: cycle.imageCaptureComplete ?? null,
      quality: cycle.quality,
    }));
  if (observedMeasurements.length) cleanMetadata.observedCoverMeasurements = observedMeasurements;

  const sessionMetaPayload = {
    sessionId,
    cycleCount: cycles.length,
    samplingRateHz: clientMetadata.samplingRateHz ?? COVER_TEST_CONFIG.datasetSampleRateHz,
    samplingMode: clientMetadata.samplingMode ?? COVER_TEST_CONFIG.datasetSamplingMode,
    sourceDevice: 'WEBCAM',
    tracker: 'MEDIAPIPE_IRIS',
    rawSchemaVersion: '2.0.0',
    clientMetadata: cleanMetadata,
  };
  formData.append('session_metadata', JSON.stringify(sessionMetaPayload));

  // 2. Cycle raw trajectories
  cycles.forEach((cycle, idx) => {
    const cycleNum = cycle.cycleIndex || cycle.cycleNumber || cycle.cycle || (idx + 1);
    const rawSamples = cycle.samples || cycle.rawTrajectory || [];
    const cyclePayload = {
      schemaVersion: '2.0.0',
      timestampUnit: 'milliseconds',
      sourceTimestampField: 'timestampMs',
      pairedFeatureVersion: 'hog64x32-canthal-seconds-v1',
      sessionId,
      cycle: cycleNum,
      coveredEye: String(cycle.coveredEye || (cycleNum % 2 === 1 ? 'LEFT' : 'RIGHT')).toUpperCase(),
      trackedEye: String(cycle.trackedEye || (cycleNum % 2 === 1 ? 'RIGHT' : 'LEFT')).toUpperCase(),
      samplingRateHz: cycle.samplingRateHz ?? COVER_TEST_CONFIG.datasetSampleRateHz,
      samplingMode: cycle.samplingMode ?? COVER_TEST_CONFIG.datasetSamplingMode,
      durationMs: cycle.durationMs || 0,
      samples: rawSamples,
      uncoverEvents: cycle.uncoverEvents || [],
      measurementProtocol: cycle.measurementProtocol || null,
      primaryMeasurement: cycle.primaryMeasurement || null,
      coverOn: cycle.primaryMeasurement === 'cover_on_fellow_eye'
        ? { leftEye: cycle.leftEye, rightEye: cycle.rightEye } : null,
      uncoverRecovery: cycle.uncoverRecovery || null,
      procedureEvidence: cycle.procedureEvidence || [],
      occlusionVerified: cycle.occlusionVerified ?? null,
      primaryOcclusionVerified: cycle.primaryOcclusionVerified ?? null,
      imageCaptureComplete: cycle.imageCaptureComplete ?? null,
      measurementQuality: cycle.quality || null,
    };
    const jsonBlob = new Blob([JSON.stringify(cyclePayload)], { type: 'application/json' });
    formData.append(`cycle_${cycleNum}_raw`, jsonBlob, `cycle_${cycleNum}_raw.json`);
  });

  // Manifest joins each eye pair to the exact source frame in the trajectory.
  const events = cycles.flatMap(cycle => cycle.uncoverEvents || []);
  const manifest = {
    schemaVersion: '2.0.0', sessionId,
    requestedModalities: ['time_series', 'uncover_eye_images'],
    timestampUnit: 'milliseconds', timestampClock: 'performance.timeOrigin',
    events,
  };
  for (const event of events.filter(event => event.status === 'CAPTURED')) {
    const cycle = cycles.find(item => (item.cycleIndex || item.cycleNumber || item.cycle) === event.cycle);
    const matching = (cycle?.samples || cycle?.rawTrajectory || []).some(sample =>
      sample.frameId === event.frameId && sample.timestampMs === event.timestampMs);
    if (!matching) throw new Error('UNCOVER_FRAME_NOT_IN_TRAJECTORY');
    for (const side of ['left', 'right']) {
      const crop = event.crops?.[side];
      if (!crop || !(images[crop.field] instanceof Blob)) throw new Error('UNCOVER_IMAGE_MISSING');
      formData.append(crop.field, images[crop.field], crop.file);
    }
  }
  formData.append('uncover_manifest', JSON.stringify(manifest));

  // 3. Eye crop images
  for (let c = 1; c <= 3; c++) {
    const leftKey = `${c}_left`;
    const rightKey = `${c}_right`;
    if (images[leftKey] instanceof Blob) {
      formData.append(`cycle_${c}_left_eye`, images[leftKey], `cycle_${c}_left_eye.jpg`);
    }
    if (images[rightKey] instanceof Blob) {
      formData.append(`cycle_${c}_right_eye`, images[rightKey], `cycle_${c}_right_eye.jpg`);
    }
  }

  const sessionUrl = endpoint(`/api/v1/cover-test/sessions?run_inference=${runInference ? 'true' : 'false'}`);

  await ensureBackendReady(signal, endpoint('/ping'));
  return apiClient(sessionUrl, {
    method: 'POST',
    body: formData,
    timeoutMs: PERSISTENCE_TIMEOUT_MS,
    signal,
  });
}
