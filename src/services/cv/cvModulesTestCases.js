/**
 * CV MODULES TEST SUITE
 * Validates:
 * 1. OneEuroFilter (1D, 2D, Landmark Manager)
 * 2. GazeTracker (Vector Projection, I-DT Fixation)
 * 3. EyeRoiService (Anatomical Fissure ROI, Canthal Roll Theta)
 * 4. FrontendQualityGate (EAR blink, Head Pose, Iris Presence, Distance)
 */

import { OneEuroFilter1D, OneEuroFilter2D, LandmarkOneEuroFilterManager } from './oneEuroFilter.js';
import { projectPointOntoSegment, GazeFixationTracker } from './gazeTracker.js';
import { calculateEyeRoi, calculateCanthalRollAngle } from './eyeRoiService.js';
import { FrontendQualityGate } from './frontendQualityGate.js';

export function runCvModulesTestCases() {
  const results = [];

  // 1. OneEuroFilter Jitter Reduction
  try {
    const filter = new OneEuroFilter1D({ minCutoff: 1.0, beta: 0.005 });
    let t = 0;
    const baseVal = 100;
    const filteredVals = [];
    for (let i = 0; i < 20; i++) {
      t += 0.033; // ~30 FPS
      const noise = (i % 2 === 0 ? 1 : -1) * 2.0; // +/- 2px jitter
      const filtered = filter.filter(baseVal + noise, t);
      filteredVals.push(filtered);
    }
    const lastDiff = Math.abs(filteredVals[filteredVals.length - 1] - baseVal);
    const passed = lastDiff < 1.0;
    results.push({
      id: 'CV-1',
      name: 'OneEuroFilter1D reduces high-frequency jitter on stationary signal',
      passed,
      details: `Jitter dampened: lastDiff=${lastDiff.toFixed(3)} < 1.0`,
    });
  } catch (e) {
    results.push({ id: 'CV-1', name: 'OneEuroFilter1D jitter test', passed: false, details: e.message });
  }

  // 2. OneEuroFilter Saccade Responsiveness
  try {
    const filter2D = new OneEuroFilter2D({ minCutoff: 1.2, beta: 0.01 });
    let t = 0;
    // 10 frames stationary at (100, 100)
    for (let i = 0; i < 10; i++) {
      t += 0.033;
      filter2D.filter(100, 100, t);
    }
    // Saccadic jump to (150, 100)
    t += 0.033;
    const saccadeRes = filter2D.filter(150, 100, t);
    // Beta speed coefficient allows fast response (> 120 on first step from 100 to 150)
    const passed = saccadeRes.x > 120;
    results.push({
      id: 'CV-2',
      name: 'OneEuroFilter2D responds rapidly to saccadic jump without stalling',
      passed,
      details: `Saccade response: ${saccadeRes.x.toFixed(1)} / 150`,
    });
  } catch (e) {
    results.push({ id: 'CV-2', name: 'OneEuroFilter2D saccade test', passed: false, details: e.message });
  }

  // 3. Landmark Filter Manager
  try {
    const lmManager = new LandmarkOneEuroFilterManager();
    const mockLm = Array.from({ length: 478 }, (_, i) => ({ x: 0.5 + i * 0.001, y: 0.5, z: 0 }));
    const _filtered1 = lmManager.filterLandmarks(mockLm, 1.0);
    const filtered2 = lmManager.filterLandmarks(mockLm, 1.033);
    const passed = filtered2.length === 478 && Math.abs(filtered2[468].x - (0.5 + 468 * 0.001)) < 1e-4;
    results.push({
      id: 'CV-3',
      name: 'LandmarkOneEuroFilterManager filters full 478 landmark array preserving indices',
      passed,
      details: `Filter preserved count=${filtered2.length}, right iris center x=${filtered2[468].x.toFixed(4)}`,
    });
  } catch (e) {
    results.push({ id: 'CV-3', name: 'LandmarkOneEuroFilterManager test', passed: false, details: e.message });
  }

  // 4. Vector Projection Gaze Ratio
  try {
    const innerCorner = { x: 100, y: 100 };
    const outerCorner = { x: 200, y: 100 };
    const upperLid = { x: 150, y: 80 };
    const lowerLid = { x: 150, y: 120 };
    const centeredIris = { x: 150, y: 100 };

    const neutralGazeX = projectPointOntoSegment(centeredIris, innerCorner, outerCorner);
    const neutralGazeY = projectPointOntoSegment(centeredIris, upperLid, lowerLid);

    const dextroIris = { x: 180, y: 100 };
    const dextroGazeX = projectPointOntoSegment(dextroIris, innerCorner, outerCorner);

    const passed =
      Math.abs(neutralGazeX - 0.5) < 0.01 &&
      Math.abs(neutralGazeY - 0.5) < 0.01 &&
      dextroGazeX > 0.75;

    results.push({
      id: 'CV-4',
      name: 'Vector projection gaze ratio correctly computes horizontal & vertical normalized coordinates',
      passed,
      details: `Neutral: (${neutralGazeX.toFixed(2)}, ${neutralGazeY.toFixed(2)}), Dextro: ${dextroGazeX.toFixed(2)}`,
    });
  } catch (e) {
    results.push({ id: 'CV-4', name: 'Gaze ratio test', passed: false, details: e.message });
  }

  // 5. Fixation Detector I-DT
  try {
    const tracker = new GazeFixationTracker({
      dispersionThreshold: 0.1,
      fixationWindowFrames: 5,
      saccadeVelocityThreshold: 1.5,
    });
    let fixCount = 0;
    let t = 1.0;
    // Stationary fixation for 10 frames
    for (let i = 0; i < 10; i++) {
      t += 0.033;
      const res = tracker.update(0.5 + (i % 2) * 0.005, 0.5, t);
      if (res.isFixating) fixCount++;
    }
    const hadFixation = fixCount > 0;
    // Saccadic jump
    t += 0.033;
    const saccadeRes = tracker.update(0.85, 0.5, t);
    const passed = hadFixation && saccadeRes.isSaccade;
    results.push({
      id: 'CV-5',
      name: 'GazeFixationTracker detects steady fixation and flags saccades based on velocity & dispersion',
      passed,
    });
  } catch (e) {
    results.push({ id: 'CV-5', name: 'GazeFixationTracker test', passed: false, details: e.message });
  }

  // 6. Canthal Roll Angle & Eye ROI
  try {
    const innerCorner = { x: 100, y: 100 };
    const outerCorner = { x: 200, y: 100 }; // 0 deg roll
    const theta0 = calculateCanthalRollAngle(innerCorner, outerCorner);

    const tiltedOuter = { x: 200, y: 120 }; // tilted down
    const thetaTilted = calculateCanthalRollAngle(innerCorner, tiltedOuter);

    const mockLandmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    // Left eye outer: 263, inner: 362
    mockLandmarks[263] = { x: 0.6, y: 0.4 };
    mockLandmarks[362] = { x: 0.55, y: 0.4 };
    mockLandmarks[386] = { x: 0.575, y: 0.38 };
    mockLandmarks[374] = { x: 0.575, y: 0.42 };
    mockLandmarks[473] = { x: 0.575, y: 0.4 };

    const roi = calculateEyeRoi(mockLandmarks, 'LEFT');
    const passed =
      Math.abs(theta0) < 1e-4 &&
      thetaTilted > 0 &&
      roi !== null &&
      roi.bboxNorm.width > 0.02 &&
      roi.bboxNorm.height > 0.01;

    results.push({
      id: 'CV-6',
      name: 'EyeRoiService computes exact canthal roll and bounds ocular ROI without clipping',
      passed,
      details: `theta0=${theta0.toFixed(2)}, thetaTilted=${thetaTilted.toFixed(4)}, ROI w=${roi?.bboxNorm?.width} h=${roi?.bboxNorm?.height}`,
    });
  } catch (e) {
    results.push({ id: 'CV-6', name: 'EyeRoiService test', passed: false, details: e.message });
  }

  // 7. Frontend Quality Gate
  try {
    const mockLandmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    // Proper eye positions
    mockLandmarks[33] = { x: 0.4, y: 0.4 }; // right outer
    mockLandmarks[133] = { x: 0.45, y: 0.4 }; // right inner
    mockLandmarks[159] = { x: 0.425, y: 0.38 }; // right top
    mockLandmarks[145] = { x: 0.425, y: 0.42 }; // right bot
    mockLandmarks[468] = { x: 0.425, y: 0.4 }; // right iris

    mockLandmarks[362] = { x: 0.55, y: 0.4 }; // left inner
    mockLandmarks[263] = { x: 0.6, y: 0.4 }; // left outer
    mockLandmarks[386] = { x: 0.575, y: 0.38 }; // left top
    mockLandmarks[374] = { x: 0.575, y: 0.42 }; // left bot
    mockLandmarks[473] = { x: 0.575, y: 0.4 }; // left iris

    // Nose bridge and chin for pose
    mockLandmarks[1] = { x: 0.5, y: 0.45, z: 0 };
    mockLandmarks[199] = { x: 0.5, y: 0.6, z: 0 };
    mockLandmarks[234] = { x: 0.35, y: 0.45, z: 0 };
    mockLandmarks[454] = { x: 0.65, y: 0.45, z: 0 };

    const gate = new FrontendQualityGate({ minDistanceCm: 25, maxDistanceCm: 50 });
    const qResult = gate.evaluateFrame(mockLandmarks, { leftEar: 0.28, rightEar: 0.28, estimatedDistanceCm: 35 });
    const passed = qResult.isAcceptable === true && qResult.qualityScore > 0.8;

    results.push({
      id: 'CV-7',
      name: 'FrontendQualityGate validates complete clinical frame and accepts standard forward gaze',
      passed,
      details: `Gate acceptable=${qResult.isAcceptable}, score=${qResult.qualityScore}`,
    });
  } catch (e) {
    results.push({ id: 'CV-7', name: 'Quality gate test', passed: false, details: e.message });
  }

  return results;
}
