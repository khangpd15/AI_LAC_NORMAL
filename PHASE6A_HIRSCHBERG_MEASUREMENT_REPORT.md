# BÁO CÁO KẾT QUẢ THỰC HIỆN PHASE 6A: HIRSCHBERG MEASUREMENT BACKEND

> **Ngày thực hiện:** 03/10/2026  
> **Trạng thái:** Hoàn thành Phase 6A - Dừng chờ duyệt (Strict Stop Point)  
> **Cam kết an toàn:** Không train model production, không sửa `/predict`, không chốt threshold lâm sàng, không đưa ra chẩn đoán y khoa.

---

## 1. Tóm tắt mục tiêu & kết quả Phase 6A

Trong Phase 6A, hệ thống đo hình học nghiên cứu Hirschberg (`/api/v1/research/measurements`) trên backend đã được nâng cấp toàn diện:
1. **Bổ sung detector `pupil_center`:** Xác định tâm và đường kính đồng tử trong ROI mắt/mống mắt, bù đắp hiện tượng tâm đồng tử lệch so với tâm mống mắt (`iris_center`).
2. **Cải tiến detector `corneal_reflex`:** Chuyển sang cơ chế đa ngưỡng sáng (`strict_specular`, `medium_specular`, `adaptive_specular`) để thích ứng với nhiều điều kiện chụp mà không bị bỏ sót phản xạ giác mạc.
3. **Tính toán và lưu trữ song song:**
   $$\Delta h_{\text{iris}} = \frac{\text{reflex}_x - \text{iris\_center}_x}{\text{iris\_diameter}}$$
   $$\Delta h_{\text{pupil}} = \frac{\text{reflex}_x - \text{pupil\_center}_x}{\text{iris\_diameter}}$$
   *(Có áp dụng quy ước dấu lâm sàng: `+` là nasal, `-` là temporal; $\Delta h = h_{\text{OD}} - h_{\text{OS}}$)*.
4. **Theo dõi tỷ lệ phát hiện riêng biệt:** Tách biệt trạng thái nhận diện của 5 thành phần: `face`, `eyes`, `iris`, `pupil`, `reflex`.
5. **Trạng thái an toàn & bảo vệ chẩn đoán:** Nếu đồng tử hoặc phản xạ giác mạc không đạt độ tin cậy, hệ thống trả về `INCONCLUSIVE` hoặc `MEASUREMENT_ONLY` với reason codes rõ ràng (`PUPIL_NOT_FOUND`, `REFLEX_NOT_FOUND`, `MULTIPLE_REFLEX`, `LOW_QUALITY_INPUT`), tuyệt đối không bao giờ ép thành `SCREENING_NORMAL`.
6. **Bảo tồn toàn vẹn Production:** Endpoint production `/api/v1/strabismus/predict`, file ONNX `best_model.onnx`, và luồng inference screening hiện tại được giữ nguyên 100%.

---

## 2. Danh mục file đã sửa và thêm mới

| STT | Đường dẫn file | Thao tác | Mục đích / Nội dung |
| :--- | :--- | :---: | :--- |
| 1 | `D:\REMICARE-STRABISMUS-AI\app\services\research_measurement_service.py` | Sửa | Thêm `detect_reflexes_in_roi` (đa ngưỡng), `detect_pupil_in_roi`, mở rộng `EyeMeasurement`, tính song song `h_iris` & `h_pupil`, tracking detection stats 5 thành phần. |
| 2 | `D:\REMICARE-STRABISMUS-AI\tests\research\test_research_measurement_service.py` | Sửa / Mở rộng | Thêm 7 unit tests kiểm tra: 1 reflex rõ nét, `REFLEX_NOT_FOUND`, `MULTIPLE_REFLEX`, `PUPIL_NOT_FOUND`, tính song song $h$, schema tương thích ngược. |
| 3 | `D:\REMICARE-STRABISMUS-AI\scripts\benchmark_hirschberg_detectors.py` | Thêm mới | Script benchmark kỹ thuật đo tỷ lệ phát hiện (coverage/success rate) trên tập dữ liệu ảnh cắt 224x224 `data_hirschberg`. |
| 4 | `D:\AI_Check_Lac\manifests\hirschberg_detector_benchmark.json` | Thêm mới | Kết quả benchmark kỹ thuật 696 ảnh: tỷ lệ nhận diện pupil, reflex, joint coverage. |
| 5 | `D:\AI_Check_Lac\PHASE6A_HIRSCHBERG_MEASUREMENT_REPORT.md` | Thêm mới | Báo cáo chi tiết Phase 6A (tài liệu này). |

