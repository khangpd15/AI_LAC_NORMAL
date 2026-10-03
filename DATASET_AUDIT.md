# DATASET_AUDIT - Phase 1 RemiCare Strabismus AI

Date: 2026-10-03

Scope: Phase 1 dataset audit after `RECON.md`. This audit is read-only for code/model/data behavior. It creates this report only and does not train, tune thresholds, migrate DB, or change production inference.

Dataset domain flag for all usable legacy research data found: `legacy_non_hirschberg`.

## 1. What Was Found

No clinical Hirschberg image dataset was found in the backend project. Recursive image search under `BE/ = D:/REMICARE-STRABISMUS-AI/` found only virtualenv/package sample images, not project data. The frontend project contains public/design images such as logos and illustrative assets, not labeled clinical eye images.

The project data found for audit is normalized Korean eye-tracker JSON under:

- `BE/data/normalized/korean/NORMAL/`
- `BE/data/normalized/korean/STRABISMUS/`

The conversion summary reports 41 total files, 41 successful, 0 failed, 20 normal files, 21 strabismus files, 62,404 total samples, and 5,351 invalid rows. Evidence: `BE/data/normalized/korean/conversion_report.json:2`, `BE/data/normalized/korean/conversion_report.json:3`, `BE/data/normalized/korean/conversion_report.json:4`, `BE/data/normalized/korean/conversion_report.json:5`, `BE/data/normalized/korean/conversion_report.json:6`, `BE/data/normalized/korean/conversion_report.json:7`, `BE/data/normalized/korean/conversion_report.json:8`.

## 2. Labels and Distribution

Observed JSON labels:

| Label | File count | Evidence |
|---|---:|---|
| `NORMAL` | 20 | `BE/data/normalized/korean/conversion_report.json:5` |
| `STRABISMUS` | 21 | `BE/data/normalized/korean/conversion_report.json:6` |

`BE/data/labels/labels.csv` is only a template and contains no real sample rows. It states valid labels should come from independent clinical examination ground truth, but no such rows are present in that file. Evidence: `BE/data/labels/labels.csv:1`, `BE/data/labels/labels.csv:2`, `BE/data/labels/labels.csv:3`, `BE/data/labels/labels.csv:4`.

The JSON files use a binary `STRABISMUS` label, not explicit approved RemiCare screening labels and not the final result enum from `NCKH.md`. Example evidence: a normal sample declares `label = NORMAL`, `source = KOREAN_EYE_TRACKER`, and `deviceType = INFRARED_EYE_TRACKER`; a strabismus sample declares `label = STRABISMUS` with the same source/device. Evidence: `BE/data/normalized/korean/NORMAL/korean_normal_김나현어머니1-정_all_gaze.json:2`, `BE/data/normalized/korean/NORMAL/korean_normal_김나현어머니1-정_all_gaze.json:3`, `BE/data/normalized/korean/NORMAL/korean_normal_김나현어머니1-정_all_gaze.json:4`, `BE/data/normalized/korean/NORMAL/korean_normal_김나현어머니1-정_all_gaze.json:5`, `BE/data/normalized/korean/STRABISMUS/korean_strabismus_김하연1-외_15_all_gaze.json:2`, `BE/data/normalized/korean/STRABISMUS/korean_strabismus_김하연1-외_15_all_gaze.json:3`, `BE/data/normalized/korean/STRABISMUS/korean_strabismus_김하연1-외_15_all_gaze.json:4`, `BE/data/normalized/korean/STRABISMUS/korean_strabismus_김하연1-외_15_all_gaze.json:5`.

## 3. Resolution / Image Properties

Image resolution audit: `UNKNOWN`.

