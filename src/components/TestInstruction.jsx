import React from 'react';

/**
 * TestInstruction Component - Large legible phase guidance for the user
 */
export default function TestInstruction({
  title,
  instruction,
  highlightEye = null, // 'LEFT' | 'RIGHT' | null
  subtext = null,
}) {
  return (
    <div className="test-instruction-panel">
      {highlightEye && (
        <div className={`eye-badge eye-${highlightEye.toLowerCase()}`}>
          {highlightEye === 'LEFT' ? '👁 Che MẮT TRÁI (bên phải màn hình)' : '👁 Che MẮT PHẢI (bên trái màn hình)'}
        </div>
      )}

      <h2 className="instruction-title">{title}</h2>
      <p className="instruction-text">{instruction}</p>

      {subtext && <p className="instruction-subtext">{subtext}</p>}
    </div>
  );
}
