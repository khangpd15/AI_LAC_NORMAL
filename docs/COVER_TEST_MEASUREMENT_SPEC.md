# ĐẶC TẢ KỸ THUẬT PHÉP ĐO COVER TEST SỐ HÓA
## REMICARE AI DIGITAL COVER TEST MEASUREMENT SPECIFICATION

---

## 1. Mục tiêu & Nguyên lý Lâm sàng

### 1.1. Mục tiêu cốt lõi
Hệ thống **RemiCare AI** được thiết kế nhằm số hóa quy trình khám sàng lọc lâm sàng của nghiệm pháp che mắt (Cover-Uncover Test và Alternate Cover Test) thông qua webcam thông thường và thị giác máy tính client-side.

Hệ thống **KHÔNG PHẢI** là một mô hình phân loại ảnh tĩnh ("AI nhìn webcam rồi đoán có lác hay không"). Thay vào đó, hệ thống thực hiện:
1. Theo dõi tọa độ mống mắt chính xác theo thời gian thực (Spatial-Temporal Tracking).
2. Xây dựng đường chuẩn vị trí ổn định (Robust Baseline Fixation).
3. Ghi nhận và phân tích động học tái định vị (Refixation Saccade Kinematics) của mắt quan sát khi bỏ che mắt đối bên.
4. Đo lường các chỉ số vật lý/hình học chuẩn hóa (Displacement, Velocity, Timing).
5. Sử dụng mô hình học máy (ONNX) như một tầng **tín hiệu hỗ trợ hình thái tĩnh** (Secondary Supporting Signal), tuyệt đối không để AI trở thành nguồn quyết định lâm sàng duy nhất.

### 1.2. Nguyên lý nhãn khoa của nghiệm pháp Cover Test
- **Sinh lý học:** Khi một mắt bị che lại, sự hợp thị hai mắt (Binocular Fusion) bị phá vỡ. Nếu mắt bị che hoặc mắt còn lại có độ lác (lác ẩn - phoria hoặc lác hiện - tropia), mắt đó sẽ trôi lệch khỏi trục thị giác.
- **Hiện tượng tái định thị (Refixation Saccade):** Ngay khi bỏ che mắt, nếu mắt đối bên hoặc mắt vừa bỏ che đang lệch trục, nó buộc phải thực hiện một chuyển động giật mắt nhanh (saccade) về phía điểm cố định thị giác (Fixation Target).
- **Cửa sổ thời gian then chốt:** Chuyển động tái định vị diễn ra rất nhanh, thường bắt đầu trong khoảng **150 – 300ms** và hoàn tất ổn định trong vòng **500ms** đầu tiên sau khi mở mắt.

---

## 2. Giao thức Tọa độ & Chuẩn hóa Hình học

### 2.1. Điểm mốc sinh trắc học (MediaPipe Face Mesh 478 Landmarks)
Hệ thống kích hoạt `refineLandmarks: true` để thu nhận chính xác các điểm mốc mống mắt và khóe mắt:

| Điểm mốc | Chỉ số MediaPipe | Vai trò lâm sàng |
| :--- | :---: | :--- |
| **Tâm mống mắt trái** | `468` | Tọa độ $X, Y$ tâm giác mạc / mống mắt trái |
| **Tâm mống mắt phải** | `473` | Tọa độ $X, Y$ tâm giác mạc / mống mắt phải |
| **Khóe trong mắt trái (Nasal Canthus)** | `362` | Điểm neo gốc trong rãnh mi mắt trái |
| **Khóe ngoài mắt trái (Temporal Canthus)** | `263` | Điểm neo ngoài bờ mi mắt trái |
| **Khóe trong mắt phải (Nasal Canthus)** | `133` | Điểm neo gốc trong rãnh mi mắt phải |
| **Khóe ngoài mắt phải (Temporal Canthus)** | `33` | Điểm neo ngoài bờ mi mắt phải |

### 2.2. Chuẩn hóa khoảng cách theo chiều rộng mắt (Eye-Width Normalization)
Để triệt tiêu sai số do khoảng cách từ người dùng tới webcam (khoảng cách gần/xa làm thay đổi kích thước pixel trên cảm biến), mọi chuyển động pixel đều **bắt buộc** phải được chuẩn hóa theo độ rộng rãnh mi mắt của chính bệnh nhân:

$$\text{eyeWidth} = \sqrt{(x_{\text{outer}} - x_{\text{inner}})^2 + (y_{\text{outer}} - y_{\text{inner}})^2}$$

Tọa độ vị trí ngang mống mắt chuẩn hóa ($X_{\text{norm}}$):

$$X_{\text{norm}} = \frac{x_{\text{iris}} - x_{\text{inner}}}{\text{eyeWidth}}$$

$$Y_{\text{norm}} = \frac{y_{\text{iris}} - y_{\text{inner}}}{\text{eyeWidth}}$$

