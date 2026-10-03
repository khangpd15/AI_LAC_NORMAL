import {
  RESEARCH_QUALITY_CONFIG,
  RESEARCH_QUALITY_STATUS,
  getDeviceContext,
} from '../../constants/researchScreeningConfig.js';

const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];
const LEFT_EYE_CORNERS = { inner: 362, outer: 263 };
const RIGHT_EYE_CORNERS = { inner: 133, outer: 33 };

const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

function statusRank(status) {
  if (status === RESEARCH_QUALITY_STATUS.INVALID) return 2;
  if (status === RESEARCH_QUALITY_STATUS.WARNING) return 1;
  return 0;
}

function worstStatus(statuses) {
  return statuses.reduce((worst, status) => (
    statusRank(status) > statusRank(worst) ? status : worst
  ), RESEARCH_QUALITY_STATUS.GOOD);
}

function makeOffscreenCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getVideoSize(video) {
  return {
    width: video?.videoWidth || video?.naturalWidth || video?.width || video?.clientWidth || 0,
    height: video?.videoHeight || video?.naturalHeight || video?.height || video?.clientHeight || 0,
  };
}

function getSampledFrame(video, width, height) {
  const canvas = makeOffscreenCanvas(width, height);
  const ctx = canvas?.getContext?.('2d', { willReadFrequently: true });
  if (!canvas || !ctx || !video) return null;

  try {
    ctx.drawImage(video, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
  } catch {
    return null;
  }
}

function analyzeFocusAndExposure(video) {
  const cfg = RESEARCH_QUALITY_CONFIG;
  const frame = getSampledFrame(video, cfg.focus.sampleWidth, cfg.focus.sampleHeight);
  if (!frame) {
    return {
      focus: { status: RESEARCH_QUALITY_STATUS.WARNING, score: null, reason: 'FRAME_UNAVAILABLE' },
      exposure: { status: RESEARCH_QUALITY_STATUS.WARNING, meanLuma: null, saturatedRatio: null, darkRatio: null, reason: 'FRAME_UNAVAILABLE' },
    };
  }

  const { data, width, height } = frame;
  const luma = new Float32Array(width * height);
  let sum = 0;
  let saturated = 0;
  let dark = 0;

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const y = (0.299 * data[i]) + (0.587 * data[i + 1]) + (0.114 * data[i + 2]);
    luma[p] = y;
    sum += y;
    if (data[i] >= 245 && data[i + 1] >= 245 && data[i + 2] >= 245) saturated += 1;
    if (y <= 35) dark += 1;
  }

  let gradientSum = 0;
  let gradientCount = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const dx = luma[idx + 1] - luma[idx - 1];
      const dy = luma[idx + width] - luma[idx - width];
      gradientSum += Math.abs(dx) + Math.abs(dy);
      gradientCount += 1;
    }
  }

  const focusScore = gradientCount ? Number((gradientSum / gradientCount).toFixed(2)) : null;
  const meanLuma = Number((sum / (width * height)).toFixed(1));
  const saturatedRatio = Number((saturated / (width * height)).toFixed(4));
  const darkRatio = Number((dark / (width * height)).toFixed(4));

  const focusStatus = focusScore == null || focusScore < cfg.focus.invalidBelow
    ? RESEARCH_QUALITY_STATUS.INVALID
    : focusScore < cfg.focus.warningBelow
      ? RESEARCH_QUALITY_STATUS.WARNING
      : RESEARCH_QUALITY_STATUS.GOOD;

  let exposureStatus = RESEARCH_QUALITY_STATUS.GOOD;
  if (
    meanLuma < cfg.exposure.lumaInvalidMin ||
    meanLuma > cfg.exposure.lumaInvalidMax ||
    saturatedRatio >= cfg.exposure.saturatedRatioInvalid
  ) {
    exposureStatus = RESEARCH_QUALITY_STATUS.INVALID;
  } else if (
    meanLuma < cfg.exposure.lumaWarningMin ||
    meanLuma > cfg.exposure.lumaWarningMax ||
    saturatedRatio >= cfg.exposure.saturatedRatioWarning ||
    darkRatio >= cfg.exposure.darkRatioWarning
  ) {
    exposureStatus = RESEARCH_QUALITY_STATUS.WARNING;
  }

  return {
    focus: { status: focusStatus, score: focusScore, thresholdSource: cfg.thresholdSource },
    exposure: {
      status: exposureStatus,
      meanLuma,
      saturatedRatio,
      darkRatio,
      thresholdSource: cfg.thresholdSource,
    },
  };
}

