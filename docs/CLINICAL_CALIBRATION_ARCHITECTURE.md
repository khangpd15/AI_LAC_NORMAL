# Clinical calibration architecture

## Safety boundary

Production calibration is disabled by default. A webcam measurement is never converted to prism diopters unless all of the following are true:

1. The measurement passes the engineering quality gate.
2. A model artifact and matching metadata are registered.
3. Runtime calibration is explicitly enabled.
4. Model status is `CLINICALLY_VALIDATED`.
5. Metadata contains `clinicalValidationStatus: "VALIDATED"` and `productionEnabled: true`.

Otherwise the result contains null clinical values and is `NOT_CALIBRATED` or `INSUFFICIENT_DATA`.

## Data separation

- Raw webcam data: landmarks, iris centres, eye corners, timestamps, head pose and frame quality. Raw frames are not exported.
- Computed webcam features: normalized displacement, X/Y movement, peak velocity, time to peak, stability, eye width and sample count.
- Clinical reference: examiner-recorded PACT horizontal/vertical prism values and directions. These values are never inferred during data collection.

## Research pipeline

`/research/clinical-calibration` collects pseudonymous, consented paired records in memory. JSON/CSV export is an explicit user action. Subject-level deterministic splitting prevents a subject from appearing in multiple partitions. The baseline model is multi-output ridge regression and refuses training below the configured subject count or with missing features/PACT targets.

Validation reports MAE, RMSE, R², bias and 95% limits of agreement for horizontal and vertical PACT values. Subgroup analysis is available by age, distance, device and deviation magnitude. Model metadata and artifacts are versioned separately.

## Existing architecture reused

- `coverTestMeasurementService`: primary movement features and quality.
- `eyeFeatureService`: normalized eye geometry.
- `fusionService`: unchanged screening aggregation.
- `calibrationService`: backward-compatible entry point, now delegated through the production guard.
- Brock String and Static Eye Measurement: independent and excluded from PACT prediction.

Clinical calibration remains screening support and is not a diagnosis.
