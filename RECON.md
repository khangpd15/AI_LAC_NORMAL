# RECON - Phase 0 RemiCare Strabismus AI

Date: 2026-10-03

Scope: read-only reconnaissance for `FE/ = D:/AI_Check_Lac/` and `BE/ = D:/REMICARE-STRABISMUS-AI/`.

This file follows `NCKH.md` Phase 0 only. No application code, model artifact, migration, training pipeline, or production deployment was changed.

## 1. Current Frontend Stack

- FE is a Vite + React app. Evidence: `FE/package.json:6` defines `dev`, `build`, `lint`, `test`; dependencies include `react`, `react-dom`, and `onnxruntime-web` at `FE/package.json:13`.
- API base URL is resolved from `VITE_AI_BACKEND_URL`, falling back to `http://localhost:8000`. Evidence: `FE/src/api/client.js:14`, `FE/src/api/client.js:26`.
- The screening UI uses MediaPipe Face Mesh from CDN, with `refineLandmarks: true` to unlock iris landmarks. Evidence: `FE/src/services/faceMeshService.js:5`, `FE/src/services/faceMeshService.js:70`, `FE/src/services/faceMeshService.js:74`.

## 2. Current Frontend Screening Flow

- The main binocular flow uses `Gaze4DirectionsStep` before the cover test; it captures LEFT, RIGHT, UP, and STRAIGHT gaze. Evidence: `FE/src/components/binocular/Gaze4DirectionsStep.jsx:12`.
- The STRAIGHT gaze capture extracts a bilateral eye ROI and sends it to the backend image model. Evidence: `FE/src/components/binocular/Gaze4DirectionsStep.jsx:162`, `FE/src/components/binocular/Gaze4DirectionsStep.jsx:165`, `FE/src/components/binocular/Gaze4DirectionsStep.jsx:176`.
- If no valid bilateral eye ROI exists, FE skips full-face upload and returns an `INCONCLUSIVE` local fallback. Evidence: `FE/src/components/binocular/Gaze4DirectionsStep.jsx:202`.
- Cover Test samples live eye features during `BASELINE` and `TRACKING`, then records timestamped time-series frames. Evidence: `FE/src/components/binocular/CoverTestStep.jsx:499`, `FE/src/components/binocular/CoverTestStep.jsx:515`.
- Cover Test UI sends raw Cover Test data to the configured FastAPI backend and shows retry UI when that call fails. Evidence: `FE/src/components/binocular/CoverTestStep.jsx:1085`, `FE/src/components/binocular/CoverTestStep.jsx:1091`.

## 3. Camera and MediaPipe Timing

- Default camera constraints currently use `facingMode: 'user'`, not rear camera. Evidence: `FE/src/services/cameraService.js:49`, `FE/src/services/cameraService.js:63`, `FE/src/services/cameraService.js:74`.
- Camera startup calls `navigator.mediaDevices.getUserMedia` through fallback constraint candidates. Evidence: `FE/src/services/cameraService.js:98`, `FE/src/services/cameraService.js:111`, `FE/src/services/cameraService.js:135`.
- The MediaPipe loop supports `requestVideoFrameCallback` and falls back to `requestAnimationFrame`. Evidence: `FE/src/hooks/useFaceMesh.js:171`, `FE/src/hooks/useFaceMesh.js:349`, `FE/src/hooks/useFaceMesh.js:371`.
- The loop passes `metadata.presentationTime` where available and attaches it to FaceMesh results. Evidence: `FE/src/hooks/useFaceMesh.js:211`, `FE/src/hooks/useFaceMesh.js:358`.

## 4. Frontend API Calls

- Image AI call uses `POST /api/v1/strabismus/predict` with multipart `image`. Evidence: `FE/src/api/strabismusApi.js:4`, `FE/src/api/strabismusApi.js:57`, `FE/src/api/strabismusApi.js:64`.
- Strabismus model health call uses `GET /api/v1/strabismus/health`. Evidence: `FE/src/api/strabismusApi.js:92`, `FE/src/api/strabismusApi.js:98`.
- The legacy/local web ONNX metadata declares model version `1.0.0`, target `onnxruntime-web`, input shape `[1,10]`, and `decisionThreshold` `0.5`. Evidence: `FE/public/models/model_metadata.json:2`, `FE/public/models/model_metadata.json:5`, `FE/public/models/model_metadata.json:11`, `FE/public/models/model_metadata.json:57`.

## 5. Current Backend Stack and Routes

