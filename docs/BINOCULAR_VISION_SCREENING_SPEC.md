# ĐẶC TẢ HỆ THỐNG SÀNG LỌC THỊ GIÁC HAI MẮT KỸ THUẬT SỐ
## REMICARE DIGITAL BINOCULAR VISION SCREENING SPECIFICATION

---

## 1. Mục Tiêu (Objective)
- Xây dựng một quy trình sàng lọc thị giác hai mắt kỹ thuật số (Digital Binocular Vision Screening) hoàn chỉnh trên nền tảng web, tích hợp liên tục hai nghiệm pháp:
  1. **Nghiệm pháp Che mắt (Cover Test)**: Đo lường động học mống mắt và phản xạ tái định vị (Refixation Saccade).
  2. **Nghiệm pháp Dây Brock (Brock String)**: Đánh giá khả năng phối hợp hai mắt và phản xạ quy tụ (Vergence Flexibility) qua 3 cự ly (20cm, 50cm, 100cm).
- Đặt **nghiệm pháp lâm sàng và đo lường hình học** làm trung tâm; AI chỉ đóng vai trò tín hiệu bổ trợ nghiên cứu hình thái học tĩnh.
- Tuyệt đối **không chẩn đoán bệnh lác**, không chuyển đổi số đo thành độ lăng kính (Prism Diopter) khi chưa có hiệu chuẩn thực nghiệm.

---

## 2. Luồng Người Dùng Toàn Cục (User Flow)

Trình tự trạng thái tuần tự và không đảo ngược:
```
POSITION CHECK ──► COVER TEST ──► BROCK STRING ──► SCREENING SUMMARY
```
1. **Kiểm tra vị trí (Position Check):** Hướng dẫn người dùng ngồi đúng khoảng cách 20–25 cm trước camera laptop.
2. **Cover Test (3 chu kỳ):** Đo lường chuyển động tái định vị mắt đối bên khi mở mắt che.
3. **Chuyển tiếp (Transition):** Nhắc nhở người dùng giữ nguyên tư thế để chuyển sang Brock String.
4. **Brock String (3 cự ly):** Dẫn hướng mắt nhìn vào các hạt mô phỏng 20 cm $\rightarrow$ 50 cm $\rightarrow$ 100 cm.
5. **Tổng hợp kết quả (Screening Summary):** Trình bày 4 bằng chứng độc lập, giải thích trung lập và đưa ra khuyến cáo y tế.

---

## 3. Kiểm Tra Vị Trí (Position Check)
- **Cự ly mục tiêu:** $20 - 25\text{ cm}$ (đo khoảng cách tương đối qua độ rộng mặt và khoảng cách khóe mắt).
- **5 Cổng kiểm soát bắt buộc:**
  1. `faceDetected === true`
  2. `bothEyesDetected === true`
  3. `irisDetected === true`
  4. `distanceValid === true` ($20 \le \text{estimatedDistanceCm} \le 25$)
  5. `headPoseValid === true` (Góc nghiêng Roll $\le 12^\circ$, góc quay Yaw $\le 15^\circ$)
- Chỉ cho phép bắt đầu sàng lọc khi cả 5 cổng đều vượt qua.

---

## 4. Nghiệm Pháp Che Mắt (Cover Test)
- **Quy trình 3 chu kỳ:** Baseline (4.0s) $\rightarrow$ Cover Left (4.5s) $\rightarrow$ Uncover Left / Track Right (4.0s) $\rightarrow$ Cover Right (4.5s) $\rightarrow$ Uncover Right / Track Left (4.0s) $\rightarrow$ Rest (2.5s).
- **Động học thời gian thực:**
  - Neo mốc $t = 0\text{ ms}$ tại thời điểm mở mắt.
  - Phân tích cửa sổ sớm ($0 - 500\text{ ms}$).
  - Đo độ dịch chuyển chuẩn hóa $\text{normalizedDisplacement} = \text{displacement} / \text{eyeWidth}$.
  - Xác định vận tốc đỉnh ($v_{\text{peak}}$), thời gian đạt đỉnh ($t_{\text{peak}}$), và vector hướng (Nasal, Temporal, Superior, Inferior).
- **Phân loại:** `REFIXATION_DETECTED`, `NO_SIGNIFICANT_REFIXATION`, hoặc `INCONCLUSIVE`.

---

## 5. Nghiệm Pháp Dây Brock (Brock String)
- **Tiêu điểm kiểm tra:** 3 hạt mô phỏng cự ly NEAR ($20\text{ cm}$), MID ($50\text{ cm}$), FAR ($100\text{ cm}$).
- **Giao diện trực quan:** Kích thước hạt biểu diễn chiều sâu phối cảnh (20cm lớn nhất, 50cm vừa, 100cm nhỏ nhất). Pixel CSS không đại diện cho khoảng cách vật lý thực tế.
- **Đo lường hai mắt:**
  - Khoảng cách hai tâm mống mắt: $D_{\text{iris}} = \|\text{iris}_{\text{left}} - \text{iris}_{\text{right}}\|$.
  - Khoảng cách hai khóe trong mắt: $D_{\text{canthal}} = \|\text{canthus}_{\text{inner\_left}} - \text{canthus}_{\text{inner\_right}}\|$.
  - Tỉ lệ quy tụ quang học: $\text{vergenceRatio} = D_{\text{iris}} / D_{\text{canthal}}$.
  - Độ ổn định định thị: $\text{IQR}(\text{vergenceRatio})$ tại mỗi mục tiêu.

