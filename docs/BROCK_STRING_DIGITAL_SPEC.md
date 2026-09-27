# ĐẶC TẢ NGHIỆM PHÁP DÂY BROCK SỐ HÓA (DIGITAL BROCK STRING SPECIFICATION)
## REMICARE DIGITAL BROCK STRING & BINOCULAR VERGENCE DYNAMICS

---

## 1. Giới Thiệu & Mô Phỏng Trực Quan (Visual Representation)

Bài kiểm tra Brock String số hóa mô phỏng bài tập thị giác hai mắt kinh điển để theo dõi khả năng phối hợp hai mắt và phản xạ quy tụ (Binocular Vergence) qua 3 cự ly mục tiêu:

| Tiêu điểm | Cự ly ước tính | Kích thước hạt mô phỏng | Màu sắc | Vai trò cơ năng |
| :--- | :---: | :---: | :---: | :--- |
| **Hạt Gần (NEAR)** | **20 cm** | **44 px (Lớn nhất)** | Cyan (`#06b6d4`) | Kích thích phản xạ quy tụ tối đa |
| **Hạt Giữa (MID)** | **50 cm** | **30 px (Vừa)** | Blue (`#3b82f6`) | Đánh giá điều tiết trung gian |
| **Hạt Xa (FAR)** | **100 cm** | **18 px (Nhỏ nhất)** | Purple (`#8b5cf6`) | Trục thị giác gần như song song |

> [!NOTE]
> **Quy chuẩn Mô phỏng Trực quan (UX Safety Rule):**
> Kích thước hạt và đường phối cảnh chỉ là **hình ảnh minh họa trực quan** để dẫn hướng mắt nhìn của người dùng trên màn hình 2D.
> Pixel CSS **không đại diện cho khoảng cách cm thực tế ngoài đời**.
> Hỗ trợ truy cập: Khi người dùng kích hoạt `prefers-reduced-motion`, hiệu ứng nhấp nháy/phóng to của hạt được thay thế bằng viền tĩnh tương phản cao.

---

## 2. Quy Trình Chạy Tuần Tự (Sequence Flow)

Quy trình diễn ra tự động qua 3 bước với hỗ trợ giọng nói:
```
[CHUYỂN TIẾP (TRANSITION 2s)]
              │
              ▼
   HẠT GẦN (NEAR 20cm, 4s) ──► TARGET_START -> TRACKING (40+ frames) -> TARGET_END
              │
              ▼
   HẠT GIỮA (MID 50cm, 4s) ──► TARGET_START -> TRACKING (40+ frames) -> TARGET_END
              │
              ▼
    HẠT XA (FAR 100cm, 4s) ──► TARGET_START -> TRACKING (40+ frames) -> TARGET_END
              │
              ▼
      TỔNG HỢP BROCK STRING
```

---

## 3. Công Thức Đo Lường Quy Tụ Hai Mắt

### 3.1. Tỉ lệ quy tụ quang học tương đối (Vergence Ratio)
$$\text{vergenceRatio} = \frac{\text{dist2D}(\text{iris}_{\text{left}}, \text{iris}_{\text{right}})}{\text{dist2D}(\text{canthus}_{\text{inner\_left}}, \text{canthus}_{\text{inner\_right}})}$$
- Mẫu số (Inter-canthal distance) là hằng số giải phẫu cố định trên sọ mặt, giúp triệt tiêu sai số dao động khoảng cách camera.
- Khi người nhìn tập trung vào cự ly Gần (20cm), hai mống mắt kéo về phía sống mũi, làm $\text{vergenceRatio}$ giảm so với cự ly Xa (100cm).

### 3.2. Độ ổn định định thị mục tiêu (Fixation Stability)
$$\text{IQR}(\text{vergenceRatio}) = Q_3(\text{vergenceRatio}) - Q_1(\text{vergenceRatio})$$
- $\text{IQR} \le 0.05$: Định thị rất tốt (`GOOD`).
- $0.05 < \text{IQR} \le 0.08$: Dao động nhẹ (`FAIR`).
- $\text{IQR} > 0.08$: Dao động lớn hoặc rung giật mống mắt (`EXCESSIVE_JITTER`).

---

## 4. Kiểm Soát Chất Lượng & Phân Định Kết Luận

- **`MEASURABLE`:** Thu thập hợp lệ $\ge 2/3$ tiêu điểm với $N \ge 15$ khung hình mỗi tiêu điểm.
- **`INCONCLUSIVE`:** Mất dấu mống mắt, nhắm mắt, hoặc cử động đầu khiến $< 2$ tiêu điểm đạt chuẩn.
- **Tuyên bố an toàn:** Tuyệt đối không kết luận "Suy giảm quy tụ" (Convergence Insufficiency) hay chẩn đoán bệnh lý khi chưa có kiểm định lâm sàng.
