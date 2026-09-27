# PHASE 4 HANDOFF
## REMICARE DIGITAL BINOCULAR VISION SCREENING SYSTEM

---

## 1. Trạng Thái Tổng Thể (Status)
- **Trạng thái:** COMPLETE (Hoàn thành 100% mục tiêu kiến trúc và mã nguồn).
- **Trọng tâm phát triển:** Mở rộng module sàng lọc của RemiCare thành **Hệ thống Sàng lọc Thị giác Hai mắt Kỹ thuật số (Digital Binocular Vision Screening System)** bao gồm:
  1. **Cover Test số hóa (Digital Cover-Uncover & Alternate Cover Test)** với động học thời gian thực, sự kiện temporal, vận tốc đỉnh, hướng vận động (Nasal/Temporal/Superior/Inferior), và phân tích đa chu kỳ.
  2. **Nghiệm pháp Brock String số hóa (Digital Brock String Test)** theo dõi tương quan mống mắt hai mắt và phản xạ quy tụ (Vergence) qua các hạt tiêu điểm NEAR (20cm), MID (50cm), FAR (100cm) có thể tùy chỉnh.
  3. **Đo tĩnh mống mắt (Static Eye Measurement)** được bảo toàn nguyên vẹn 100% tính năng và khả năng hoạt động.
  4. **Tầng kiểm soát chất lượng dữ liệu (Data Quality Layer)** khắt khe, loại trừ mọi trường hợp mất mống mắt, chớp mắt, che mắt, đầu nghiêng, rung giật, thiếu mẫu (chuyển sang `INCONCLUSIVE`, tuyệt đối không gán giá trị 0).
  5. **Mô hình kết quả đo hợp nhất (Unified Measurement Result Model)** phân lập độc lập từng giao thức, không gộp điểm số.
  6. **Khóa an toàn hiệu chuẩn lâm sàng (Calibration Safeguards)**: Cả độ lăng kính PACT ($\Delta$) và góc quy tụ ($^\circ$) đều trả về `status: "NOT_CALIBRATED", value: null`.
  7. **Bộ kiểm thử toàn diện T01 - T10 (`screeningTestCases.js`)**: 100% Passed.
  8. **Chất lượng mã nguồn**: 0 lỗi, 0 cảnh báo linter (`oxlint`), biên dịch Vite build thành công 100%.

---

## 2. Danh Sách Tệp Mã Nguồn & Tài Liệu

### 2.1. Tệp mới tạo (Files Created)
1. `src/services/brockStringMeasurementService.js`: Dịch vụ toán học và hình học đo lường phản xạ quy tụ hai mắt, trích xuất đặc trưng `leftEyeFeature`, `rightEyeFeature`, `binocularFeature`, tính `vergenceRatio`, đánh giá độ ổn định định thị IQR và độ trễ chuyển tiếp.
2. `src/components/BrockStringTest.jsx`: Giao diện lâm sàng nghiệm pháp Brock String với dây ảo 3 hạt động, cấu hình khoảng cách, thanh trạng thái cảm biến thời gian thực, bảng chi tiết từng tiêu điểm, biểu đồ Canvas tỉ lệ quy tụ, và khuyến cáo y tế.
3. `src/services/coverTestMeasurementService.js`: Dịch vụ đo lường động học Cover Test, tính toán robust baseline trung vị, phân tích quỹ đạo mở mắt (displacements, peak velocity, time-to-peak, direction vectors, temporal events anchored at $t=0\text{ms}$), tổng hợp 3 chu kỳ.
4. `src/services/calibrationService.js`: Dịch vụ quản lý mô hình hiệu chuẩn lâm sàng tương lai với `calibrateCoverTestMeasurement()` và `calibrateBrockStringMeasurement()`, khóa an toàn ở trạng thái `NOT_CALIBRATED`.
5. `src/services/measurementResultService.js`: Bộ tạo cấu trúc kết quả đo lường chuẩn hóa thống nhất theo Part 9 cho cả 3 giao thức.
6. `src/services/screeningTestCases.js`: Bộ kiểm thử tự động 10 ca kiểm thử kỹ thuật và an toàn lâm sàng (T01 - T10).
7. `docs/COVER_TEST_MEASUREMENT_SPEC.md`: Tài liệu đặc tả toán học và giao thức Cover Test số hóa.
8. `docs/BROCK_STRING_MEASUREMENT_SPEC.md`: Tài liệu đặc tả toán học và giao thức Brock String số hóa.
9. `docs/BINOCULAR_VISION_SCREENING_SPEC.md`: Tài liệu đặc tả kiến trúc tổng thể hệ thống sàng lọc thị giác hai mắt.
10. `docs/CLINICAL_VALIDATION_PLAN.md`: Kế hoạch kiểm định lâm sàng đối chiếu tiêu chuẩn vàng PACT / Synoptophore và mô hình dữ liệu nghiên cứu.
11. `docs/phases/PHASE_4_HANDOFF.md`: Tài liệu bàn giao kỹ thuật Phase 4 này.

