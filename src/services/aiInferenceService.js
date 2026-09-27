/**
 * AI Inference Service - Client-side ONNX Runtime Web execution
 * Pure service layer without UI logic.
 */

import * as ort from 'onnxruntime-web';

// Strict feature contract order matching Phase 2 model_metadata.json
export const AI_FEATURE_ORDER = [
  'leftHorizontalRatio',
  'rightHorizontalRatio',
  'leftVerticalRatio',
  'rightVerticalRatio',
  'interocularDistance',
  'horizontalRatioDiff',
  'verticalRatioDiff',
  'leftEyeWidth',
  'rightEyeWidth',
  'irisDistanceRatio',
];

const DEFAULT_MODEL_PATH = '/models/strabismus_model.onnx';
const DEFAULT_METADATA_PATH = '/models/model_metadata.json';

// Configure ONNX Runtime Web environment once
if (typeof window !== 'undefined' && ort && ort.env && ort.env.wasm) {
  // Use public/dist wasm or robust CDN fallback
  ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.0/dist/';
  ort.env.wasm.numThreads = 1;
}

let cachedSession = null;
let cachedMetadata = null;
let sessionLoadingPromise = null;

/**
 * Loads metadata specification for the trained model
 * @param {string} metadataUrl
 * @returns {Promise<any>}
 */
export async function loadModelMetadata(metadataUrl = DEFAULT_METADATA_PATH) {
  if (cachedMetadata) return cachedMetadata;
  try {
    const res = await fetch(metadataUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching metadata`);
    cachedMetadata = await res.json();
    return cachedMetadata;
  } catch (err) {
    console.warn('Could not fetch model metadata, using built-in defaults:', err);
    cachedMetadata = {
      features: AI_FEATURE_ORDER,
      labels: { '0': 'normal', '1': 'strabismus' },
      decisionThreshold: 0.5,
    };
    return cachedMetadata;
  }
}

/**
 * Initializes and caches ONNX Runtime Web InferenceSession (Single-instance load)
 * @param {string} modelUrl
 * @returns {Promise<ort.InferenceSession>}
 */
export async function getOrInitAISession(modelUrl = DEFAULT_MODEL_PATH) {
  if (cachedSession) return cachedSession;
  if (sessionLoadingPromise) return sessionLoadingPromise;

  sessionLoadingPromise = (async () => {
    try {
      console.log(`[RemiCare AI] Loading ONNX model from: ${modelUrl}`);
      // Options optimized for mobile and desktop browsers
      const sessionOptions = {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      };

      // Fetch model binary directly to ensure robust loading across all bundlers
      const res = await fetch(modelUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} tải tệp mô hình ONNX`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const modelBytes = new Uint8Array(arrayBuffer);

      const session = await ort.InferenceSession.create(modelBytes, sessionOptions);
      cachedSession = session;
      console.log('[RemiCare AI] ONNX InferenceSession successfully initialized');
      return session;
    } catch (err) {
      console.error('[RemiCare AI] Failed to load ONNX model:', err);
      sessionLoadingPromise = null; // allow retry
      throw new Error(`Không thể nạp mô hình AI ONNX: ${err.message}`);
    }
  })();

  return sessionLoadingPromise;
}

/**
 * Executes real-time inference on eye geometric features
 * @param {Object} eyeFeatures - Feature object from extractEyeFeatures()
 * @param {ort.InferenceSession} session - Optional session override
 * @returns {Promise<{
 *   normalScore: number,
 *   strabismusScore: number,
 *   confidence: number,
 *   predictedClass: number,
 *   inferenceTimeMs: number
 * }>}
 */
export async function runAIInference(eyeFeatures, session = null) {
  const activeSession = session || cachedSession || (await getOrInitAISession());
  if (!activeSession) {
    throw new Error('AI Session not initialized');
  }

  const startTime = performance.now();

  // 1. Pack feature vector in strict contract order
  const numFeatures = AI_FEATURE_ORDER.length;
  const floatBuffer = new Float32Array(numFeatures);

  for (let i = 0; i < numFeatures; i++) {
    const key = AI_FEATURE_ORDER[i];
    const val = eyeFeatures[key];
    floatBuffer[i] = typeof val === 'number' && Number.isFinite(val) ? val : 0.0;
  }

  // 2. Wrap into ONNX Tensor (Shape: [1, 10])
  const inputTensor = new ort.Tensor('float32', floatBuffer, [1, numFeatures]);
  const inputName = activeSession.inputNames[0] || 'float_input';

  // 3. Run Session
  const feeds = { [inputName]: inputTensor };
  const results = await activeSession.run(feeds);

  const inferenceTimeMs = performance.now() - startTime;

  // 4. Parse Outputs: label & probabilities
  let normalScore = 0.5;
  let strabismusScore = 0.5;
  let predictedClass = 0;

  // Check probabilities output
  const probOutputKey = activeSession.outputNames.find((name) =>
    name.toLowerCase().includes('prob')
  ) || activeSession.outputNames[1];

  const labelOutputKey = activeSession.outputNames.find((name) =>
    name.toLowerCase().includes('label')
  ) || activeSession.outputNames[0];

  if (probOutputKey && results[probOutputKey]) {
    const probData = results[probOutputKey].data;
    if (probData.length >= 2) {
      normalScore = Number(probData[0]);
      strabismusScore = Number(probData[1]);
    }
  }

  if (labelOutputKey && results[labelOutputKey]) {
    const labelData = results[labelOutputKey].data;
    predictedClass = Number(labelData[0]);
  } else {
    predictedClass = strabismusScore >= 0.5 ? 1 : 0;
  }

  // Clinical confidence measure
  const confidence = Math.max(normalScore, strabismusScore);

  return {
    normalScore: Number(normalScore.toFixed(4)),
    strabismusScore: Number(strabismusScore.toFixed(4)),
    confidence: Number(confidence.toFixed(4)),
    predictedClass,
    inferenceTimeMs: Number(inferenceTimeMs.toFixed(2)),
  };
}

/**
 * Cleanly releases ONNX session
 */
export function disposeAISession() {
  if (cachedSession) {
    try {
      cachedSession.release?.();
    } catch (e) {
      console.warn('Error releasing ONNX session:', e);
    }
    cachedSession = null;
    sessionLoadingPromise = null;
  }
}
