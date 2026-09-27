import React, { useEffect, useRef } from 'react';
import { LANDMARKS } from '../constants/screeningConfig';

/**
 * EyeOverlay Component - Renders iris and eye corner markers onto canvas
 */
export default function EyeOverlay({
  landmarks,
  videoWidth = 640,
  videoHeight = 480,
  isTrackingValid = true,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks) return;

    const w = canvas.width;
    const h = canvas.height;

    const drawPoint = (pt, color, radius = 3) => {
      if (!pt) return;
      ctx.beginPath();
      ctx.arc(pt.x * w, pt.y * h, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    const drawCrosshair = (pt, color, length = 8) => {
      if (!pt) return;
      const x = pt.x * w;
      const y = pt.y * h;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(x - length, y);
      ctx.lineTo(x + length, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, y - length);
      ctx.lineTo(x, y + length);
      ctx.stroke();
    };

    // 1. Draw Eye Corners
    const cornerColor = '#f59e0b'; // Amber for landmarks 362, 263, 133, 33
    const corners = [
      landmarks[LANDMARKS.LEFT_INNER_CORNER],
      landmarks[LANDMARKS.LEFT_OUTER_CORNER],
      landmarks[LANDMARKS.RIGHT_INNER_CORNER],
      landmarks[LANDMARKS.RIGHT_OUTER_CORNER],
    ];

    corners.forEach((pt) => {
      drawPoint(pt, cornerColor, 2.5);
    });

    // Draw eye contour connectors between corners
    if (landmarks[LANDMARKS.LEFT_INNER_CORNER] && landmarks[LANDMARKS.LEFT_OUTER_CORNER]) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(landmarks[LANDMARKS.LEFT_INNER_CORNER].x * w, landmarks[LANDMARKS.LEFT_INNER_CORNER].y * h);
      ctx.lineTo(landmarks[LANDMARKS.LEFT_OUTER_CORNER].x * w, landmarks[LANDMARKS.LEFT_OUTER_CORNER].y * h);
      ctx.stroke();
    }
    if (landmarks[LANDMARKS.RIGHT_INNER_CORNER] && landmarks[LANDMARKS.RIGHT_OUTER_CORNER]) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(landmarks[LANDMARKS.RIGHT_INNER_CORNER].x * w, landmarks[LANDMARKS.RIGHT_INNER_CORNER].y * h);
      ctx.lineTo(landmarks[LANDMARKS.RIGHT_OUTER_CORNER].x * w, landmarks[LANDMARKS.RIGHT_OUTER_CORNER].y * h);
      ctx.stroke();
    }

    // 2. Draw Iris Centers (468, 473) and Perimeter Rings
    const irisPrimaryColor = '#06b6d4'; // Cyan for iris center
    const irisAccentColor = '#22d3ee';

    const leftIris = landmarks[LANDMARKS.LEFT_IRIS_CENTER];
    const rightIris = landmarks[LANDMARKS.RIGHT_IRIS_CENTER];

    if (leftIris) {
      drawPoint(leftIris, irisPrimaryColor, 3.5);
      drawCrosshair(leftIris, irisAccentColor, 7);
    }

    if (rightIris) {
      drawPoint(rightIris, irisPrimaryColor, 3.5);
      drawCrosshair(rightIris, irisAccentColor, 7);
    }

    // Draw iris perimeter rings to visualize dynamic eye gaze orientation
    const drawIrisRing = (perimeterIndices, color) => {
      if (!perimeterIndices || perimeterIndices.length === 0) return;
      const pts = perimeterIndices.map((idx) => landmarks[idx]).filter(Boolean);
      if (pts.length < 3) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * w, pts[i].y * h);
      }
      ctx.closePath();
      ctx.stroke();
    };

    if (LANDMARKS.LEFT_IRIS_PERIMETER) {
      drawIrisRing(LANDMARKS.LEFT_IRIS_PERIMETER, 'rgba(34, 211, 238, 0.65)');
    }
    if (LANDMARKS.RIGHT_IRIS_PERIMETER) {
      drawIrisRing(LANDMARKS.RIGHT_IRIS_PERIMETER, 'rgba(34, 211, 238, 0.65)');
    }
  }, [landmarks, videoWidth, videoHeight, isTrackingValid]);

  return <canvas ref={canvasRef} className="eye-overlay-canvas" aria-hidden="true" />;
}
