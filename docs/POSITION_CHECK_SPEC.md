# ĐẶC TẢ KỸ THUẬT BƯỚC KIỂM TRA VỊ TRÍ (POSITION CHECK SPECIFICATION)
## REMICARE POSITION CALIBRATION & POSTURE VALIDATION SPECIFICATION

---

## 1. Mục Tiêu & Nguyên Lý Kỹ Thuật

### 1.1. Mục tiêu cốt lõi
Bước **Kiểm tra vị trí (Position Check)** là cổng kiểm soát tiên quyết (Prerequisite Gate) trong quy trình Sàng lọc Thị giác Hai mắt (Digital Binocular Vision Screening).
Mục đích:
1. Định hướng người tham gia ngồi vào cự ly làm việc tối ưu của webcam laptop: **20 – 25 cm**.
2. Đảm bảo cảm biến thu nhận đầy đủ 478 điểm mốc khuôn mặt, 2 hốc mắt và 2 tâm mống mắt trước khi bước vào các bài test vận động.
3. Kiểm tra tư thế đầu (Head Posture) đảm bảo không bị nghiêng (Roll), quay (Yaw), hoặc ngửa/cúi (Pitch) quá mức cho phép.
4. Ngăn chặn người dùng bấm bắt đầu khi các điều kiện kỹ thuật chưa đạt chuẩn (`canStart === false`).

### 1.2. Bản chất kỹ thuật của ước lượng cự ly qua Webcam
> [!IMPORTANT]
> **Tuyên bố An toàn Kỹ thuật & Y khoa:**
> Webcam laptop thông thường **không có cảm biến độ sâu phần cứng (ToF / Structured Light)**.
> Mọi phép đo khoảng cách trong mã nguồn là **ƯỚC LƯỢNG TƯƠNG ĐỐI (Relative Estimation)**, được đặt tên bắt buộc trong code là:
> `estimatedDistanceCm`
> Tuyệt đối **KHÔNG ĐƯỢC ĐẶT TÊN** là `exactDistanceCm` và **KHÔNG ĐƯỢC TUYÊN BỐ** đây là thước đo vật lý chính xác.

---

## 2. Mô Hình Toán Học Ước Lượng Khoảng Cách (Pinhole Scaling Model)

Dựa trên mô hình máy ảnh lỗ kim (Pinhole Camera Model):
$$\text{ApparentFeatureSize} = \frac{\text{PhysicalFeatureSize} \cdot f}{\text{Distance}}$$

Với độ phân giải webcam chuẩn ($640 \times 480$), góc nhìn trường ảnh $\text{FOV} \approx 65^\circ$:
- Tại cự ly tối ưu chuẩn $D_0 = 22.5\text{ cm}$:
  - Độ rộng khuôn mặt chuẩn hóa giữa hai thái dương/gò má (Landmarks 234 và 454): $W_0 \approx 0.43$ (chiếm ~43% chiều ngang khung hình).
  - Khoảng cách giữa hai khóe trong mắt (Landmarks 362 và 133): $C_0 \approx 0.105$.
- Tỉ lệ co giãn tương đối (Relative Scale Factor):
  $$S = \frac{\text{dist2D}(\text{point}_{234}, \text{point}_{454})}{W_0}$$
- Khoảng cách ước tính:
  $$\text{estimatedDistanceCm} = \frac{D_0}{S} = \frac{22.5}{S} \quad (\text{giới hạn vật lý: } [10\text{ cm}, 100\text{ cm}])$$

---

## 3. Ma Trận Kiểm Tra Điều Kiện (5-Gate Checklist)

Để nút **[ BẮT ĐẦU SÀNG LỌC ]** được kích hoạt, toàn bộ 5 điều kiện sau phải thỏa mãn đồng thời:

| Điều kiện kiểm tra | Tiêu chí kỹ thuật | Thông báo khi không đạt |
| :--- | :--- | :--- |
| **1. `faceDetected`** | `landmarks.length >= 478` | "Không phát hiện khuôn mặt. Hãy nhìn thẳng vào webcam." |
| **2. `bothEyesDetected`** | Tồn tại đủ mốc 362, 263, 133, 33 | "Mất nhận diện một mắt. Hãy vén tóc và nhìn thẳng vào camera." |
| **3. `irisDetected`** | Tồn tại mốc 468, 473 trong khung hình hợp lệ | "Không nhận diện rõ mống mắt. Hãy mở mắt to và kiểm tra ánh sáng." |
| **4. `headPoseValid`** | $\|\text{Roll}\| \le 12^\circ$, $\|\text{Yaw}\| \le 15^\circ$, $\|\text{Pitch}\| \le 15^\circ$ | "Đầu đang bị nghiêng/quay. Vui lòng giữ đầu thẳng đứng đối diện màn hình." |
| **5. `distanceValid`** | $20.0\text{ cm} \le \text{estimatedDistanceCm} \le 25.0\text{ cm}$ | $< 20\text{cm}$: "Bạn đang ngồi quá gần. Vui lòng lùi ra một chút."<br/>$> 25\text{cm}$: "Bạn đang ngồi quá xa. Vui lòng tiến gần hơn." |

---

## 4. Giao Diện Người Dùng & Phản Hồi Trực Quan

```
---------------------------------------------------------------
KIỂM TRA VỊ TRÍ
---------------------------------------------------------------
Hãy ngồi thẳng và nhìn vào camera.

[ CAMERA PREVIEW ]
Khoảng cách ước tính: ~22.5 cm

[==== Quá gần (<20) ====][==== Mục tiêu (20-25cm) ====][==== Quá xa (>25) ====]
                                      ▲ (Marker)

"Khoảng cách phù hợp (~22.5 cm). Vị trí sẵn sàng để bắt đầu."

✓ Khuôn mặt được phát hiện
✓ Hai mắt được phát hiện
✓ Mống mắt nhận diện rõ
✓ Vị trí đầu thẳng đứng (Roll: 1.2°, Yaw: 0.8°)
✓ Khoảng cách chuẩn (20–25 cm)

[ BẮT ĐẦU SÀNG LỌC ]
---------------------------------------------------------------
```
