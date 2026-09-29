# RemiCare Feature Contract V1

> **Tài liệu Hợp đồng Đặc trưng — Feature Contract**
> *Phiên bản:* 1.0
> *Trạng thái:* Draft — Chưa implement / Chưa retrain model
>
> **Mục đích:** Định nghĩa chính tắc và duy nhất (single source of truth) cho mọi feature được dùng trong pipeline RemiCare, đảm bảo Python training script và JavaScript inference runtime sử dụng **cùng một mathematical definition**.
>
> **Quy tắc bắt buộc:**
> - Mọi thay đổi feature PHẢI được cập nhật ở đây trước.
> - Python (`training/extract_features.py`) và JavaScript (`src/services/eyeFeatureService.js`) phải được sửa **đồng thời**.
> - Sau khi sửa công thức feature, **phải retrain model** — không sửa một phía.
> - Chỉ sửa JS-side mà không retrain sẽ làm phân phối feature lệch ngược chiều → inference tệ hơn.

---

## Hệ tọa độ và quy ước chung

### Coordinate System

- **Nguồn dữ liệu:** MediaPipe Face Mesh với `refineLandmarks: true` (478 landmarks).
- **Hệ tọa độ:** Normalized image coordinates, góc trên-trái = (0, 0), góc dưới-phải = (1, 1).
- **Trục X:** Hướng sang phải trong ảnh (screen-right). Do webcam mirror, đây là bên **trái sinh học** của người dùng.
- **Trục Y:** Hướng xuống dưới trong ảnh (screen-down).
- **Lưu ý mirror:** MediaPipe thường trả về ảnh đã mirror theo chiều ngang. Cần xác nhận với cấu hình cụ thể của webcam và `selfie_mode` setting của MediaPipe.

### Landmark Index Reference

| Landmark | Index MediaPipe | Mô tả |
|:---------|:---------------:|:------|
| LEFT_IRIS_CENTER (OS) | 473 | Tâm mống mắt mắt trái (từ góc nhìn người dùng) |
| RIGHT_IRIS_CENTER (OD) | 468 | Tâm mống mắt mắt phải |
| LEFT_INNER_CORNER (OS) | 362 | Khóe mắt trong mắt trái |
| LEFT_OUTER_CORNER (OS) | 263 | Khóe mắt ngoài mắt trái |
| RIGHT_INNER_CORNER (OD) | 133 | Khóe mắt trong mắt phải |
| RIGHT_OUTER_CORNER (OD) | 33 | Khóe mắt ngoài mắt phải |
| LEFT_TOP_LID (OS) | 386 | Mi trên mắt trái |
| LEFT_BOTTOM_LID (OS) | 374 | Mi dưới mắt trái |
| RIGHT_TOP_LID (OD) | 159 | Mi trên mắt phải |
| RIGHT_BOTTOM_LID (OD) | 145 | Mi dưới mắt phải |
| LEFT_IRIS_BOUNDARY_TOP | 474 | Biên mống mắt trái — trên |
| LEFT_IRIS_BOUNDARY_BOTTOM | 476 | Biên mống mắt trái — dưới |
| LEFT_IRIS_BOUNDARY_LEFT | 475 | Biên mống mắt trái — trái |
| LEFT_IRIS_BOUNDARY_RIGHT | 477 | Biên mống mắt trái — phải |
| RIGHT_IRIS_BOUNDARY_TOP | 469 | Biên mống mắt phải — trên |
| RIGHT_IRIS_BOUNDARY_BOTTOM | 471 | Biên mống mắt phải — dưới |
| RIGHT_IRIS_BOUNDARY_LEFT | 470 | Biên mống mắt phải — trái |
| RIGHT_IRIS_BOUNDARY_RIGHT | 472 | Biên mống mắt phải — phải |
| NOSE_TIP | 1 | Đỉnh mũi |
| GLABELLA | 168 | Điểm giữa hai mày |

### Quy ước EAR Landmarks

| Landmark | Index |
|:---------|:-----:|
| LEFT_EAR_V1_TOP | 385 |
| LEFT_EAR_V1_BOT | 380 |
| LEFT_EAR_V2_TOP | 386 |
| LEFT_EAR_V2_BOT | 374 |
| RIGHT_EAR_V1_TOP | 158 |
| RIGHT_EAR_V1_BOT | 153 |
| RIGHT_EAR_V2_TOP | 159 |
| RIGHT_EAR_V2_BOT | 145 |

