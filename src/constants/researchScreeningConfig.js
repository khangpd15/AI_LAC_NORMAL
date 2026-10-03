export const RESEARCH_SCREENING_FLOW_ENABLED =
  typeof import.meta === 'undefined' ||
  import.meta.env?.VITE_RESEARCH_SCREENING_FLOW !== 'false';

export const RESEARCH_CAMERA_CONFIG = {
  minWidth: 640,
  minHeight: 480,
  preferredWidth: 1920,
  preferredHeight: 1080,
  maxWidth: 2560,
  maxHeight: 1440,
  frameRate: { ideal: 30, max: 60 },
  facingMode: { ideal: 'environment' },
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

export function getScreeningCameraConstraints() {
  return {
    video: {
      width: {
        ideal: RESEARCH_CAMERA_CONFIG.preferredWidth,
        max: RESEARCH_CAMERA_CONFIG.maxWidth,
      },
      height: {
        ideal: RESEARCH_CAMERA_CONFIG.preferredHeight,
        max: RESEARCH_CAMERA_CONFIG.maxHeight,
      },
      facingMode: RESEARCH_CAMERA_CONFIG.facingMode,
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

export function validateResearchCameraSettings(settings = {}) {
  const width = Number(settings.width || 0);
  const height = Number(settings.height || 0);
  const valid = width >= RESEARCH_CAMERA_CONFIG.minWidth && height >= RESEARCH_CAMERA_CONFIG.minHeight;

  return {
    valid,
    width,
    height,
    minWidth: RESEARCH_CAMERA_CONFIG.minWidth,
    minHeight: RESEARCH_CAMERA_CONFIG.minHeight,
    reason: valid ? null : 'CAMERA_RESOLUTION_BELOW_TODO_PILOT_MINIMUM',
  };
}

export async function tryEnableTorchForResearch(stream, deviceContext = getDeviceContext()) {
  const track = stream?.getVideoTracks?.()[0] || null;
  const result = {
    requested: Boolean(deviceContext.isAndroid),
    supported: false,
    enabled: false,
    fallback: null,
    error: null,
  };

  if (!track || !deviceContext.isAndroid) {
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