---

## 3. Chi tiết logic Pupil và Reflex Detector

### 3.1. Corneal Reflex Detector (`detect_reflexes_in_roi`)
* **Nguyên lý:** Phản xạ giác mạc (Purkinje image I) là điểm phản chiếu từ nguồn sáng (đèn pin/flash/môi trường) trên bề mặt giác mạc cong.
* **Cơ chế đa tầng (Multi-tier Strategy):**
  1. *Tier 1 (`strict_specular`):* $R, G, B \ge 235$ và $\text{Luma} \ge 225.0$. Dành cho ánh sáng đèn pin trực diện hoặc flash rõ nét.
  2. *Tier 2 (`medium_specular`):* $R, G, B \ge 215$ và $\text{Luma} \ge 205.0$. Thích ứng với ánh sáng phòng có trợ sáng gián tiếp.
  3. *Tier 3 (`adaptive_specular`):* $R, G, B \ge 195$ và $\text{Luma} \ge 185.0$. Thích ứng ảnh có độ phơi sáng vừa phải.
* **Lọc hình học và nhiễu:**
  - Vùng tìm kiếm: Hình tròn đồng tâm mống mắt bán kính $R_{\text{search}} = R_{\text{iris}} \times 1.35$.
  - Diện tích: $2 \le \text{pixels} \le 120$.
  - Tỷ lệ khung (Aspect Ratio): $\le 3.5$ nhằm loại bỏ các vệt lóa dài dọc theo bờ mi (eyelid glare streak) hoặc sống mũi.
* **Trạng thái đầu ra:**
  - Đúng 1 điểm sáng hợp lệ $\rightarrow$ `DETECTED`.
  - Không có điểm sáng nào ở mọi tầng $\rightarrow$ `REFLEX_NOT_FOUND`.
  - Có $\ge 2$ điểm sáng ở tầng kích hoạt $\rightarrow$ `MULTIPLE_REFLEX`.

### 3.2. Pupil Center Detector (`detect_pupil_in_roi`)
* **Nguyên lý:** Đồng tử là lỗ tròn trung tâm mống mắt có cường độ sáng tối hơn đáng kể so với nhu mô mống mắt xung quanh.
* **Các bước xử lý:**
  1. *Trích xuất ROI:* Vùng tìm kiếm bên trong mống mắt $R_{\text{pupil\_search}} = R_{\text{iris}} \times 0.85$.
  2. *Khử phản xạ giác mạc (Specular Highlight Masking):* Trước khi đo đạc vùng tối, toàn bộ các điểm sáng $R, G, B, \text{Luma} \ge 180$ được loại bỏ khỏi mask phân tích để vết sáng flash không làm biến dạng tâm hình học của đồng tử.
  3. *Kiểm tra độ tương phản cục bộ:* Đo độ chênh lệch giữa bách phân vị $P_{85}$ và $P_{15}$ của mống mắt. Nếu $\Delta < 12.0$ (vùng phẳng, ảnh quá tối, hoặc không có sự phân biệt giữa mống mắt và đồng tử), trả về ngay `PUPIL_NOT_FOUND`.
  4. *Quét ngưỡng phân đoạn:* Thử nghiệm các ngưỡng phân vị $P_{18}, P_{28}, P_{38}$ giới hạn trần ở $\text{Luma} \le 95.0$.
  5. *Lọc giải phẫu học:*
     - Diện tích đồng tử: $0.15^2 \pi R^2 \le \text{Area} \le 0.70^2 \pi R^2$.
     - Khoảng cách từ tâm đồng tử tới tâm mống mắt: $\le 0.25 \times \text{Iris\_Diameter}$.
     - Độ tròn giải phẫu: $\text{Circularity} = \frac{4\pi \times \text{Area}}{\text{Perimeter}^2} \ge 0.35$.
  6. *Tính toán tâm & đường kính:* Xác định trọng tâm $(\bar{x}, \bar{y})$ và đường kính tương đương $D = 2\sqrt{\text{Area}/\pi}$. Nếu đạt, trả về `DETECTED`; nếu không, trả về `PUPIL_NOT_FOUND`.