- BE is a FastAPI service. Evidence: `BE/app/main.py:11`, `BE/app/main.py:89`.
- Startup lifespan initializes DB, preloads transfer/Cover model service, and preloads the bilateral strabismus ONNX service. Evidence: `BE/app/main.py:42`, `BE/app/main.py:47`, `BE/app/main.py:52`, `BE/app/main.py:64`.
- Routers registered today: transfer router, legacy cover-test router, v1 cover-test router, and strabismus image router. Evidence: `BE/app/main.py:165`.
- System health endpoints exist at `/health/db` and `/health`. Evidence: `BE/app/main.py:193`, `BE/app/main.py:204`.
- The image router prefix is `/api/v1/strabismus`, with `GET /health` and `POST /predict`. Evidence: `BE/app/api/strabismus.py:20`, `BE/app/api/strabismus.py:32`, `BE/app/api/strabismus.py:53`.
- The Cover Test v1 router is mounted under `/api/v1/cover-test` by `main.py`, while the router itself exposes `/sessions`. Evidence: `BE/app/main.py:170`, `BE/app/api/cover_test.py:18`, `BE/app/api/cover_test.py:21`.

## 6. Current Backend Image Model

- Current image model default filename: `best_model.onnx`. Evidence: `BE/app/services/strabismus_inference_service.py:35`.
- Current image model version: `remicare-bilateral-resnet18-v1`. Evidence: `BE/app/services/strabismus_inference_service.py:36`.
- Current image threshold: `0.20`, with `probability >= 0.20 -> SUSPICIOUS`. Evidence: `BE/app/services/strabismus_inference_service.py:37`, `BE/app/services/strabismus_inference_service.py:347`.
- Image model expects a bilateral ocular ROI, not a full face image, and preprocesses to 224x224 RGB with ImageNet normalization. Evidence: `BE/app/services/strabismus_inference_service.py:52`, `BE/app/services/strabismus_inference_service.py:186`, `BE/app/services/strabismus_inference_service.py:197`.
- Full face style images can be rejected by a defensive ROI contract. Evidence: `BE/app/services/strabismus_inference_service.py:63`, `BE/app/services/strabismus_inference_service.py:261`.
- Low quality image input returns `INCONCLUSIVE`; it is not forced to `NORMAL`. Evidence: `BE/app/services/strabismus_inference_service.py:290`, `BE/app/services/strabismus_inference_service.py:305`.
- Model load is singleton-based and resident in RAM after first creation. Evidence: `BE/app/services/strabismus_inference_service.py:396`, `BE/app/services/strabismus_inference_service.py:400`.
- UNKNOWN: ONNX graph input dimension beyond runtime input name was not inspected in Phase 0. The service logs `input_name`, but does not expose full tensor shape in the lines read. Evidence: `BE/app/services/strabismus_inference_service.py:173`, `BE/app/services/strabismus_inference_service.py:175`.

## 7. Current Backend Cover/FPS Model

- Current Cover/FPS candidate service loads `remicare_15fps_candidate.joblib`. Evidence: `BE/app/services/fps_model_service.py:1`, `BE/app/services/fps_model_service.py:32`.
- Default Cover/FPS contract lists 14 features. Evidence: `BE/app/services/fps_model_service.py:37`.
- The service validates model `n_features_in_` against feature name count during load and validates vector length during inference. Evidence: `BE/app/services/fps_model_service.py:131`, `BE/app/services/fps_model_service.py:179`.
- If the FPS model is not loaded, `predict_window` returns `INCONCLUSIVE` with `MODEL_NOT_LOADED`. Evidence: `BE/app/services/fps_model_service.py:155`.
- Existing tests cover missing required features and model-not-loaded behavior. Evidence: `BE/tests/model/test_fps_model_contract.py:16`, `BE/tests/model/test_fps_model_contract.py:46`.
- The current Cover Test session service persists raw numeric trajectory data and then optionally runs the 10-15 FPS model. Evidence: `BE/app/services/cover_test/session_service.py:247`, `BE/app/services/cover_test/session_service.py:378`.
- Korean transfer/comparison results are added for research comparison only in the current persistence flow. Evidence: `BE/app/services/cover_test/session_service.py:409`, `BE/app/services/cover_test/session_service.py:436`.

## 8. Current Database and Persistence

