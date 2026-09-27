# ĐẶC TẢ KỸ THUẬT PHÉP ĐO BROCK STRING SỐ HÓA
## REMICARE AI DIGITAL BROCK STRING MEASUREMENT SPECIFICATION

---

## 1. Mục Tiêu & Nguyên Lý Lâm Sàng

### 1.1. Mục tiêu cốt lõi
Hệ thống **RemiCare AI** mở rộng giao thức sàng lọc thị giác hai mắt (Binocular Vision Screening) bằng việc số hóa bài tập/nghiệm pháp **Brock String** thông qua webcam thông thường và thị giác máy tính MediaPipe Face Mesh.

Mục tiêu chính:
1. Theo dõi chuyển động hai mắt và phản xạ quy tụ (Vergence / Convergence) khi người tham gia chuyển điểm nhìn lần lượt giữa các hạt tiêu điểm (Target Beads) ở các cự ly khác nhau.
2. Đo lường chỉ số quy tụ quang học hai mắt tương quan (Relative Vergence Metric) dựa trên hình học mống mắt và khóe mắt.
3. Đánh giá độ ổn định định thị (Fixation Stability) tại từng vị trí hạt và thời gian chuyển tiếp (Transition Latency) giữa các tiêu điểm.
4. Thiết lập cổng kiểm soát chất lượng dữ liệu khắt khe (Data Quality Layer) để loại trừ sai số do nghiêng đầu, mất mống mắt hoặc cử động chớp mắt.
5. **Tuyệt đối không chẩn đoán:** Hệ thống chỉ xuất kết quả trung lập (`MEASURABLE` hoặc `INCONCLUSIVE`). Không tự kết luận "suy giảm quy tụ" (Convergence Insufficiency), "lác ẩn" (Phoria), hay "lác hiện" (Strabismus) khi chưa có kiểm định lâm sàng.

### 1.2. Cơ sở sinh lý thị giác hai mắt của nghiệm pháp Brock String
- **Dây Brock (Brock String):** Là dụng cụ kinh điển trong trị liệu thị giác (Vision Therapy) gồm một sợi dây trắng dài (thường 1m - 3m) với 3 hạt màu được bố trí ở cự ly Gần (Near - ~20cm), Trung bình (Mid - ~50cm), và Xa (Far - ~100cm). Một đầu dây tì vào sống mũi, đầu kia cố định vào một vật cố định.
- **Hiện tượng song thị sinh lý (Physiological Diplopia):** Khi cố định mắt vào một hạt, người có thị giác hai mắt bình thường sẽ thấy 2 sợi dây giao nhau đúng tại tâm hạt đó thành hình chữ "X". Các hạt ở phía trước hoặc phía sau hạt đang nhìn sẽ xuất hiện thành hình ảnh đôi.
- **Động học quy tụ (Ocular Vergence Kinematics):**
  - Khi nhìn hạt XA (Far): Hai trục thị giác gần như song song, khoảng cách giữa 2 mống mắt lớn nhất.
  - Khi chuyển sang hạt GẦN (Near): Cơ thẳng trong (Medial Rectus) của cả hai mắt co lại, kéo hai mống mắt dịch chuyển về phía mũi (Nasal direction). Khoảng cách giữa 2 mống mắt trên mặt phẳng cảm biến camera giảm xuống so với khoảng cách giữa hai khóe mắt.

---

## 2. Giao thức Tọa độ & Điểm mốc Sinh trắc học

Hệ thống sử dụng MediaPipe Face Mesh (`refineLandmarks: true`) với các điểm mốc 2D chuẩn hóa:

| Điểm mốc sinh trắc học | Chỉ số MediaPipe | Ý nghĩa quang học |
| :--- | :---: | :--- |
| **Tâm mống mắt trái (Left Iris Center)** | `468` | Tọa độ $X_L, Y_L$ tâm giác mạc mắt trái |
| **Tâm mống mắt phải (Right Iris Center)** | `473` | Tọa độ $X_R, Y_R$ tâm giác mạc mắt phải |
| **Khóe trong mắt trái (Left Inner Canthus)** | `362` | Điểm neo giải phẫu góc trong mắt trái |
| **Khóe ngoài mắt trái (Left Outer Canthus)** | `263` | Điểm neo giải phẫu góc ngoài mắt trái |
| **Khóe trong mắt phải (Right Inner Canthus)** | `133` | Điểm neo giải phẫu góc trong mắt phải |
| **Khóe ngoài mắt phải (Right Outer Canthus)** | `33` | Điểm neo giải phẫu góc ngoài mắt phải |
| **Chóp mũi (Nose Tip)** | `1` | Tham chiếu tư thế đầu (Head Pose Yaw) |
| **Gốc mũi giữa hai mắt (Glabella / Sellion)** | `168` | Tham chiếu đường đối xứng dọc mặt |

