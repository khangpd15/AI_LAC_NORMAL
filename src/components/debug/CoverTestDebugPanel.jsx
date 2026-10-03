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
  realtimeFps = null,
  datasetSampleRateHz = 15,
  totalFrames = null,
  savedSamples = null,
  validSamples = null,
  rejectedSamples = null,
  validSampleRatio = null,
  faceMeshMetrics = null,
  aiMetrics = null,
  videoWidth = null,
  videoHeight = null,
}) {
  if (!import.meta.env.DEV) return null;
  const eyeWidthValid = quality?.isValid && quality?.leftEyeDetected && quality?.rightEyeDetected;
  return (
    <aside className="cover-debug-panel" aria-label="Cover Test development debug">
      <strong>Cover Test Debug</strong>
      <span>Camera: {cameraReady ? 'READY' : 'WAITING'}</span>
      <span>Resolution: {videoWidth && videoHeight ? `${videoWidth}x${videoHeight}` : '--'}</span>
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
      {/* Dev Debug Telemetry (Section 13) */}
      <span>Realtime: {realtimeFps != null ? `${realtimeFps} FPS` : '-- FPS'}</span>
      <span>Camera: {faceMeshMetrics?.cameraFps ? `${faceMeshMetrics.cameraFps} FPS` : '-- FPS'}</span>
      <span>Landmark: {faceMeshMetrics?.landmarkFps ? `${faceMeshMetrics.landmarkFps} FPS` : '-- FPS'}</span>
      <span>Landmark latency: {faceMeshMetrics?.avgLandmarkLatencyMs ? `${faceMeshMetrics.avgLandmarkLatencyMs}ms` : '--'}</span>
      <span>Dropped: {faceMeshMetrics?.droppedFramePercent != null ? `${faceMeshMetrics.droppedFramePercent}%` : '--'}</span>
      <span>AI: {aiMetrics?.inferenceFps != null ? `${aiMetrics.inferenceFps} FPS` : '-- FPS'}</span>
      <span>Inference: {aiMetrics?.avgInferenceLatencyMs ? `${aiMetrics.avgInferenceLatencyMs}ms` : '--'}</span>
      <span>Q Score: {quality?.qualityScore != null ? quality.qualityScore : '--'}</span>
      <span>Blink: {quality?.blinkDetected ? 'YES' : 'NO'}</span>
      <span>Occlusion: {quality?.occlusionDetected ? 'YES' : 'NO'}</span>
      <span>Yaw: {quality?.headYawDeg != null ? `${Number(quality.headYawDeg).toFixed(1)}°` : '--'}</span>
      <span>Roll: {quality?.headRollDeg != null ? `${Number(quality.headRollDeg).toFixed(1)}°` : '--'}</span>
      <span>Dataset: {datasetSampleRateHz} Hz</span>
      <span>Frames: {totalFrames ?? '--'}</span>
      <span>Saved: {savedSamples ?? '--'}</span>
      <span>Valid: {validSamples ?? '--'}</span>
      <span>Rejected: {rejectedSamples ?? '--'}</span>
      <span>Valid ratio: {validSampleRatio != null ? `${Math.round(validSampleRatio * 100)}%` : '--'}</span>
      <span>Session: {sessionId}</span>
    </aside>
  );
}
