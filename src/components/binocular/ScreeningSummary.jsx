/**
 * ScreeningSummary — thin wrapper that delegates to FinalScreeningResult.
 * Kept for backward-compatibility with BinocularVisionScreening.jsx.
 */
import React from 'react';
import FinalScreeningResult from './FinalScreeningResult.jsx';

export default function ScreeningSummary({ sessionData, onRestart }) {
  return <FinalScreeningResult sessionData={sessionData} onRestart={onRestart} />;
}