---

## Primitive Functions (Shared)

Các hàm toán học cơ bản phải có implementation **giống hệt nhau** trong Python và JavaScript:

### F-PRIM-01: projectPointOntoSegment

**Mục đích:** Tính tỉ lệ chiếu vector của một điểm lên đoạn thẳng (roll-invariant gaze ratio).

**Định nghĩa toán học:**

```
projectPointOntoSegment(pt, start, end):
  line_vec = end - start          # (lineDx, lineDy)
  pt_vec   = pt - start           # (ptDx, ptDy)
  len_sq   = dot(line_vec, line_vec)
  if len_sq < 1e-8: return 0.5
  ratio    = dot(pt_vec, line_vec) / len_sq
  return ratio  # không clamp — caller xử lý clamp nếu cần
```

**JavaScript (canonical implementation — `src/services/cv/gazeTracker.js`):**
```javascript
export function projectPointOntoSegment(pt, start, end) {
  if (!pt || !start || !end) return 0.5;
  const lineDx = end.x - start.x;
  const lineDy = end.y - start.y;
  const ptDx = pt.x - start.x;
  const ptDy = pt.y - start.y;
  const lineLenSq = lineDx * lineDx + lineDy * lineDy;
  if (lineLenSq < 1e-8) return 0.5;
  const projection = (ptDx * lineDx + ptDy * lineDy) / lineLenSq;
  return Number.isFinite(projection) ? projection : 0.5;
}
```

**Python equivalent (must match):**
```python
def project_point_onto_segment(pt, start, end):
    """
    Computes vector projection ratio of pt onto segment [start, end].
    Returns 0.5 if segment is degenerate.
    pt, start, end: dict or object with .x and .y attributes
    """
    line_dx = end['x'] - start['x']
    line_dy = end['y'] - start['y']
    pt_dx = pt['x'] - start['x']
    pt_dy = pt['y'] - start['y']
    line_len_sq = line_dx * line_dx + line_dy * line_dy
    if line_len_sq < 1e-8:
        return 0.5
    projection = (pt_dx * line_dx + pt_dy * line_dy) / line_len_sq
    return projection if (projection == projection) else 0.5  # NaN check
```

> **CRITICAL:** Bất kỳ thay đổi nào trong `projectPointOntoSegment` phải được áp dụng đồng thời cho cả hai implementations và phải retrain model.

---

## Static Morphology Features (Group A)

Các features này được tính từ một single frame (snapshot), không cần temporal context.

### F-A-01: leftHorizontalRatio

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-A-01 |
| **Feature Name** | leftHorizontalRatio |
| **Group** | Static Morphology |
| **Formula** | `projectPointOntoSegment(lm[473], lm[362], lm[263])` |
| **Landmarks** | Iris: 473 (OS center); Start: 362 (OS inner corner); End: 263 (OS outer corner) |
| **Coordinate System** | MediaPipe normalized [0, 1] — NO unit conversion |
| **Expected Range** | ~0.3 – 0.7 (center gaze); clamped to [-0.5, 1.5] trước khi đưa vào model |
| **Smoothing** | One Euro Filter (minCutoff=1.2 Hz, β=0.008) nếu `applySmoothing=true` |
| **Missing Value** | Return 0.5 (neutral center) |
| **Interpretation** | 0 = iris tại inner corner; 1 = iris tại outer corner; 0.5 = centered |

**Python:**
```python
left_h_ratio = project_point_onto_segment(lm[473], lm[362], lm[263])
left_h_ratio = max(-0.5, min(1.5, left_h_ratio))  # clamp
```

**JavaScript (`eyeFeatureService.js`):**
```javascript
leftHorizontalRatio = projectPointOntoSegment(leftIris, leftInner, leftOuter);
// clamp applied: Math.min(1.5, Math.max(-0.5, leftHorizontalRatio))
```

---

### F-A-02: rightHorizontalRatio

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-A-02 |
| **Feature Name** | rightHorizontalRatio |
| **Formula** | `projectPointOntoSegment(lm[468], lm[133], lm[33])` |
| **Landmarks** | Iris: 468 (OD center); Start: 133 (OD inner corner); End: 33 (OD outer corner) |
| **Coordinate System** | MediaPipe normalized |
| **Expected Range** | ~0.3 – 0.7; clamped [-0.5, 1.5] |
| **Smoothing** | One Euro Filter nếu `applySmoothing=true` |
| **Missing Value** | 0.5 |

