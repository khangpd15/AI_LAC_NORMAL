# RemiCare Frontend CV Architecture

## Target Pipeline

```text
Camera MediaStream
  -> video element
  -> requestVideoFrameCallback when available
  -> requestAnimationFrame fallback with one-video-frame guard
  -> MediaPipe Face Mesh
  -> eye/iris landmarks
  -> One Euro smoothed features
  -> frame quality gate
  -> UI + voice quality status
  -> Cover Test timeline recorder
  -> adaptive AI inference
  -> backend persistence
```

## Frame Quality Contract

Each processed frame should expose:

```js
{
  faceDetected,
  leftEyeDetected,
  rightEyeDetected,
  leftIrisDetected,
  rightIrisDetected,
  blinkDetected,
  occlusionDetected,
  headPoseValid,
  headPoseStatus,
  distanceValid,
  fps,
  trackingConfidence,
  qualityScore,
  isValid,
  frameValid,
  aiFrameEligible,
  uiStatus
}
```

The gate is intentionally permissive:

- Critical: face, required eye(s), iris landmarks, non-blink frame, phase-compatible eye visibility.
- Optional: perfect head alignment, ideal distance, ideal FPS.
- A bad frame is dropped. The session is paused or marked inconclusive only after repeated invalid tracking.

## Tracking Loop

`useFaceMesh()` remains the only MediaPipe sender. It should:

- Prefer `requestVideoFrameCallback`.
- Keep the existing in-flight `send()` lock.
- Calculate real FPS from timestamps.
- Downshift FaceMesh target FPS when latency rises.
- Never run a second MediaPipe loop for AI.

## AI Loop

`useStrabismusAI()` remains separate from tracking:

- Runs only when `quality.aiFrameEligible === true`.
- Skips if another inference is in flight.
- Adapts interval based on average inference latency.
- Exposes `inferenceFps` and `avgInferenceLatencyMs` for dev debug.

## Cover Test Timeline

Cover Test records timestamped samples, not fixed-frame assumptions:

```js
{
  timestamp,
  phase,
  leftIrisX,
  leftIrisY,
  rightIrisX,
  rightIrisY,
  leftEyeCenterX,
  leftEyeCenterY,
  rightEyeCenterX,
  rightEyeCenterY,
  velocity,
  acceleration,
  trackingConfidence,
  blink,
  occlusion,
  frameValid
}
```

Cycle summaries also carry:

- `coverTimestamp`
- `uncoverTimestamp`
- `movementStartTimestamp`
- `movementEndTimestamp`
- `settlingTimestamp`
- movement latency/duration/max displacement/settling time

## UI Guidance

`CameraQualityStatus` shows one short priority message:

- `Ổn`
- `Gần hơn`
- `Xa hơn`
- `Mắt chưa rõ`
- `Giữ yên`
- `Đưa mặt vào giữa`
- `Mở mắt`

Voice guidance uses the existing speech system, but adds a cooldown so tracking updates cannot speak every frame.

## ROI Crop

`src/services/cv/eyeRoiService.js` owns eye ROI math. The public API includes:

- `getEyeROI(landmarks, side)`
- `calculateEyeRoi(landmarks, eyeSide)`
- `cropRollAlignedEye(video, roiData)`

The model input size remains unchanged unless the model contract changes.

## Dev Debug

Debug remains development-only through `import.meta.env.DEV` and should include:

- Camera FPS
- Landmark FPS
- AI FPS
- Inference latency
- Quality score
- Valid frame ratio
- Blink / occlusion
- Yaw / roll

## Privacy

No automatic upload of raw face or eye images is added. Existing protocol-triggered eye crops remain explicit research artifacts and should still require product consent before production capture workflows are enabled.
