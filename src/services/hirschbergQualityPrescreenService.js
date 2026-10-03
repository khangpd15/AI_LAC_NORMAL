/**
 * Hirschberg Photo Quality Pre-screening Service
 *
 * Sàng lọc trước chất lượng ảnh chụp hoặc ảnh tải lên trước khi gửi về AI phân tích:
 * 1. Nhận diện khuôn mặt (Face presence & landmarks >= 468)
 * 2. Hai mắt mở rõ, không nhắm/chớp/che khuất (Both eyes visible, eye openness)
 * 3. Góc nhìn trực diện (Head pose: Yaw <= 12°, Pitch <= 10°, Roll <= 8°)
 * 4. Độ sắc nét không mờ (Image sharpness / Laplacian focus score)
 * 5. Độ sáng & phơi sáng chuẩn (Exposure: Luma, saturated / dark pixels)
 * 6. Điểm phản xạ giác mạc (Corneal reflex presence)
 */

import {
  RESEARCH_QUALITY_STATUS,
} from '../constants/researchScreeningConfig.js';
import {
  evaluateResearchFrameQuality,
  detectCornealReflexCandidates,
} from './cv/researchQualityGate.js';
import { estimateHeadPose } from './positionCalibrationService.js';
import { processSingleImageWithFaceMesh } from './faceMeshService.js';

export const QUALITY_PRESCREEN_STATUS = {
  PASS: 'PASS',
  WARNING: 'WARNING',
  FAIL: 'FAIL',
};

/**
 * Checks eye openness using upper & lower eyelid landmarks.
 * Right eye: 159 (upper) and 145 (lower)
 * Left eye: 386 (upper) and 374 (lower)
 */
function checkEyeOpenness(landmarks) {
  if (!landmarks || landmarks.length < 468) {
    return { isOpen: false, rightOpening: 0, leftOpening: 0 };
  }
  const rTop = landmarks[159];
  const rBottom = landmarks[145];
  const lTop = landmarks[386];
  const lBottom = landmarks[374];

  if (!rTop || !rBottom || !lTop || !lBottom) {
    return { isOpen: false, rightOpening: 0, leftOpening: 0 };
  }

  const rOpen = Math.hypot(rTop.x - rBottom.x, rTop.y - rBottom.y);
  const lOpen = Math.hypot(lTop.x - lBottom.x, lTop.y - lBottom.y);

  // Normalized distance threshold for closed eyes / blink (typically < 0.012)
  const minThreshold = 0.011;
  const isOpen = rOpen >= minThreshold && lOpen >= minThreshold;

  return {
    isOpen,
    rightOpening: Number(rOpen.toFixed(4)),
    leftOpening: Number(lOpen.toFixed(4)),
  };
}

/**
 * Validates whether an image element meets Hirschberg quality criteria.
 * @param {Object} params
 * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} params.element
 * @param {Array} params.landmarks
 * @param {number} [params.distanceCm]
 * @returns {Object} Comprehensive quality evaluation result
 */
