/**
 * FaceMesh Service - MediaPipe Face Mesh lifecycle & frame processing
 */

const MEDIAPIPE_CDN_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
const MEDIAPIPE_ASSETS_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/';

/**
 * Ensures MediaPipe FaceMesh script is loaded into the document
 * @returns {Promise<typeof window.FaceMesh>}
 */
export function ensureFaceMeshScriptLoaded() {
  if (typeof window !== 'undefined' && window.FaceMesh) {
    return Promise.resolve(window.FaceMesh);
  }

  return new Promise((resolve, reject) => {
    // Check if script tag is already being appended
    let script = document.querySelector(`script[src="${MEDIAPIPE_CDN_URL}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = MEDIAPIPE_CDN_URL;
      script.crossOrigin = 'anonymous';
      script.async = true;
      document.head.appendChild(script);
    }

    script.onload = () => {
      if (window.FaceMesh) {
        resolve(window.FaceMesh);
      } else {
        reject(new Error('MediaPipe FaceMesh script loaded but FaceMesh constructor not found.'));
      }
    };

    script.onerror = () => {
      reject(new Error('Không thể tải thư viện MediaPipe FaceMesh từ CDN.'));
    };
  });
}

let sharedFaceMeshInstance = null;
let currentResultsCallback = null;
let initPromise = null;

/**
 * Initializes or returns the shared FaceMesh instance with refineLandmarks: true
 * @param {Function} onResultsCallback
 * @param {Object} customOptions
 * @returns {Promise<any>}
 */
export async function initializeFaceMesh(onResultsCallback, customOptions = {}) {
  await ensureFaceMeshScriptLoaded();

  currentResultsCallback = onResultsCallback;

  if (sharedFaceMeshInstance) {
    if (customOptions && Object.keys(customOptions).length > 0) {
      sharedFaceMeshInstance.setOptions(customOptions);
    }
    return sharedFaceMeshInstance;
  }

  if (initPromise) {
    await initPromise;
    return sharedFaceMeshInstance;
  }

  initPromise = (async () => {
    const faceMesh = new window.FaceMesh({
      locateFile: (file) => `${MEDIAPIPE_ASSETS_BASE}${file}`,
    });

    const options = {
      maxNumFaces: 1,
      refineLandmarks: true, // REQUIRED: unlocks iris landmarks 468 - 477
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
      ...customOptions,
    };

    faceMesh.setOptions(options);

    faceMesh.onResults((results) => {
      if (currentResultsCallback) {
        currentResultsCallback(results);
      }
    });

    sharedFaceMeshInstance = faceMesh;
    return faceMesh;
  })();

  return await initPromise;
}

/**
 * Updates the active results callback for the shared FaceMesh instance
 * @param {Function} callback
 */
export function setFaceMeshResultsCallback(callback) {
  currentResultsCallback = callback;
}

/**
 * Sends a single video frame to FaceMesh with dimension and readiness checks
 * @param {any} faceMeshInstance
 * @param {HTMLVideoElement} videoElement
 */
export async function sendFrameToFaceMesh(faceMeshInstance, videoElement) {
  if (
    !faceMeshInstance ||
    !videoElement ||
    videoElement.readyState < 2 ||
    videoElement.videoWidth === 0 ||
    videoElement.videoHeight === 0 ||
    videoElement.paused
  ) {
    return;
  }
  try {
    let timeoutId = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('MediaPipe send timeout')), 2500);
    });

    try {
      await Promise.race([
        faceMeshInstance.send({ image: videoElement }),
        timeoutPromise,
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  } catch (err) {
    // Non-fatal frame skip
    console.debug('MediaPipe frame processing skipped:', err);
  }
}

/**
 * Safely detaches callback without destroying global WebGL context
 * @param {any} faceMeshInstance
 */
export function closeFaceMesh(_faceMeshInstance = null) {
  // Never close the shared instance to avoid destroying the WebGL context across tab switches!
  if (currentResultsCallback) {
    currentResultsCallback = null;
  }
}

/**
 * Process a single image element (e.g. uploaded file or captured frame) with FaceMesh
 * @param {HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} imageElement
 * @param {Object} customOptions
 * @returns {Promise<any>} MediaPipe results object
 */
export async function processSingleImageWithFaceMesh(imageElement, customOptions = {}) {
  const instance = await initializeFaceMesh(null, customOptions);
  if (!instance || !imageElement) {
    return { multiFaceLandmarks: [] };
  }

  return new Promise((resolve) => {
    let settled = false;
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      setFaceMeshResultsCallback(null);
    };

    const handler = (results) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(results || { multiFaceLandmarks: [] });
    };

    setFaceMeshResultsCallback(handler);

    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ multiFaceLandmarks: [] });
    }, 4500);

    try {
      instance.send({ image: imageElement }).catch((err) => {
        console.warn('FaceMesh send single image error:', err);
        if (settled) return;
        settled = true;
        cleanup();
        resolve({ multiFaceLandmarks: [] });
      });
    } catch (err) {
      console.warn('FaceMesh send single image sync error:', err);
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ multiFaceLandmarks: [] });
    }
  });
}