**Python:**
```python
right_h_ratio = project_point_onto_segment(lm[468], lm[133], lm[33])
right_h_ratio = max(-0.5, min(1.5, right_h_ratio))
```

---

### F-A-03: leftVerticalRatio

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-A-03 |
| **Feature Name** | leftVerticalRatio |
| **Formula** | `projectPointOntoSegment(lm[473], lm[386], lm[374])` |
| **Landmarks** | Iris: 473; Start: 386 (OS top lid); End: 374 (OS bottom lid) |
| **Expected Range** | ~0.3 – 0.7; clamped [-0.5, 1.5] |
| **Missing Value** | 0.5 |

---

### F-A-04: rightVerticalRatio

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-A-04 |
| **Feature Name** | rightVerticalRatio |
| **Formula** | `projectPointOntoSegment(lm[468], lm[159], lm[145])` |
| **Landmarks** | Iris: 468; Start: 159 (OD top lid); End: 145 (OD bottom lid) |
| **Expected Range** | ~0.3 – 0.7; clamped [-0.5, 1.5] |
| **Missing Value** | 0.5 |

---

### F-A-05: horizontalRatioDiff

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-A-05 |
| **Feature Name** | horizontalRatioDiff |
| **Formula** | `abs(leftHorizontalRatio - rightHorizontalRatio)` |
| **Dependencies** | F-A-01, F-A-02 (clamped values) |
| **Expected Range** | [0, 2.0] |
| **Missing Value** | 0.0 |
| **Interpretation** | Asymmetry trong horizontal gaze ratio — proxy cho misalignment |

---

### F-A-06: verticalRatioDiff

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-A-06 |
| **Feature Name** | verticalRatioDiff |
| **Formula** | `abs(leftVerticalRatio - rightVerticalRatio)` |
| **Dependencies** | F-A-03, F-A-04 (clamped values) |
| **Expected Range** | [0, 2.0] |
| **Missing Value** | 0.0 |

---

### F-A-07: irisDistanceRatio

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-A-07 |
| **Feature Name** | irisDistanceRatio |
| **Formula** | `hypot(lm[473].x - lm[468].x, lm[473].y - lm[468].y) / max(0.01, hypot(lm[362].x - lm[133].x, lm[362].y - lm[133].y))` |
| **Numerator** | Inter-iris distance (473 to 468) |
| **Denominator** | Inter-inner-canthus distance (362 to 133) |
| **Expected Range** | ~0.8 – 1.2 for orthophoria |
| **Missing Value** | 1.0 |

---

### F-A-08: leftEyeWidth

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-A-08 |
| **Feature Name** | leftEyeWidth |
| **Formula** | `max(0.001, hypot(lm[263].x - lm[362].x, lm[263].y - lm[362].y))` |
| **Unit** | MediaPipe normalized units |
| **Missing Value** | null (nếu landmarks không valid) |

---

### F-A-09: rightEyeWidth

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-A-09 |
| **Feature Name** | rightEyeWidth |
| **Formula** | `max(0.001, hypot(lm[33].x - lm[133].x, lm[33].y - lm[133].y))` |
| **Missing Value** | null |

---

### F-A-10: estimatedDistanceCm

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-A-10 |
| **Feature Name** | estimatedDistanceCm |
| **Formula** | `4095.0 / (irisDistance_px)` where `irisDistance_px = hypot(lm[473].x - lm[468].x, ...) * 640.0` |
| **Unit** | Centimeters (approximate) |
| **Calibration Note** | Hằng số 4095 là empirical calibration, cần điều chỉnh nếu độ phân giải camera thay đổi. |
| **Expected Range** | 28 – 65 cm (valid range for screening) |
| **Missing Value** | 50.0 (default neutral) |

---

## EAR Features (Group B — Quality / Blink Detection)

### F-B-01: leftEAR

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-B-01 |
| **Feature Name** | leftEAR (Eye Aspect Ratio — mắt trái) |
| **Formula** | `(hypot(lm[385]-lm[380]) + hypot(lm[386]-lm[374])) / (2 * hypot(lm[263]-lm[362]))` |
| **Landmarks** | V1_top: 385; V1_bot: 380; V2_top: 386; V2_bot: 374; Outer: 263; Inner: 362 |
| **Blink Threshold** | `leftEAR < 0.18` → isBlinkLeft = True |
| **Temporal Buffer** | Khi isBlinkLeft: mask tọa độ trong [-60ms, +120ms] — **tham số cần benchmark** |
| **Missing Value** | 0.30 (neutral open eye) |
| **Note** | Không dùng EAR làm input feature cho AI model — chỉ dùng cho quality gating |

