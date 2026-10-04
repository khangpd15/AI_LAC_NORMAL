# Phase 5 Report - Data Collection + Training Pipeline Preparation

Backend path: `D:\REMICARE-STRABISMUS-AI`

## Scope

Phase 5 prepares research dataset and training-pipeline scaffolding only.

No model was trained. No production model, threshold, feature order, or `/predict` behavior was changed.

## Backend Files Added

- `scripts/research_dataset_pipeline.py`
- `scripts/train_research_model.py`
- `docs/research_dataset_schema.md`
- `tests/research/test_phase5_research_dataset_pipeline.py`

## Backend Files Modified

- `DATA_GOVERNANCE.md`
- `MODEL_REGISTRY.md`

## Dataset Pipeline Prepared

`scripts/research_dataset_pipeline.py` supports:

- participant-level manifest records
- research consent checks
- doctor/orthoptist label-field validation
- legacy-domain exclusion from training eligibility
- deterministic split by `participant_id`
- distance-experiment reporting:
  - focus pass ratio
  - exact one-reflex-per-eye ratio
  - `delta_h` distribution by bucket

The report explicitly does not choose a clinical distance or threshold.

## Training Scaffold Prepared

`scripts/train_research_model.py` creates a reproducibility plan only:

- seed
- dataset version
- feature version
- split policy
- metrics placeholders
- artifact path placeholder

Training is blocked by default with:

```text
TRAINING_REQUIRES_APPROVED_PROTOCOL_DATASET_AND_DOCTOR_LABELS
```

Even with `--allow-train`, the Phase 5 script has no training implementation and raises a guard error.

## Data Governance Updated

`DATA_GOVERNANCE.md` now documents:

- research-only consent requirements
- what may be stored for Hirschberg and Cover
- raw landmarks/video consent rule
- no model-output labels
- access control expectations
- pending retention policy
- deletion coverage
- participant-level split requirement
- `legacy_non_hirschberg` ban for threshold/training

## Model Registry Updated

`MODEL_REGISTRY.md` now includes a planned research placeholder:

```text
hirschberg-cover-research-v0.1
```

with null artifact, null threshold, null metrics, and feature version:

```text
research-geometry-v0.1
```

## Tests

Commands run from `D:\REMICARE-STRABISMUS-AI` using bundled Codex Python plus backend site-packages because the backend `.venv` launcher points to a missing Python executable.

```powershell
pytest tests\research -q
pytest -q
```

Results:

- Research tests: `8 passed`
- Full backend tests: `11 passed, 1 skipped`
- Warning: `.pytest_cache` write permission warning only

## Not Done

- No model training.
- No threshold selection.
- No production deployment.
- No DB migration/table creation.
- No use of legacy data for training.
- No use of model predictions as labels.

## Stop Point

Phase 5 preparation is complete. Training remains blocked until the user confirms an approved dataset with sufficient protocol data and clinician labels.
