# RemiCare Frontend CV Audit

Audit date: 2026-10-03

## 1. Current Architecture

The active frontend is the React/Vite app in `D:\AI_Check_Lac`. The backend repo `D:\REMICARE-STRABISMUS-AI` only contains FastAPI, CV/model services, schemas, and storage APIs; it does not contain the live camera UI.

The frontend stack is:

- React 19 + Vite.
- Browser `getUserMedia` webcam capture through `src/hooks/useCamera.js` and `src/services/cameraService.js`.
- MediaPipe Face Mesh loaded from CDN by `src/services/faceMeshService.js` with `refineLandmarks: true`.
- Tracking loop in `src/hooks/useFaceMesh.js`.
- Eye/iris features from `src/hooks/useEyeTracking.js` and `src/services/eyeFeatureService.js`.
- Cover Test protocol in `src/components/binocular/CoverTestStep.jsx`.
- Cover Test time-series persistence through `src/services/coverTest/coverTestPersistenceService.js` to `/api/v1/cover-test/sessions`.
- Optional browser ONNX inference in `src/hooks/useStrabismusAI.js` and `src/services/aiInferenceService.js`.

## 2. Camera Pipeline

`cameraService.startCameraStream()` requests:

```js
video: {
  width: { ideal: 640, max: 1280 },
  height: { ideal: 480, max: 720 },
  facingMode: 'user',
  frameRate: { ideal: 30, max: 60 },
}
```

This is reasonable for mobile/laptop screening because it avoids 4K capture and prefers the user-facing camera. `useCamera()` reuses an existing live stream and stops all `MediaStreamTrack`s on unmount.

Risks found:

- No explicit track settings metrics are passed into debug/performance reports.
- No camera switching UI was found.
- Orientation/resize stability is mostly handled by CSS/video metadata, but the audit did not find a dedicated orientation-change handler.

## 3. Tracking Pipeline

`useFaceMesh()` already uses `requestVideoFrameCallback` when available and falls back to `requestAnimationFrame`. It tracks camera FPS, landmark FPS, latency, processed frames, and dropped frames. It also guards against overlapping `faceMesh.send()` calls with `isSendingRef`.

Strengths:

- Progressive rVFC support exists.
- Adaptive landmark interval exists.
- Duplicate concurrent MediaPipe inference is guarded.
- Metrics are dev-visible through `CoverTestDebugPanel`.

Risks found:

- The rAF fallback can still process repeated video frames because it lacks a media-time guard.
- The loop stores `presentationTime` but downstream logic treats it mostly as a generic timestamp.
- FaceMesh results callback is global/shared, so multiple mounted consumers could race if another screen starts FaceMesh concurrently.

## 4. AI Pipeline

The browser ONNX path is loaded once through `getOrInitAISession()` and throttled in `useStrabismusAI()` around 6-20 FPS depending on measured latency. The master screening component avoids running this AI during Cover Test.

Strengths:

- Tracking and AI inference are already separate.
- AI inference is asynchronous and skipped if a previous inference is still in flight.
- The Cover Test backend inference runs once after session persistence, guarded by refs.

Risks found:

- AI frame eligibility was based on `quality.isValid` plus both eyes and blink checks; it lacked a reusable quality-gate object with `qualityScore`, `frameValid`, occlusion, and phase eligibility semantics.
- The hook did not expose average inference latency to the UI/debug report.
- AI throttling did not account for frame-quality drop rate.

## 5. Cover Test Pipeline

`CoverTestStep.jsx` runs protocol states:

`IDLE -> PREPARING -> BASELINE -> COVER -> UNCOVER -> TRACKING -> CYCLE_COMPLETE -> NEXT_CYCLE -> FINISHED`

It records raw time-series at a timestamp-downsampled 15 Hz target while live tracking can run at native camera/FaceMesh speed. It stores baseline, right/left eye analyses, cycle summaries, and backend cloud persistence.

Strengths:

- Cover Test already avoids one-frame diagnosis and aggregates cycles.
- Velocity uses elapsed timestamps, not fixed frame counts.
- Blink masking exists in `eyeFeatureService.js`.
- Backend persistence is single-dispatch guarded.

Risks found:

- `createCoverFrame()` rejects any invalid head pose immediately, making mild head pose drift too blocking.
- Time-series samples lack explicit `velocity`, `acceleration`, `frameValid`, `blink`, `occlusion`, `leftEyeCenterX/Y`, `rightEyeCenterX/Y`, movement event timestamps, and separate tracking confidence fields requested by the task.
- `UNCOVER` is used as a short spoken/instruction state while actual trajectory analysis happens in `TRACKING`; persisted samples need clearer phase/event metadata.
- The quality gate drops samples but does not maintain an explicit recovery state for tracking lost 3/10+ frames.

## 6. Performance Bottlenecks

- `CoverTestStep.jsx` remains very large and combines UI, state machine, sampling, persistence, and result rendering.
- Frequent `console.debug` in `CameraView.jsx` can be noisy during camera operation, although not a production blocker if minified.
- Time-series sampling is efficient, but feature extraction and UI quality state still sync every 100 ms.
- Browser ONNX is separate but should expose latency metrics and adaptive interval state.

## 7. Existing Bugs / Gaps

- Quality status messages are long in some paths and not centralized into one short user-facing status.
- Voice guidance has no quality-status cooldown wrapper. The audio service stops previous speech on every `speak()`, so frame-level calls would spam if added naively.
- `validateEyeTrackingQuality()` reports `irisValid` as one-eye valid in some cover contexts; general AI eligibility needs both irises.
- Head pose is binary `VALID/INVALID`; warning state is not represented.
- ROI utilities exist, but the named API requested by the task, `getEyeROI(landmarks, side)`, does not exist.
- Dev-only training capture exists in partial form through dataset/session services, but the exact `session/metadata.json`, `landmarks.json`, `quality.json`, `phases.json`, `left-eye`, `right-eye`, `both-eyes` structure is not implemented.

## 8. Proposed Architecture

Recommended runtime pipeline:

```text
Camera
  -> rVFC/rAF single-frame scheduler
  -> FaceMesh landmarks
  -> eye/iris feature extraction with One Euro smoothing
  -> blink + occlusion + head pose + distance + FPS quality gate
  -> compact UI/voice guidance
  -> Cover Test recorder and kinematics
  -> adaptive AI inference only for valid non-Cover frames
  -> backend persistence once per completed session
```

Quality gate must drop bad frames, not fail the session, unless invalid tracking persists across a recovery threshold.

## 9. Files Cần Sửa

- `src/services/eyeFeatureService.js`
- `src/hooks/useEyeTracking.js`
- `src/components/CameraQualityStatus.jsx` (new)
- `src/components/CameraView.jsx`
- `src/components/binocular/BinocularVisionScreening.jsx`
- `src/hooks/useStrabismusAI.js`
- `src/services/cv/eyeRoiService.js`
- `src/services/coverTestTimeSeriesService.js`
- `src/services/coverTestProtocolService.js`
- `src/components/debug/CoverTestDebugPanel.jsx`
- `src/constants/screeningConfig.js`

## 10. Files Không Nên Sửa

- Backend model files and clinical thresholds in `D:\REMICARE-STRABISMUS-AI\models` / `app\models`.
- Backend API contracts unless frontend payload additions reveal a strict validation failure.
- `public/models/strabismus_model.onnx`.
- `package-lock.json` unless dependency changes are strictly required.
- Existing clinical documents unless the clinical protocol changes.