---

### F-B-02: rightEAR

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-B-02 |
| **Feature Name** | rightEAR |
| **Formula** | `(hypot(lm[158]-lm[153]) + hypot(lm[159]-lm[145])) / (2 * hypot(lm[33]-lm[133]))` |
| **Blink Threshold** | `rightEAR < 0.18` → isBlinkRight = True |
| **Missing Value** | 0.30 |

---

## Kinematic Features (Group C — Dynamic, from Cover Test)

Các features này được tính từ **temporal sequence** trong cửa sổ Uncover (500 ms sau khi bỏ che mắt). Yêu cầu ít nhất 2 valid frames sau khi lọc blink.

### Preprocessing bắt buộc trước khi tính Group C:

1. Lọc frames có `isBlinking = True` hoặc trong temporal masking window.
2. Áp dụng Head Motion Compensation (2D canthal normalization).
3. Áp dụng Savitzky-Golay post-processing (p=2, n=5, mirror-padding) trên chuỗi X(t) và Y(t).
4. Nếu valid samples < 5 sau lọc blink: skip SG, dùng raw compensated data.

---

### F-C-01: netDisplacementX (signed)

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-C-01 |
| **Feature Name** | netDisplacementX |
| **Formula** | `X_final - X_initial` (từ chuỗi đã SG-smooth) |
| **Unit** | MediaPipe normalized units (head-compensated) |
| **Sign Convention** | > 0 = iris lệch sang phải màn hình (anatomically: abduction/Exo cho mắt phải; adduction/Eso cho mắt trái) |
| **Missing Value** | null |
| **Note** | Không normalize theo eyeWidth ở bước feature — normalize nếu cần ở training step |

---

### F-C-02: netDisplacementY (signed)

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-C-02 |
| **Feature Name** | netDisplacementY |
| **Formula** | `Y_final - Y_initial` (từ chuỗi đã SG-smooth) |
| **Sign Convention** | > 0 = iris lệch xuống (Hypo); < 0 = iris lệch lên (Hyper) |
| **Missing Value** | null |

---

### F-C-03: peakVelocity

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-C-03 |
| **Feature Name** | peakVelocity |
| **Formula** | `max(stepDist / stepDt)` cho mọi consecutive frame pairs trong Uncover window |
| **Unit** | MediaPipe normalized units per second |
| **DVA Note** | Nếu estimatedDistanceCm có sẵn, có thể convert sang deg/s — nhưng đơn vị phải nhất quán giữa training và inference |
| **Missing Value** | null (nếu < 2 valid frames) |

---

### F-C-04: peakAcceleration

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-C-04 |
| **Feature Name** | peakAcceleration |
| **Formula** | Second-order finite difference: `(v[i+1] - v[i]) / dt` — lấy max absolute value |
| **Unit** | MediaPipe normalized units per second² |
| **Missing Value** | null |

---

### F-C-05: saccadeOnsetTime

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-C-05 |
| **Feature Name** | saccadeOnsetTime (T_onset) |
| **Formula** | Thời điểm đầu tiên Engbert-Kliegl ellipse criterion được thỏa mãn trong Uncover window |
| **Unit** | Milliseconds từ `t = 0` (thời điểm uncover) |
| **Engbert-Kliegl Source** | σ_x, σ_y tính từ Baseline velocity sequence (~90 frames), NOT từ Uncover |
| **Missing Value** | null (nếu không phát hiện saccade) |

---

### F-C-06: postSaccadicStability

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-C-06 |
| **Feature Name** | postSaccadicStability |
| **Formula** | IQR của X(t) trong Settling Window (400–800ms sau uncover) |
| **Unit** | MediaPipe normalized units |
| **Interpretation** | Nhỏ = ổn định tốt sau saccade; lớn = oscillation / nystagmoid jerks |
| **Missing Value** | null |

---

### F-C-07: irisDiameterRatio (per-session)

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-C-07 |
| **Feature Name** | irisDiameterRatio |
| **Formula** | `median(hypot(lm[474].x - lm[476].x, ...) over Baseline frames)` — horizontal iris span |
| **Unit** | MediaPipe normalized units |
| **Usage** | Dùng để tính px_per_mm cho Hirschberg scaling (xem F-C-08) |
| **Missing Value** | null |