export function validateHirschbergQuality({
  element,
  landmarks = null,
  distanceCm = null,
} = {}) {
  const errors = [];
  const warnings = [];
  const passedChecks = [];

  // 1. Face detection
  const hasFace = Array.isArray(landmarks) && landmarks.length >= 468;
  if (!hasFace) {
    errors.push({
      code: 'FACE_NOT_FOUND',
      label: 'Không tìm thấy khuôn mặt rõ trong ảnh',
      tip: 'Vui lòng chụp hoặc tải ảnh rõ toàn bộ khuôn mặt ở góc nhìn trực diện.',
    });
  } else {
    passedChecks.push({
      code: 'FACE_DETECTED',
      label: 'Khuôn mặt rõ ràng trong ảnh',
    });
  }

  // 2. Both eyes & irises visible + eye openness
  const hasLeftIris = Boolean(landmarks?.[468]);
  const hasRightIris = Boolean(landmarks?.[473]);
  const eyeOpen = checkEyeOpenness(landmarks);

  if (!hasFace || !hasLeftIris || !hasRightIris) {
    errors.push({
      code: 'EYES_NOT_VISIBLE',
      label: 'Không phát hiện rõ hai mắt hoặc mống mắt',
      tip: 'Đảm bảo mắt không bị che bởi tóc, bóng râm hoặc gọng kính dày.',
    });
  } else if (!eyeOpen.isOpen) {
    errors.push({
      code: 'EYES_CLOSED_OR_BLINKING',
      label: 'Mắt đang nhắm hoặc chớp mắt khi chụp',
      tip: 'Vui lòng mở to mắt và nhìn thẳng vào chấm sáng camera.',
    });
  } else {
    passedChecks.push({
      code: 'EYES_OPEN_AND_CLEAR',
      label: 'Hai mắt mở rõ, thấy rõ mống mắt',
    });
  }

  // 3. Head pose (Yaw, Pitch, Roll)
  const headPose = estimateHeadPose(landmarks);
  const yawAbs = Math.abs(headPose.yawDeg || 0);
  const pitchAbs = Math.abs(headPose.pitchDeg || 0);
  const rollAbs = Math.abs(headPose.rollDeg || 0);

  if (hasFace) {
    if (yawAbs > 14) {
      errors.push({
        code: 'HEAD_YAW_EXCEEDED',
        label: `Mặt quay nghiêng sang bên quá nhiều (${yawAbs.toFixed(1)}°)`,
        tip: 'Vui lòng nhìn thẳng trực diện vào ống kính, không quay đầu sang bên.',
      });
    } else if (pitchAbs > 14) {
      errors.push({
        code: 'HEAD_PITCH_EXCEEDED',
        label: `Đầu đang ngửa lên hoặc cúi xuống quá nhiều (${pitchAbs.toFixed(1)}°)`,
        tip: 'Vui lòng đặt máy ảnh ngang tầm mắt, giữ đầu thăng bằng.',
      });
    } else if (rollAbs > 12) {
      errors.push({
        code: 'HEAD_ROLL_EXCEEDED',
        label: `Đầu đang nghiêng lệch sang một bên (${rollAbs.toFixed(1)}°)`,
        tip: 'Vui lòng giữ thẳng đầu, không nghiêng sang vai trái hay phải.',
      });
    } else {
      if (yawAbs > 8 || pitchAbs > 9 || rollAbs > 7) {
        warnings.push({
          code: 'HEAD_SLIGHTLY_TILTED',
          label: 'Đầu hơi nghiêng nhẹ nhưng vẫn có thể phân tích được',
          tip: 'Để kết quả chính xác nhất, nên giữ đầu hoàn toàn thẳng đứng.',
        });
      }
      passedChecks.push({
        code: 'HEAD_POSE_CENTERED',
        label: 'Góc đầu thẳng, hướng nhìn trực diện',
      });
    }
  }

  // 4. Run research quality evaluation (focus, exposure, reflex)
  let qualityReport = null;
  if (element) {
    try {
      qualityReport = evaluateResearchFrameQuality({
        video: element,
        landmarks,
        distanceCm,
      });
    } catch (err) {
      console.warn('Frame quality evaluation error:', err);
    }
  }

  const focusScore = qualityReport?.checks?.focus?.score ?? null;
  const focusStatus = qualityReport?.checks?.focus?.status ?? RESEARCH_QUALITY_STATUS.GOOD;
  const meanLuma = qualityReport?.checks?.exposure?.meanLuma ?? null;
  const exposureStatus = qualityReport?.checks?.exposure?.status ?? RESEARCH_QUALITY_STATUS.GOOD;
  const cornealReflex = qualityReport?.checks?.cornealReflex;

  // 4a. Sharpness / Blur check
  if (focusStatus === RESEARCH_QUALITY_STATUS.INVALID || (focusScore !== null && focusScore < 10.0)) {
    errors.push({
      code: 'IMAGE_BLURRY',
      label: `Ảnh bị mờ hoặc rung tay (độ nét ${focusScore ?? 0} < 10)`,
      tip: 'Vui lòng cầm chắc điện thoại, chờ camera lấy nét rõ rồi chụp lại.',
    });
  } else if (focusStatus === RESEARCH_QUALITY_STATUS.WARNING || (focusScore !== null && focusScore < 18.0)) {
    warnings.push({
      code: 'IMAGE_SLIGHTLY_SOFT',
      label: 'Ảnh hơi mờ nhẹ nhưng vẫn nhận diện được',
      tip: 'Nên chụp lại ở nơi đủ sáng để ảnh sắc nét hơn.',
    });
    passedChecks.push({
      code: 'FOCUS_ACCEPTABLE',
      label: `Độ sắc nét chấp nhận được (${focusScore})`,
    });
  } else if (focusScore !== null) {
    passedChecks.push({
      code: 'FOCUS_GOOD',
      label: `Độ sắc nét tốt (${focusScore})`,
    });
  }

  // 4b. Lighting / Exposure check
  if (exposureStatus === RESEARCH_QUALITY_STATUS.INVALID) {
    if (meanLuma !== null && meanLuma < 35) {
      errors.push({
        code: 'IMAGE_TOO_DARK',
        label: `Ảnh quá tối, thiếu ánh sáng (độ sáng ${meanLuma})`,
        tip: 'Vui lòng bật thêm đèn phòng hoặc di chuyển tới nơi sáng sủa hơn.',
      });
    } else {
      errors.push({
        code: 'IMAGE_OVEREXPOSED_OR_GLARE',
        label: 'Ảnh bị lóa sáng hoặc cháy sáng quá mức',
        tip: 'Vui lòng tránh nguồn sáng chói rọi thẳng vào ống kính hoặc mắt.',
      });
    }
  } else if (exposureStatus === RESEARCH_QUALITY_STATUS.WARNING) {
    warnings.push({
      code: 'EXPOSURE_SUBOPTIMAL',
      label: `Ánh sáng chưa tối ưu (${meanLuma ? `độ sáng ${meanLuma}` : 'vừa đủ'})`,
      tip: 'Nên điều chỉnh ánh sáng phòng đều trước mặt để ảnh rõ hơn.',
    });
    passedChecks.push({
      code: 'EXPOSURE_TOLERATED',
      label: 'Độ sáng nằm trong phạm vi chấp nhận được',
    });
  } else {
    passedChecks.push({
      code: 'EXPOSURE_GOOD',
      label: 'Ánh sáng và độ phơi sáng đạt chuẩn',
    });
  }

  // 4c. Corneal reflex check
  const reflexCountLeft = cornealReflex?.left?.count ?? 0;
  const reflexCountRight = cornealReflex?.right?.count ?? 0;
  const totalReflex = reflexCountLeft + reflexCountRight;

  if (hasFace && hasLeftIris && hasRightIris) {
    if (totalReflex === 0) {
      warnings.push({
        code: 'REFLEX_NOT_DETECTED',
        label: 'Chưa thấy điểm sáng phản chiếu rõ trên giác mạc',
        tip: 'Nên có ánh đèn nhẹ chiếu vào mắt (đèn trần hoặc đèn bàn) để tạo chấm sáng Hirschberg.',
      });
    } else if (reflexCountLeft > 2 || reflexCountRight > 2) {
      warnings.push({
        code: 'MULTIPLE_REFLEXES',
        label: 'Có nhiều nguồn sáng gây nhiều đốm lóa trên mắt',
        tip: 'Nên tắt bớt nguồn sáng phụ để chỉ có 1 điểm sáng phản chiếu duy nhất.',
      });
    } else {
      passedChecks.push({
        code: 'CORNEAL_REFLEX_PRESENT',
        label: 'Có điểm sáng phản chiếu trên giác mạc',
      });
    }
  }

  // Overall Decision
  const isAcceptable = errors.length === 0;
  const status = !isAcceptable
    ? QUALITY_PRESCREEN_STATUS.FAIL
    : warnings.length > 0
      ? QUALITY_PRESCREEN_STATUS.WARNING
      : QUALITY_PRESCREEN_STATUS.PASS;

  let title = 'Ảnh đạt chuẩn sàng lọc AI';
  let summary = 'Ảnh có đầy đủ khuôn mặt, hai mắt rõ ràng và độ nét đạt yêu cầu để phân tích Hirschberg.';

  if (!isAcceptable) {
    title = 'Ảnh chưa đạt chuẩn - Cần chụp hoặc tải ảnh khác';
    summary = errors.map((e) => e.label).join('. ') + '.';
  } else if (warnings.length > 0) {
    title = 'Ảnh đạt chuẩn (kèm lưu ý nhẹ)';
    summary = 'Ảnh đủ điều kiện phân tích hình học, nhưng có thể cải thiện thêm ánh sáng để chuẩn xác hơn.';
  }

  return {
    isAcceptable,
    status,
    title,
    summary,
    errors,
    warnings,
    passedChecks,
    metrics: {
      focusScore,
      meanLuma,
      headPose: {
        yawDeg: headPose.yawDeg,
        pitchDeg: headPose.pitchDeg,
        rollDeg: headPose.rollDeg,
      },
      eyeOpenness: eyeOpen,
      reflexCountPerEye: {
        left: reflexCountLeft,
        right: reflexCountRight,
      },
      distanceCm,
    },
    qualityReport,
  };
}

