# KẾ HOẠCH KIỂM ĐỊNH LÂM SÀNG & MÔ HÌNH DỮ LIỆU HIỆU CHUẨN
## CLINICAL VALIDATION PROTOCOL & CALIBRATION DATA MODEL

---

## 1. Mục Đích Nghiên Cứu

Tài liệu này xác định phương pháp luận nghiên cứu và mô hình thu thập dữ liệu lâm sàng nhằm kiểm định tính chính xác của hệ thống **RemiCare Digital Cover Test** so với tiêu chuẩn vàng nhãn khoa: **Prism and Alternate Cover Test (PACT)** do bác sĩ nhãn khoa chuyên khoa mắt thực hiện.

Mục tiêu chính:
1. Xác định mối tương quan thực nghiệm giữa **Độ dịch chuyển mống mắt chuẩn hóa qua camera ($\text{Normalized Displacement}$)** và **Độ lăng kính lâm sàng ($\text{Prism Diopters } \Delta$)**.
2. Xây dựng mô hình hồi quy / hiệu chuẩn (Calibration Model) để có cơ sở khoa học chuyển đổi từ phép đo camera sang độ lăng kính $\Delta$.
3. Đánh giá độ nhạy (Sensitivity), độ đặc hiệu (Specificity), độ tương đồng (Bland-Altman Agreement), sai số tuyệt đối trung bình (MAE) và căn bậc hai sai số toàn phương trung bình (RMSE).

---

## 2. Mô Hình Thu Thập Dữ Liệu Lâm Sàng (Data Model)

Mỗi hồ sơ tham gia nghiên cứu (Study Record) được cấu trúc với các trường dữ liệu bắt buộc sau:

```json
{
  "studyMetadata": {
    "protocolVersion": "1.0-CLINICAL",
    "institutionId": "OPHTHALMOLOGY_CLINIC_A",
    "examinerId": "DR_OPHTHALMOLOGIST_01",
    "studyDate": "YYYY-MM-DDTHH:mm:ssZ"
  },
  "participant": {
    "participantId": "SUBJ_2026_001",
    "ageGroup": "PEDIATRIC | ADULT | ELDERLY",
    "gender": "MALE | FEMALE | OTHER",
    "refractiveError": {
      "odSph": -1.50,
      "odCyl": -0.50,
      "osSph": -1.25,
      "osCyl": -0.75
    },
    "wearingGlassesDuringTest": false,
    "interpupillaryDistanceMm": 62.5
  },
  "testingEnvironment": {
    "cameraModel": "Logitech C920 HD Pro",
    "resolution": "1280x720@30fps",
    "patientDistanceMm": 550,
    "targetDistanceMm": 550,
    "ambientLux": 420,
    "fixationTargetType": "RED_CIRCLE_LED"
  },
  "clinicalReferencePACT": {
    "testedDistance": "NEAR_33CM | FAR_6M",
    "manifestDeviation": "ORTHO | ESOTROPIA | EXOTROPIA | HYPERTROPIA",
    "latentDeviation": "NONE | ESOPHORIA | EXOPHORIA | HYPERPHORIA",
    "pactHorizontalDelta": 12.0,
    "pactVerticalDelta": 0.0,
    "fixatingEye": "RIGHT",
    "clinicalNotes": "Exotropia intermittent, rapid recovery"
  },
  "cameraMeasurements": {
    "protocol": "ALTERNATE_COVER_TEST_3_CYCLES",
    "validCyclesCount": 3,
    "leftEye": {
      "medianNormalizedDisplacement": 0.124,
      "meanNormalizedDisplacement": 0.128,
      "medianPeakVelocity": 0.48,
      "meanTimeToPeakMs": 280,
      "baselineStabilityIQR": 0.021
    },
    "rightEye": {
      "medianNormalizedDisplacement": 0.032,
      "meanNormalizedDisplacement": 0.035,
      "medianPeakVelocity": 0.18,
      "meanTimeToPeakMs": 0,
      "baselineStabilityIQR": 0.018
    },
    "aiSupportingSignal": {
      "modelVersion": "strabismus_v1_onnx",
      "meanStrabismusScore": 0.72,
      "meanConfidence": 0.81
    },
    "dataQualityScore": 0.94
  }
}
```