---

### F-C-08: hirschbergDeviationPD

| Thuộc tính | Giá trị |
|:-----------|:--------|
| **Feature ID** | F-C-08 |
| **Feature Name** | hirschbergDeviationPD |
| **Formula** | `hypot(glint.x - iris_center.x, glint.y - iris_center.y) / px_per_mm * K_Hirschberg` |
| **Inputs** | glint position (từ pixel brightness analysis, NOT từ MediaPipe); iris_center (lm[468] hoặc lm[473]) |
| **px_per_mm** | `irisDiameter_px / HVID_ref_mm` (HVID_ref = 11.7mm mặc định, configurable) |
| **K_Hirschberg** | 18 PD/mm mặc định (configurable) — population mean, không phải hằng số |
| **Stability Required** | ≥ 20 stable frames để tích lũy median |
| **Missing Value** | `NaN` hoặc `null` khi glint INDETERMINATE |
| **⚠️ Warning** | Giá trị PD này là screening-grade approximation. Không dùng để diagnosis. Xem Section 8 của Improvement Plan. |

---

## Feature Vector cho AI Model (Group D — Model Input)

### D-01: Static MLP Input (V1 — Current Verified Ground Truth)

**Thứ tự feature trong vector (ĐÃ AUDIT VÀ XÁC NHẬN khớp giữa `model_metadata.json`, `aiInferenceService.js`, `train.py`, `extract_features.py`):**

| Index | Feature ID | Feature Name | Clamp Range | Ground Truth Source |
|:-----:|:----------:|:-------------|:------------|:-------------------|
| 0 | F-A-01 | leftHorizontalRatio | [-0.5, 1.5] | `model_metadata.json` [0] |
| 1 | F-A-02 | rightHorizontalRatio | [-0.5, 1.5] | `model_metadata.json` [1] |
| 2 | F-A-03 | leftVerticalRatio | [-0.5, 1.5] | `model_metadata.json` [2] |
| 3 | F-A-04 | rightVerticalRatio | [-0.5, 1.5] | `model_metadata.json` [3] |
| 4 | F-A-07 | interocularDistance | [0, 1.0] | `model_metadata.json` [4] |
| 5 | F-A-05 | horizontalRatioDiff | [0, 2.0] | `model_metadata.json` [5] |
| 6 | F-A-06 | verticalRatioDiff | [0, 2.0] | `model_metadata.json` [6] |
| 7 | F-A-08 | leftEyeWidth | [0, 0.2] | `model_metadata.json` [7] |
| 8 | F-A-09 | rightEyeWidth | [0, 0.2] | `model_metadata.json` [8] |
| 9 | F-A-10 | irisDistanceRatio | [0.5, 2.0] | `model_metadata.json` [9] |

**Tổng:** 10 features.

> **IMPORTANT:** Đây là feature order thực tế của model V1 đang chạy trong ONNX Runtime Web. Bất kỳ thay đổi nào (thêm, bớt, hoán vị) đều PHẢI retrain model đồng thời cả Python và JS.

---

### D-01-A: Phase 1 Feature Contract Audit Report (Discrepancy Log)

Trong quá trình thực hiện Priority 1 (P1), toàn bộ mã nguồn trích xuất đặc trưng của Python và JavaScript đã được đối chiếu chi tiết:

1. **Thứ tự 10 Feature Vector V1:**
   - **Trạng thái:** ✅ **KHỚP 100%** giữa `public/models/model_metadata.json`, `models/model_metadata.json`, `src/services/aiInferenceService.js` (`AI_FEATURE_ORDER`), `training/train.py`, và `training/extract_features.py` (`FEATURE_COLUMNS`).
   - *Ghi chú:* Bảng D-01 trong bản thảo sơ bộ trước đây có nhầm lẫn vị trí của `interocularDistance` và `irisDistanceRatio`, nay đã được hiệu chỉnh chính xác theo ground truth của mô hình thực tế.

