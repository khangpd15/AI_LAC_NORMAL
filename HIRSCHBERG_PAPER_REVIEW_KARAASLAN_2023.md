# Paper Review - Karaaslan et al. 2023 Hirschberg Method

Paper:

`A new method based on deep learning and image processing for detection of strabismus with the Hirschberg test`

## What The Paper Does

The paper automates Hirschberg measurement from frontal face images:

1. Capture frontal facial image with phone camera and phone flash.
2. Use MediaPipe Face Mesh to locate facial/eye/iris landmarks.
3. Crop eye/iris regions.
4. Detect corneal light reflection using thresholding and contour analysis.
5. Detect pupil and pupil center using HSV/image-processing steps.
6. Measure displacement between corneal reflection centroid and pupil center.
7. Convert displacement to degrees using their mathematical model.

Reported dataset:

- 88 strabismic patients.
- Ages 2-35.
- 3024x4032 RGB facial images.
- 12 MP mobile phone camera.
- Phone back flash used as light source.
- Patient looks directly into camera lens.

Reported region detection performance:

- Eye detection: 100% right, 100% left.
- Iris detection: 100% right, 100% left.
- Pupil detection: 90% right, 91% left.
- Reflected light detection: 98% right, 98% left.

## Directly Useful For RemiCare

### 1. Keep The Hybrid Geometry Pipeline

This paper supports the direction already chosen in Phase 4:

- Use MediaPipe for landmarks/eye ROI.
- Use image processing for corneal reflex detection.
- Do the measurement on the backend with one implementation.
- Treat successful detection of pupil/reflex as a quality gate before any interpretation.

### 2. Add Pupil Center Detection As A Backend Measurement Option

Current RemiCare Phase 4 measurement uses iris geometry and corneal reflex. The paper argues that MediaPipe iris center can differ from pupil center, so pupil center detection can improve Hirschberg measurement.

Implementation idea:

- Add backend OpenCV/NumPy pupil detector inside eye ROI.
- Use HSV or grayscale thresholding to segment the pupil.
- Return both:
  - `iris_center`
  - `pupil_center`
- Compare:
  - `h_iris = (reflex_x - iris_center_x) / iris_diameter`
  - `h_pupil = (reflex_x - pupil_center_x) / iris_diameter`
- Keep both as research measurements until validation.

### 3. Improve Reflex Detection

The paper uses multiple thresholds for bright reflection detection. RemiCare currently uses saturated bright components. A paper-inspired backend improvement:

- Try thresholds around high luma / saturation bands.
- Keep connected components only inside iris/pupil ROI.
- Prefer the bright component nearest the expected iris/pupil vertical center.
- Return `REFLEX_NOT_FOUND` or `MULTIPLE_REFLEX` rather than forcing a result.

### 4. Track Detector Success Metrics Separately From Classifier Metrics

Paper reports eye/iris/pupil/reflex detection success separately. RemiCare should add a report for:

- face detected
- both eyes detected
- iris ROI detected
- pupil center detected
- exactly one reflex per eye
- usable measurement rate per distance bucket/device/lighting setup

These metrics are more appropriate than clinical sensitivity/specificity before a validated clinical dataset exists.

### 5. Distance Experiment Should Include A 50 cm Bucket

The paper uses 50 cm. RemiCare currently pilots 20-25 cm. Do not switch automatically, but add 50 cm as a research distance bucket if the user wants a comparison:

- `TARGET_20_25_CM`
- `TARGET_50_CM_PAPER_REFERENCE`

Report quality and repeatability by bucket. Do not choose the final distance automatically.

## Not Safe To Copy Directly

### Do Not Adopt Degree/PD Conversion Yet

The paper uses assumptions such as conversion from mm to degrees/prism diopters. RemiCare should not copy these constants without calibration because:

- phone optics differ,
- subject distance differs,
- crop/original resolution differs,
- 2D images approximate a 3D eye,
- RemiCare scope is screening/research, not clinical angle measurement.

### Do Not Use The Paper As Proof That Our 224x224 Crop Dataset Is Clinically Sufficient

The paper used original high-resolution frontal facial images. Our current `data_hirschberg` folder contains 224x224 crops. These can help train exploratory image classifiers, but they are not equivalent to the paper's full-frame Hirschberg capture protocol.

### Do Not Treat This As A Production Validation

The paper reports region-detection success on 88 strabismic patients. It does not automatically validate RemiCare's camera, lighting, distance, dataset, or clinical thresholds.

## Recommended RemiCare Next Step

Create a Phase 6A technical improvement:

1. Add backend pupil-center detector.
2. Add paper-inspired reflex detector variants.
3. Add a detector-quality benchmark on `data_hirschberg`.
4. Keep output as `MEASUREMENT_ONLY` / `INCONCLUSIVE`.
5. Do not update production model.

Then optionally create Phase 6B:

1. Train exploratory Hirschberg classifier on the folder-labeled crop dataset.
2. Store artifact as `research_candidate`.
3. Report as non-production and non-clinical.
