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
  landmarks,
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

    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

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

    const effectiveFeatures = features || featuresRef?.current || null;

    const w = canvas.width;
    const h = canvas.height;

    // Helper: draw single point
    const drawPoint = (pt, color, radius = 2.5) => {
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    // Helper: draw crosshair
    const drawCrosshair = (pt, color, length = 7) => {
      if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
      const x = pt.x * w;
      const y = pt.y * h;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      ctx.moveTo(x - length, y);
      ctx.lineTo(x + length, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y - length);
      ctx.lineTo(x, y + length);
      ctx.stroke();
    };

    // Helper: draw closed contour
    const drawContour = (indices, strokeColor, fillColor = null) => {
      if (!indices || indices.length === 0) return;
      const validPts = indices.map((idx) => landmarks[idx]).filter((p) => p && Number.isFinite(p.x));
      if (validPts.length < 3) return;

      ctx.beginPath();
      ctx.moveTo(validPts[0].x * w, validPts[0].y * h);
      for (let i = 1; i < validPts.length; i++) {
        ctx.lineTo(validPts[i].x * w, validPts[i].y * h);
      }
      ctx.closePath();

      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };

    // 1. Draw 16-point Anatomical Eye Contours
    drawContour(LEFT_EYE_CONTOUR, 'rgba(0, 171, 155, 0.75)', 'rgba(0, 171, 155, 0.08)');
    drawContour(RIGHT_EYE_CONTOUR, 'rgba(38, 122, 120, 0.75)', 'rgba(38, 122, 120, 0.08)');

    // 2. Draw Canthal Lines (Inner Canthus to Outer Canthus)
    const lInner = landmarks[LANDMARKS.LEFT_INNER_CORNER];
    const lOuter = landmarks[LANDMARKS.LEFT_OUTER_CORNER];
    const rInner = landmarks[LANDMARKS.RIGHT_INNER_CORNER];
    const rOuter = landmarks[LANDMARKS.RIGHT_OUTER_CORNER];

    ctx.strokeStyle = 'rgba(242, 198, 109, 0.55)';
    ctx.lineWidth = 1.0;
    if (lInner && lOuter) {
      ctx.beginPath();
      ctx.moveTo(lInner.x * w, lInner.y * h);
      ctx.lineTo(lOuter.x * w, lOuter.y * h);
      ctx.stroke();
    }
    if (rInner && rOuter) {
      ctx.beginPath();
      ctx.moveTo(rInner.x * w, rInner.y * h);
      ctx.lineTo(rOuter.x * w, rOuter.y * h);
      ctx.stroke();
    }

    // Draw Canthal Points (Soft Amber)
    const corners = [lInner, lOuter, rInner, rOuter];
    corners.forEach((pt) => drawPoint(pt, '#F2C56D', 2.5));

    // 3. Draw Iris Centers (473 Left, 468 Right) & Perimeter Rings
    const leftIris = landmarks[LANDMARKS.LEFT_IRIS_CENTER];
    const rightIris = landmarks[LANDMARKS.RIGHT_IRIS_CENTER];

    if (leftIris) {
      drawPoint(leftIris, '#00AB9B', 3.0);
      drawCrosshair(leftIris, '#B8E8DF', 7);
    }
    if (rightIris) {
      drawPoint(rightIris, '#267A78', 3.0);
      drawCrosshair(rightIris, '#B8E8DF', 7);
    }

    if (LANDMARKS.LEFT_IRIS_PERIMETER) {
      drawContour(LANDMARKS.LEFT_IRIS_PERIMETER, 'rgba(0, 171, 155, 0.85)');
    }
    if (LANDMARKS.RIGHT_IRIS_PERIMETER) {
      drawContour(LANDMARKS.RIGHT_IRIS_PERIMETER, 'rgba(38, 122, 120, 0.85)');
    }

    // 4. Draw Roll-Aligned Ocular ROI Boundary Boxes
    if (showRoi) {
      const leftRoi = calculateEyeRoi(landmarks, 'LEFT');
      const rightRoi = calculateEyeRoi(landmarks, 'RIGHT');

      const drawRoiBox = (roi, strokeColor, _label) => {
        if (!roi || !roi.isValid) return;

        const cxPx = roi.cx * w;
        const cyPx = roi.cy * h;
        const roiWPx = roi.roiWidth * w;
        const roiHPx = roi.roiHeight * h;

        ctx.save();
        ctx.translate(cxPx, cyPx);
        ctx.rotate(roi.rollAngleRad);

        // Dashed rounded rectangle
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(-roiWPx / 2.0, -roiHPx / 2.0, roiWPx, roiHPx);
        ctx.setLineDash([]);

        // Small corner brackets for visual polish
        const bLen = Math.min(8, roiWPx * 0.15);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.0;
        // Top-left
        ctx.beginPath();
        ctx.moveTo(-roiWPx / 2.0, -roiHPx / 2.0 + bLen);
        ctx.lineTo(-roiWPx / 2.0, -roiHPx / 2.0);
        ctx.lineTo(-roiWPx / 2.0 + bLen, -roiHPx / 2.0);
        ctx.stroke();
        // Top-right
        ctx.beginPath();
        ctx.moveTo(roiWPx / 2.0 - bLen, -roiHPx / 2.0);
        ctx.lineTo(roiWPx / 2.0, -roiHPx / 2.0);
        ctx.lineTo(roiWPx / 2.0, -roiHPx / 2.0 + bLen);
        ctx.stroke();
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(-roiWPx / 2.0, roiHPx / 2.0 - bLen);
        ctx.lineTo(-roiWPx / 2.0, roiHPx / 2.0);
        ctx.lineTo(-roiWPx / 2.0 + bLen, roiHPx / 2.0);
        ctx.stroke();
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(roiWPx / 2.0 - bLen, roiHPx / 2.0);
        ctx.lineTo(roiWPx / 2.0, roiHPx / 2.0);
        ctx.lineTo(roiWPx / 2.0, roiHPx / 2.0 - bLen);
        ctx.stroke();

        ctx.restore();
      };

      drawRoiBox(leftRoi, 'rgba(0, 171, 155, 0.85)', 'L-ROI');
      drawRoiBox(rightRoi, 'rgba(38, 122, 120, 0.85)', 'R-ROI');
    }

    // 5. Draw Gaze Projection Vector
    if (effectiveFeatures) {
      const drawGazeVector = (irisPt, gazeH, gazeV, color) => {
        if (!irisPt) return;
        const startX = irisPt.x * w;
        const startY = irisPt.y * h;
        // Displacement vector relative to center 0.5
        const vecX = (gazeH - 0.5) * 45;
        const vecY = (gazeV - 0.5) * 45;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + vecX, startY + vecY);
        ctx.stroke();

        // Arrow head
        ctx.beginPath();
        ctx.arc(startX + vecX, startY + vecY, 2.0, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      };

      if (leftIris) drawGazeVector(leftIris, effectiveFeatures.leftHorizontalRatio, effectiveFeatures.leftVerticalRatio, '#00AB9B');
      if (rightIris) drawGazeVector(rightIris, effectiveFeatures.rightHorizontalRatio, effectiveFeatures.rightVerticalRatio, '#267A78');
    }
  }, [landmarks, videoWidth, videoHeight, isTrackingValid, features, featuresRef, showRoi]);

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