- DB uses SQLAlchemy async engine/session and supports SQLite fallback when no DB URL is configured. Evidence: `BE/app/db/database.py:10`, `BE/app/db/database.py:38`, `BE/app/db/database.py:98`.
- PostgreSQL/Supabase pooler compatibility is handled by URL formatting/connect args. Evidence: `BE/app/db/database.py:38`, `BE/app/db/database.py:59`.
- Startup calls `Base.metadata.create_all` and a non-destructive auto-migrate helper. Evidence: `BE/app/db/database.py:179`, `BE/app/db/database.py:182`.
- `strabismus_screenings` stores metadata only, with no image binary/base64. Evidence: `BE/app/db/models/strabismus_model.py:12`, `BE/app/db/models/strabismus_model.py:13`.
- `strabismus_screenings` fields include status, probability, confidence, quality score, threshold, model version, latency, `image_saved`, and failure reason. Evidence: `BE/app/db/models/strabismus_model.py:22`.
- `cover_test_sessions` stores session metadata, source device, tracker, raw schema version, storage root, processing status, and client metadata. Evidence: `BE/app/db/models/cover_test_session.py:50`, `BE/app/db/models/cover_test_session.py:57`.
- Cover Test v1 endpoint explicitly ignores representative/facial images for privacy and requires at least one raw trajectory JSON. Evidence: `BE/app/api/cover_test.py:43`, `BE/app/api/cover_test.py:77`, `BE/app/api/cover_test.py:83`.

## 9. Phase 0 File Map

### FE files read

- `FE/package.json`
- `FE/public/models/model_metadata.json`
- `FE/src/api/client.js`
- `FE/src/api/strabismusApi.js`
- `FE/src/components/binocular/Gaze4DirectionsStep.jsx`
- `FE/src/components/binocular/CoverTestStep.jsx`
- `FE/src/hooks/useFaceMesh.js`
- `FE/src/services/cameraService.js`
- `FE/src/services/faceMeshService.js`

### BE files read

- `BE/app/main.py`
- `BE/app/api/strabismus.py`
- `BE/app/api/cover_test.py`
- `BE/app/services/strabismus_inference_service.py`
- `BE/app/services/fps_model_service.py`
- `BE/app/services/cover_test/session_service.py`
- `BE/app/db/database.py`
- `BE/app/db/models/strabismus_model.py`
- `BE/app/db/models/cover_test_session.py`
- `BE/tests/model/test_fps_model_contract.py`

## 10. Files Likely To Change In Later Phases

Only after explicit approval for later phases:

- FE checklist/camera flow: `FE/src/components/binocular/`, `FE/src/services/cameraService.js`, likely a new config file under `FE/src/constants/`.
- FE quality gate/reflex metadata: `FE/src/services/cv/`, `FE/src/hooks/useFaceMesh.js`, and API client files under `FE/src/api/`.
- BE research schema/validation: likely `BE/app/schemas/`, `BE/app/api/`, `BE/app/services/`, and tests under `BE/tests/`.
- BE Hirschberg/Cover research services: likely new isolated service modules, not current production image model service.
- DB changes: only if approved after schema audit; candidates are `BE/app/db/models/`, `BE/app/db/repositories/`, and `BE/migrations/`.

## 11. Files Not To Change For Phase 0

- Do not change `BE/app/services/strabismus_inference_service.py` or `BE/app/models/best_model.onnx` for Phase 0. Current image model and `/api/v1/strabismus/predict` must remain compatible.
- Do not change `BE/app/services/fps_model_service.py` feature order or model artifacts for Phase 0.
- Do not run migrations, training, threshold tuning, or deployment.
- Do not create a new endpoint or DB table during Phase 0.

## 12. Key Gaps / UNKNOWN

- UNKNOWN: approved clinical truth table for combining Hirschberg + Cover into `SCREENING_NORMAL`, `REVIEW_REQUIRED`, `INCONCLUSIVE`, `QUALITY_FAIL`, `SYSTEM_ERROR`.
- UNKNOWN: approved pediatric upper age limit; only lower bound is described in `NCKH.md`.
- UNKNOWN: approved red-flag question list.
- UNKNOWN: approved glasses policy.
- UNKNOWN: pilot thresholds for Hirschberg displacement, Cover amplitude/velocity, distance buckets, image resolution, retry limits, and quality fail boundaries.
- UNKNOWN: whether existing backend datasets have consent and ground truth suitable for any future training; Phase 0 did not audit dataset provenance.
- Current FE camera defaults to front camera; NCKH target flow wants rear camera in later phases. Evidence: `FE/src/services/cameraService.js:63`.

## 13. Phase 0 Conclusion

- UI/API/DB/model changed: No.
- Tests run: No; Phase 0 was recon only.
- Production model changed: No.
- Legacy `/api/v1/strabismus/predict` identified and left untouched.
- Backend folder resolved as `D:/REMICARE-STRABISMUS-AI/`, matching the actual directory on disk.