function averageLandmarks(landmarks, indices) {
  const points = indices.map((idx) => landmarks?.[idx]).filter(Boolean);
  if (!points.length) return null;
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
}

function eyeWidth(landmarks, corners) {
  const inner = landmarks?.[corners.inner];
  const outer = landmarks?.[corners.outer];
  if (!inner || !outer) return null;
  return Math.hypot(inner.x - outer.x, inner.y - outer.y);
}

function detectEyeReflex(video, landmarks, eye) {
  const cfg = RESEARCH_QUALITY_CONFIG.cornealReflex;
  const irisIndices = eye === 'left' ? LEFT_IRIS : RIGHT_IRIS;
  const corners = eye === 'left' ? LEFT_EYE_CORNERS : RIGHT_EYE_CORNERS;
  const center = averageLandmarks(landmarks, irisIndices);
  const widthNorm = eyeWidth(landmarks, corners);
  const { width, height } = getVideoSize(video);

  if (!center || !widthNorm || !width || !height) {
    return {
      status: RESEARCH_QUALITY_STATUS.INVALID,
      count: 0,
      candidates: [],
      reason: 'IRIS_LANDMARKS_UNAVAILABLE',
    };
  }

  const radiusPx = Math.max(8, Math.round(widthNorm * width * cfg.irisCropScale));
  const cx = Math.round(center.x * width);
  const cy = Math.round(center.y * height);
  const side = radiusPx * 2;
  const canvas = makeOffscreenCanvas(side, side);
  const ctx = canvas?.getContext?.('2d', { willReadFrequently: true });
  if (!canvas || !ctx) {
    return {
      status: RESEARCH_QUALITY_STATUS.WARNING,
      count: null,
      candidates: [],
      reason: 'CANVAS_UNAVAILABLE',
    };
  }

  try {
    ctx.drawImage(video, cx - radiusPx, cy - radiusPx, side, side, 0, 0, side, side);
  } catch {
    return {
      status: RESEARCH_QUALITY_STATUS.WARNING,
      count: null,
      candidates: [],
      reason: 'FRAME_UNAVAILABLE',
    };
  }

  const img = ctx.getImageData(0, 0, side, side);
  const visited = new Uint8Array(side * side);
  const candidates = [];
  const inCircle = (x, y) => Math.hypot(x - radiusPx, y - radiusPx) <= radiusPx;
  const isBright = (x, y) => {
    const offset = (y * side + x) * 4;
    const r = img.data[offset];
    const g = img.data[offset + 1];
    const b = img.data[offset + 2];
    const luma = (0.299 * r) + (0.587 * g) + (0.114 * b);
    return r >= cfg.saturatedRgbMin && g >= cfg.saturatedRgbMin && b >= cfg.saturatedRgbMin && luma >= cfg.brightLumaMin;
  };

  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const startIdx = y * side + x;
      if (visited[startIdx] || !inCircle(x, y) || !isBright(x, y)) continue;

      const stack = [[x, y]];
      visited[startIdx] = 1;
      let count = 0;
      let sumX = 0;
      let sumY = 0;

      while (stack.length) {
        const [px, py] = stack.pop();
        count += 1;
        sumX += px;
        sumY += py;
        const neighbors = [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= side || ny >= side) continue;
          const nIdx = ny * side + nx;
          if (visited[nIdx] || !inCircle(nx, ny) || !isBright(nx, ny)) continue;
          visited[nIdx] = 1;
          stack.push([nx, ny]);
        }
      }

      if (count >= cfg.minCandidatePixels && count <= cfg.maxCandidatePixels) {
        candidates.push({
          x: Number(((sumX / count - radiusPx) / radiusPx).toFixed(3)),
          y: Number(((sumY / count - radiusPx) / radiusPx).toFixed(3)),
          areaPx: count,
        });
      }
    }
  }

  const status = candidates.length === cfg.expectedCountPerEye
    ? RESEARCH_QUALITY_STATUS.GOOD
    : candidates.length === 0
      ? RESEARCH_QUALITY_STATUS.INVALID
      : RESEARCH_QUALITY_STATUS.WARNING;

  return {
    status,
    count: candidates.length,
    candidates: candidates.slice(0, 4),
    thresholdSource: RESEARCH_QUALITY_CONFIG.thresholdSource,
  };
}

