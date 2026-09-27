import React from 'react';

export default function CoverTestDebugPanel({
  cameraReady,
  quality,
  positionReport,
  state,
  cycle,
  trackedEye,
  samples,
  sessionId,
  timerDisplay,
  startTime,
  elapsedMs,
}) {
  if (!import.meta.env.DEV) return null;
  const eyeWidthValid = quality?.isValid && quality?.leftEyeDetected && quality?.rightEyeDetected;
  return (
    <aside className="cover-debug-panel" aria-label="Cover Test development debug">
      <strong>Cover Test Debug</strong>
      <span>Camera: {cameraReady ? 'READY' : 'WAITING'}</span>
      <span>Face: {quality?.faceDetected ? 'DETECTED' : 'NOT DETECTED'}</span>
      <span>Left Iris: {quality?.leftEyeDetected ? 'VALID' : 'INVALID'}</span>
      <span>Right Iris: {quality?.rightEyeDetected ? 'VALID' : 'INVALID'}</span>
      <span>Eye Width: {eyeWidthValid ? 'VALID' : 'INVALID'}</span>
      <span>Position: {Number.isFinite(positionReport?.stableDistanceCm) ? `${positionReport.stableDistanceCm.toFixed(1)} cm (estimated)` : '--'}</span>
      <span>Timer: {timerDisplay || '0.0s'}</span>
      <span>State: {state}</span>
      <span>StartTime: {startTime != null ? Number(startTime).toFixed(2) : '--'}</span>
      <span>Elapsed: {Math.round(elapsedMs || 0)}ms</span>
      <span>SampleCount: {samples}</span>
      <span>Cycle: {cycle} / 3</span>
      <span>Tracked Eye: {trackedEye?.toUpperCase() || '--'}</span>
      <span>Samples: {samples}</span>
      <span>Quality: {quality?.isValid ? 'GOOD' : 'INCONCLUSIVE'}</span>
      <span>Session: {sessionId}</span>
    </aside>
  );
}
