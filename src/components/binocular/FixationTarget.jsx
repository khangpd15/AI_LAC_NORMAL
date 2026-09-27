import React from 'react';
import { FIXATION_TARGET_CONFIG } from '../../constants/binocularScreeningConfig.js';

/**
 * FixationTarget Component
 * Renders calibrated center fixation target for Cover Test & Brock String Full-Screen Mode.
 * 
 * Strict Positioning Rules (Section 35.2 & 36.8):
 * - Dead Center: left: 50%, top: 50%, transform: translate(-50%, -50%).
 * - Center coordinates NEVER shift when size changes (only width, height, and scale change).
 * - Smooth CSS scale transition for child-friendly focus.
 */
export default function FixationTarget({
  _type = 'DOT',
  size = FIXATION_TARGET_CONFIG.sizePx,
  color = FIXATION_TARGET_CONFIG.color,
  position = 'CENTER',
  isPulsing = true,
  ariaLabel = 'Mục tiêu định thị trung tâm',
  targetPosition = null,
}) {
  const leftStyle = targetPosition?.x != null ? `${targetPosition.x}%` : '50%';
  const topStyle = targetPosition?.y != null ? `${targetPosition.y}%` : '50%';

  return (
    <div
      className={`fullscreen-fixation-container pos-${position.toLowerCase()}`}
      style={{
        position: 'absolute',
        left: leftStyle,
        top: topStyle,
        transform: 'translate(-50%, -50%)',
        zIndex: 50,
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label={ariaLabel}
      role="img"
    >
      <div
        className={`fixation-dot-core ${isPulsing ? 'dot-pulse' : ''}`}
        style={{
          '--pulse-color': color,
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: color,
          borderRadius: '50%',
          boxShadow: `0 0 24px ${color}99, inset 0 0 8px rgba(255, 255, 255, 0.7)`,
          border: '3px solid rgba(255, 255, 255, 0.95)',
          transition: 'width 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), height 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.35s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Subtle center specular dot */}
        <span
          style={{
            width: `${Math.max(5, size * 0.22)}px`,
            height: `${Math.max(5, size * 0.22)}px`,
            backgroundColor: '#ffffff',
            borderRadius: '50%',
            opacity: 0.9,
          }}
        />
      </div>
    </div>
  );
}