export function detectCornealReflexCandidates(video, landmarks) {
  if (!RESEARCH_QUALITY_CONFIG.cornealReflex.enabled) {
    return {
      status: RESEARCH_QUALITY_STATUS.WARNING,
      enabled: false,
      left: null,
      right: null,
    };
  }

  const left = detectEyeReflex(video, landmarks, 'left');
  const right = detectEyeReflex(video, landmarks, 'right');

  return {
    enabled: true,
    status: worstStatus([left.status, right.status]),
    left,
    right,
    reflexCountPerEye: {
      left: left.count,
      right: right.count,
    },
  };
}

function evaluateDistance(distanceCm) {
  const cfg = RESEARCH_QUALITY_CONFIG.distanceCm;
  if (!isFiniteNumber(distanceCm)) {
    return {
      status: RESEARCH_QUALITY_STATUS.WARNING,
      estimatedCm: null,
      estimatedErrorCm: cfg.estimatedErrorCm,
      bucket: 'UNKNOWN',
      thresholdSource: RESEARCH_QUALITY_CONFIG.thresholdSource,
    };
  }

  const bucket = distanceCm >= cfg.targetMin && distanceCm <= cfg.targetMax
    ? 'TARGET_20_25_CM'
    : distanceCm < cfg.warningMin
      ? 'TOO_CLOSE'
      : distanceCm > cfg.warningMax
        ? 'TOO_FAR'
        : 'OUTSIDE_TARGET_TOLERATED';
  const status = bucket === 'TARGET_20_25_CM'
    ? RESEARCH_QUALITY_STATUS.GOOD
    : bucket === 'OUTSIDE_TARGET_TOLERATED'
      ? RESEARCH_QUALITY_STATUS.WARNING
      : RESEARCH_QUALITY_STATUS.INVALID;

  return {
    status,
    estimatedCm: Number(distanceCm),
    estimatedErrorCm: cfg.estimatedErrorCm,
    bucket,
    thresholdSource: RESEARCH_QUALITY_CONFIG.thresholdSource,
  };
}

function evaluateHeadPose(quality = {}, positionReport = {}) {
  const cfg = RESEARCH_QUALITY_CONFIG.headPose;
  const yaw = quality.headYawDeg ?? positionReport?.headPose?.yawDeg ?? null;
  const pitch = quality.headPitchDeg ?? positionReport?.headPose?.pitchDeg ?? null;
  const roll = quality.headRollDeg ?? positionReport?.headPose?.rollDeg ?? null;

  const yawAbs = Math.abs(Number(yaw));
  const pitchAbs = Math.abs(Number(pitch));
  const rollAbs = Math.abs(Number(roll));
  if (!isFiniteNumber(yawAbs) && !isFiniteNumber(rollAbs) && !isFiniteNumber(pitchAbs)) {
    return {
      status: quality.headPoseValid === false ? RESEARCH_QUALITY_STATUS.INVALID : RESEARCH_QUALITY_STATUS.WARNING,
      yawDeg: null,
      pitchDeg: null,
      rollDeg: null,
      thresholdSource: RESEARCH_QUALITY_CONFIG.thresholdSource,
    };
  }

  let status = RESEARCH_QUALITY_STATUS.GOOD;
  if (
    (isFiniteNumber(yawAbs) && yawAbs > cfg.yawInvalidMaxDeg) ||
    (isFiniteNumber(pitchAbs) && pitchAbs > cfg.pitchInvalidMaxDeg) ||
    (isFiniteNumber(rollAbs) && rollAbs > cfg.rollInvalidMaxDeg) ||
    quality.headPoseValid === false
  ) {
    status = RESEARCH_QUALITY_STATUS.INVALID;
  } else if (
    (isFiniteNumber(yawAbs) && yawAbs > cfg.yawGoodMaxDeg) ||
    (isFiniteNumber(pitchAbs) && pitchAbs > cfg.pitchGoodMaxDeg) ||
    (isFiniteNumber(rollAbs) && rollAbs > cfg.rollGoodMaxDeg)
  ) {
    status = RESEARCH_QUALITY_STATUS.WARNING;
  }

  return {
    status,
    yawDeg: isFiniteNumber(Number(yaw)) ? Number(Number(yaw).toFixed(1)) : null,
    pitchDeg: isFiniteNumber(Number(pitch)) ? Number(Number(pitch).toFixed(1)) : null,
    rollDeg: isFiniteNumber(Number(roll)) ? Number(Number(roll).toFixed(1)) : null,
    strictestAxis: 'yaw',
    thresholdSource: RESEARCH_QUALITY_CONFIG.thresholdSource,
  };
}