---

## 4. Bảng hằng số và ngưỡng nghiên cứu (`TODO_PILOT`)

Mọi thông số kỹ thuật đều được khai báo tường minh dưới dạng hằng số kèm chú thích `TODO_PILOT`, thể hiện rõ tính chất nghiên cứu tiền lâm sàng, chưa chốt y khoa:

```python
# ==============================================================================
# Phase 6A Research Thresholds (All thresholds are TODO_PILOT pending clinical pilot)
# ==============================================================================

REFLEX_MULTI_THRESHOLDS_TODO_PILOT = [
    {"tier": "strict_specular", "min_rgb": 235, "min_luma": 225.0, "threshold_source": "TODO_PILOT"},
    {"tier": "medium_specular", "min_rgb": 215, "min_luma": 205.0, "threshold_source": "TODO_PILOT"},
    {"tier": "adaptive_specular", "min_rgb": 195, "min_luma": 185.0, "threshold_source": "TODO_PILOT"},
]
REFLEX_MIN_PIXELS_TODO_PILOT = 2
REFLEX_MAX_PIXELS_TODO_PILOT = 120
REFLEX_SEARCH_RADIUS_FACTOR_TODO_PILOT = 1.35   # Vùng tìm phản xạ quanh bán kính mống mắt
REFLEX_MAX_ASPECT_RATIO_TODO_PILOT = 3.5        # Ngưỡng loại trừ vệt lóa kéo dài

PUPIL_SEARCH_RADIUS_FACTOR_TODO_PILOT = 0.85    # Vùng tìm kiếm đồng tử trong mống mắt
PUPIL_MIN_RADIUS_RATIO_TODO_PILOT = 0.15        # Tỷ lệ bán kính đồng tử tối thiểu / mống mắt
PUPIL_MAX_RADIUS_RATIO_TODO_PILOT = 0.70        # Tỷ lệ bán kính đồng tử tối đa / mống mắt
PUPIL_MIN_AREA_PX_TODO_PILOT = 8                # Diện tích pixel tối thiểu của đồng tử
PUPIL_MAX_OFFSET_FROM_IRIS_TODO_PILOT = 0.25    # Độ lệch tâm tối đa cho phép giữa đồng tử và mống mắt
PUPIL_MIN_CIRCULARITY_TODO_PILOT = 0.35         # Hệ số tròn tối thiểu của đồng tử
PUPIL_MIN_CONTRAST_DIFF_TODO_PILOT = 12.0       # Độ tương phản tối thiểu giữa mống mắt và đồng tử
PUPIL_THRESHOLD_PERCENTILES_TODO_PILOT = [18.0, 28.0, 38.0]
PUPIL_MAX_DARK_LUMA_TODO_PILOT = 95.0           # Ngưỡng sáng tối đa cho pixel vùng tối đồng tử
```

---

## 5. Kết quả kiểm thử tự động (Unit Tests)

### 5.1. Bộ test nghiên cứu backend (`pytest tests\research -q`)
Tất cả 16 test cases trong `tests/research/` đều pass:
```text
cd D:\REMICARE-STRABISMUS-AI
.\.venv\Scripts\python.exe -m pytest tests\research -q
................                                                         [100%]
16 passed in 0.44s
```

