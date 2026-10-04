import assert from 'node:assert/strict';
import {
  getVideoDisplayRect,
  mapCameraPointToDisplay,
  mapCameraRectToDisplay,
} from '../src/utils/cameraCoordinateTransform.js';

console.log('--- RUNNING REMICARE CAMERA COORDINATE TRANSFORM TESTS ---');

// Test 1: Android Baseline - Exact Matching Aspect Ratio (4:3 in 4:3)
{
  const mockVideo = {
    videoWidth: 640,
    videoHeight: 480,
    clientWidth: 640,
    clientHeight: 480,
    parentElement: { clientWidth: 640, clientHeight: 480 },
  };

  const rect = getVideoDisplayRect(mockVideo, mockVideo.parentElement);
  assert.equal(rect.containerWidth, 640);
  assert.equal(rect.containerHeight, 480);
  assert.equal(rect.renderedWidth, 640);
  assert.equal(rect.renderedHeight, 480);
  assert.equal(rect.offsetX, 0);
  assert.equal(rect.offsetY, 0);

  // Mirrored point test
  const pt = mapCameraPointToDisplay({ x: 0.3, y: 0.4 }, rect, true);
  // (1 - 0.3) * 640 = 0.7 * 640 = 448
  assert.equal(pt.x, 448);
  assert.equal(pt.y, 0.4 * 480);
  assert.equal(pt.xPercent, 70);
  assert.equal(pt.yPercent, 40);

  // Mirrored rect test
  const box = mapCameraRectToDisplay({ xMin: 0.2, yMin: 0.1, width: 0.4, height: 0.5 }, rect, true);
  // 1 - (0.2 + 0.4) = 0.4 -> left = 0.4 * 640 = 256
  assert.equal(box.left, 256);
  assert.equal(box.top, 0.1 * 480);
  assert.equal(box.width, 0.4 * 640);
  assert.equal(box.height, 0.5 * 480);
  assert.equal(box.leftPercent, 40);
  console.log('✓ Test 1 Passed: Android Baseline matching aspect ratio matches exact formulas');
}

// Test 2: Fullscreen Mobile Portrait Viewport (Cover Test mode: 640x480 landscape stream on 390x844 portrait screen)
{
  const mockVideo = {
    videoWidth: 640,
    videoHeight: 480, // vRatio = 1.333
    clientWidth: 390,
    clientHeight: 844, // cRatio = 390 / 844 = 0.462
    parentElement: { clientWidth: 390, clientHeight: 844 },
  };

  // vRatio (1.333) > cRatio (0.462) -> scaled by container height (844)
  const rect = getVideoDisplayRect(mockVideo, mockVideo.parentElement);
  assert.equal(rect.renderedHeight, 844);
  const expectedWidth = 844 * (640 / 480); // ~1125.333px
  assert.ok(Math.abs(rect.renderedWidth - expectedWidth) < 0.01);
  const expectedOffsetX = (390 - expectedWidth) / 2;
  assert.ok(Math.abs(rect.offsetX - expectedOffsetX) < 0.01);
  assert.equal(rect.offsetY, 0);

  // Center point should map EXACTLY to center of screen (390 / 2 = 195)
  const centerPt = mapCameraPointToDisplay({ x: 0.5, y: 0.5 }, rect, true);
  assert.ok(Math.abs(centerPt.x - 195) < 0.01);
  assert.ok(Math.abs(centerPt.xPercent - 50) < 0.01);
  console.log('✓ Test 2 Passed: Fullscreen Mobile Portrait correctly crops horizontally and centers (x=0.5 -> 50%)');
}

// Test 3: Mobile Portrait Native Camera Stream (3:4 or 480x640 on 360x640 screen)
{
  const mockVideo = {
    videoWidth: 480,
    videoHeight: 640, // vRatio = 0.75
    clientWidth: 360,
    clientHeight: 640, // cRatio = 0.5625
    parentElement: { clientWidth: 360, clientHeight: 640 },
  };

  const rect = getVideoDisplayRect(mockVideo, mockVideo.parentElement);
  assert.equal(rect.renderedHeight, 640);
  assert.equal(rect.renderedWidth, 640 * 0.75); // 480
  assert.equal(rect.offsetX, (360 - 480) / 2); // -60px
  assert.equal(rect.offsetY, 0);

  // Eye at center horizontally x=0.5 -> -60 + 0.5 * 480 = 180 (exact middle of 360)
  const centerPt = mapCameraPointToDisplay({ x: 0.5, y: 0.35 }, rect, true);
  assert.equal(centerPt.x, 180);
  assert.equal(centerPt.xPercent, 50);
  // y = 0.35 * 640 = 224px (35% of 640)
  assert.equal(centerPt.y, 224);
  assert.equal(centerPt.yPercent, 35);
  console.log('✓ Test 3 Passed: Portrait native camera stream preserves true eye level and center');
}

