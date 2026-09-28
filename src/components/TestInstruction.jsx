import React from 'react';
import { toCanonicalEye } from '../utils/eyeCoordinateMapping';

/**
 * TestInstruction Component - Large legible phase guidance for the user
 */
export default function TestInstruction({
  title,
  instruction,
  highlightEye = null, // 'LEFT' | 'RIGHT' | null
  subtext = null,
}) {
  const canonicalEye = toCanonicalEye(highlightEye);
  return (
    <div className="test-instruction-panel">
      {canonicalEye && (
        <div className={`eye-badge eye-${canonicalEye.toLowerCase()}`}>
          {canonicalEye === 'LEFT' ? '👁 Che MẮT TRÁI' : '👁 Che MẮT PHẢI'}
        </div>
      )}

      <h2 className="instruction-title">{title}</h2>
      <p className="instruction-text">{instruction}</p>

      {subtext && <p className="instruction-subtext">{subtext}</p>}
    </div>
  );
}