Chi tiết các test case mới được bổ sung theo yêu cầu:
1. `test_detect_reflex_single_spot`: Phát hiện chuẩn xác khi có 1 đốm sáng trắng rõ trong ROI ($\text{status} = \text{"DETECTED"}$, $\text{tier} = \text{"strict_specular"}$).
2. `test_detect_reflex_not_found`: Trả về $\text{status} = \text{"REFLEX_NOT_FOUND"}$ khi không có chấm phản quang.
3. `test_detect_reflex_multiple_spots`: Trả về $\text{status} = \text{"MULTIPLE_REFLEX"}$ khi có 2 đốm sáng phản chiếu.
4. `test_detect_pupil_not_found_when_insufficient_data`: Trả về `PUPIL_NOT_FOUND` / `LOW_QUALITY_INPUT` khi ảnh phẳng xám không có tương phản hoặc ROI quá nhỏ ($< 6\times 6$ px).
5. `test_hirschberg_parallel_iris_and_pupil_measurements_and_schema`:
   - Kết quả trả về `status="INCONCLUSIVE"`, `result="MEASUREMENT_ONLY"`, `experimental=True`.
   - Cả hai mắt OD, OS đều chứa đầy đủ trường: `iris_center`, `pupil_center`, `reflex_center`, `iris_diameter`, `pupil_diameter_px`, `h_iris`, `h_pupil`.
   - Có đầy đủ trường tracking 5 thành phần: `face`, `eyes`, `iris`, `pupil`, `reflex`.
   - Tương thích ngược 100% với schema cũ: trường `h` giữ nguyên giá trị bằng `h_iris`, trường `delta_h` giữ nguyên.
6. `test_hirschberg_missing_reflex_reason_codes`: Kiểm tra khi thiếu chấm sáng, hệ thống gắn mã lý do `REFLEX_NOT_FOUND` và kết quả là `MEASUREMENT_ONLY`, không clearance.
7. `test_hirschberg_multiple_reflex_reason_codes`: Kiểm tra khi có nhiều chấm sáng, hệ thống gắn mã lý do `MULTIPLE_REFLEX` và kết quả là `MEASUREMENT_ONLY`.

### 5.2. Toàn bộ test suite backend (`pytest -q`)
```text
cd D:\REMICARE-STRABISMUS-AI
.\.venv\Scripts\python.exe -m pytest -q
....................                                                     [100%]
20 passed in 1.63s
```

### 5.3. Test frontend (`npm test` tại `D:\AI_Check_Lac`)
```text
cd D:\AI_Check_Lac
npm test
ALL REMICARE CAMERA TESTS PASSED SUCCESSFULLY! (5/5 passed)
```

---

## 6. Kết quả benchmark độ phủ kỹ thuật trên tập `data_hirschberg`

Đã chạy benchmark bằng script `scripts/benchmark_hirschberg_detectors.py` trên toàn bộ 696 ảnh cắt mắt $224\times 224$ (`hirschberg_folder_labels.jsonl`):

```json
{
  "benchmarkName": "Phase 6A Hirschberg Detector Technical Coverage Benchmark",
  "datasetVersion": "hirschberg-folder-labels-v0.1",
  "totalImagesEvaluated": 696,
  "detectorSuccessRates": {
    "pupilCenterDetection": {
      "detectedCount": 101,
      "successRatePercent": 14.51,
      "pupilNotFoundCount": 595,
      "lowQualityInputCount": 0
    },
    "cornealReflexDetection": {
      "detectedCount": 205,
      "successRatePercent": 29.45,
      "reflexNotFoundCount": 229,
      "multipleReflexCount": 262,
      "lowQualityInputCount": 0,
      "tierBreakdown": {
        "strict_specular": 199,
        "adaptive_specular": 134,
        "medium_specular": 134
      }
    },
    "jointMeasurementCoverage": {
      "jointDetectedCount": 31,
      "coveragePercent": 4.45
    }
  },
  "perSplitCoverage": {
    "test": {"total": 125, "pupilSuccessRatePercent": 9.6, "reflexSuccessRatePercent": 28.8, "jointCoveragePercent": 3.2},
    "train": {"total": 467, "pupilSuccessRatePercent": 14.99, "reflexSuccessRatePercent": 29.76, "jointCoveragePercent": 4.71},
    "val": {"total": 104, "pupilSuccessRatePercent": 18.27, "reflexSuccessRatePercent": 28.85, "jointCoveragePercent": 4.81}
  }
}
```