// Test 4: Unmirrored mode (scaleX(1))
{
  const mockVideo = {
    videoWidth: 640,
    videoHeight: 480,
    clientWidth: 640,
    clientHeight: 480,
    parentElement: { clientWidth: 640, clientHeight: 480 },
  };

  const rect = getVideoDisplayRect(mockVideo, mockVideo.parentElement);
  const pt = mapCameraPointToDisplay({ x: 0.25, y: 0.75 }, rect, false);
  assert.equal(pt.x, 0.25 * 640);
  assert.equal(pt.y, 0.75 * 480);
  console.log('✓ Test 4 Passed: Unmirrored mode correctly bypasses horizontal inversion');
}

// Test 5: Target Safe Zone Alignment in PositionCheck
{
  const mockVideo = {
    videoWidth: 640,
    videoHeight: 480,
    clientWidth: 390,
    clientHeight: 520, // 3:4 container with 4:3 video -> cropped horizontally
    parentElement: { clientWidth: 390, clientHeight: 520 },
  };

  const rect = getVideoDisplayRect(mockVideo, mockVideo.parentElement);
  const targetZoneCameraRect = {
    xMin: 0.5 - 0.10, // 0.40
    yMin: 0.5 - 0.12, // 0.38
    width: 0.20,
    height: 0.24,
  };

  const mappedTarget = mapCameraRectToDisplay(targetZoneCameraRect, rect, true);
  // Center of target zone should be exactly at 50% horizontally
  const targetCenterPercent = mappedTarget.leftPercent + mappedTarget.widthPercent / 2;
  assert.ok(Math.abs(targetCenterPercent - 50) < 0.01);

  // When face box is centered at 0.5 in camera space, mappedBox center must match mappedTarget center
  const centeredFaceBox = {
    xMin: 0.35,
    yMin: 0.30,
    width: 0.30,
    height: 0.40,
  };
  const mappedFace = mapCameraRectToDisplay(centeredFaceBox, rect, true);
  const faceCenterPercent = mappedFace.leftPercent + mappedFace.widthPercent / 2;
  assert.ok(Math.abs(faceCenterPercent - 50) < 0.01);
  console.log('✓ Test 5 Passed: PositionCheck safe zone and face bounding box align with 100% geometric precision');
}

console.log('ALL REMICARE CAMERA TESTS PASSED SUCCESSFULLY! ✓');

// ==============================================================================
// HIRSCHBERG QUALITY PRE-SCREENING SERVICE TESTS
// ==============================================================================
import { validateHirschbergQuality, QUALITY_PRESCREEN_STATUS } from '../src/services/hirschbergQualityPrescreenService.js';

console.log('\n--- RUNNING HIRSCHBERG QUALITY PRE-SCREENING TESTS ---');

// Helper to generate minimal synthetic landmarks array
function createSyntheticLandmarks({ eyeOpening = 0.025, yawOffset = 0 } = {}) {
  const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  // Canthi and nose for head pose
  // Left canthus: index 362 (nasal), Right canthus: index 133 (nasal)
  // Nose tip: index 1
  landmarks[362] = { x: 0.54, y: 0.40, z: 0 };
  landmarks[133] = { x: 0.46, y: 0.40, z: 0 };
  landmarks[1] = { x: 0.50 + yawOffset, y: 0.48, z: -0.05 };
  landmarks[168] = { x: 0.50, y: 0.38, z: 0 }; // glabella
  landmarks[33] = { x: 0.38, y: 0.40, z: 0 };  // right outer
  landmarks[263] = { x: 0.62, y: 0.40, z: 0 }; // left outer

  // Irises
  landmarks[468] = { x: 0.58, y: 0.40, z: 0 }; // left iris
  landmarks[473] = { x: 0.42, y: 0.40, z: 0 }; // right iris

  // Eyelids
  // Right: 159 (top), 145 (bottom)
  landmarks[159] = { x: 0.42, y: 0.40 - eyeOpening / 2, z: 0 };
  landmarks[145] = { x: 0.42, y: 0.40 + eyeOpening / 2, z: 0 };
  // Left: 386 (top), 374 (bottom)
  landmarks[386] = { x: 0.58, y: 0.40 - eyeOpening / 2, z: 0 };
  landmarks[374] = { x: 0.58, y: 0.40 + eyeOpening / 2, z: 0 };

  return landmarks;
}

// Test 6: Rejection when face landmarks are missing
{
  const res = validateHirschbergQuality({ landmarks: null });
  assert.equal(res.isAcceptable, false);
  assert.equal(res.status, QUALITY_PRESCREEN_STATUS.FAIL);
  assert.ok(res.errors.some((e) => e.code === 'FACE_NOT_FOUND'));
  console.log('✓ Test 6 Passed: Missing face landmarks is rejected with FACE_NOT_FOUND');
}

// Test 7: Rejection when eyes are closed or blinking
{
  const landmarks = createSyntheticLandmarks({ eyeOpening: 0.004 });
  const res = validateHirschbergQuality({ landmarks });
  assert.equal(res.isAcceptable, false);
  assert.equal(res.status, QUALITY_PRESCREEN_STATUS.FAIL);
  assert.ok(res.errors.some((e) => e.code === 'EYES_CLOSED_OR_BLINKING'));
  console.log('✓ Test 7 Passed: Closed/blinking eyes rejected with EYES_CLOSED_OR_BLINKING');
}