*Ý nghĩa:* Giá trị $X_{\text{norm}} \approx 0.50$ phản ánh mống mắt nằm cân đối ở chính giữa hai khóe mắt.

---

## 3. Quy trình Đo lường Số hóa Từng Pha

```
[INTRO] -> [BASELINE (4.5s)] -> [COVER LEFT (5.0s)] -> [UNCOVER LEFT (4.5s: Track Right Eye)]
                 │                                                   │
        Robust Median Baseline                              Trajectory Kinematics
                 │                                                   │
                 └───────────────────► So sánh đối chiếu ◄───────────┘
                                                │
[COVER RIGHT (5.0s)] -> [UNCOVER RIGHT (4.5s: Track Left Eye)] -> [REST (3.0s)] -> (Lặp lại 3 chu kỳ)
```

### 3.1. Pha Cố định thị giác ban đầu (Multi-Frame Robust Baseline)
- **Thời lượng:** 4500ms (~4.5 giây).
- **Thu thập mẫu:** Ghi nhận liên tục $N \ge 20$ khung hình cho **cả hai mắt** khi người dùng nhìn chăm chú vào chấm đỏ trung tâm.
- **Công thức tính Baseline trung vị:**

$$\text{baselineX} = \text{median}(\{x_{\text{iris}, i}\}_{i=1}^N)$$

$$\text{baselineY} = \text{median}(\{y_{\text{iris}, i}\}_{i=1}^N)$$

- **Đánh giá độ ổn định thị giác (Fixation Stability):**
  Sử dụng khoảng tứ phân vị (Interquartile Range - IQR) của tọa độ chuẩn hóa:

$$\text{IQR}(X_{\text{norm}}) = Q_3(X_{\text{norm}}) - Q_1(X_{\text{norm}})$$

  Nếu $\text{IQR} > 0.06$ (người dùng liếc nhìn xung quanh, đầu cử động mạnh), baseline bị đánh dấu là không ổn định (`isStable = false`).

### 3.2. Pha Mở mắt & Ghi nhận Động học Quỹ đạo (Uncover Trajectory Tracking)
- **Mắt theo dõi:**
  - Khi mở mắt trái (`UNCOVER_LEFT`): Hệ thống tập trung quan sát **MẮT PHẢI**.
  - Khi mở mắt phải (`UNCOVER_RIGHT`): Hệ thống tập trung quan sát **MẮT TRÁI**.
- **Cấu trúc mẫu ghi nhận:** Mỗi mẫu trong mảng quỹ đạo gồm:
  `{ timestamp, t, x, y, normalizedX, normalizedY, quality }` trong đó $t = 0\text{ms}$ tại thời điểm mở mắt.
- **Cửa sổ phân tích sớm (Early Analysis Window):** $0 \le t \le 500\text{ms}$.
- **Độ dịch chuyển tịnh tiến chuẩn hóa (Normalized Displacement):**

$$d_{\text{early}} = \frac{\sqrt{(x_{500\text{ms}} - x_{0\text{ms}})^2 + (y_{500\text{ms}} - y_{0\text{ms}})^2}}{\text{eyeWidth}}$$

- **Vận tốc tức thời & Vận tốc đỉnh (Peak Velocity):**

$$v(t_i) = \frac{\sqrt{(x_i - x_{i-1})^2 + (y_i - y_{i-1})^2}}{\text{eyeWidth} \cdot \Delta t_i} \quad (\text{đơn vị: eyeWidth/giây})$$

$$v_{\text{peak}} = \max_{i} v(t_i), \quad t_{\text{peak}} = \arg\max_{i} v(t_i)$$

- **Vận tốc trung bình (Mean Velocity):**

$$\bar{v} = \frac{d_{\text{early}}}{\Delta t_{\text{early}}}$$

- **Thời lượng vận động (Movement Duration):** Thời điểm vận tốc sau đỉnh giảm xuống dưới ngưỡng nghỉ ($< 25\% \cdot v_{\text{peak}}$).
- **Độ dịch chuyển so với Baseline ban đầu:**

$$d_{\text{from\_baseline}} = \frac{\sqrt{(x_{0\text{ms}} - \text{baselineX})^2 + (y_{0\text{ms}} - \text{baselineY})^2}}{\text{eyeWidth}}$$

---

## 4. Phân định Rõ ràng: Ngưỡng Kỹ thuật vs Ngưỡng Lâm sàng

> [!IMPORTANT]
> **Tuyên bố An toàn Y khoa Bắt buộc:**
> Mọi ngưỡng xử lý số trong mã nguồn hiện tại là **NGƯỠNG KỸ THUẬT (Engineering Parameter / Research Heuristic)** phục vụ lọc nhiễu tín hiệu thị giác máy tính, **KHÔNG PHẢI LÀ NGƯỠNG CHẨN ĐOÁN LÂM SÀNG (Clinically Validated Threshold)**.