Reason: no labeled clinical image files were found in project data. The usable files are JSON time-series eye coordinates. They include normalized coordinates such as `leftX`, `leftY`, `rightX`, `rightY` and validity flags, not image pixels or image dimensions. Evidence: `BE/data/normalized/korean/NORMAL/korean_normal_김나현어머니1-정_all_gaze.json:12`, `BE/data/normalized/korean/NORMAL/korean_normal_김나현어머니1-정_all_gaze.json:14`, `BE/data/normalized/korean/NORMAL/korean_normal_김나현어머니1-정_all_gaze.json:16`, `BE/data/normalized/korean/NORMAL/korean_normal_김나현어머니1-정_all_gaze.json:18`.

Visible corneal reflex audit: `UNKNOWN / not assessable`.

Reason: no raw eye images were present, so there is no pixel evidence to decide which images show a clear Hirschberg light reflex.

## 4. Person ID / Participant Risk

Likely participant identifiers exist in `sampleId` and filenames. The sample IDs include Korean name-like strings and repeated session suffixes such as 1/2/3. Evidence: `BE/data/normalized/korean/NORMAL/korean_normal_김나현어머니1-정_all_gaze.json:2`, `BE/data/normalized/korean/STRABISMUS/korean_strabismus_김하연1-외_15_all_gaze.json:2`.

A prior backend audit already reports participant-level leakage in the Korean data, with 2 overlapping participants between train and test. Evidence: `BE/docs/participant_leakage_report.md:3`, `BE/docs/participant_leakage_report.md:9`, `BE/docs/participant_leakage_report.md:10`, `BE/docs/participant_leakage_report.md:11`, `BE/docs/participant_leakage_report.md:12`, `BE/docs/participant_leakage_report.md:13`, `BE/docs/participant_leakage_report.md:19`, `BE/docs/participant_leakage_report.md:20`.

Implication: any future split must be participant-level, not session/file-level. Do not claim independent test performance from this dataset without fixing leakage.

## 5. Protocol and Domain Shift

This dataset is not Hirschberg protocol data and not RemiCare phone-camera Cover-Uncover data.

Existing backend documentation says the Korean source is an infrared binocular eye tracker, sampled around 60 Hz, in controlled lab conditions, using normalized infrared sensor coordinates, with a static fixation task and no Cover Test. Evidence: `BE/docs/training_audit_before_transfer.md:16`, `BE/docs/training_audit_before_transfer.md:20`, `BE/docs/training_audit_before_transfer.md:21`, `BE/docs/training_audit_before_transfer.md:22`, `BE/docs/training_audit_before_transfer.md:23`, `BE/docs/training_audit_before_transfer.md:24`, `BE/docs/training_audit_before_transfer.md:25`.

The same audit states RemiCare data uses consumer webcam + MediaPipe, around 15 Hz cover-test cycle sampling, natural head movement, variable lighting, video-frame coordinates, and structured Cover Test cycles. Evidence: `BE/docs/training_audit_before_transfer.md:48`, `BE/docs/training_audit_before_transfer.md:52`, `BE/docs/training_audit_before_transfer.md:53`, `BE/docs/training_audit_before_transfer.md:54`, `BE/docs/training_audit_before_transfer.md:55`, `BE/docs/training_audit_before_transfer.md:56`, `BE/docs/training_audit_before_transfer.md:57`.

Domain shift risk: HIGH.

Reason: infrared tracker static-fixation coordinates are materially different from phone/webcam Hirschberg images and RemiCare Cover-Uncover time series. The backend transfer service itself documents coordinate mismatch between Korean infrared viewport and RemiCare MediaPipe frame. Evidence: `BE/app/services/korean_transfer.py:8`, `BE/app/services/korean_transfer.py:10`, `BE/app/services/korean_transfer.py:11`, `BE/app/services/korean_transfer.py:12`, `BE/app/services/korean_transfer.py:13`.

Source/device/lighting confounding:

