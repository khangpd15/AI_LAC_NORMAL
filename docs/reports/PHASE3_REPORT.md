# Phase 3 Report - Frontend AI Detect & Quality Gate

## Scope

Phase 3 implements frontend research-quality gating and metadata preparation only. No backend model, diagnostic threshold, ONNX file, or clinical decision logic was changed.

Backend AI remains in `D:\REMICARE-STRABISMUS-AI`.

## Implemented

### Research Quality Config

- Added `RESEARCH_QUALITY_CONFIG` and `RESEARCH_QUALITY_STATUS` in `src/constants/researchScreeningConfig.js`.
- All quality thresholds are marked as `TODO_PILOT`.
- Config covers:
  - Distance target bucket `20-25 cm`
  - Focus/blur score
  - Exposure/backlight approximations
  - Head pose thresholds with yaw as the strictest axis
  - Corneal reflex candidate detection

### Client Quality Gate Module

Added `src/services/cv/researchQualityGate.js`.

The module produces quality metadata only. It does not compute diagnostic eye-deviation features and does not return a disease classification.

Checks included:

- Face and bilateral iris visibility
- Occlusion/blink warning
- Distance estimate and bucket
- Head pose quality
- Focus score from sampled video frame gradients
- Exposure statistics
- Coarse corneal reflex candidate count per eye
- Fixation/stability status from the existing gaze gate

### Gaze 4 Directions Capture

Updated `src/components/binocular/Gaze4DirectionsStep.jsx`.

Each capture now stores:

- `image`
- `originalFrame`
- existing `eyeRoi` for the current AI model
- landmarks
- `researchQuality`
- `backendResearchPayload`

Important compatibility decision:

- Existing diagnostic image endpoint still receives the bilateral eye ROI only.
- Full original Hirschberg frame is prepared as research metadata but not sent to the old image model endpoint.
- `backendResearchPayload.preparedOnly = true` because the Phase 4 backend endpoint is not implemented yet.

### Cover Test Time-Series Schema

Updated `src/services/coverTestTimeSeriesService.js`.

Each saved sample now additionally includes:

- `realTimestampMs`
- `trackEye`
- `iris_x`
- `eye_corner`
- `visibility`
- `phase`

This matches the research sequence requirement while preserving the existing fields used by current analysis.

### Cover Session Metadata

Updated `src/components/binocular/CoverTestStep.jsx`.

`clientMetadata` now includes:

- research quality schema version
- cover sequence field mapping
- threshold source `TODO_PILOT`

## Verification

Commands run:

```powershell
npm run build
npm run lint
npm test
```

Results:

- Build passed.
- Lint passed with existing React/compiler warnings.
- Tests passed.

## Not Done In Phase 3

- No backend research endpoint was added.
- No model retraining or threshold tuning was done.
- No clinical Hirschberg diagnostic logic was added to the frontend.
- Corneal reflex detection is a coarse quality signal and must be validated on real phone-camera data.
- Live reflex/focus behavior still needs Android/iOS device validation with controlled lighting.

## Stop Point

Phase 3 is complete. Stop here before Phase 4 backend API/storage integration.
