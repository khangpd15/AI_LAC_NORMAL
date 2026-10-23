import React, { useEffect, useRef, useState } from 'react';
import { LANDMARKS } from '../constants/screeningConfig';
import { calculateEyeRoi } from '../services/cv/eyeRoiService';

// Full 16-point eye contours
const LEFT_EYE_CONTOUR = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const RIGHT_EYE_CONTOUR = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];

/**
 * EyeOverlay Component - High-fidelity clinical eye & iris visualization overlay
 * Supports:
 * - 16-point anatomical eye contours
 * - Canthal axis orientation
 * - Roll-aligned ocular ROI boundary boxes
 * - Dynamic gaze projection vectors
 * - Iris centers & perimeter rings
 * - Toggleable Debug HUD Telemetry Panel (Press 'D' key or click HUD toggle)
 */
export default function EyeOverlay({
  landmarks: stateLandmarks,
  landmarksRef = null,
  videoWidth = 640,
  videoHeight = 480,
  isTrackingValid = true,
  isMirrored = true,
  quality = null,
  features = null,
  featuresRef = null,
  showRoi = true,
  showDebug: initialShowDebug = false,
}) {
  const canvasRef = useRef(null);
  const [showDebug, setShowDebug] = useState(initialShowDebug);
  const [currentFps, setCurrentFps] = useState(30);
  const fpsRef = useRef({ lastTime: 0, frames: 0 });

  // Toggle debug HUD on 'D' keyboard press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'd' || e.key === 'D') {
        setShowDebug((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationId;
    let lastDrawn;
    const draw = () => {
    // A supplied ref is authoritative, including null on face loss.
    const landmarks = landmarksRef ? landmarksRef.current : stateLandmarks;

    // Use display size (CSS pixels × dpr) for canvas resolution
    // so overlay stays pixel-perfect on high-DPI mobile screens.
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    // Fall back to video intrinsic size if canvas hasn't been laid out yet
    const displayW = rect.width  > 0 ? Math.round(rect.width  * dpr) : (videoWidth  || 640);
    const displayH = rect.height > 0 ? Math.round(rect.height * dpr) : (videoHeight || 480);

    const resized = canvas.width !== displayW || canvas.height !== displayH;
    if (resized) {
      canvas.width = displayW;
      canvas.height = displayH;
    }
    if (landmarksRef && !resized && lastDrawn === landmarks) return;
    lastDrawn = landmarks;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Compute FPS
    const now = performance.now();
    fpsRef.current.frames += 1;
    if (fpsRef.current.lastTime === 0) {
      fpsRef.current.lastTime = now;
    } else if (now - fpsRef.current.lastTime >= 1000) {
      const calcFps = Math.round((fpsRef.current.frames * 1000) / (now - fpsRef.current.lastTime));
      fpsRef.current.frames = 0;
      fpsRef.current.lastTime = now;
      setCurrentFps(calcFps);
    }

    if (!landmarks) return;

    const effectiveFeatures = featuresRef ? featuresRef.current : features;

    // Canvas draw space = display pixels
    const cW = canvas.width;   // display width in physical px
    const cH = canvas.height;  // display height in physical px

    // Video intrinsic dimensions
    const vW = videoWidth  || 640;
    const vH = videoHeight || 480;

    // Replicate object-fit: cover transform so overlay aligns with what
    // the <video> element actually renders (cover = fill, center, crop).
    const scaleX = cW / vW;
    const scaleY = cH / vH;
    const coverScale = Math.max(scaleX, scaleY);
    const offsetX = (cW - vW * coverScale) / 2;
    const offsetY = (cH - vH * coverScale) / 2;

    // Helper: convert normalized landmark → canvas pixel with cover-scale
    const lx = (nx) => nx * vW * coverScale + offsetX;
    const ly = (ny) => ny * vH * coverScale + offsetY;

    // Keep w / h as aliases that helpers below use
    const w = vW;
    const h = vH;

    // Helper: draw single point
    const drawPoint = (pt, color, radius = 2.5) => {
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
      ctx.beginPath();
      ctx.arc(lx(pt.x), ly(pt.y), radius * coverScale, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    // Helper: draw crosshair
    const drawCrosshair = (pt, color, length = 7) => {
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
      const x = lx(pt.x);
      const y = ly(pt.y);
      const len = length * coverScale;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      ctx.moveTo(x - len, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y - len);
      ctx.lineTo(x, y + len);
      ctx.stroke();
    };

    // Helper: draw smooth closed contour using quadratic bezier curves
    const drawContour = (indices, strokeColor, fillColor = null, lineW = 0.8) => {
      if (!indices || indices.length === 0) return;
      const validPts = indices.map((idx) => landmarks[idx]).filter((p) => p && Number.isFinite(p.x));
      if (validPts.length < 3) return;

      ctx.beginPath();
      // Use midpoints for smooth bezier
      const mid = (a, b) => ({ x: (lx(a.x) + lx(b.x)) / 2, y: (ly(a.y) + ly(b.y)) / 2 });
      const first = mid(validPts[validPts.length - 1], validPts[0]);
      ctx.moveTo(first.x, first.y);
      for (let i = 0; i < validPts.length; i++) {
        const curr = validPts[i];
        const next = validPts[(i + 1) % validPts.length];
        const m = mid(curr, next);
        ctx.quadraticCurveTo(lx(curr.x), ly(curr.y), m.x, m.y);
      }
      ctx.closePath();

      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineW;
      ctx.stroke();
    };

    // 1. Draw 16-point Anatomical Eye Contours — very subtle smooth curves
    drawContour(LEFT_EYE_CONTOUR,  'rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.03)', 0.7);
    drawContour(RIGHT_EYE_CONTOUR, 'rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.03)', 0.7);

    // 2. Canthal corners — tiny barely-visible dots only, no lines
    const lInner = landmarks[LANDMARKS.LEFT_INNER_CORNER];
    const lOuter = landmarks[LANDMARKS.LEFT_OUTER_CORNER];
    const rInner = landmarks[LANDMARKS.RIGHT_INNER_CORNER];
    const rOuter = landmarks[LANDMARKS.RIGHT_OUTER_CORNER];
    [lInner, lOuter, rInner, rOuter].forEach((pt) => drawPoint(pt, 'rgba(255,255,255,0.25)', 1.0));

    // 3. Iris — soft glint dot only (no crosshair, no bold ring)
    const leftIris  = landmarks[LANDMARKS.LEFT_IRIS_CENTER];
    const rightIris = landmarks[LANDMARKS.RIGHT_IRIS_CENTER];

    const drawIrisGlint = (pt) => {
      if (!pt) return;
      const x = lx(pt.x);
      const y = ly(pt.y);
      const r = 2.5 * coverScale;
      // Soft outer glow
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
      grd.addColorStop(0,   'rgba(255,255,255,0.30)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      grd.addColorStop(1,   'rgba(255,255,255,0.00)');
      ctx.beginPath();
      ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
      // Crisp center dot
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
    };

    drawIrisGlint(leftIris);
    drawIrisGlint(rightIris);

    // Iris perimeter — very faint ring
    if (LANDMARKS.LEFT_IRIS_PERIMETER) {
      drawContour(LANDMARKS.LEFT_IRIS_PERIMETER,  'rgba(255, 255, 255, 0.12)', null, 0.6);
    }
    if (LANDMARKS.RIGHT_IRIS_PERIMETER) {
      drawContour(LANDMARKS.RIGHT_IRIS_PERIMETER, 'rgba(255, 255, 255, 0.12)', null, 0.6);
    }

    // 4. ROI — only show tiny corner brackets, very faint (no dashed rect)
    if (showRoi) {
      const leftRoi  = calculateEyeRoi(landmarks, 'LEFT');
      const rightRoi = calculateEyeRoi(landmarks, 'RIGHT');

      const drawRoiCorners = (roi, strokeColor) => {
        if (!roi || !roi.isValid) return;

        const cxPx  = lx(roi.cx);
        const cyPx  = ly(roi.cy);
        const roiWPx = roi.roiWidth  * vW * coverScale;
        const roiHPx = roi.roiHeight * vH * coverScale;

        ctx.save();
        ctx.translate(cxPx, cyPx);
        ctx.rotate(roi.rollAngleRad);

        const bLen = Math.min(6 * coverScale, roiWPx * 0.18);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.0;
        const hW = roiWPx / 2;
        const hH = roiHPx / 2;
        // Four corner L-brackets only
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
          ctx.beginPath();
          ctx.moveTo(sx * hW, sy * hH + sy * -bLen);
          ctx.lineTo(sx * hW, sy * hH);
          ctx.lineTo(sx * hW + sx * -bLen, sy * hH);
          ctx.stroke();
        });

        ctx.restore();
      };

      drawRoiCorners(leftRoi,  'rgba(255, 255, 255, 0.25)');
      drawRoiCorners(rightRoi, 'rgba(255, 255, 255, 0.25)');
    }

    // 5. Gaze Projection Vector — very subtle, near-invisible
    if (effectiveFeatures) {
      const drawGazeVector = (irisPt, gazeH, gazeV, color) => {
        if (!irisPt) return;
        const startX = lx(irisPt.x);
        const startY = ly(irisPt.y);
        const vecX = (gazeH - 0.5) * 30 * coverScale;
        const vecY = (gazeV - 0.5) * 30 * coverScale;

        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + vecX, startY + vecY);
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      };

      if (leftIris)  drawGazeVector(leftIris,  effectiveFeatures.leftHorizontalRatio,  effectiveFeatures.leftVerticalRatio,  'rgba(255,255,255,0.6)');
      if (rightIris) drawGazeVector(rightIris, effectiveFeatures.rightHorizontalRatio, effectiveFeatures.rightVerticalRatio, 'rgba(255,255,255,0.6)');
    }
    };
    const tick = () => {
      draw();
      animationId = requestAnimationFrame(tick);
    };
    if (landmarksRef) tick();
    else draw();
    return () => cancelAnimationFrame(animationId);
  }, [stateLandmarks, landmarksRef, videoWidth, videoHeight, isTrackingValid, features, featuresRef, showRoi]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="eye-overlay-canvas"
        style={isMirrored ? undefined : { transform: 'none' }}
        aria-hidden="true"
      />

      {/* Debug HUD Overlay (Rendered in sharp DOM layer to avoid canvas mirroring inversion) */}
      {showDebug && (
        <div
          className="debug-hud-overlay"
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(0, 84, 93, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--color-soft-mint)',
            borderRadius: '10px',
            padding: '10px 14px',
            color: '#f8fafc',
            fontFamily: 'monospace',
            fontSize: '11px',
            lineHeight: 1.4,
            zIndex: 10,
            maxWidth: '280px',
            pointerEvents: 'auto',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <span style={{ color: 'var(--color-mint)', fontWeight: 'bold' }}>REMICARE CV HUD</span>
            <span style={{ color: 'var(--color-soft-mint)', fontSize: '10px' }}>FPS: {currentFps}</span>
          </div>
          <div style={{ fontSize: '9px', color: 'var(--color-soft-mint)', marginBottom: '6px' }}>
            Res: {videoWidth}x{videoHeight} {isMirrored ? '• Mirrored' : ''}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '6px' }}>
            <div>
              <span style={{ color: 'var(--color-soft-mint)' }}>L-EAR: </span>
              <span style={{ color: (features?.leftEar ?? 0.3) < 0.18 ? 'var(--color-warm-coral)' : 'var(--color-soft-mint)' }}>
                {features?.leftEar?.toFixed(2) ?? '--'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--color-soft-mint)' }}>R-EAR: </span>
              <span style={{ color: (features?.rightEar ?? 0.3) < 0.18 ? 'var(--color-warm-coral)' : 'var(--color-soft-mint)' }}>
                {features?.rightEar?.toFixed(2) ?? '--'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--color-soft-mint)' }}>Dist: </span>
              <span>{features?.estimatedDistanceCm ? `${features.estimatedDistanceCm} cm` : '--'}</span>
            </div>
            <div>
              <span style={{ color: 'var(--color-soft-mint)' }}>Blink: </span>
              <span style={{ color: features?.isBlinking ? 'var(--color-warm-coral)' : 'var(--color-soft-mint)' }}>
                {features?.isBlinking ? 'ACTIVE' : 'NO'}
              </span>
            </div>
          </div>

          {/* 2D Gaze Grid Visualizer */}
          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(184, 232, 223, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: 'var(--color-soft-mint)' }}>Gaze Map:</span>
              <span style={{ color: 'var(--color-mint)' }}>
                {features?.leftHorizontalRatio?.toFixed(2) ?? '--'} / {features?.leftVerticalRatio?.toFixed(2) ?? '--'}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '42px',
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid var(--color-soft-mint)',
                borderRadius: '6px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Crosshair lines */}
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.15)' }} />
              {/* Gaze Dot */}
              {features && (
                <div
                  style={{
                    position: 'absolute',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: 'var(--color-mint)',
                    boxShadow: '0 0 6px var(--color-mint)',
                    left: `${Math.max(5, Math.min(95, features.leftHorizontalRatio * 100))}%`,
                    top: `${Math.max(5, Math.min(95, features.leftVerticalRatio * 100))}%`,
                    transform: 'translate(-50%, -50%)',
                    transition: 'all 0.05s ease-out',
                  }}
                />
              )}
            </div>
          </div>

          <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: (quality?.isValid ?? isTrackingValid) ? 'var(--color-soft-mint)' : 'var(--color-soft-amber)', fontSize: '10px' }}>
              ● {quality?.status || (isTrackingValid ? 'FRAME ACCEPTED' : 'FRAME REJECTED')}
            </span>
            <button
              type="button"
              onClick={() => setShowDebug(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-soft-mint)',
                cursor: 'pointer',
                fontSize: '10px',
                padding: '0 2px',
              }}
            >
              [Ẩn]
            </button>
          </div>
        </div>
      )}

      {/* Floating HUD toggle button in bottom corner */}
      {!showDebug && (
        <button
          type="button"
          onClick={() => setShowDebug(true)}
          title="Bật bảng phân tích chi tiết (hoặc nhấn phím D)"
          style={{
            position: 'absolute',
            bottom: '8px',
            left: '8px',
            background: 'rgba(0, 84, 93, 0.85)',
            border: '1px solid var(--color-soft-mint)',
            borderRadius: '6px',
            color: '#ffffff',
            fontSize: '10px',
            padding: '3px 8px',
            cursor: 'pointer',
            zIndex: 9,
            backdropFilter: 'blur(4px)',
          }}
        >
          ⚙️ Telemetry HUD
        </button>
      )}
    </>
  );
}