- Source and device type are uniform in the JSON files inspected: `KOREAN_EYE_TRACKER` and `INFRARED_EYE_TRACKER`. Evidence: `BE/data/normalized/korean/NORMAL/korean_normal_김나현어머니1-정_all_gaze.json:3`, `BE/data/normalized/korean/NORMAL/korean_normal_김나현어머니1-정_all_gaze.json:4`, `BE/data/normalized/korean/STRABISMUS/korean_strabismus_김하연1-외_15_all_gaze.json:3`, `BE/data/normalized/korean/STRABISMUS/korean_strabismus_김하연1-외_15_all_gaze.json:4`.
- Lighting, camera model, distance, glasses, consent, and clinical examiner metadata are `UNKNOWN` in the JSON files read.
- Normal and strabismus samples live in separate folders and appear to encode identity/session information in filenames; this is a leakage/shortcut risk even when device/source fields match.

## 6. Horizontal-Strabismus Scope

Files are grouped as binary `NORMAL` or `STRABISMUS`, not as approved RemiCare labels for horizontal-only screening.

Some filenames contain strings that may suggest inward/outward labels, but this audit does not convert filename text into clinical labels. Because the actual JSON label is only `STRABISMUS`, subtype and horizontal-only eligibility are `UNKNOWN` unless separately verified against source labels and clinician ground truth.

Backend training documentation says the original training source merged exotropia, esotropia, and hypertropia into binary `STRABISMUS`. Evidence: `BE/docs/training_audit_before_transfer.md:31`, `BE/docs/training_audit_before_transfer.md:32`, `BE/docs/training_audit_before_transfer.md:33`, `BE/docs/training_audit_before_transfer.md:34`, `BE/docs/training_audit_before_transfer.md:37`.

Therefore:

- Normal class: present.
- Strabismus class: present.
- Horizontal-only labels: `UNKNOWN` for this normalized 41-file set.
- Non-horizontal exclusion: cannot be completed from normalized JSON alone.

## 7. Allowed / Forbidden Use

Allowed use for this dataset:

- Exploratory engineering checks only.
- Testing parsers and feature extraction on legacy gaze JSON.
- Studying data quality, timestamp behavior, validity flags, and leakage risks.
- Research comparison clearly marked as transfer/legacy/non-Hirschberg.

Forbidden use for this dataset:

- Do not choose Hirschberg reflex displacement thresholds.
- Do not train a Hirschberg image model.
- Do not report clinical sensitivity/specificity from this set.
- Do not use model output as ground truth.
- Do not claim participant-independent generalization while leakage remains.
- Do not use this dataset to decide final RemiCare screening labels.

Existing backend documentation agrees that no clinical thresholds or diagnostic cutoffs are derived from the Korean infrared tracker audit, and model predictions are not medical diagnoses. Evidence: `BE/docs/training_audit_before_transfer.md:8`, `BE/docs/training_audit_before_transfer.md:9`, `BE/docs/training_audit_before_transfer.md:10`.

## 8. Missing Information To Ask User / Clinical Owner

- Where is the labeled clinical image dataset, if it exists? It was not found under `BE/data`.
- Who assigned labels, and by what clinical method/date?
- Is there signed consent allowing use for research, model development, and storage?
- Are original eye images/videos available, or only normalized JSON?
- Are labels horizontal-only, and are vertical/hypertropia cases excluded?
- Are glasses, lighting, camera/device, distance, age, and diagnosis metadata available?
- Should Korean legacy data remain available only as a transfer-learning comparison artifact?

## 9. Phase 1 Conclusion

- Dataset image audit completed: no labeled clinical images found.
- Legacy data found: 41 Korean infrared eye-tracker JSON files, 20 normal and 21 strabismus.
- Domain flag applied in this report: `legacy_non_hirschberg`.
- Corneal reflex visibility: `UNKNOWN`; no raw images to inspect.
- Ground truth quality: `UNKNOWN`; `labels.csv` is a template only.
- Leakage risk: present in prior backend audit; participant-level split required.
- UI/API/DB/model changed: No.
- Training/threshold selection performed: No.

