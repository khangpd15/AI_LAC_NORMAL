export const RESEARCH_SCREENING_FLOW_ENABLED =
  typeof import.meta === 'undefined' ||
  import.meta.env?.VITE_RESEARCH_SCREENING_FLOW !== 'false';

export const RESEARCH_CAMERA_CONFIG = {
  minWidth: 640,
  minHeight: 480,
  preferredWidth: 1280,
  preferredHeight: 720,
  maxWidth: 1920,
  maxHeight: 1080,
  frameRate: { ideal: 30, max: 60 },
  facingMode: { ideal: 'user' },
  retryLimit: null,
  thresholdSource: 'TODO_PILOT',
};

export const RESEARCH_ELIGIBILITY_CONFIG = {
  minAgeYears: 7,
  maxAgeYears: null,
  redFlagQuestions: [
    {
      id: 'doctor_red_flags_pending',
      label: 'Có dấu hiệu cần khám ngay theo danh sách bác sĩ cung cấp',
      status: 'PLACEHOLDER_PENDING_CLINICAL_REVIEW',
    },
  ],
  glassesPolicy: 'TODO_CLINICAL_REVIEW',
};

export const RESEARCH_QUALITY_STATUS = {
  GOOD: 'GOOD',
  WARNING: 'WARNING',
  INVALID: 'INVALID',
};

export const RESEARCH_QUALITY_CONFIG = {
  schemaVersion: 'remicare-research-quality-v0.1',
  thresholdSource: 'TODO_PILOT',
  distanceCm: {
    targetMin: 20,
    targetMax: 25,
    warningMin: 15,
    warningMax: 30,
    estimatedErrorCm: 4,
  },
  focus: {
    invalidBelow: 10,
    warningBelow: 22,
    sampleWidth: 96,
    sampleHeight: 72,
  },
  exposure: {
    lumaInvalidMin: 35,
    lumaWarningMin: 55,
    lumaWarningMax: 205,
    lumaInvalidMax: 225,
    saturatedRatioWarning: 0.08,
    saturatedRatioInvalid: 0.18,
    darkRatioWarning: 0.45,
  },
  headPose: {
    yawGoodMaxDeg: 8,
    yawInvalidMaxDeg: 14,
    pitchGoodMaxDeg: 12,
    pitchInvalidMaxDeg: 18,
    rollGoodMaxDeg: 10,
    rollInvalidMaxDeg: 16,
  },
  cornealReflex: {
    enabled: true,
    irisCropScale: 0.42,
    saturatedRgbMin: 235,
    brightLumaMin: 225,
    minCandidatePixels: 2,
    maxCandidatePixels: 90,
    expectedCountPerEye: 1,
  },
};

export function getScreeningCameraConstraints(preferredFacingMode = null) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;

  // On desktop / laptop, there is no rear camera; always use 'user'.
  // On mobile, default to 'user' for front-facing position check so the user can see the alignment box.
  const facing = preferredFacingMode || (isMobile ? { ideal: 'user' } : 'user');

  // iOS Safari / WebKit WebRTC: hardware sensor reports in landscape (e.g. 1280x720).
  // Specifying hard min/max constraints or portrait bounds causes OverconstrainedError on Safari.
  if (isIOS) {
    return {
      video: {
        facingMode: facing,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    };
  }

  return {
    video: {
      width: isPortrait
        ? { ideal: 720, max: 1080 }
        : { ideal: 1280, max: 1920 },
      height: isPortrait
        ? { ideal: 1080, max: 1920 }
        : { ideal: 720, max: 1080 },
      facingMode: facing,
      frameRate: RESEARCH_CAMERA_CONFIG.frameRate,
    },
    audio: false,
  };
}

export function getDeviceContext() {
  if (typeof navigator === 'undefined') {
    return {
      userAgent: 'UNKNOWN',
      os: 'UNKNOWN',
      browser: 'UNKNOWN',
      isAndroid: false,
      isIOS: false,
    };
  }

  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const browser = /Edg/i.test(ua)
    ? 'Edge'
    : /Chrome|CriOS/i.test(ua)
      ? 'Chrome'
      : /Safari/i.test(ua)
        ? 'Safari'
        : /Firefox|FxiOS/i.test(ua)
          ? 'Firefox'
          : 'UNKNOWN';

  return {
    userAgent: ua,
    os: isAndroid ? 'Android' : isIOS ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : 'UNKNOWN',
    browser,
    isAndroid,
    isIOS,
    platform: navigator.platform || 'UNKNOWN',
    deviceMemory: navigator.deviceMemory ?? null,
  };
}

export function validateResearchCameraSettings(settings = {}, videoElement = null) {
  const w1 = Number(settings.width || 0);
  const h1 = Number(settings.height || 0);
  const w2 = Number(videoElement?.videoWidth || 0);
  const h2 = Number(videoElement?.videoHeight || 0);

  const rawWidth = w1 || w2;
  const rawHeight = h1 || h2;

  // If dimensions not yet available (metadata loading), treat as initializing / valid
  if (rawWidth === 0 && rawHeight === 0) {
    return {
      valid: true,
      width: 0,
      height: 0,
      minWidth: RESEARCH_CAMERA_CONFIG.minWidth,
      minHeight: RESEARCH_CAMERA_CONFIG.minHeight,
      reason: null,
      isInitializing: true,
    };
  }

  // Support both portrait and landscape orientation
  const maxDim = Math.max(rawWidth, rawHeight);
  const minDim = Math.min(rawWidth, rawHeight);

  // Meets standard if long edge >= 640 and short edge >= 480
  const meetsStandard = maxDim >= RESEARCH_CAMERA_CONFIG.minWidth && minDim >= RESEARCH_CAMERA_CONFIG.minHeight;

  return {
    valid: meetsStandard,
    width: rawWidth,
    height: rawHeight,
    minWidth: RESEARCH_CAMERA_CONFIG.minWidth,
    minHeight: RESEARCH_CAMERA_CONFIG.minHeight,
    reason: meetsStandard ? null : 'CAMERA_RESOLUTION_BELOW_TODO_PILOT_MINIMUM',
  };
}

export async function tryEnableTorchForResearch(stream, deviceContext = getDeviceContext()) {
  const safeDeviceContext = deviceContext || getDeviceContext();
  const track = stream?.getVideoTracks?.()[0] || null;
  const result = {
    requested: Boolean(safeDeviceContext.isAndroid),
    supported: false,
    enabled: false,
    fallback: null,
    error: null,
  };

  if (!track || !safeDeviceContext.isAndroid) {
    result.fallback = 'external_light';
    return result;
  }

  try {
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    result.supported = Boolean(capabilities && capabilities.torch);
    if (!result.supported) {
      result.fallback = 'external_light';
      return result;
    }

    await track.applyConstraints({ advanced: [{ torch: true }] });
    result.enabled = true;
    return result;
  } catch (err) {
    result.error = err?.message || 'TORCH_APPLY_CONSTRAINTS_FAILED';
    result.fallback = 'external_light';
    return result;
  }
}