---

## 6. Dữ Liệu Đo Lường (Measurement Data Model)
- Cấu trúc phiên đo hợp nhất theo dõi:
  - `sessionId`, `startedAt`, `completedAt`
  - `positionCheck`: `{ estimatedDistanceCm, validRange, confidence, quality }`
  - `coverTest`: `{ status, cycles, validCycles, refixationDetected, consistency, quality }`
  - `brockString`: `{ status, targets: { near20cm, mid50cm, far100cm }, quality }`
  - `summary`: `{ coverTestStatus, brockStringStatus, overallDataQuality, screeningStatus, recommendation }`
  - `events`: Danh sách các sự kiện vòng đời phục vụ kiểm toán kỹ thuật.

---

## 7. Tầng Kiểm Soát Chất Lượng (Quality Gate)
- Loại trừ mọi trường hợp lỗi cảm biến mà **không gán số 0 giả định**:
  - `NO_FACE`: Không có khuôn mặt.
  - `ONE_EYE_MISSING`: Bị che một mắt hoặc quay mặt đi.
  - `IRIS_NOT_DETECTED`: Chớp mắt, nhắm mắt.
  - `INVALID_EYE_WIDTH`: Ngồi quá gần hoặc quá xa.
  - `INVALID_HEAD_POSE`: Đầu nghiêng quá $12^\circ$ hoặc quay quá $15^\circ$.
  - `INSUFFICIENT_SAMPLES`: Số khung hình $< 15$ mẫu/pha.
  - `EXCESSIVE_JITTER`: Rung giật mống mắt $\text{IQR} > 0.08$.

---

## 8. Tầng Hỗ Trợ AI (AI Supporting Signal)
- Mô hình `strabismus_model.onnx` chạy trên luồng phụ WebAssembly (ONNX Runtime Web).
- **Nguyên tắc an toàn:**
  - AI chỉ là tín hiệu bổ trợ nghiên cứu hình thái học tĩnh.
  - Tuyệt đối **không được override** kết quả đo lường chuyển động của Cover Test hay Brock String.
  - Các hệ số trọng số và ngưỡng trước đây (`CV 0.60 / AI 0.40`, `0.10`) là **tham số kỹ thuật thử nghiệm**, không phải tỷ lệ lâm sàng.

---

## 9. Tổng Hợp Báo Cáo Sàng Lọc (Screening Summary)
- Trình bày 4 bằng chứng độc lập, không gộp điểm số:
  1. Position Check: Đạt chuẩn ~22 cm.
  2. Cover Test: Có / Không ghi nhận chuyển động tái định thị đáng chú ý.
  3. Brock String: Theo dõi quy tụ thu được dữ liệu / Chưa đủ dữ liệu.
  4. Data Quality: GOOD / FAIR / INCONCLUSIVE.
- Đưa ra nhận định trung lập y tế và khuyến cáo đi khám bác sĩ nhãn khoa chuyên khoa nếu cần thiết.

---

## 10. Giới Hạn Kỹ Thuật (Limitations)
- Phép đo webcam là phép chiếu 2D của nhãn cầu 3D.
- Chưa có cảm biến độ sâu thực tế (ToF/Stereo).
- Phụ thuộc vào điều kiện ánh sáng phòng ($\ge 300\text{ lux}$) và độ phân giải camera ($\ge 720\text{p}$, $\ge 25\text{ FPS}$).
- Kính dày hoặc phản quang có thể gây dao động mốc mống mắt.

---

## 11. Bảo Mật & Quyền Riêng Tư (Privacy)
- **100% Client-side Processing:** Toàn bộ thuật toán MediaPipe, thị giác máy tính và suy luận AI diễn ra trên CPU/GPU cục bộ của trình duyệt người dùng qua WebAssembly.
- Không tải hình ảnh hay video của người dùng lên bất kỳ máy chủ nào.
- Không lưu video liên tục; chỉ lưu các vector đặc trưng tọa độ phục vụ phiên đo hiện tại.

---

## 12. Lộ Trình Hiệu Chuẩn Lâm Sàng (Future Clinical Validation)
- Để chuyển đổi độ dịch chuyển chuẩn hóa sang Độ lăng kính (Prism Diopter — $\Delta$) và Góc quy tụ lâm sàng ($^\circ$):
  1. Cần nghiên cứu đối đầu lâm sàng (Double-Blind Clinical Trial, $N \ge 100$) đối chiếu với tiêu chuẩn vàng PACT và Synoptophore.
  2. Xây dựng mô hình hồi quy chuyển đổi thực nghiệm trong `src/services/calibrationService.js`.
  3. Hiện tại, cả hai hàm `calibrateCoverTestMeasurement()` và `calibrateBrockStringMeasurement()` được khóa chặt ở trạng thái `status: "NOT_CALIBRATED", value: null`.
