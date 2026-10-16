import React, { useRef, useState, useCallback } from 'react';

/**
 * VirtualJoystick Component - 360° Interactive 2D Eye Deviation Trackpad
 * 
 * Maps 2D thumbstick position (normalized -1.0 to +1.0) to anatomical eye deviation:
 * - X: Negative = Temporal / Positive = Nasal (or vice-versa depending on eye)
 * - Y: Negative = Superior (Up) / Positive = Inferior (Down)
 */
export default function VirtualJoystick({
  value = { x: 0, y: 0 },
  onChange,
  size = 140,
  disabled = false,
  label = 'Cần xoay 360°',
}) {
  const padRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const radius = size / 2;
  const knobRadius = 22;
  const maxTravel = radius - knobRadius - 4;

  const updatePosition = useCallback(
    (clientX, clientY) => {
      if (!padRef.current || disabled) return;
      const rect = padRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > maxTravel) {
        dx = (dx / dist) * maxTravel;
        dy = (dy / dist) * maxTravel;
      }

      const normX = Number((dx / maxTravel).toFixed(2));
      const normY = Number((dy / maxTravel).toFixed(2));

      if (onChange) {
        onChange({ x: normX, y: normY });
      }
    },
    [maxTravel, disabled, onChange]
  );

  const handlePointerDown = (e) => {
    if (disabled) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updatePosition(e.clientX, e.clientY);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || disabled) return;
    updatePosition(e.clientX, e.clientY);
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture lost
    }
  };

  const handleReset = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange({ x: 0, y: 0 });
    }
  };

  // Knob current px offset
  const knobX = (value?.x || 0) * maxTravel;
  const knobY = (value?.y || 0) * maxTravel;

  // Compute angle in degrees
  const angleDeg = Math.round((Math.atan2(value?.y || 0, value?.x || 0) * 180) / Math.PI);
  const intensity = Math.round(Math.hypot(value?.x || 0, value?.y || 0) * 100);

  return (
    <div className={`v-joystick-wrap ${disabled ? 'disabled' : ''}`}>
      <div className="v-joystick-header">
        <span className="v-joystick-label">{label}</span>
        {(value.x !== 0 || value.y !== 0) && (
          <button
            type="button"
            className="btn-joystick-center"
            onClick={handleReset}
            title="Đưa con ngươi về giữa"
          >
            Về giữa
          </button>
        )}
      </div>

      <div
        ref={padRef}
        className={`v-joystick-pad ${isDragging ? 'dragging' : ''}`}
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Concentric Reticle Rings */}
        <div className="joystick-ring ring-1" />
        <div className="joystick-ring ring-2" />
        <div className="joystick-crosshair ch-h" />
        <div className="joystick-crosshair ch-v" />

        {/* Direction Indicator Labels */}
        <span className="dir-tag tag-top">TRÊN</span>
        <span className="dir-tag tag-bottom">DƯỚI</span>
        <span className="dir-tag tag-left">TRONG</span>
        <span className="dir-tag tag-right">NGOÀI</span>

        {/* Active Knob */}
        <div
          className="joystick-knob"
          style={{
            transform: `translate(${knobX}px, ${knobY}px)`,
          }}
        >
          <div className="knob-iris-center" />
          <div className="knob-pulse-glow" />
        </div>
      </div>

      <div className="v-joystick-telemetry">
        <span>Góc: {intensity > 0 ? `${angleDeg}°` : 'Trung tâm'}</span>
        <span>Biên độ: {intensity}%</span>
      </div>
    </div>
  );
}