function evaluateVisibility(landmarks, quality = {}) {
  const hasFace = Array.isArray(landmarks) && landmarks.length >= 468;
  const leftIris = Boolean(averageLandmarks(landmarks, LEFT_IRIS));
  const rightIris = Boolean(averageLandmarks(landmarks, RIGHT_IRIS));
  const occlusion = Boolean(quality.occlusionDetected || quality.blinkDetected);
  const status = !hasFace || !leftIris || !rightIris
    ? RESEARCH_QUALITY_STATUS.INVALID
    : occlusion
      ? RESEARCH_QUALITY_STATUS.WARNING
      : RESEARCH_QUALITY_STATUS.GOOD;

  return {
    status,
    faceVisible: hasFace,
    bothEyesVisible: leftIris && rightIris,
    bothIrisesVisible: leftIris && rightIris,
    occlusionSuspected: occlusion,
  };
}

export function evaluateResearchFrameQuality({
  video,
  landmarks,
  distanceCm,
  gazeGateResult = null,
  positionReport = null,
  trackingQuality = null,
  lighting = null,
} = {}) {
  const visibility = evaluateVisibility(landmarks, trackingQuality || {});
  const distance = evaluateDistance(distanceCm);
  const headPose = evaluateHeadPose(trackingQuality || {}, positionReport || {});
  const frame = analyzeFocusAndExposure(video);
  const cornealReflex = detectCornealReflexCandidates(video, landmarks);
  const stabilityStatus = gazeGateResult?.isPassing || gazeGateResult?.isReadyToCapture
    ? RESEARCH_QUALITY_STATUS.GOOD
    : RESEARCH_QUALITY_STATUS.WARNING;

  const status = worstStatus([
    visibility.status,
    distance.status,
    headPose.status,
    frame.focus.status,
    frame.exposure.status,
    cornealReflex.status,
    stabilityStatus,
  ]);

  return {
    schemaVersion: RESEARCH_QUALITY_CONFIG.schemaVersion,
    thresholdSource: RESEARCH_QUALITY_CONFIG.thresholdSource,
    status,
    capturedAt: new Date().toISOString(),
    checks: {
      visibility,
      distance,
      headPose,
      focus: frame.focus,
      exposure: frame.exposure,
      cornealReflex,
      stability: {
        status: stabilityStatus,
        progressRatio: gazeGateResult?.progressRatio ?? null,
        fixationGateOnly: true,
      },
    },
    metadata: {
      device: getDeviceContext(),
      camera: video?.srcObject?.getVideoTracks?.()[0]?.getSettings?.() ?? null,
      focusScore: frame.focus.score,
      distanceEstimateCm: distance.estimatedCm,
      distanceErrorCm: distance.estimatedErrorCm,
      distanceBucket: distance.bucket,
      lightNote: lighting?.fallback || lighting?.source || 'TODO_PILOT',
      lighting: {
        source: lighting?.enabled ? 'torch' : lighting?.fallback || 'ambient',
        reflexCountPerEye: cornealReflex.reflexCountPerEye,
      },
    },
  };
}
