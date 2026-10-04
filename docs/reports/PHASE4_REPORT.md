# Phase 4 Report - Backend Geometry + Cover Experimental

Backend path: `D:\REMICARE-STRABISMUS-AI`

## Scope

Implemented a versioned, research-only backend measurement branch. The existing production endpoints and models remain unchanged:

- `/api/v1/strabismus/predict` was not changed.
- `strabismus_inference_service.py` was not changed.
- ONNX/model artifacts and thresholds were not changed.
- New Cover result remains `EXPERIMENTAL` and never returns `SCREENING_NORMAL`.

## Backend Files Added

- `app/api/research_measurement.py`
- `app/schemas/research_measurement.py`
- `app/services/research_measurement_service.py`
- `tests/research/test_research_measurement_service.py`

## Backend Files Modified

- `app/config.py`
  - Added `ENABLE_RESEARCH_MEASUREMENT_API`.
- `app/main.py`
  - Registered one new route group: `/api/v1/research/measurements`.

## API Added

`POST /api/v1/research/measurements`

One endpoint accepts:

- `testType: HIRSCHBERG`
- `testType: COVER`

Request requires:

- `schemaVersion`
- `featureVersion`
- `testType`
- `sessionId`
- `distance_bucket`
- `eligibility.consent`
- `eligibility.ageYears`
- `eligibility.redFlag`

Eligibility validation blocks:

- missing research consent
- age under 7
- red flag present

Errors are returned with safe codes such as:

- `INVALID_REQUEST`
- `INVALID_LANDMARKS`
- `TIMESERIES_INVALID`
- `LOW_QUALITY_INPUT`
- `FEATURE_CONTRACT_MISMATCH`
- `INFERENCE_ERROR`

## Hirschberg Server Measurement

Implemented server-side measurement from original image + landmarks:

- decodes image data URL/base64
- validates max bytes and pixels
- uses one backend implementation to locate bright reflex candidates in iris ROI
- requires exactly one reflex candidate per eye
- computes normalized Hirschberg displacement:

```text
delta_px_eye = s_eye * (reflex_x_px - iris_center_x_px)
h_eye        = delta_px_eye / iris_diameter_px
delta_h      = h_OD - h_OS
```

Sign convention:

- `+` nasal
- `-` temporal
- `delta_h = h_OD - h_OS`

No diagnostic threshold is applied. Output remains `INCONCLUSIVE` / `MEASUREMENT_ONLY` because distance-bucket thresholds are still `TODO_PILOT`.

## Cover Experimental Measurement

Implemented rule-based Cover analysis from timestamped samples:

- validates strictly increasing timestamps
- detects large timestamp gaps
- rejects low quality via `validFrameRatio` and `trackingConfidence`
- computes normalized horizontal position from iris x and canthi
- estimates baseline median
- computes peak amplitude, direction, velocity, latency, and gap count
- result is always experimental

Cover can return:

- `REVIEW_REQUIRED` when amplitude exceeds `TODO_PILOT` threshold
- `MEASUREMENT_ONLY`
- `LOW_QUALITY_INPUT`
- `TIMESERIES_INVALID`

It does not return normal/clear screening.

## Tests

Commands run from `D:\REMICARE-STRABISMUS-AI`.

The backend `.venv` Python launcher is stale and points to a missing Python path, so tests were run with bundled Codex Python plus backend site-packages:

```powershell
$bundle='C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\Lib\site-packages'
$env:PYTHONPATH="D:\REMICARE-STRABISMUS-AI;$bundle;D:\REMICARE-STRABISMUS-AI\.venv\Lib\site-packages"
& 'C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m pytest -q
```

Result:

- `6 passed`
- `1 skipped`
- `1 warning` about `.pytest_cache` write permission

Additional syntax check:

- in-memory compile check passed for changed backend files.

`app.main` import could not be verified in this mixed runtime because the venv `greenlet` binary wheel is incompatible with bundled Python. This is an environment limitation; full app import should be verified in the backend's real deployment/runtime Python.

## TODO_PILOT Thresholds

Still not production-approved:

- Hirschberg distance bucket thresholds
- Cover amplitude threshold
- Cover valid frame/tracking confidence thresholds
- timestamp gap threshold
- server-side reflex candidate pixel thresholds

## Not Done

- No DB table or migration was added.
- No production model registry change.
- No model training.
- No truth-table aggregation of Hirschberg + Cover because the table is not approved.
- No frontend call to the new backend endpoint yet.
- No clinical validation; synthetic tests are code tests only.

## Stop Point

Phase 4 backend measurement branch is complete. Stop here before Phase 5 data-collection/training pipeline work.