2. **Định danh Landmark Iris (468 vs 473):**
   - **Hiện trạng JS (`screeningConfig.js`):** `LEFT_IRIS_CENTER: 473` (mắt trái giải phẫu / OS), `RIGHT_IRIS_CENTER: 468` (mắt phải giải phẫu / OD).
   - **Hiện trạng Python (`extract_features.py`):** `'LEFT_IRIS_CENTER': 468`, `'RIGHT_IRIS_CENTER': 473`.
   - **Nhận định:** Theo chuẩn MediaPipe Face Mesh, 468 là tâm mống mắt phải (OD), 473 là tâm mống mắt trái (OS). Do đó JS `screeningConfig.js` tuân thủ đúng quy chuẩn giải phẫu. `extract_features.py` của Python bị hoán đổi nhãn.
   - **Kế hoạch xử lý:** Tuân thủ nguyên tắc P1 (*không sửa code training độc lập khi chưa retrain*), việc hiệu chỉnh này được đưa vào **Phase 4 Retraining** để đồng bộ đồng thời cả 2 môi trường và train lại model mới.

3. **Phương pháp chiếu tọa độ (Vector Projection vs Scalar Difference):**
   - **Hiện trạng JS (`gazeTracker.js` & `eyeFeatureService.js`):** Sử dụng `projectPointOntoSegment` (hình chiếu vector 2D lên đoạn thẳng nối 2 khóe mắt) — có tính bất biến với góc nghiêng đầu trong mặt phẳng (Canthal roll-invariant).
   - **Hiện trạng Python (`extract_features.py`):** Sử dụng hiệu số vô hướng trục X: `(iris.x - inner.x) / (outer.x - inner.x)`.
   - **Kế hoạch xử lý:** Trong Phase 4, Python script sẽ được cập nhật sử dụng hàm `project_point_onto_segment` tương đương để đảm bảo 100% tính nhất quán toán học.

---

### D-02: Extended Feature Vector (V2 — Planned, NOT YET IMPLEMENTED)

Chỉ được implement sau khi P1-P3 của Improvement Plan hoàn thành.

**Feature order dự kiến:**

| Index | Feature ID | Feature Name | Status |
|:-----:|:----------:|:-------------|:------:|
| 0–9 | F-A-01...F-A-10 | Static morphology (như V1) | Sẽ dùng |
| 10 | F-C-01 | netDisplacementX (signed) | Planned |
| 11 | F-C-02 | netDisplacementY (signed) | Planned |
| 12 | F-C-03 | peakVelocity | Planned |
| 13 | F-C-04 | peakAcceleration | Planned |
| 14 | F-C-05 | saccadeOnsetTime (normalized: /500ms) | Planned |
| 15 | F-C-06 | postSaccadicStability | Planned |
| 16 | F-C-07 | irisDiameterRatio | Planned |
| 17 | F-C-08 | hirschbergDeviationPD (NaN → 0.0 with flag) | Planned |

**Tổng:** 18 features.

**Missing value handling cho V2:**
- Static features: dùng giá trị neutral (0.5 hoặc 0.0) nếu landmark không valid.
- Kinematic features: nếu null (ít frame quá), dùng 0.0 kèm flag `isKinematicsValid = False`.
- hirschbergDeviationPD = NaN: encode thành 0.0 kèm boolean feature `isHirschbergValid = False` (hoặc thêm feature index 18).

---

## Validation Checklist

Trước khi merge bất kỳ thay đổi feature nào:

- [ ] `FEATURE_CONTRACT_V1.md` đã được cập nhật với định nghĩa mới
- [ ] `training/extract_features.py` đã được sửa khớp
- [ ] `src/services/eyeFeatureService.js` đã được sửa khớp
- [ ] Unit test cho cả Python và JavaScript function với cùng input → cùng output (trong floating point tolerance 1e-6)
- [ ] Model đã được retrain với feature mới
- [ ] Bộ test cases `coverTestTimeSeriesTestCases.js` đã được cập nhật
- [ ] Feature vector order đã được cập nhật trong section D của file này

---

## Changelog

| Ngày | Version | Thay đổi |
|:-----|:-------:|:---------|
| 2026-09-30 | 1.0 | Khởi tạo. Định nghĩa 10 static features (Group A), 2 EAR features (Group B), 8 kinematic features (Group C — planned). |

---

## References

- **MediaPipe Face Mesh Landmarks:** [https://developers.google.com/mediapipe/solutions/vision/face_landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)
- **Engbert, R., & Kliegl, R.** (2003). Microsaccades uncover the orientation of covert attention. *Vision Research*, 43(9), 1035-1045.
- **Casiez, G., et al.** (2012). 1€ filter. *CHI 2012*.
- **Choi, R. Y., & Tychsen, L.** (2019). Photographic Hirschberg measurement. *Journal of AAPOS*.
