import React from 'react';

/**
 * Countdown Component - Renders prominent countdown timer for Cover Test phases
 */
export default function Countdown({ value, unit = 's', label = 'Thời gian còn lại' }) {
  return (
    <div className="countdown-container" aria-live="polite" aria-atomic="true">
      <div className="countdown-number">
        {value}
        {unit && <span className="countdown-unit">{unit}</span>}
      </div>
      {label && <div className="countdown-label">{label}</div>}
    </div>
  );
}