// Test 8: Rejection when head pose has excessive yaw tilt
{
  const landmarks = createSyntheticLandmarks({ eyeOpening: 0.025, yawOffset: 0.06 });
  const res = validateHirschbergQuality({ landmarks });
  assert.equal(res.isAcceptable, false);
  assert.equal(res.status, QUALITY_PRESCREEN_STATUS.FAIL);
  assert.ok(res.errors.some((e) => e.code === 'HEAD_YAW_EXCEEDED'));
  console.log('✓ Test 8 Passed: Excessive head yaw turn rejected with HEAD_YAW_EXCEEDED');
}

// Test 9: Acceptance when frontal face, eyes open and centered
{
  const landmarks = createSyntheticLandmarks({ eyeOpening: 0.025, yawOffset: 0.0 });
  const res = validateHirschbergQuality({ landmarks, distanceCm: 22 });
  assert.equal(res.isAcceptable, true);
  assert.ok(res.passedChecks.some((c) => c.code === 'FACE_DETECTED'));
  assert.ok(res.passedChecks.some((c) => c.code === 'EYES_OPEN_AND_CLEAR'));
  assert.ok(res.passedChecks.some((c) => c.code === 'HEAD_POSE_CENTERED'));
  console.log('✓ Test 9 Passed: Frontal clear photo with open eyes passes pre-screening');
}

console.log('ALL HIRSCHBERG PRE-SCREENING TESTS PASSED SUCCESSFULLY! ✓');

// ==============================================================================
// RESEARCH CAMERA RESOLUTION & SETTINGS VALIDATION TESTS
// ==============================================================================
import { validateResearchCameraSettings } from '../src/constants/researchScreeningConfig.js';
import {
  classifyResearchMeasurementError,
  validateResearchAge,
} from '../src/services/researchMeasurementErrorService.js';

console.log('\n--- RUNNING RESEARCH CAMERA RESOLUTION TESTS ---');

// Test 10: Mobile portrait orientation (480x640) meets minimum standard
{
  const res = validateResearchCameraSettings({ width: 480, height: 640 });
  assert.equal(res.valid, true);
  assert.equal(res.width, 480);
  assert.equal(res.height, 640);
  console.log('✓ Test 10 Passed: Mobile portrait 480x640 correctly recognized as valid');
}

// Test 11: Initializing camera (0x0) is treated as initializing/valid, not blocked
{
  const res = validateResearchCameraSettings({ width: 0, height: 0 });
  assert.equal(res.valid, true);
  assert.equal(res.isInitializing, true);
  console.log('✓ Test 11 Passed: Initializing camera (0x0) treated as valid to prevent camera shutdown');
}

// Test 12: Landscape HD (1280x720) meets minimum standard
{
  const res = validateResearchCameraSettings({ width: 1280, height: 720 });
  assert.equal(res.valid, true);
  assert.equal(res.width, 1280);
  assert.equal(res.height, 720);
  console.log('✓ Test 12 Passed: Landscape 1280x720 recognized as valid');
}

console.log('ALL CAMERA RESOLUTION TESTS PASSED SUCCESSFULLY! ✓\n');

// ==============================================================================
// RESEARCH MEASUREMENT ERROR MAPPING TESTS
// ==============================================================================

console.log('--- RUNNING RESEARCH MEASUREMENT ERROR MAPPING TESTS ---');

// Test 13: Backend age eligibility rejection is not shown as SYSTEM_ERROR
{
  const mapped = classifyResearchMeasurementError({
    status: 400,
    data: {
      detail: {
        code: 'INVALID_REQUEST',
        message: 'Age is outside the supported screening range.',
      },
    },
  });
  assert.equal(mapped.result, 'INELIGIBLE');
  assert.equal(mapped.reasonCode, 'INVALID_REQUEST');
  assert.match(mapped.message, /Độ tuổi hiện tại/);
  console.log('✓ Test 13 Passed: Age validation maps to INELIGIBLE, not SYSTEM_ERROR');
}

// Test 14: Missing age is blocked before the Hirschberg backend request
{
  const ageCheck = validateResearchAge('', 7);
  assert.equal(ageCheck.valid, false);
  assert.equal(ageCheck.ageYears, null);
  assert.match(ageCheck.message, /nhập tuổi/);
  console.log('✓ Test 14 Passed: Missing age fails frontend eligibility guard');
}

// Test 15: Valid age is normalized for the backend payload
{
  const ageCheck = validateResearchAge('9', 7);
  assert.equal(ageCheck.valid, true);
  assert.equal(ageCheck.ageYears, 9);
  console.log('✓ Test 15 Passed: Valid age passes eligibility guard');
}

console.log('ALL RESEARCH MEASUREMENT ERROR MAPPING TESTS PASSED SUCCESSFULLY! ✓\n');
