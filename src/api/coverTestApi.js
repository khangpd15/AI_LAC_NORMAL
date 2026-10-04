/**
 * RemiCare Cover Test API Service
 * 
 * Manages multipart session packaging and persistence to Render FastAPI backend.
 */

import { apiClient } from './client.js';
import { ensureBackendReady } from './backendReady.js';
import { COVER_TEST_CONFIG } from '../constants/screeningConfig.js';

const PERSISTENCE_TIMEOUT_MS = 60000;

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

  const sessionMetaPayload = {
    sessionId,
    cycleCount: cycles.length,
    samplingRateHz: COVER_TEST_CONFIG.datasetSampleRateHz,
    samplingMode: COVER_TEST_CONFIG.datasetSamplingMode,
    sourceDevice: 'WEBCAM',
    tracker: 'MEDIAPIPE_IRIS',
    rawSchemaVersion: '1.0.0',
    clientMetadata: cleanMetadata,
  };
  formData.append('session_metadata', JSON.stringify(sessionMetaPayload));

  // 2. Cycle raw trajectories
  cycles.forEach((cycle, idx) => {
    const cycleNum = cycle.cycleIndex || cycle.cycleNumber || cycle.cycle || (idx + 1);
    const rawSamples = cycle.samples || cycle.rawTrajectory || [];
    const cyclePayload = {
      schemaVersion: '1.0.0',
      sessionId,
      cycle: cycleNum,
      coveredEye: String(cycle.coveredEye || (cycleNum % 2 === 1 ? 'LEFT' : 'RIGHT')).toUpperCase(),
      trackedEye: String(cycle.trackedEye || (cycleNum % 2 === 1 ? 'RIGHT' : 'LEFT')).toUpperCase(),
      samplingRateHz: COVER_TEST_CONFIG.datasetSampleRateHz,
      samplingMode: COVER_TEST_CONFIG.datasetSamplingMode,
      durationMs: cycle.durationMs || 0,
      samples: rawSamples,
    };
    const jsonBlob = new Blob([JSON.stringify(cyclePayload)], { type: 'application/json' });
    formData.append(`cycle_${cycleNum}_raw`, jsonBlob, `cycle_${cycleNum}_raw.json`);
  });

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

  const endpoint = `/api/v1/cover-test/sessions?run_inference=${runInference ? 'true' : 'false'}`;

  await ensureBackendReady(signal);
  return apiClient(endpoint, {
    method: 'POST',
    body: formData,
    timeoutMs: PERSISTENCE_TIMEOUT_MS,
    signal,
  });
}