---

## 3. Công Thức & Chỉ Số Đo Lường (Measurement Formulas)

### 3.1. Kích thước hình học tham chiếu (Inter-Canthal & Eye Width)

1. **Độ rộng mắt trái & mắt phải:**
   $$\text{eyeWidth}_L = \sqrt{(x_{263} - x_{362})^2 + (y_{263} - y_{362})^2}$$
   $$\text{eyeWidth}_R = \sqrt{(x_{33} - x_{133})^2 + (y_{33} - y_{133})^2}$$

2. **Khoảng cách giữa hai khóe trong mắt (Inter-Canthal Distance):**
   $$D_{\text{canthal}} = \sqrt{(x_{362} - x_{133})^2 + (y_{362} - y_{133})^2}$$
   *Lưu ý:* $D_{\text{canthal}}$ là khoảng cách giải phẫu cố định trên hộp sọ của mỗi cá nhân, không thay đổi khi mắt liếc hay đảo, do đó được dùng làm **mẫu số chuẩn hóa tuyệt đối** cho các phép đo khoảng cách hai mắt trên mặt phẳng camera.

### 3.2. Khoảng cách hai tâm mống mắt (Inter-Iris Distance)
$$D_{\text{iris}} = \sqrt{(x_{468} - x_{473})^2 + (y_{468} - y_{473})^2}$$

### 3.3. Tỉ lệ quy tụ quang học (Vergence Ratio)
Chỉ số tỉ lệ quy tụ tương đối được định nghĩa:
$$\text{vergenceRatio} = \frac{D_{\text{iris}}}{D_{\text{canthal}}}$$

*Quy luật sinh lý trên mặt phẳng quan sát webcam:*
- Khi người nhìn tập trung vào tiêu điểm **XA (Far)**: Hai mắt nhìn thẳng, $\text{vergenceRatio}_{\text{FAR}}$ đạt giá trị lớn nhất.
- Khi người nhìn chuyển tiêu điểm vào **TRUNG BÌNH (Mid)**: Hai mắt quy tụ nhẹ, $\text{vergenceRatio}_{\text{MID}}$ giảm.
- Khi người nhìn chuyển tiêu điểm vào **GẦN (Near)**: Cả hai mắt quy tụ tối đa về phía sống mũi, $\text{vergenceRatio}_{\text{NEAR}}$ đạt giá trị nhỏ nhất.
- Hệ số quy tụ lý thuyết:
  $$\Delta \text{vergence} = \text{vergenceRatio}_{\text{FAR}} - \text{vergenceRatio}_{\text{NEAR}} > 0$$

### 3.4. Vị trí mống mắt tương đối từng mắt (Monocular Iris Ratios)
- **Mắt trái (theo quy ước MediaPipe):**
  $$r_{\text{left}} = \frac{x_{468} - x_{362}}{\text{eyeWidth}_L}$$
  *Khi mắt trái quy tụ về phía mũi, mống mắt tiến gần $x_{362}$, $r_{\text{left}}$ giảm về phía 0.*
- **Mắt phải (theo quy ước MediaPipe):**
  $$r_{\text{right}} = \frac{x_{473} - x_{133}}{\text{eyeWidth}_R}$$
  *Khi mắt phải quy tụ về phía mũi, mống mắt tiến gần $x_{133}$, $r_{\text{right}}$ giảm về phía 0.*

### 3.5. Độ ổn định định thị mục tiêu (Fixation Stability)
Tại mỗi mục tiêu (NEAR, MID, FAR), sau khi trừ pha trễ chuyển tiếp 500ms đầu tiên, hệ thống ghi nhận $M \ge 20$ frames và tính khoảng tứ phân vị (Interquartile Range - IQR) của `vergenceRatio`:
$$\text{IQR}(\text{vergence}) = Q_3(\text{vergenceRatio}) - Q_1(\text{vergenceRatio})$$

- Nếu $\text{IQR} \le 0.04$: Định thị rất vững vàng (`GOOD_STABILITY`).
- Nếu $0.04 < \text{IQR} \le 0.08$: Dao động nhẹ (`MODERATE_STABILITY`).
- Nếu $\text{IQR} > 0.08$: Dao động lớn, định thị không ổn định (`POOR_STABILITY`).

---

## 4. Kiến Trúc Kỹ Thuật (Engineering Implementation)

