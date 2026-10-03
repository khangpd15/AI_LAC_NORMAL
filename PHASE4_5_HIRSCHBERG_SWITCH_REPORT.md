# Phase 4.5 Report - Replace Gaze4Directions With Hirschberg

## Scope

Before Phase 5, the frontend "Gaze4Directions" step was changed into a single straight-gaze Hirschberg photo step.

The internal React component name remains `Gaze4DirectionsStep.jsx` to keep imports stable, but the user-facing protocol and behavior are now Hirschberg.

## Changed Behavior

- No longer captures left/right/up/straight 4-direction motility photos.
- Captures one original straight-gaze Hirschberg frame.
- Uses 20-25 cm position guidance for the Hirschberg step.
- Runs the existing client quality gate for:
  - face/eyes/iris visibility
  - distance
  - focus/exposure/reflex quality metadata
  - fixation stability
- Sends original frame + landmarks + eligibility metadata to:

```text
POST /api/v1/research/measurements
```

with:

```text
testType = HIRSCHBERG
schemaVersion = remicare-research-quality-v0.1
featureVersion = research-geometry-v0.1
```

## Important Safety Decision

The old bilateral ROI image model endpoint is no longer called from this step:

```text
POST /api/v1/strabismus/predict
```

That model and endpoint still exist, but the Hirschberg step now records:

```text
screening_status = HIRSCHBERG_MEASUREMENT_ONLY
status = INCONCLUSIVE
```

This avoids pretending the Hirschberg research measurement is a validated diagnostic classifier.

## Files Modified

- `src/components/binocular/Gaze4DirectionsStep.jsx`
- `src/components/binocular/BinocularVisionScreening.jsx`
- `src/components/binocular/ScreeningProgress.jsx`
- `src/components/binocular/FinalScreeningResult.jsx`
- `src/constants/binocularScreeningConfig.js`
- `src/services/cv/gaze4DirectionsQualityGate.js`
- `src/services/binocularScreeningService.js`
- `src/api/index.js`

## Files Added

- `src/api/researchMeasurementApi.js`

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

## Remaining TODO

- Live device validation with camera permission is still required.
- Backend must be running with the Phase 4 route enabled for Hirschberg measurement to complete.
- Distance/reflex thresholds remain `TODO_PILOT`.
- Final clinical aggregation still treats Hirschberg as measurement-only.