### 2.2. Tệp đã sửa đổi (Files Modified)
1. `src/constants/screeningConfig.js`: Bổ sung enums `PROTOCOLS`, `QUALITY_STATUS`, `QUALITY_REASONS`, `TEMPORAL_EVENT_TYPES`, `BROCK_STRING_TARGETS`, `BINOCULAR_VERDICT`, tọa độ mốc đầu (Nose tip 1, Glabella 168), và ghi chú tham số kỹ thuật.
2. `src/services/fusionService.js`: Bổ sung diễn giải sàng lọc trung lập y khoa (`SCREENING_VERDICT`), loại trừ hoàn toàn công thức giả định tỉ trọng lâm sàng.
3. `src/pages/StrabismusScreening.jsx`: Tích hợp thu thập baseline 2 mắt, truyền tham số vector hướng và mốc thời gian temporal, biểu đồ Canvas hiển thị điểm đỉnh vận động, phân đoạn 3 phần kết quả.
4. `src/App.jsx`: Cập nhật thanh điều hướng với 3 tab chuyển đổi giao thức: `[ Đo tĩnh ]`, `[ Cover Test ]`, `[ Brock String ]`.
5. `src/index.css`: Bổ sung hệ thống định kiểu UI cho Brock String, thẻ mục tiêu, thanh telemetry, bảng kết quả, và biểu đồ canvas.

---

## 3. Kiến Trúc Đo Lường Hợp Nhất (Unified Architecture)

```
                            Camera Stream (WebRTC 30 FPS)
                                          │
                            MediaPipe Face Mesh (478 pts)
                                          │
                     Iris & Corner Landmarks (468, 473, 362, 263, 133, 33)
                                          │
               ┌──────────────────────────┼──────────────────────────┐
               ▼                          ▼                          ▼
      [ STATIC EYE TEST ]        [ COVER TEST ]             [ BROCK STRING ]
    - Chênh lệch tỉ lệ ngang    - Robust Baseline (4.5s)   - Targets: NEAR, MID, FAR
    - Lịch sử trượt 60 khung    - Uncover Kinematics       - Inter-iris / Inter-canthal
    - Ngưỡng kỹ thuật diff      - 3 chu kỳ lặp lại         - Vergence Ratio biến thiên
               │                          │                          │
               └──────────────────────────┼──────────────────────────┘
                                          │
                                          ▼
                               DATA QUALITY GATEWAY
              (NO_FACE, IRIS_MISSING, HEAD_POSE_INVALID, INSUFFICIENT_SAMPLES)
                                          │
                               ┌──────────┴──────────┐
                               ▼ Đạt                 ▼ Không đạt
                     TÍNH TOÁN ĐỘNG HỌC          INCONCLUSIVE
                               │
                               ▼
                     BÁO CÁO KẾT QUẢ RIÊNG CHO MỖI PROTOCOL
                               │
                               ▼
                     OPTIONAL AI SUPPORTING SIGNAL (ONNX)
                     (Chỉ hỗ trợ nghiên cứu hình thái học tĩnh)
```

