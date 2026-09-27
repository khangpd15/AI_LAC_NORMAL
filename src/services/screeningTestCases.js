/**
 * COMPREHENSIVE SCREENING TEST SUITE (CASE 1 - CASE 12)
 * Validates independent Position Check architecture, stability, and anti-flicker:
 * - Cover Test Target: 33–40 cm
 * - Brock String Target: 20–25 cm
 * - Edge Cases 1 to 12 as strictly specified by Section 31.
 */

import {
  estimateCameraDistance,
  DistanceStabilityTracker,
} from './positionCalibrationService.js';
import {
  POSITION_CONFIG,
  POSITION_STATUS,
  POSITION_QUALITY_CONFIG,
} from '../constants/binocularScreeningConfig.js';

/**
 * Runs all validation test cases (CASE 1 to CASE 12) and returns diagnostic report
 * @returns {Array<{ id: string, name: string, passed: boolean, details: string }>}
 */
export function runScreeningValidationSuite() {
  const results = [];

  // Helper: synthetic landmarks generator for a given distance in cm
  const createMockLandmarksAtDistance = (distanceCm, {
    hasLeftEye = true,
    hasRightEye = true,
    hasIris = true,
    headYaw = 0,
    headRoll = 0,
  } = {}) => {
    const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

    // Inverse pinhole relationship: faceScale = baselineCm / distanceCm
    const baselineCm = POSITION_QUALITY_CONFIG.OPTICAL_BASELINE.OPTIMAL_BASELINE_CM; // 22.5cm
    const faceScale = baselineCm / distanceCm;
    const refWidth = POSITION_QUALITY_CONFIG.OPTICAL_BASELINE.REFERENCE_FACE_WIDTH_AT_22_5CM; // 0.43

    // Face temple width (landmarks 234 and 454)
    const halfWidth = (refWidth * faceScale) / 2;
    lm[234] = { x: 0.5 - halfWidth, y: 0.45 };
    lm[454] = { x: 0.5 + halfWidth, y: 0.45 };

    // Eye corners (362: left inner, 263: left outer, 133: right inner, 33: right outer)
    const rollOffset = headRoll * 0.003;
    if (!hasLeftEye) {
      lm[362] = null;
      lm[263] = null;
    } else {
      lm[362] = { x: 0.5 + 0.05 * faceScale, y: 0.4 + rollOffset };
      lm[263] = { x: 0.5 + 0.15 * faceScale, y: 0.4 + rollOffset };
    }

    if (!hasRightEye) {
      lm[133] = null;
      lm[33] = null;
    } else {
      lm[133] = { x: 0.5 - 0.05 * faceScale, y: 0.4 - rollOffset };
      lm[33] = { x: 0.5 - 0.15 * faceScale, y: 0.4 - rollOffset };
    }

    // Iris centers (468: left iris, 473: right iris)
    if (!hasIris) {
      lm[468] = null;
      lm[473] = null;
    } else {
      lm[468] = { x: 0.5 + 0.10 * faceScale, y: 0.4 };
      lm[473] = { x: 0.5 - 0.10 * faceScale, y: 0.4 };
    }

    // Nose & Glabella
    lm[1] = { x: 0.5 + headYaw * 0.005, y: 0.5 };
    lm[168] = { x: 0.5, y: 0.40 };

    return lm;
  };

  // Helper: generates a stable consecutive history buffer for a target distance
  const createStableHistory = (distanceCm, count = 5) => {
    return Array.from({ length: count }, () => distanceCm);
  };

  // ----------------------------------------------------
  // CASE 1: No face -> NO_FACE -> Button disabled
  // ----------------------------------------------------
  try {
    const res = estimateCameraDistance(null, 640, 480, 'COVER_TEST');
    const passed =
      res.status === POSITION_STATUS.NO_FACE &&
      res.faceDetected === false &&
      res.checks.distanceValid === false &&
      res.isDistanceValid === false;
    results.push({
      id: 'CASE 1',
      name: 'No face -> NO_FACE -> button disabled',
      passed,
      details: `Status: ${res.status}, faceDetected: ${res.faceDetected}, distanceValid: ${res.checks.distanceValid}`,
    });
  } catch (e) {
    results.push({ id: 'CASE 1', name: 'No face', passed: false, details: e.message });
  }

  // ----------------------------------------------------
  // CASE 2: Distance = 30 cm, Cover Test -> TOO_CLOSE -> disabled
  // ----------------------------------------------------
  try {
    const lm = createMockLandmarksAtDistance(30);
    const hist = createStableHistory(30);
    const res = estimateCameraDistance(lm, 640, 480, 'COVER_TEST', hist);
    const passed =
      res.status === POSITION_STATUS.TOO_CLOSE &&
      res.checks.distanceValid === false &&
      res.stableDistanceCm < POSITION_CONFIG.COVER_TEST.minDistanceCm;
    results.push({
      id: 'CASE 2',
      name: 'Distance = 30 cm, Cover Test -> TOO_CLOSE -> disabled',
      passed,
      details: `Distance: ${res.stableDistanceCm} cm, Status: ${res.status}, Min: ${POSITION_CONFIG.COVER_TEST.minDistanceCm}`,
    });
  } catch (e) {
    results.push({ id: 'CASE 2', name: 'Distance = 30 cm Cover Test', passed: false, details: e.message });
  }

  // ----------------------------------------------------
  // CASE 3: Distance = 33 cm, Cover Test -> READY
  // ----------------------------------------------------
  try {
    const lm = createMockLandmarksAtDistance(33);
    const hist = createStableHistory(33);
    const res = estimateCameraDistance(lm, 640, 480, 'COVER_TEST', hist);
    const passed =
      res.status === POSITION_STATUS.READY &&
      res.checks.distanceValid === true &&
      res.stableDistanceCm >= 33 &&
      res.stableDistanceCm <= 40;
    results.push({
      id: 'CASE 3',
      name: 'Distance = 33 cm, Cover Test -> READY (Lower bound)',
      passed,
      details: `Distance: ${res.stableDistanceCm} cm, Status: ${res.status}, Range: 33-40cm`,
    });
  } catch (e) {
    results.push({ id: 'CASE 3', name: 'Distance = 33 cm Cover Test', passed: false, details: e.message });
  }

  // ----------------------------------------------------
  // CASE 4: Distance = 40 cm, Cover Test -> READY
  // ----------------------------------------------------
  try {
    const lm = createMockLandmarksAtDistance(40);
    const hist = createStableHistory(40);
    const res = estimateCameraDistance(lm, 640, 480, 'COVER_TEST', hist);
    const passed =
      res.status === POSITION_STATUS.READY &&
      res.checks.distanceValid === true &&
      res.stableDistanceCm >= 33 &&
      res.stableDistanceCm <= 40;
    results.push({
      id: 'CASE 4',
      name: 'Distance = 40 cm, Cover Test -> READY (Upper bound)',
      passed,
      details: `Distance: ${res.stableDistanceCm} cm, Status: ${res.status}, Range: 33-40cm`,
    });
  } catch (e) {
    results.push({ id: 'CASE 4', name: 'Distance = 40 cm Cover Test', passed: false, details: e.message });
  }

  // ----------------------------------------------------
  // CASE 5: Distance = 41 cm, Cover Test -> TOO_FAR -> disabled
  // ----------------------------------------------------
  try {
    const lm = createMockLandmarksAtDistance(41);
    const hist = createStableHistory(41);
    const res = estimateCameraDistance(lm, 640, 480, 'COVER_TEST', hist);
    const passed =
      res.status === POSITION_STATUS.TOO_FAR &&
      res.checks.distanceValid === false &&
      res.stableDistanceCm > POSITION_CONFIG.COVER_TEST.maxDistanceCm;
    results.push({
      id: 'CASE 5',
      name: 'Distance = 41 cm, Cover Test -> TOO_FAR -> disabled',
      passed,
      details: `Distance: ${res.stableDistanceCm} cm, Status: ${res.status}, Max: ${POSITION_CONFIG.COVER_TEST.maxDistanceCm}`,
    });
  } catch (e) {
    results.push({ id: 'CASE 5', name: 'Distance = 41 cm Cover Test', passed: false, details: e.message });
  }

  // ----------------------------------------------------
  // CASE 6: Distance = 18 cm, Brock String -> TOO_CLOSE -> disabled
  // ----------------------------------------------------
  try {
    const lm = createMockLandmarksAtDistance(18);
    const hist = createStableHistory(18);
    const res = estimateCameraDistance(lm, 640, 480, 'BROCK_STRING', hist);
    const passed =
      res.status === POSITION_STATUS.TOO_CLOSE &&
      res.checks.distanceValid === false &&
      res.stableDistanceCm < POSITION_CONFIG.BROCK_STRING.minDistanceCm;
    results.push({
      id: 'CASE 6',
      name: 'Distance = 18 cm, Brock String -> TOO_CLOSE -> disabled',
      passed,
      details: `Distance: ${res.stableDistanceCm} cm, Status: ${res.status}, Min: ${POSITION_CONFIG.BROCK_STRING.minDistanceCm}`,
    });
  } catch (e) {
    results.push({ id: 'CASE 6', name: 'Distance = 18 cm Brock String', passed: false, details: e.message });
  }

  // ----------------------------------------------------
  // CASE 7: Distance = 20 cm, Brock String -> READY
  // ----------------------------------------------------
  try {
    const lm = createMockLandmarksAtDistance(20);
    const hist = createStableHistory(20);
    const res = estimateCameraDistance(lm, 640, 480, 'BROCK_STRING', hist);
    const passed =
      res.status === POSITION_STATUS.READY &&
      res.checks.distanceValid === true &&
      res.stableDistanceCm >= 20 &&
      res.stableDistanceCm <= 25;
    results.push({
      id: 'CASE 7',
      name: 'Distance = 20 cm, Brock String -> READY (Lower bound)',
      passed,
      details: `Distance: ${res.stableDistanceCm} cm, Status: ${res.status}, Range: 20-25cm`,
    });
  } catch (e) {
    results.push({ id: 'CASE 7', name: 'Distance = 20 cm Brock String', passed: false, details: e.message });
  }

  // ----------------------------------------------------
  // CASE 8: Distance = 25 cm, Brock String -> READY
  // ----------------------------------------------------
  try {
    const lm = createMockLandmarksAtDistance(25);
    const hist = createStableHistory(25);
    const res = estimateCameraDistance(lm, 640, 480, 'BROCK_STRING', hist);
    const passed =
      res.status === POSITION_STATUS.READY &&
      res.checks.distanceValid === true &&
      res.stableDistanceCm >= 20 &&
      res.stableDistanceCm <= 25;
    results.push({
      id: 'CASE 8',
      name: 'Distance = 25 cm, Brock String -> READY (Upper bound)',
      passed,
      details: `Distance: ${res.stableDistanceCm} cm, Status: ${res.status}, Range: 20-25cm`,
    });
  } catch (e) {
    results.push({ id: 'CASE 8', name: 'Distance = 25 cm Brock String', passed: false, details: e.message });
  }

  // ----------------------------------------------------
  // CASE 9: Distance = 26 cm, Brock String -> TOO_FAR -> disabled
  // ----------------------------------------------------
  try {
    const lm = createMockLandmarksAtDistance(26);
    const hist = createStableHistory(26);
    const res = estimateCameraDistance(lm, 640, 480, 'BROCK_STRING', hist);
    const passed =
      res.status === POSITION_STATUS.TOO_FAR &&
      res.checks.distanceValid === false &&
      res.stableDistanceCm > POSITION_CONFIG.BROCK_STRING.maxDistanceCm;
    results.push({
      id: 'CASE 9',
      name: 'Distance = 26 cm, Brock String -> TOO_FAR -> disabled',
      passed,
      details: `Distance: ${res.stableDistanceCm} cm, Status: ${res.status}, Max: ${POSITION_CONFIG.BROCK_STRING.maxDistanceCm}`,
    });
  } catch (e) {
    results.push({ id: 'CASE 9', name: 'Distance = 26 cm Brock String', passed: false, details: e.message });
  }

  // ----------------------------------------------------
  // CASE 10: Noisy distance -> Không READY ngay -> LOW_CONFIDENCE
  // ----------------------------------------------------
  try {
    const lm = createMockLandmarksAtDistance(35); // 35 cm is in range
    const noisyHistory = [31, 35, 29, 37, 33]; // High jitter std dev
    const res = estimateCameraDistance(lm, 640, 480, 'COVER_TEST', noisyHistory);
    const passed =
      res.status !== POSITION_STATUS.READY &&
      (res.status === POSITION_STATUS.LOW_CONFIDENCE || res.checks.isStable === false);
    results.push({
      id: 'CASE 10',
      name: 'Noisy distance [31, 35, 29, 37, 33] -> LOW_CONFIDENCE (Chưa READY)',
      passed,
      details: `Status: ${res.status}, isStable: ${res.checks.isStable}, message: ${res.feedbackMessage}`,
    });
  } catch (e) {
    results.push({ id: 'CASE 10', name: 'Noisy distance', passed: false, details: e.message });
  }

  // ----------------------------------------------------
  // CASE 11: Cover Test READY at 36 cm -> Chuyển Brock String -> 36 cm KHÔNG READY
  // ----------------------------------------------------
  try {
    const tracker = new DistanceStabilityTracker('COVER_TEST');
    const lm36 = createMockLandmarksAtDistance(36);

    // Feed 5 frames at 36cm to achieve READY in Cover Test
    let coverReport = null;
    for (let i = 0; i < 5; i++) {
      coverReport = tracker.update(lm36);
    }
    const coverPassed = coverReport.status === POSITION_STATUS.READY;

    // Transition: Reset tracker to Brock String
    tracker.reset('BROCK_STRING');
    // Check same position (36cm) in Brock String
    const brockReport = tracker.update(lm36);
    const brockPassed =
      brockReport.status !== POSITION_STATUS.READY &&
      brockReport.status === POSITION_STATUS.TOO_FAR;

    const passed = coverPassed && brockPassed;
    results.push({
      id: 'CASE 11',
      name: 'Cover Test READY ở 36 cm -> Chuyển Brock String -> 36 cm KHÔNG READY (TOO_FAR)',
      passed,
      details: `CoverStatus: ${coverReport.status}, BrockStatus: ${brockReport.status} (Min 20, Max 25)`,
    });
  } catch (e) {
    results.push({ id: 'CASE 11', name: 'Cover Test 36cm sang Brock String', passed: false, details: e.message });
  }

  // ----------------------------------------------------
  // CASE 12: Brock String READY at 22 cm -> Quay lại Cover Test -> 22 cm KHÔNG READY
  // ----------------------------------------------------
  try {
    const tracker = new DistanceStabilityTracker('BROCK_STRING');
    const lm22 = createMockLandmarksAtDistance(22);

    // Feed 5 frames at 22cm to achieve READY in Brock String
    let brockReport = null;
    for (let i = 0; i < 5; i++) {
      brockReport = tracker.update(lm22);
    }
    const brockPassed = brockReport.status === POSITION_STATUS.READY;

    // Transition: Reset tracker to Cover Test
    tracker.reset('COVER_TEST');
    // Check same position (22cm) in Cover Test
    const coverReport = tracker.update(lm22);
    const coverPassed =
      coverReport.status !== POSITION_STATUS.READY &&
      coverReport.status === POSITION_STATUS.TOO_CLOSE;

    const passed = brockPassed && coverPassed;
    results.push({
      id: 'CASE 12',
      name: 'Brock String READY ở 22 cm -> Quay lại Cover Test -> 22 cm KHÔNG READY (TOO_CLOSE)',
      passed,
      details: `BrockStatus: ${brockReport.status}, CoverStatus: ${coverReport.status} (Min 33, Max 40)`,
    });
  } catch (e) {
    results.push({ id: 'CASE 12', name: 'Brock String 22cm quay lại Cover Test', passed: false, details: e.message });
  }

  return results;
}

