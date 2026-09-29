/**
 * REMICARE AI - VECTOR PROJECTION GAZE & FIXATION TRACKER
 * 
 * Implements roll-invariant vector projection gaze estimation and
 * I-DT (Identification by Dispersion-Threshold) fixation detection.
 * Inspired by InsightEye and optimized for RemiCare clinical screening.
 */

import { LANDMARKS } from '../../constants/screeningConfig.js';

/**
 * Projects 2D point `pt` onto the line segment `start -> end` and returns scalar ratio.
 * Invariant to 2D in-plane head tilt (canthal roll).
 * 
 * @param {{x: number, y: number}} pt
 * @param {{x: number, y: number}} start
 * @param {{x: number, y: number}} end
 * @returns {number} Normalized projection ratio (nominally ~0.5 at center)
 */
export function projectPointOntoSegment(pt, start, end) {
  if (!pt || !start || !end) return 0.5;

  const lineDx = end.x - start.x;
  const lineDy = end.y - start.y;
  const ptDx = pt.x - start.x;
  const ptDy = pt.y - start.y;

  const lineLenSq = lineDx * lineDx + lineDy * lineDy;
  if (lineLenSq < 1e-8) return 0.5;

  const projection = (ptDx * lineDx + ptDy * lineDy) / lineLenSq;
  return Number.isFinite(projection) ? projection : 0.5;
}

/**
 * Computes vector-projected gaze coordinates for both eyes from landmarks.
 * @param {Array<{x: number, y: number}>} landmarks
 * @returns {{
 *   leftGazeX: number,
 *   leftGazeY: number,
 *   rightGazeX: number,
 *   rightGazeY: number,
 *   gazeX: number,
 *   gazeY: number
 * } | null}
 */
export function calculateVectorGazeRatios(landmarks) {
  if (!landmarks || landmarks.length < 478) return null;

  // Left Eye (Subject OS): Inner = 362, Outer = 263, Top = 386, Bot = 374, Iris = 473
  const lIris = landmarks[LANDMARKS.LEFT_IRIS_CENTER];
  const lInner = landmarks[LANDMARKS.LEFT_INNER_CORNER];
  const lOuter = landmarks[LANDMARKS.LEFT_OUTER_CORNER];
  const lTop = landmarks[LANDMARKS.LEFT_TOP_LID];
  const lBot = landmarks[LANDMARKS.LEFT_BOTTOM_LID];

  // Right Eye (Subject OD): Inner = 133, Outer = 33, Top = 159, Bot = 145, Iris = 468
  const rIris = landmarks[LANDMARKS.RIGHT_IRIS_CENTER];
  const rInner = landmarks[LANDMARKS.RIGHT_INNER_CORNER];
  const rOuter = landmarks[LANDMARKS.RIGHT_OUTER_CORNER];
  const rTop = landmarks[LANDMARKS.RIGHT_TOP_LID];
  const rBot = landmarks[LANDMARKS.RIGHT_BOTTOM_LID];

  let leftGazeX = 0.5;
  let leftGazeY = 0.5;
  if (lIris && lInner && lOuter) {
    leftGazeX = projectPointOntoSegment(lIris, lInner, lOuter);
  }
  if (lIris && lTop && lBot) {
    leftGazeY = projectPointOntoSegment(lIris, lTop, lBot);
  }

  let rightGazeX = 0.5;
  let rightGazeY = 0.5;
  if (rIris && rInner && rOuter) {
    rightGazeX = projectPointOntoSegment(rIris, rInner, rOuter);
  }
  if (rIris && rTop && rBot) {
    rightGazeY = projectPointOntoSegment(rIris, rTop, rBot);
  }

  // Average gaze coordinates across valid eyes
  const gazeX = (leftGazeX + rightGazeX) / 2.0;
  const gazeY = (leftGazeY + rightGazeY) / 2.0;

  return {
    leftGazeX: Number(leftGazeX.toFixed(4)),
    leftGazeY: Number(leftGazeY.toFixed(4)),
    rightGazeX: Number(rightGazeX.toFixed(4)),
    rightGazeY: Number(rightGazeY.toFixed(4)),
    gazeX: Number(gazeX.toFixed(4)),
    gazeY: Number(gazeY.toFixed(4)),
  };
}

/**
 * Gaze & Fixation State Tracker
 * Tracks gaze velocity, I-DT fixation stability, and saccade flags across frames.
 */
export class GazeFixationTracker {
  constructor({
    dispersionThreshold = 0.08,
    fixationWindowFrames = 15,
    saccadeVelocityThreshold = 2.0,
  } = {}) {
    this.dispersionThreshold = dispersionThreshold;
    this.fixationWindowFrames = fixationWindowFrames;
    this.saccadeVelocityThreshold = saccadeVelocityThreshold;

    this.gazeWindow = []; // [{ x, y, t }]
    this.lastGaze = null; // { x, y, t }
  }

  /**
   * Updates tracking with a new gaze point.
   * @param {number} gazeX
   * @param {number} gazeY
   * @param {number} timestampSec
   * @returns {{
   *   gazeVelocity: number,
   *   isFixating: boolean,
   *   isSaccade: boolean,
   *   dispersion: number,
   *   gazeState: 'FIXATED' | 'SEARCHING' | 'SACCADE'
   * }}
   */
  update(gazeX, gazeY, timestampSec = performance.now() / 1000.0) {
    // 1. Calculate gaze velocity (normalized units per second)
    let gazeVelocity = 0.0;
    if (this.lastGaze) {
      const dt = timestampSec - this.lastGaze.t;
      if (dt > 1e-4) {
        const dist = Math.hypot(gazeX - this.lastGaze.x, gazeY - this.lastGaze.y);
        gazeVelocity = dist / dt;
      }
    }
    this.lastGaze = { x: gazeX, y: gazeY, t: timestampSec };

    // 2. I-DT Fixation Window
    this.gazeWindow.push({ x: gazeX, y: gazeY, t: timestampSec });
    if (this.gazeWindow.length > this.fixationWindowFrames) {
      this.gazeWindow.shift();
    }

    let isFixating = false;
    let dispersion = 0.0;

    if (this.gazeWindow.length >= this.fixationWindowFrames) {
      const xs = this.gazeWindow.map((p) => p.x);
      const ys = this.gazeWindow.map((p) => p.y);
      dispersion = (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys));
      if (dispersion < this.dispersionThreshold) {
        isFixating = true;
      }
    }

    // 3. Saccade classification
    const isSaccade = gazeVelocity > this.saccadeVelocityThreshold && !isFixating;

    let gazeState = 'SEARCHING';
    if (isSaccade) {
      gazeState = 'SACCADE';
    } else if (isFixating) {
      gazeState = 'FIXATED';
    }

    return {
      gazeVelocity: Number(gazeVelocity.toFixed(3)),
      isFixating,
      isSaccade,
      dispersion: Number(dispersion.toFixed(4)),
      gazeState,
    };
  }

  reset() {
    this.gazeWindow = [];
    this.lastGaze = null;
  }
}
