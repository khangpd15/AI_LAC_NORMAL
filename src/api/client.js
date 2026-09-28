/**
 * RemiCare Standardized API Client
 * 
 * Provides unified request orchestration:
 * 1. Base URL resolution with fallback
 * 2. Strict timeout handling with AbortController
 * 3. In-flight promise deduplication (prevents duplicate simultaneous requests)
 * 4. Request cancellation via caller-provided AbortSignal
 * 5. Full client-side performance measurement (Request Start -> TTFB -> Parse -> UI Render)
 * 6. Server-Timing header extraction
 * 7. Development-only performance logging (zero PII / sensitive data)
 */

const DEFAULT_BACKEND_URL = 'http://localhost:8000';
const DEFAULT_TIMEOUT_MS = 15000;

// In-flight deduplication cache
const inFlightRequests = new Map();

// Client-side simple TTL cache (for GET idempotent requests)
const responseCache = new Map();

/**
 * Resolves clean base URL without trailing slash.
 */
export function getApiBaseUrl() {
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_BACKEND_URL;
  const rawUrl = envUrl || DEFAULT_BACKEND_URL;
  return rawUrl.replace(/\/+$/, '');
}

/**
 * Checks if current environment is development.
 */
function isDev() {
  return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
}

/**
 * Logs performance measurement in development mode.
 */
function logPerfMetrics({ method, url, status, totalMs, ttfbMs, parseMs, serverTiming, sizeBytes }) {
  if (!isDev()) return;

  const sizeFormatted = sizeBytes != null ? `${(sizeBytes / 1024).toFixed(2)} KB` : 'unknown size';
  console.groupCollapsed(
    `%c[RemiCare Client Perf]%c ${method} ${url} | %c${status}%c | ${totalMs.toFixed(1)}ms`,
    'color: #0284c7; font-weight: bold',
    'color: inherit',
    status >= 200 && status < 300 ? 'color: #16a34a; font-weight: bold' : 'color: #dc2626; font-weight: bold',
    'color: inherit'
  );
  console.log(`⏱️ Total Client Time : ${totalMs.toFixed(1)} ms`);
  console.log(`🌐 Network TTFB      : ${ttfbMs.toFixed(1)} ms`);
  console.log(`⚙️ JSON Parse Time   : ${parseMs.toFixed(1)} ms`);
  if (serverTiming) {
    console.log(`🖥️ Backend Server    : ${serverTiming}`);
  }
  console.log(`📦 Response Size     : ${sizeFormatted}`);
  console.groupEnd();
}

/**
 * Unified request executor.
 * 
 * @param {string} endpoint - Path relative to base URL (e.g. '/api/v1/screening/analyze')
 * @param {Object} options
 * @param {string} [options.method='GET']
 * @param {Object|FormData|string} [options.body]
 * @param {Object} [options.headers]
 * @param {number} [options.timeoutMs=15000]
 * @param {AbortSignal} [options.signal] - External signal for component unmount cancellation
 * @param {boolean} [options.deduplicate=true] - Prevent duplicate simultaneous identical requests
 * @param {number} [options.cacheTtlMs=0] - If > 0 and method is GET, cache response for given ms
 * @returns {Promise<any>} Parsed JSON response or throws error
 */
export async function apiClient(endpoint, options = {}) {
  const {
    method = 'GET',
    body = null,
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: callerSignal = null,
    deduplicate = false,
    cacheTtlMs = 0,
  } = options;

  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

  // 1. Check TTL cache for GET requests
  const cacheKey = `${method}:${url}`;
  if (method === 'GET' && cacheTtlMs > 0) {
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTtlMs) {
      return cached.data;
    }
  }

  // 2. In-flight promise deduplication
  if (deduplicate && method === 'GET') {
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }
  }

  const execPromise = (async () => {
    // 3. Setup timeout and abort controller linkage
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(new Error(`TIMEOUT_${timeoutMs}`)), timeoutMs);

    // Link caller signal if provided
    let abortListener = null;
    if (callerSignal) {
      if (callerSignal.aborted) {
        clearTimeout(timerId);
        throw new DOMException('Aborted by caller', 'AbortError');
      }
      abortListener = () => controller.abort(callerSignal.reason);
      callerSignal.addEventListener('abort', abortListener);
    }

    const reqHeaders = { ...headers };
    let reqBody = body;

    // Auto-detect JSON payload
    if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      reqBody = JSON.stringify(body);
    }

    const tStart = performance.now();
    let tTtfb = 0;
    let tParse = 0;

    try {
      const response = await fetch(url, {
        method,
        headers: reqHeaders,
        body: reqBody,
        signal: controller.signal,
      });

      tTtfb = performance.now() - tStart;

      // Extract server timing header if present (defensively check response.headers)
      const serverTiming = response.headers?.get ? response.headers.get('Server-Timing') : null;

      // Check response content size
      const contentLengthHeader = response.headers?.get ? response.headers.get('Content-Length') : null;
      const sizeBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;

      const tParseStart = performance.now();
      let data = null;
      if (typeof response.json === 'function') {
        data = await response.json().catch(() => null);
      } else if (typeof response.text === 'function') {
        data = await response.text();
      }
      tParse = performance.now() - tParseStart;

      const tTotal = performance.now() - tStart;

      logPerfMetrics({
        method,
        url: endpoint,
        status: response.status,
        totalMs: tTotal,
        ttfbMs: tTtfb,
        parseMs: tParse,
        serverTiming,
        sizeBytes,
      });

      if (!response.ok) {
        const error = new Error(data?.detail || data?.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      // Cache if configured
      if (method === 'GET' && cacheTtlMs > 0) {
        responseCache.set(cacheKey, { timestamp: Date.now(), data });
      }

      return data;
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        const isTimeout = controller.signal.reason?.message?.startsWith('TIMEOUT_');
        const timeoutError = new Error(
          isTimeout ? `Yêu cầu quá thời gian chờ (${Math.round(timeoutMs / 1000)}s)` : 'Yêu cầu đã bị hủy'
        );
        timeoutError.name = isTimeout ? 'TimeoutError' : 'AbortError';
        timeoutError.isTimeout = isTimeout;
        throw timeoutError;
      }
      throw err;
    } finally {
      clearTimeout(timerId);
      if (callerSignal && abortListener) {
        callerSignal.removeEventListener('abort', abortListener);
      }
      inFlightRequests.delete(cacheKey);
    }
  })();

  if (deduplicate && method === 'GET') {
    inFlightRequests.set(cacheKey, execPromise);
  }

  return execPromise;
}
