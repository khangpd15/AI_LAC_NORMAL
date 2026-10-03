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
