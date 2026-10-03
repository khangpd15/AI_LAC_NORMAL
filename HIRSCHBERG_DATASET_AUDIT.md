# Hirschberg Dataset Audit - `data_hirschberg`

Backend folder inspected: `D:\REMICARE-STRABISMUS-AI\data_hirschberg\eye-classification`

## Summary

Found 696 JPEG images in a pre-split folder layout:

```text
eye-classification/
  train/
    ESOTROPIA/
    EXOTROPIA/
    NORMAL/
  val/
    ESOTROPIA/
    EXOTROPIA/
    NORMAL/
  test/
    ESOTROPIA/
    EXOTROPIA/
    NORMAL/
```

However, `test/NORMAL` currently contains no images.

## Counts

| Split | ESOTROPIA | EXOTROPIA | NORMAL | Total |
|---|---:|---:|---:|---:|
| train | 171 | 189 | 142 | 502 |
| val | 37 | 40 | 38 | 115 |
| test | 38 | 41 | 0 | 79 |
| total | 246 | 270 | 180 | 696 |

## Image Format

- File extension: `.jpg`
- Decode errors: 0
- Resolution: all images are `224x224`
- Mode: all `RGB`
- Format: all `JPEG`
- Exact SHA-256 duplicate groups: 0
- Exact cross-split duplicate groups: 0

## Leakage / Split Risk

There are 117 label+basename groups repeated across splits.

Examples:

- `test\ESOTROPIA\esotropia_003.jpg`
- `train\ESOTROPIA\esotropia_003.jpg`
- `val\ESOTROPIA\esotropia_003.jpg`

They are not byte-identical, but repeated names across splits strongly suggest the current split may not be patient-level or may contain related variants. There is no participant manifest in the dataset folder, so patient-level leakage risk is `UNKNOWN/HIGH`.

## Visual Audit

Created montage:

`D:\AI_Check_Lac\hirschberg_dataset_montage.jpg`

Visual notes:

- Images appear to be pre-cropped eye/face-region images, not original full-resolution Hirschberg capture frames.
- Gaze direction varies across samples.
- Lighting, color balance, and image quality vary substantially.
- Some examples are grayscale/low contrast or heavily blurred.
- Corneal reflex is visible in some images but not consistently controlled as exactly one small point per iris.

## Clinical / Protocol Suitability

Not enough evidence yet to use as a validated Hirschberg training dataset.

Known/observed issues:

- No participant IDs.
- No consent manifest found.
- No doctor/orthoptist label manifest found in the folder; labels are inferred from directory names only.
- No exam date, exam method, intermittency, glasses group, or pseudostrabismus metadata.
- No evidence that the images were captured with RemiCare protocol: rear camera, fixed phone, 20-25 cm, small light source near camera, straight gaze, original frame preserved.
- Existing test split has no NORMAL class, so specificity/NPV cannot be evaluated from `test` as-is.

## Can It Be Used?

### Safe uses now

- Exploratory detector/quality gate testing.
- Exploratory image-classifier prototype only, clearly marked non-clinical.
- Pretraining/augmentation experiments only after user approval and with no clinical claims.

### Not safe yet

- Not safe for choosing Hirschberg reflex displacement thresholds.
- Not safe for clinical sensitivity/specificity reporting.
- Not safe for production model replacement.
- Not safe for patient-independent evaluation unless participant IDs or a patient-level split manifest is provided.

## Required Before Training A Hirschberg AI Candidate

Provide or create:

1. `participant_id` for every image.
2. A doctor/orthoptist label manifest with:
   - `participant_id`
   - `image_path`
   - `label_source`
   - `exam_date`
   - `horizontal_strabismus_type`
   - `intermittent`
   - `glasses_group`
   - `pseudostrabismus`
   - `exam_method`
3. Research consent status.
4. Protocol/domain field:
   - `hirschberg_cover_protocol_v1` if captured with the RemiCare Hirschberg protocol.
   - `legacy_non_hirschberg` if not.
5. A patient-level train/val/test split.

## Recommendation

Do not train the clinical Hirschberg model yet.

Folder-label manifest has now been generated from the directory labels using the user's statement that the labels were previously doctor-confirmed by an organization.

Generated files:

- `D:\AI_Check_Lac\manifests\hirschberg_folder_labels.csv`
- `D:\AI_Check_Lac\manifests\hirschberg_folder_labels.jsonl`
- `D:\AI_Check_Lac\manifests\hirschberg_folder_labels_summary.json`

Manifest provenance:

```text
label_source = user_attested_doctor_confirmed_folder_label
domain = legacy_or_unknown_hirschberg_crop
participant_id = UNKNOWN
training_use = exploratory_only_until_participant_id_and_protocol_are_confirmed
```

The generated split is by `group_id = class_label + filename stem`, so same basename variants no longer cross train/val/test.

Generated split counts:

| Generated split | ESOTROPIA | EXOTROPIA | NORMAL | Total |
|---|---:|---:|---:|---:|
| train | 163 | 173 | 131 | 467 |
| val | 35 | 45 | 24 | 104 |
| test | 48 | 52 | 25 | 125 |

Generated cross-split group leakage: 0.

Remaining blocker: without actual participant IDs, this still cannot prove patient-level independence.