### 4.1. Cấu hình tiêu điểm động (Dynamic Target Configuration)
Người dùng/Kỹ thuật viên có thể cấu hình khoảng cách vật lý của từng hạt trên thanh trượt UI:
- Hạt Gần (`NEAR`): Mặc định $20\text{ cm}$ (dải cho phép $10 - 35\text{ cm}$).
- Hạt Giữa (`MID`): Mặc định $50\text{ cm}$ (dải cho phép $36 - 75\text{ cm}$).
- Hạt Xa (`FAR`): Mặc định $100\text{ cm}$ (dải cho phép $76 - 200\text{ cm}$).

### 4.2. Trình tự tự động (Automated Sequence Runner)
Quy trình thực hiện tuần tự:
```
[CHỌN CẤU HÌNH] -> [HẠT GẦN (20cm, 4.0s)] -> [HẠT GIỮA (50cm, 4.0s)] -> [HẠT XA (100cm, 4.0s)] -> [TỔNG HỢP KẾT QUẢ]
```
Trong quá trình chạy tự động:
- Giọng nói trợ lý (Web Speech API) thông báo tên tiêu điểm cần nhìn.
- Người dùng có thể tạm dừng hoặc chọn từng hạt thủ công để kiểm tra lặp lại.

---

## 5. Tầng Kiểm Soát Chất Lượng Dữ Liệu (Data Quality Gating)

Mỗi khung hình và mỗi phiên thử nghiệm phải vượt qua ma trận kiểm soát:

| Điều kiện lỗi | Mã nguyên nhân (`QUALITY_REASONS`) | Hành vi xử lý |
| :--- | :--- | :--- |
| Không tìm thấy khuôn mặt | `NO_FACE` | Đánh dấu frame không hợp lệ, không tích lũy dữ liệu. |
| Mất nhận diện 1 mắt (bị che hoặc quay mặt) | `ONE_EYE_MISSING` | Trả về `isValid: false`, thông báo cảnh báo. |
| Mất tâm mống mắt (nhắm mắt, chớp mắt) | `IRIS_MISSING` | Loại khỏi mẫu tính toán, không thay thế bằng 0. |
| Độ rộng mắt bất thường ($< 15\text{px}$ hoặc $> 300\text{px}$) | `INVALID_EYE_WIDTH` | Đánh dấu người dùng quá xa hoặc quá sát camera. |
| Đầu nghiêng lệch quá mức ($\|\text{Roll}\| > 15^\circ$, $\|\text{Yaw}\| > 18^\circ$) | `HEAD_POSE_INVALID` | Đánh dấu frame bị suy giảm chất lượng (`DEGRADED`). |
| Số lượng mẫu hợp lệ $< 15$ frames / mục tiêu | `INSUFFICIENT_SAMPLES` | Mục tiêu bị đánh dấu `INCONCLUSIVE`. |
| Độ rung giật vị trí mống mắt quá lớn ($\text{Jitter} > 0.08$) | `EXCESSIVE_JITTER` | Mục tiêu bị đánh dấu `INCONCLUSIVE`. |

---

## 6. Phân Biệt Giả Định Kỹ Thuật & Sự Thật Lâm Sàng

> [!CAUTION]
> **Tuyên ngôn An toàn Y khoa Nghiêm ngặt:**
> Tuyệt đối không được xem các chỉ số hình học webcam là chỉ số lâm sàng đã kiểm định:

1. **Chỉ số $\text{vergenceRatio}$ là chỉ số hình học 2D trên cảm biến:** Nó phản ánh hình chiếu chuyển động mống mắt trên cảm biến máy ảnh, chịu ảnh hưởng bởi tiêu cự ống kính, khoảng cách từ mặt tới camera và góc đặt camera.
2. **Không quy đổi thành "Góc quy tụ lâm sàng" (Clinical Convergence Angle):** Trong nhãn khoa, góc quy tụ được tính bằng Độ lăng kính ($\Delta$) hoặc Độ góc ($^\circ$) dựa trên khoảng cách đồng tử (PD) thực tế đo bằng máy đo khúc xạ tự động và thước đo tiêu điểm gần (RAF Rule).
3. **Trạng thái hiệu chuẩn bắt buộc:** Hàm `calibrateBrockStringMeasurement()` luôn trả về:
   ```json
   {
     "status": "NOT_CALIBRATED",
     "value": null,
     "convergenceAngleDegrees": null,
     "clinicalNote": "Hệ thống chưa có bộ dữ liệu ghép cặp lâm sàng để hiệu chuẩn sang góc quy tụ lâm sàng."
   }
   ```
4. **Kết luận sàng lọc trung lập:** Kết quả chỉ gồm 2 trạng thái:
   - `MEASURABLE`: Đo lường được xu hướng biến thiên quy tụ hai mắt qua các hạt.
   - `INCONCLUSIVE`: Dữ liệu không đủ độ tin cậy để đưa ra nhận định kỹ thuật.