---

## 3. Quy Trình Khám & Thử Nghiệm Đối Đầu (Double-Blind Protocol)

1. **Khám lâm sàng độc lập (Examiner A):**
   - Bác sĩ nhãn khoa 1 thực hiện đo khúc xạ, thị lực, đo khoảng cách đồng tử (IPD).
   - Thực hiện Cover-Uncover Test và Alternate Cover Test bằng thước lăng kính rời hoặc thanh lăng kính Berens (Prism Bar).
   - Ghi nhận độ lăng kính PACT ($\Delta$) cho cả cự ly gần (33cm) và cự ly xa (6m).
   - Kết quả được bảo mật độc lập, không cung cấp cho người điều hành hệ thống camera.
2. **Đo kỹ thuật số qua camera (Examiner B):**
   - Người tham gia ngồi trước máy tính trang bị webcam đã được định cự ly chuẩn ($50\text{cm} \pm 5\text{cm}$).
   - Tiến hành bài kiểm tra RemiCare Digital Cover Test đủ 3 chu kỳ.
   - Hệ thống tự động ghi nhận dữ liệu thô (raw landmarks), baseline mống mắt, và quỹ đạo mở mắt.
3. **Mã hóa và lưu trữ:**
   - Dữ liệu hai nhánh được ghép nối thông qua mã ẩn danh `participantId`.

---

## 4. Phương Pháp Thống Kê & Tiêu Chuẩn Đánh Giá (Statistical Analysis Plan)

### 4.1. Phân tích tương quan & Hồi quy tuyến tính
- Vẽ biểu đồ phân tán giữa **Độ dịch chuyển mống mắt chuẩn hóa ($X = \text{Normalized Displacement}$)** và **Độ lăng kính PACT ($Y = \text{Prism Diopters } \Delta$)**.
- Tính hệ số tương quan Pearson ($r$) và Spearman ($\rho$).
  - *Mục tiêu chấp nhận:* $r \ge 0.85$ ($p < 0.001$).
- Xây dựng phương trình hồi quy tuyến tính:

$$\Delta_{\text{estimated}} = \beta_1 \cdot \text{NormalizedDisplacement} + \beta_0$$

### 4.2. Độ tương đồng Bland-Altman (Bland-Altman Agreement)
- Tính toán độ lệch trung bình (Mean Difference / Bias) giữa độ lăng kính ước tính từ camera và độ lăng kính đo bằng PACT:

$$\bar{d} = \frac{1}{N} \sum_{i=1}^N (\Delta_{\text{camera}, i} - \Delta_{\text{PACT}, i})$$

- Xác định giới hạn tương đồng 95% (95% Limits of Agreement - LoA):

$$\text{LoA} = \bar{d} \pm 1.96 \cdot \text{SD}$$

- *Mục tiêu lâm sàng:* Giới hạn LoA nằm trong khoảng $\pm 4\Delta$ (mức sai số chấp nhận được trong thực hành lâm sàng nhãn khoa giữa các bác sĩ).

### 4.3. Đánh giá sai số định lượng (Error Metrics)
- **Sai số tuyệt đối trung bình (MAE):**

$$\text{MAE} = \frac{1}{N} \sum_{i=1}^N |\Delta_{\text{camera}, i} - \Delta_{\text{PACT}, i}| \quad (\text{Mục tiêu: } \text{MAE} \le 2.5\Delta)$$

- **Căn bậc hai sai số toàn phương trung bình (RMSE):**

$$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N (\Delta_{\text{camera}, i} - \Delta_{\text{PACT}, i})^2} \quad (\text{Mục tiêu: } \text{RMSE} \le 3.5\Delta)$$

### 4.4. Đánh giá Hiệu quả Sàng lọc (Diagnostic Performance)
Dựa trên ngưỡng lâm sàng phân định lác ($\ge 4\Delta$ hoặc $\ge 8\Delta$ theo tiêu chuẩn nhãn khoa cộng đồng):
- **Độ nhạy (Sensitivity):** Tỷ lệ phát hiện đúng người có chuyển động tái định vị lâm sàng. Mục tiêu: $\ge 90\%$.
- **Độ đặc hiệu (Specificity):** Tỷ lệ phân loại đúng người không có lác / chính thị. Mục tiêu: $\ge 85\%$.
- **Đường cong ROC và diện tích dưới đường cong (ROC-AUC):** Mục tiêu: $\text{AUC} \ge 0.92$.

