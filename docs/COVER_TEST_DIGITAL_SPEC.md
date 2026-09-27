# ĐẶC TẢ NGHIỆM PHÁP CHE MẮT SỐ HÓA (DIGITAL COVER TEST SPECIFICATION)
## REMICARE DIGITAL COVER-UNCOVER & REFIXATION KINEMATICS

---

## 1. Giao Thức Khám Lâm Sàng Số Hóa

Nghiệm pháp Che mắt số hóa (Digital Cover Test) mô phỏng quy trình Cover-Uncover Test kinh điển của chuyên khoa mắt nhằm phát hiện chuyển động giật mắt tái định vị (Refixation Saccade) sau khi phá vỡ sự hợp thị hai mắt.

### 1.1. Trình tự 3 chu kỳ lặp lại
Mỗi chu kỳ gồm 5 pha tự động kèm hỗ trợ giọng nói:
1. **BASELINE (4.0s):** Cố định ánh nhìn vào chấm đỏ trung tâm để thiết lập tọa độ mống mắt cơ bản cho cả hai mắt.
2. **COVER LEFT (4.5s):** Che kín mắt trái, mắt phải tiếp tục nhìn điểm cố định.
3. **UNCOVER LEFT (4.0s):** Bỏ che mắt trái $\rightarrow$ **Hệ thống tập trung theo dõi MẮT PHẢI**.
4. **COVER RIGHT (4.5s):** Che kín mắt phải, mắt trái tiếp tục nhìn điểm cố định.
5. **UNCOVER RIGHT (4.0s):** Bỏ che mắt phải $\rightarrow$ **Hệ thống tập trung theo dõi MẮT TRÁI**.
6. **REST (2.5s):** Nghỉ ngắn giữa các chu kỳ để thư giãn mắt và tránh mỏi điều tiết.

---

## 2. Công Thức & Chỉ Số Động Học Thời Gian (Temporal Kinematics)

Mọi mẫu dữ liệu được neo thời gian với mốc **$t = 0\text{ ms}$ tại thời điểm mở mắt (UNCOVER)**.

### 2.1. Tọa độ chuẩn hóa theo độ rộng mắt
$$\text{eyeWidth} = \sqrt{(x_{\text{outer}} - x_{\text{inner}})^2 + (y_{\text{outer}} - y_{\text{inner}})^2}$$
$$X_{\text{norm}} = \frac{x_{\text{iris}} - x_{\text{inner}}}{\text{eyeWidth}}, \quad Y_{\text{norm}} = \frac{y_{\text{iris}} - y_{\text{inner}}}{\text{eyeWidth}}$$

### 2.2. Độ dịch chuyển trong cửa sổ sớm (0 – 500 ms)
$$dx = x_{500\text{ms}} - x_{0\text{ms}}, \quad dy = y_{500\text{ms}} - y_{0\text{ms}}$$
$$\text{normalizedDisplacement} = \frac{\sqrt{dx^2 + dy^2}}{\text{eyeWidth}}$$

### 2.3. Vận tốc đỉnh & Thời gian đạt đỉnh
$$v(t_i) = \frac{\sqrt{(x_i - x_{i-1})^2 + (y_i - y_{i-1})^2}}{\text{eyeWidth} \cdot \Delta t_i} \quad (\text{đơn vị: eyeWidth/s})$$
$$v_{\text{peak}} = \max_i v(t_i), \quad t_{\text{peak}} = \arg\max_i v(t_i) \quad (\text{ms tính từ } t=0\text{ms})$$

### 2.4. Xác định vector hướng vận động
- Mắt phải: Dịch chuyển về phía mũi ($dx > 0$ trong ảnh): `NASAL`; Dịch chuyển ra phía tai: `TEMPORAL`.
- Mắt trái: Dịch chuyển về phía mũi ($dx < 0$ trong ảnh): `NASAL`; Dịch chuyển ra phía tai: `TEMPORAL`.
- Dịch chuyển lên trên ($dy < 0$): `SUPERIOR`; Dịch chuyển xuống dưới ($dy > 0$): `INFERIOR`.

---

## 3. Tiêu Chuẩn Kết Luận Cơ Năng (Non-Diagnostic Interpretation)

Hệ thống phân định kết quả thành 3 nhóm cơ năng:

| Trạng thái | Điều kiện kỹ thuật | Ý nghĩa sàng lọc |
| :--- | :--- | :--- |
| **`REFIXATION_DETECTED`** | $\ge 2/3$ chu kỳ ghi nhận $\text{normalizedDisplacement} \ge 0.10$ | Có ghi nhận chuyển động tái định thị đáng chú ý khi mở mắt. |
| **`NO_SIGNIFICANT_REFIXATION`** | $\ge 2/3$ chu kỳ ghi nhận $\text{normalizedDisplacement} < 0.10$ | Không ghi nhận chuyển động tái định thị đáng chú ý. |
| **`INCONCLUSIVE`** | $< 2$ chu kỳ hợp lệ (do chớp mắt, mất mống mắt, nghiêng đầu) | Dữ liệu không đủ độ tin cậy để đưa ra nhận định. |

> [!CAUTION]
> **Tuyệt đối không chẩn đoán:** Hệ thống không hiển thị các từ ngữ bệnh học như "Bạn bị lác", "Esotropia", "Exotropia", "Hypertropia". Toàn bộ thông số chỉ mang tính chất sàng lọc sơ bộ.
