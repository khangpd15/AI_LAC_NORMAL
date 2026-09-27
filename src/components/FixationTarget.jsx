import React from 'react';

/**
 * FixationTarget Component - Calibrated visual fixation dot for eye alignment
 */
export default function FixationTarget({ isPulsing = true, size = 28 }) {
  return (
    <div className="fixation-target-wrapper" aria-hidden="true">
      <div
        className={`fixation-dot ${isPulsing ? 'pulse' : ''}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      >
        <span className="inner-pin" />
      </div>
      <div className="fixation-label">Điểm cố định thị giác</div>
    </div>
  );
}