| Tham số | Giá trị | Bản chất | Ghi chú an toàn |
| :--- | :---: | :--- | :--- |
| `DISPLACEMENT_THRESHOLD` | `0.10` (10% độ rộng mắt) | **Ngưỡng kỹ thuật** | Tín hiệu dịch chuyển $> 10\%$ độ rộng mắt trong 500ms để kích hoạt cờ theo dõi. Tuyệt đối không tự tuyên bố $0.10 = \text{strabismus}$. |
| `VELOCITY_THRESHOLD` | `0.25` eyeWidth/s | **Ngưỡng kỹ thuật** | Ngưỡng phân tách giữa chuyển động đảo mắt trôi nhẹ (drift) và giật mắt nhanh (saccade). |
| `EARLY_ANALYSIS_WINDOW_MS` | `500ms` | **Tiêu chuẩn sinh lý nhãn khoa** | Thời gian phản ứng tái định vị thị giác của con người. |
| `MIN_VALID_SAMPLES_UNCOVER`| `15` frames | **Cổng kiểm soát chất lượng** | Đảm bảo tần số webcam đạt $\ge 20\text{ FPS}$ trong cửa sổ ghi nhận. |

---

## 5. Nguyên tắc Quản lý Độ Lăng Kính (Prism Diopters — $\Delta$)

### 5.1. Tình trạng Hiện tại: `NOT_CALIBRATED`
- Nghiệm pháp khám lác lâm sàng tiêu chuẩn vàng sử dụng thanh lăng kính để triệt tiêu chuyển động mắt (**Prism and Alternate Cover Test — PACT**), cho kết quả bằng Độ lăng kính (Prism Diopters - $\Delta$).
- Vì hệ thống webcam **chưa trải qua nghiên cứu hiệu chuẩn chéo (Empirical Cross-Calibration Study) với bệnh nhân thực tế và bác sĩ đo PACT**, hệ thống **TUYỆT ĐỐI KHÔNG TỰ QUY ĐỔI** độ lệch pixel thành $10\Delta, 15\Delta, 20\Delta$.
- Mọi hàm chuyển đổi (`cameraMeasurementToPrismDiopters`) phải trả về:
  ```javascript
  {
    status: "NOT_CALIBRATED",
    prismDiopters: null,
    clinicalNote: "Chưa hiệu chuẩn thực nghiệm với PACT. Không xuất độ lăng kính."
  }
  ```

---

## 6. Kiến trúc Dung hợp Đa phương thức (Decision Support Architecture)

Mô hình phân bổ vai trò mới:
```
┌────────────────────────────────────────────────────────┐
│             CỔNG CHẤT LƯỢNG DỮ LIỆU                     │
│  (Nhận diện mặt, mắt, mống mắt, độ ổn định Baseline)    │
└──────────────────────────┬─────────────────────────────┘
                           │ Đạt chất lượng?
            ┌──────────────┴──────────────┐
            ▼ Có                          ▼ Không
┌──────────────────────────────┐   ┌─────────────────────┐
│ TÍN HIỆU CHÍNH (PRIMARY)     │   │ KẾT QUẢ:            │
│ Phép đo Cover Test số hóa    │   │ INCONCLUSIVE        │
│ (Displacement, Saccade Vel)  │   │ (Dữ liệu không đủ)  │
└──────────────┬───────────────┘   └─────────────────────┘
               │
               ▼
┌──────────────────────────────┐
│ TÍN HIỆU HỖ TRỢ (SUPPORTING) │
│ Mô hình AI ONNX WebAssembly  │
│ (Đánh giá hình thái tĩnh)    │
└──────────────┬───────────────┘
               │
               ▼
┌────────────────────────────────────────────────────────┐
│           KẾT LUẬN SÀNG LỌC TRUNG LẬP Y KHOA            │
│  - "Có ghi nhận chuyển động tái định thị đáng chú ý"   │
│  - "Không ghi nhận chuyển động tái định thị đáng chú ý"│
└────────────────────────────────────────────────────────┘
```

1. **Cover Test Measurement là quyết định chính:** Nếu mắt không hề có chuyển động giật tái định vị, AI tĩnh **không được phép** kết luận có lác.
2. **AI là tín hiệu bổ trợ hình thái học:** AI kiểm tra sự bất đối xứng vị trí mống mắt tĩnh. Nếu cả Cover Test ghi nhận giật mắt và AI ghi nhận bất thường hình thái, hệ thống ghi nhận tính đồng thuận cao (`CONCORDANT_NOTABLE`).
3. **Tổng hợp đa chu kỳ:** Áp dụng quy tắc đa số phiếu (Majority Voting $\ge 2/3$ chu kỳ) và tính trung vị độ dịch chuyển (`medianDisplacement`), vận tốc đỉnh (`medianPeakVelocity`).