---

## 4. Kết Quả Kiểm Thử (Validation Test Suite T01 - T10)

Lệnh thực thi:
```bash
node -e "import('./src/services/screeningTestCases.js').then(m => console.log(JSON.stringify(m.runScreeningValidationSuite(), null, 2)))"
```

Kết quả: **10/10 Passed (100%)**
- **T01 (Normal fixation):** `passed: true` — Độ dịch chuyển $0.0114 < 0.10$, cờ chuyển động `isNotable = false`.
- **T02 (Intentional eye movement):** `passed: true` — Độ dịch chuyển $0.3022 > 0.10$, phát hiện chuyển động mắt có chủ đích.
- **T03 (Cover -> Uncover temporal events):** `passed: true` — Ghi nhận đầy đủ 4 sự kiện chu kỳ với mốc $t=0\text{ms}$ tại thời điểm mở mắt.
- **T04 (Movement peak after uncover):** `passed: true` — Xác định chính xác $t_{\text{peak}} = 231\text{ms}$ và vận tốc đỉnh $v_{\text{peak}} = 8.14$.
- **T05 (Blink / eyelid occlusion):** `passed: true` — Kích hoạt cờ `IRIS_MISSING`, không nhầm lẫn chớp mắt với chuyển động tái định vị.
- **T06 (Head movement):** `passed: true` — Góc nghiêng đầu $\text{Roll} = 39.8^\circ > 15^\circ$ bị gán lỗi `HEAD_POSE_INVALID`.
- **T07 (Brock String session):** `passed: true` — Đánh giá thành công phiên đo 3 hạt NEAR/MID/FAR với kết luận `MEASURABLE`.
- **T08 (Lost iris tracking):** `passed: true` — Trả về `INCONCLUSIVE` với lý do `IRIS_MISSING`.
- **T09 (One eye missing):** `passed: true` — Trả về `INCONCLUSIVE` với lý do `ONE_EYE_MISSING`.
- **T10 (Insufficient samples):** `passed: true` — 5 khung hình ($< 15$) bị đánh dấu không hợp lệ với lý do `INSUFFICIENT_SAMPLES`.

---

## 5. Kiểm Tra Chất Lượng Mã Nguồn (Code Quality)
- **`npm run lint` (`oxlint`):** `0 warnings, 0 errors` trên 30 tệp.
- **`npm run build` (`vite build`):** Biên dịch hoàn tất thành công trong 668ms.
- **WebGL / MediaPipe Lifecycle:** Giữ nguyên mô hình Singleton `getSharedFaceMesh()` trong `faceMeshService.js`. Khi chuyển đổi qua lại giữa các tab `Đo tĩnh`, `Cover Test`, và `Brock String`, context WebGL không bị đóng/mở lại, đảm bảo không rò rỉ tài nguyên GPU.
- **Dọn dẹp tài nguyên (Resource Cleanup):** Toàn bộ hook `useCamera`, `useSpeech`, `useFaceMesh` và các component đều có hàm hủy bỏ stream (`stream.getTracks().forEach(t => t.stop())`), `cancelAnimationFrame`, `clearTimeout` và dọn dẹp canvas khi unmount.

---

## 6. Hướng Dẫn Vận Hành & Khởi Động
1. Khởi động máy chủ phát triển cục bộ:
   ```bash
   npm run dev
   ```
2. Truy cập ứng dụng tại: `http://127.0.0.1:5173/`
3. Điều hướng giữa các giao thức trên thanh Header:
   - **Tab "Đo tĩnh":** Kiểm tra bất đối xứng vị trí mống mắt tĩnh liên tục theo thời gian thực.
   - **Tab "Cover Test":** Thực hiện quy trình Cover-Uncover 3 chu kỳ với phân tích động học quỹ đạo mống mắt và đồ thị thời gian.
   - **Tab "Brock String":** Thực hiện quy trình theo dõi phản xạ quy tụ hai mắt qua 3 hạt tiêu điểm với đồ thị tỉ lệ quy tụ quang học.