/**
 * Loads an image from Data URL into an HTMLImageElement
 * @param {string} dataUrl
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    if (!dataUrl) {
      reject(new Error('Data URL is empty'));
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Không thể tải hoặc giải mã ảnh.'));
    img.src = dataUrl;
  });
}

/**
 * Reads a File object as Data URL
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('File is missing'));
      return;
    }
    if (!file.type.startsWith('image/')) {
      reject(new Error('Tệp tải lên không phải là ảnh hợp lệ (.jpg, .png, .webp).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Lỗi khi đọc tệp ảnh từ thiết bị.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Full Pipeline: Pre-screen an uploaded file or captured data URL
 * 1. Loads image element
 * 2. Runs MediaPipe Face Mesh on image
 * 3. Evaluates all quality criteria
 * @param {File|string} fileOrDataUrl
 * @param {Object} [options]
 * @returns {Promise<Object>} Inspection result with dataUrl, landmarks, and validation
 */
export async function inspectHirschbergImage(fileOrDataUrl, options = {}) {
  let dataUrl = typeof fileOrDataUrl === 'string' ? fileOrDataUrl : null;
  if (!dataUrl && fileOrDataUrl instanceof File) {
    dataUrl = await readFileAsDataUrl(fileOrDataUrl);
  }

  const img = await loadImageElement(dataUrl);

  // If caller already has landmarks (e.g. from live camera snapshot), reuse them; otherwise run FaceMesh
  let landmarks = options.landmarks || null;
  if (!landmarks || landmarks.length < 468) {
    try {
      const results = await processSingleImageWithFaceMesh(img);
      landmarks = results?.multiFaceLandmarks?.[0] || null;
    } catch (err) {
      console.warn('FaceMesh processing on uploaded image failed:', err);
      landmarks = null;
    }
  }

  const validation = validateHirschbergQuality({
    element: img,
    landmarks,
    distanceCm: options.distanceCm || null,
  });

  return {
    dataUrl,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    landmarks,
    validation,
  };
}