---

## 5. Kế Hoạch Kiểm Định Lâm Sàng Nghiệm Pháp Brock String

### 5.1. Tiêu chuẩn vàng đối chiếu lâm sàng
- **Thiết bị đối chiếu 1:** **Thước RAF (Royal Air Force Rule)** đo Điểm quy tụ gần (Near Point of Convergence - NPC) và Biên độ điều tiết (Accommodation Amplitude).
- **Thiết bị đối chiếu 2:** **Máy đo thị giác hai mắt Synoptophore** hoặc Thanh lăng kính phân ly để đo góc quy tụ khách quan (Objective Angle) và góc quy tụ chủ quan (Subjective Angle).
- **Quy trình:**
  1. Bác sĩ đo NPC và góc quy tụ bằng Synoptophore tại 3 cự ly tương ứng (20cm, 50cm, 100cm).
  2. Bệnh nhân thực hiện bài kiểm tra Brock String số hóa trên RemiCare.
  3. Đối chiếu chỉ số biến thiên quy tụ `vergenceRatio` với góc quy tụ Synoptophore và khoảng cách NPC thực tế.

### 5.2. Mô hình hồi quy chuyển đổi góc quy tụ
$$\text{ConvergenceAngle}^\circ = \gamma_1 \cdot \text{vergenceRatio} + \gamma_0$$
Chỉ khi nghiên cứu hoàn tất với hệ số tương quan $r \ge 0.80$, hàm `calibrateBrockStringMeasurement` mới được kích hoạt cập nhật giá trị độ góc.

---

## 6. Khung Phân Định 5 Tầng Bắt Buộc

Mọi tài liệu và báo cáo kỹ thuật của RemiCare phải tuân thủ nghiêm ngặt 5 tầng phân định sau:

| Tầng phân định | Phạm vi nội dung | Ví dụ cụ thể |
| :--- | :--- | :--- |
| **1. Clinical Protocol** | Quy trình y khoa chuẩn được giới nhãn khoa công nhận | Che mắt 4-5s phá vỡ hợp thị; Brock String tạo song thị sinh lý. |
| **2. Engineering Implementation** | Giải pháp phần mềm, cảm biến, thuật toán thị giác | MediaPipe Face Mesh, FPS loop, Canvas rendering, Web Speech API. |
| **3. Measurement Formula** | Công thức toán học thuần túy | $\text{displacement} / \text{eyeWidth}$; $\text{interIrisDistance} / \text{interCanthalDistance}$. |
| **4. Research Assumption** | Giả định kỹ thuật phục vụ thử nghiệm nội bộ | Ngưỡng $0.10$ kích hoạt cờ dịch chuyển; Tỉ trọng tạm thời CV/AI. |
| **5. Clinical Validation Requirement** | Yêu cầu pháp lý và y đức bắt buộc trước khi chẩn đoán | Nghiên cứu đối đầu PACT ($N \ge 100$), phê duyệt IRB, chứng nhận SaMD. |

> [!CAUTION]
> **Tuyệt đối không biến Research Assumption thành Clinical Fact!**
> 1. **Tuyệt đối không bịa đặt dữ liệu (Zero Synthetic Fabrication):** Không được sinh dữ liệu giả lập hay gán ngẫu nhiên số $\Delta$ để vờ như đã hoàn thành kiểm định lâm sàng.
> 2. **Chỉ tích hợp vào `calibrationService.js` khi có kết quả thực nghiệm:** Tệp `src/services/calibrationService.js` sẽ giữ nguyên trạng thái `CALIBRATION_STATUS.NOT_CALIBRATED` cho tới khi hoàn tất nghiên cứu trên tập mẫu $N \ge 100$ bệnh nhân có hội đồng y đức (IRB Approval) phê duyệt.
