> Cập nhật giao diện và API Hirschberg: [hướng dẫn tích hợp](docs/FRONTEND_HIRSCHBERG_INTEGRATION.md).

# RemiCare Strabismus Screening

> **Sàng lọc lác mắt (Esotropia / Exotropia) ứng dụng Trí tuệ Nhân tạo & Thị giác Máy tính.**

Hệ thống hỗ trợ sàng lọc bất thường vận nhãn và lệch trục nhãn cầu ở trẻ em thông qua hai phương pháp chuẩn y khoa: **Phương pháp phản xạ giác mạc Hirschberg** và **Nghiệm pháp che mắt Cover Test**.

---

## 📌 Quy trình Sàng lọc (Business Flow)

```text
USER
 ↓
B1 — HIRSCHBERG
 ├── Hướng dẫn tư thế & ánh sáng điểm nhỏ (30–50 cm)
 ├── Chụp ảnh / Tải ảnh lên
 └── Image Quality Gate (Kiểm tra khuôn mặt, 2 mắt mở rõ, độ nét, ánh sáng, góc nghiêng)
 ↓
B2 — KẾT QUẢ HIRSCHBERG
 ├── Kết quả sàng lọc phản xạ giác mạc & phân tích AI
 └── Tùy chọn: "Kiểm tra bổ sung bằng Cover Test" hoặc "Xem kết quả ngay"
 ↓
B3 — COVER TEST DISTANCE GATE
 ├── Xác nhận 5 điều kiện an toàn & hỗ trợ (Người hỗ trợ, Cố định máy, Đầu thẳng, Ánh sáng, Đèn phụ)
 └── Cự ly chuẩn 30–50 cm (TOO_CLOSE / VALID / TOO_FAR)
 ↓
B4 — COVER TEST 3 CYCLES
 ├── Ghi nhận chuỗi khung hình liên tục kèm timestamp chính xác (performance.now())
 ├── 3 chu kỳ che mở mắt luân phiên (Baseline -> Cover Left -> Uncover -> Cover Right -> Uncover)
 └── Phân tích vận tốc tái định thị & chuyển động nhãn cầu
 ↓
B5 — KẾT QUẢ TỔNG HỢP (COMBINED SCREENING RESULT)
 ├── Báo cáo độc lập từng phương pháp (Hirschberg + Cover Test)
 ├── Đánh giá tổng hợp không quy đổi gượng ép
 └── Cảnh báo y tế: Kết quả sàng lọc không thay thế chẩn đoán của bác sĩ chuyên khoa mắt
```

---

## 🚀 Tính năng Cốt lõi

1. **Hirschberg Screening (B1 - B2)**:
   - Sàng lọc độ lệch phản xạ ánh sáng giác mạc đối xứng trục nhãn cầu.
   - Quality Gate tự động loại bỏ ảnh mờ, nhắm mắt, nghiêng đầu trước khi gửi backend.
   - Phân tích hình thái hai mắt bằng mô hình AI Deep Learning (ResNet50 + đặc trưng hình học Hirschberg + nhánh khe mi).

2. **Cover Test Realtime Engine (B3 - B4)**:
   - Kiểm tra khoảng cách mục tiêu 30–50 cm thời gian thực dựa trên khoảng cách gian đồng tử (IPD).
   - Kiểm soát 5 điều kiện tiền kiểm tra (Pre-test confirmation checklist).
   - 3 chu kỳ đo lường chuẩn với bộ đệm thời gian, khử nhiễu cử động đầu (Head pose rejection), phát hiện chớp mắt.

3. **Combined Screening Result (B5)**:
   - Trình bày kết quả thân thiện với phụ huynh, ngôn ngữ trung tính an toàn y khoa.
   - Bảng phân tích kỹ thuật chi tiết dành cho chuyên gia / bác sĩ tham khảo.

---

## 🛠️ Công nghệ Sử dụng

- **Frontend**: React 19, Vite, Vanilla CSS.
- **Computer Vision**: MediaPipe Face Mesh (478 landmarks + iris), One Euro Filter, Canvas image processing.
- **Mobile & Safari Compatibility**: Tự động phục hồi camera stream khi chuyển ứng dụng / Control Center, hỗ trợ `playsInline`, `webkit-playsinline`, torch flash trên Android/iOS.
- **Backend**: Python 3.11, FastAPI, ONNX Runtime, OpenCV, Scikit-learn.

---

## 🏃 Hướng dẫn Chạy Thử nghiệm

```bash
# Cài đặt thư viện
npm install

# Chạy môi trường phát triển
npm run dev

# Kiểm tra chất lượng mã nguồn
npm run lint

# Chạy test suite
npm test

# Đóng gói sản phẩm
npm run build
```

---

## ⚠️ Tuyên bố Miễn trừ Trách nhiệm Y tế (Medical Disclaimer)

RemiCare Eye Screening là giải pháp hỗ trợ sàng lọc nguy cơ ban đầu trong cộng đồng. Ứng dụng **không đưa ra chẩn đoán y khoa xác định** và **không thay thế quy trình khám chuyên sâu** của bác sĩ nhãn khoa.