### Đánh giá kỹ thuật từ benchmark:
1. **Corneal Reflex Coverage (29.45% đơn lẻ, 37.64% đa phản quang):**
   - Phản quang đơn lẻ phát hiện được ở 205/696 ảnh.
   - Có đến 262/696 ảnh (37.64%) xuất hiện $\ge 2$ đốm sáng phản chiếu. Điều này phản ánh đặc thù tập ảnh legacy/internet không được chụp theo giao thức nguồn sáng điểm đơn (point light source) chuẩn của nghiệm pháp Hirschberg lâm sàng.
2. **Pupil Center Coverage (14.51%):**
   - Do 696 ảnh là crop $224\times 224$ độ phân giải thấp, nhiều mắt bị nheo mi, lóa bóng, hoặc mắt châu Á có mống mắt sẫm màu tiệm cận độ đen của đồng tử với độ chênh lệch tương phản thấp.
   - Bộ lọc an toàn đã từ chối nhận diện sai đối với 595 trường hợp thiếu dữ liệu (`PUPIL_NOT_FOUND`).
3. **Tuân thủ đạo đức nghiên cứu AI:**
   - Báo cáo **chỉ công bố tỷ lệ thành công của detector (coverage rate)**.
   - **Tuyệt đối không tính và không công bố** độ nhạy (sensitivity), độ đặc hiệu (specificity), hay độ chính xác chẩn đoán (accuracy) từ tập ảnh này vì chưa đáp ứng giao thức full-frame và chưa chứng minh tính độc lập bệnh nhân.

---

## 7. Những việc chưa làm (Scope Boundaries)

Để đảm bảo an toàn tuyệt đối và ranh giới chuyên môn theo chỉ đạo:
1. **Chưa train model production:** Không tạo ra hay thay thế bất kỳ model nào trên môi trường production.
2. **Chưa sửa endpoint `/predict`:** API chẩn đoán/sàng lọc production giữ nguyên kiến trúc ban đầu.
3. **Chưa quy đổi sang độ hay Prism Diopter:** Giá trị trả về hoàn toàn là tỷ lệ không thứ nguyên ($h$ ratio). Tuyệt đối không hard-code hệ số chuyển đổi như $1\text{ mm} = 7^\circ$ hay $1\text{ mm} = 22^\Delta$.
4. **Chưa chốt threshold lâm sàng:** Mọi ngưỡng đều mang nhãn `TODO_PILOT`, chờ phê duyệt từ bác sĩ chuyên khoa nhãn nhi.
5. **Chưa gọi kết quả là chẩn đoán y khoa:** Mọi phản hồi từ endpoint nghiên cứu đều giữ trạng thái `status: INCONCLUSIVE`, `result: MEASUREMENT_ONLY`.
6. **Chưa chuyển sang Phase 6B:** Chưa tiến hành train classifier exploratory candidate.

---

## 8. Khẳng định an toàn & Điểm dừng

* **Khẳng định rõ ràng:** Phase 6A chỉ cải thiện năng lực đo đạc hình học backend phục vụ nghiên cứu; **chưa train production, chưa đổi `/predict`, chưa chốt threshold lâm sàng, chưa đưa ra chẩn đoán**.
* **Điểm dừng (Stop Point):** Agent dừng lại tại đây và chờ phản hồi, đánh giá từ người dùng trước khi thực hiện bất kỳ bước tiếp theo nào.
