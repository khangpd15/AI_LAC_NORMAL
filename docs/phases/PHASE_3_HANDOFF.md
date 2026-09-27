# PHASE 3 HANDOFF

## 1. Status
- **Trạng thái:** COMPLETE (Hoàn thành 100% phạm vi Phase 3 — Hoàn tất toàn bộ 3 Phase của Dự án RemiCare AI).
- **Mục tiêu đạt được:** Tích hợp mô hình ONNX Runtime Web client-side thời gian thực (5–15 FPS) + Thuật toán dung hợp đa phương thức (Multi-Modal Fusion: CV Refixation Motion + AI Screening Signal) + Bổ sung telemetry thời gian thực (Face, Eyes, AI) + Lọc chu kỳ trên biểu đồ quỹ đạo Canvas + Hoàn thiện UI kết quả sàng lọc không mang tính chẩn đoán (Non-diagnostic clinical screening UI) + Tối ưu hóa hiệu năng render (bảo vệ React 60 FPS, không re-render CameraView, nạp model duy nhất một lần).

---

## 2. Completed
1. **Dịch vụ Suy luận AI Client-Side (`src/services/aiInferenceService.js`):**
   - Khởi tạo và quản lý phiên suy luận `InferenceSession` của `onnxruntime-web` (WebAssembly backend).
   - Nạp mô hình `models/strabismus_model.onnx` (5.1 KB) và kiểm tra metadata cấu hình một lần duy nhất (`Single-Instance caching`).
   - Nhận mảng 10 đặc trưng hình học chuẩn hóa theo đúng hợp đồng dữ liệu, đóng gói vào `ort.Tensor('float32', buffer, [1, 10])`.
   - Trả về đối tượng tín hiệu sàng lọc chuẩn hóa:
     `{ normalScore, strabismusScore, confidence, predictedClass, inferenceTimeMs }`.
   - Tuyệt đối không chứa logic giao diện (UI logic) hay kết luận chẩn đoán.
2. **Custom Hook Điều phối AI (`src/hooks/useStrabismusAI.js`):**
   - Điều tiết tần số suy luận (Throttling) ở mức tối ưu **~10 FPS (100ms interval)**, tách biệt hoàn toàn với tần số xử lý khung hình 30 FPS của webcam MediaPipe.
   - Sử dụng `useRef` lưu trữ dữ liệu tần số cao (`historyRef`, `latestSmoothedRef`, `isInferringRef`), triệt tiêu hiện tượng gọi `setState` mỗi frame gây nghẽn luồng render.
   - Áp dụng thuật toán làm mượt trượt (Moving Average Smoothing) qua 8 mẫu suy luận gần nhất, loại bỏ hiện tượng nhấp nháy (flickering) của tín hiệu AI.
   - Đo đạc và hiển thị tốc độ khung hình suy luận thực tế (`inferenceFps`).
3. **Thuật toán Dung hợp Đa phương thức (`src/services/fusionService.js`):**
   - Kết hợp 3 nguồn tín hiệu độc lập:
     - **Tín hiệu chuyển động CV (`cvSignal`):** Độ dịch chuyển tịnh tiến chuẩn hóa (`displacement`), cờ vượt ngưỡng (`displaced`), vận tốc tức thời đỉnh (`peakVelocity`), vận tốc trung bình (`meanVelocity`). Trọng số lâm sàng 60%.
     - **Tín hiệu hình thái AI (`aiSignal`):** Điểm số sàng lọc lệch trục (`strabismusScore`), độ tin cậy mô hình (`confidence`). Trọng số lâm sàng 40%.
     - **Chất lượng dữ liệu (`dataQuality`):** Trạng thái nhận diện khuôn mặt và mống mắt (`isValid`). Nếu mất dấu, chuyển sang trạng thái `INCONCLUSIVE`.
   - Tổng hợp đa chu kỳ qua phép bỏ phiếu đa số (Majority Voting) và trung bình có trọng số trên cả mắt trái và mắt phải.
4. **Thành phần Telemetry thời gian thực (`src/components/AIStatus.jsx`):**
   - Bảng trạng thái trực quan ngay dưới camera:
     - Khuôn mặt: `✓` / `✕`
     - Mắt trái: `✓` / `✕`
     - Mắt phải: `✓` / `✕`
     - AI: `Hoạt động (~10 FPS)` / `Đang tải...` / `Không khả dụng`
   - Thanh hiển thị mức tín hiệu AI mini mượt mà với độ tin cậy.
   - Nếu AI bị lỗi hoặc model chưa tải xong, Cover Test vẫn tiếp tục chạy bình thường (Graceful Degradation).
5. **Giao diện Kết quả Sàng lọc & Lọc Biểu đồ (`src/pages/StrabismusScreening.jsx`):**
   - Bảng báo cáo kết quả chi tiết sau 3 chu kỳ:
     - Tín hiệu mắt trái (theo dõi sau khi bỏ che mắt phải)
     - Tín hiệu mắt phải (theo dõi sau khi bỏ che mắt trái)
     - Điểm sàng lọc tổng hợp (%), Độ tin cậy (%) và số chu kỳ ghi nhận tín hiệu.
   - Bộ chọn chu kỳ đồ thị: `[ Tất cả chu kỳ ]`, `[ Chu kỳ 1 ]`, `[ Chu kỳ 2 ]`, `[ Chu kỳ 3 ]` vẽ trực tiếp trên canvas độ phân giải cao (Hi-DPI) kèm vạch phân tích 500ms.
6. **Tuân thủ An toàn Y khoa & Quyền riêng tư:**
   - Cam kết 100% Client-side: *"Hình ảnh từ camera được xử lý trực tiếp trên thiết bị và không được gửi lên máy chủ."*
   - Ngôn từ chuẩn mực theo quy tắc Educational Screening Tool:
     - *"Có ghi nhận tín hiệu chuyển động đáng chú ý"* / *"Không ghi nhận tín hiệu chuyển động đáng chú ý trong lần sàng lọc này."*
     - Luôn đính kèm cảnh báo: *"Kết quả sàng lọc không thay thế khám chuyên khoa mắt."*

---

## 3. Files Created
1. `src/services/aiInferenceService.js`: Dịch vụ khởi tạo phiên ONNX Runtime Web, nạp mô hình `models/strabismus_model.onnx`, chuẩn bị Tensor `[1, 10]` và thực thi suy luận client-side.
2. `src/services/fusionService.js`: Dịch vụ tính điểm sàng lọc dung hợp CV + AI (`fuseScreeningSignals`) và tổng hợp đa chu kỳ (`aggregateMultiCycleFusion`).
3. `src/hooks/useStrabismusAI.js`: Hook quản lý vòng đời mô hình AI, điều tiết tần số 10 FPS, làm mượt đường trượt 8 mẫu và bộ đệm `useRef`.
4. `src/components/AIStatus.jsx`: Component hiển thị telemetry trạng thái Face/Eyes/AI và thanh đo tín hiệu AI thời gian thực.
5. `public/models/strabismus_model.onnx`: Tệp nhị phân mô hình ONNX (5.1 KB) được Vite phục vụ trực tiếp tại root URL.
6. `public/models/model_metadata.json`: Bản đặc tả hợp đồng đặc trưng và tham số chuẩn hóa.
7. `docs/phases/PHASE_3_HANDOFF.md`: File bàn giao kỹ thuật Phase 3 này.

---

## 4. Files Modified
1. `src/pages/StrabismusScreening.jsx`: Tích hợp toàn diện `useStrabismusAI`, thu thập song song tín hiệu CV + AI trong các pha `UNCOVER_LEFT`/`UNCOVER_RIGHT`, hiển thị `AIStatus`, tính toán kết quả dung hợp đa chu kỳ và thêm bộ lọc chu kỳ trên đồ thị Canvas.
2. `src/services/eyeFeatureService.js`: Bổ sung tính toán 3 đặc trưng phái sinh (`horizontalRatioDiff`, `verticalRatioDiff`, `irisDistanceRatio`) và mở rộng hàm `calculateRefixationDisplacement` để tính toán vận tốc giật mống mắt (`peakVelocity`, `meanVelocity`).
3. `src/index.css`: Bổ sung hệ thống CSS tokens và styling cho `.ai-telemetry-container`, `.telemetry-item`, `.ai-gauge-mini`, `.cycle-filter-btn`.
4. `package.json`: Cài đặt gói `onnxruntime-web` (v1.20.0).

---

## 5. Current Architecture

```
                               Webcam Video Feed
                                      │
                        MediaPipe Face Mesh (20-30 FPS)
                                      │
                        478 Biometric Mesh Landmarks
                                      │
                         extractEyeFeatures()
                                      │
                 10-Dimensional Normalized Feature Vector
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
       Computer Vision Signal                       AI Inference Loop
     (Refixation Saccades)                        (Throttled 5-15 FPS)
               │                                             │
      Normalized Displacement                                │
      Peak/Mean Velocity                            runAIInference()
      Analysis Window (500ms)                                │
               │                                   Moving Average Smoothing
               │                                   (Window = 8 samples)
               │                                             │
               │                                    AI Screening Signal
               │                                   (strabismusScore, conf)
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      │
                                      ▼
                           fuseScreeningSignals()
                           (CV: 60%, AI: 40% Weight)
                                      │
                                      ▼
                        aggregateMultiCycleFusion()
                         (Majority Voting / 3 Cycles)
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
       Real-Time UI State                            Final Clinical Report
      - AIStatus (FPS, Badges)                      - Screening Result Cards
      - FixationTarget / Countdown                  - Dual Eye Verdicts
      - Mirrored EyeOverlay                         - Multi-Cycle Trajectories
```

---

## 6. Current Data Flow
1. **Thu nhận khung hình:** Camera stream đẩy qua video element `videoRef` với tốc độ ~30 khung hình/giây.
2. **Trích xuất điểm mốc:** `useFaceMesh` nạp frame vào FaceMesh instance, trích xuất tọa độ 3D của các điểm `468, 473` (tâm mống mắt), `362, 263, 133, 33` (khóe mắt) và các điểm bờ mi.
3. **Trích xuất vector 10 chiều:** `extractEyeFeatures` tính toán chính xác 10 giá trị hình học:
   `[leftHorizontalRatio, rightHorizontalRatio, leftVerticalRatio, rightVerticalRatio, interocularDistance, horizontalRatioDiff, verticalRatioDiff, leftEyeWidth, rightEyeWidth, irisDistanceRatio]`.
4. **Suy luận AI thời gian thực:**
   - `useStrabismusAI.processFrameAI()` kiểm tra ngưỡng giãn cách thời gian (`INFERENCE_THROTTLE_MS = 100ms`).
   - Nếu đủ điều kiện thời gian, chuyển vector sang Float32 Tensor `[1, 10]`, gọi `session.run({ float_input })`.
   - Kết quả xác suất được thêm vào buffer hàng đợi và tính trung bình trượt 8 mẫu để cập nhật thanh đo `AIStatus`.
5. **Đồng bộ hóa trong Cover Test:**
   - Khi ở trạng thái `UNCOVER_LEFT`: Theo dõi mắt phải, thu thập quỹ đạo vị trí mống mắt trong 1500ms.
   - Khi ở trạng thái `UNCOVER_RIGHT`: Theo dõi mắt trái, thu thập quỹ đạo vị trí mống mắt trong 1500ms.
   - Tính toán CV signal (`displacement`, `displaced`, `peakVelocity`) trong cửa sổ 500ms đầu tiên.
   - Lấy snapshot tín hiệu AI tại thời điểm mở mắt.
   - Đưa cả hai vào hàm `fuseScreeningSignals` để tính điểm tổng hợp cho chu kỳ đó.
6. **Báo cáo chung cuộc:**
   - Sau khi hoàn thành 3 chu kỳ, `aggregateMultiCycleFusion` tập hợp tất cả các lần chạy dung hợp, áp dụng thuật toán đa số phiếu để xác định kết luận sàng lọc cho từng mắt và toàn thể.
   - Biểu đồ Canvas vẽ lại các đường cong vị trí $X$ theo thời gian với vạch nét đứt 500ms và cho phép người dùng bấm lọc xem riêng từng chu kỳ hoặc xem đồng thời tất cả.

---

## 7. Configuration & Feature Contract
Toàn bộ cấu hình kiểm tra và giao thức đặc trưng tuân thủ hợp đồng:

```javascript
// src/constants/screeningConfig.js
export const SCREENING_CONFIG = {
  BASELINE_MS: 4500,          // 4.5s cố định thị giác ban đầu
  COVER_MS: 5000,             // 5.0s che mắt bằng lòng bàn tay
  UNCOVER_WINDOW_MS: 500,     // Cửa sổ phân tích giật mắt lâm sàng chính (500ms)
  RECORD_MS: 4500,            // 4.5s theo dõi quỹ đạo sau khi mở mắt
  REST_MS: 3000,              // 3.0s nghỉ ngắn giữa các chu kỳ
  CYCLES: 3,
  DISPLACEMENT_THRESHOLD: 0.10,
};

// src/services/fusionService.js
export const FUSION_CONFIG = {
  CV_WEIGHT: 0.60,
  AI_WEIGHT: 0.40,
  COMPOSITE_THRESHOLD: 0.50,
  HIGH_CONFIDENCE_THRESHOLD: 0.75,
};
```

---

## 8. What Has Been Tested

### 8.1. Kiểm thử Tích hợp & Biên dịch (Build & Lint)
- **`npm run lint` (`oxlint`):** **0 errors, 0 warnings** trên toàn bộ 24 files của dự án.
- **`npm run build` (`vite build`):** Biên dịch thành công trong **577ms**, sinh gói bundle tĩnh hoàn chỉnh bao gồm WebAssembly binary `ort-wasm-simd-threaded.jsep.wasm`.
- **HTTP Server:** Dev server tại `http://127.0.0.1:5173/` trả về mã trạng thái **200 OK**.
- **Model Endpoint:** Truy vấn `GET /models/strabismus_model.onnx` (5177 bytes) và `GET /models/model_metadata.json` (1412 bytes) thành công 100%.

### 8.2. Kiểm thử Tình huống Ngoại lệ & Khả năng Phục hồi (Edge Cases & Resilience)
| Tình huống Kiểm thử | Hành vi Hệ thống | Kết quả |
| :--- | :--- | :--- |
| **Từ chối quyền Camera (Permission Denied)** | Hiển thị thông báo hướng dẫn cấp quyền rõ ràng trong `CameraView`, không crash ứng dụng. | **PASS** |
| **Ngắt kết nối Camera đột ngột** | Hook `useCamera` bắt lỗi, cập nhật trạng thái lỗi, dọn dẹp track WebRTC an toàn. | **PASS** |
| **Mất khuôn mặt trong khung hình** | `validateEyeTrackingQuality` báo `"Không phát hiện khuôn mặt"`, badge Face chuyển sang `✕`, ngừng đưa dữ liệu rác vào buffer. | **PASS** |
| **Che khuất 1 mắt trong pha che** | `AIStatus` báo mắt bị che tương ứng, Cover Test tiếp tục theo dõi mắt còn lại. | **PASS** |
| **Mô hình ONNX tải chậm / lỗi nạp** | `AIStatus` hiển thị `"AI: Không khả dụng (Dùng CV)"`, nghiệm pháp Cover Test vẫn chạy bình thường với 100% thuật toán CV. | **PASS** |
| **Bấm "Hủy bài kiểm tra" giữa chừng** | Lập tức ngắt chu kỳ đếm ngược, hủy giọng nói `speechSynthesis.cancel()`, đưa về trạng thái `CANCELLED` sạch sẽ. | **PASS** |
| **Chuyển tab liên tục** | Camera tự động tắt khi rời trang, không để rò rỉ bộ nhớ hay luồng camera ngầm. | **PASS** |

---

## 9. Known Limitations
1. **Ánh sáng yếu hoặc ngược sáng mạnh:** Camera có thể giảm tốc độ khung hình và MediaPipe có thể gặp khó khăn trong việc phân tách ranh giới mống mắt với con ngươi.
2. **Kính mắt phản quang / Kính đổi màu:** Các phản xạ ánh sáng mạnh trên tròng kính có thể gây nhiễu nhẹ cho thuật toán định vị tâm mống mắt MediaPipe.
3. **Mô phỏng Cover Test bằng tay:** Do người dùng tự dùng tay che mắt, tốc độ mở tay có thể dao động giữa các lần thực hiện (hệ thống giải quyết điều này bằng cửa sổ quan sát chuẩn hóa 500ms và lọc đa số phiếu qua 3 chu kỳ).

---

## 10. Important Decisions
1. **Kiến trúc Dung hợp Trọng số Lâm sàng (60% CV + 40% AI):** Trong nhãn khoa, dấu hiệu giật tái định vị (Refixation Saccade) sau khi mở mắt che là tiêu chuẩn vàng để chẩn đoán lác ẩn (phoria) và lác hiện (tropia). Do đó, tín hiệu động học CV được gán trọng số 60%, trong khi tín hiệu AI tĩnh chiếm 40%.
2. **Điều tiết Tần số AI ở mức 10 FPS (100ms):** Không chạy suy luận AI ở 30-60 FPS để tránh làm nóng thiết bị hoặc gây nghẽn luồng xử lý WebAssembly trên các thiết bị di động / máy tính cấu hình trung bình.
3. **Làm mượt xác suất bằng Moving Average 8 mẫu:** Giúp thanh đo tín hiệu AI hiển thị ổn định, trực quan, loại bỏ các biến động nhảy số đột ngột do chớp mắt hoặc rung giật nhẹ.
4. **Tuyệt đối tuân thủ ngôn từ An toàn Y khoa:** Giao diện kết quả hoàn toàn tránh các từ ngữ khẳng định chẩn đoán ("bạn bị lác", "chắc chắn bình thường") mà sử dụng các thuật ngữ mô tả khách quan: *"Có ghi nhận tín hiệu chuyển động đáng chú ý"* / *"Không ghi nhận tín hiệu chuyển động đáng chú ý trong lần sàng lọc này"*.

---

## 11. Deployment & Production Guidelines
Khi triển khai ứng dụng lên máy chủ sản xuất (Vercel, Netlify, Cloudflare Pages hoặc Docker):
1. **Cross-Origin Opener / Embedder Policy (COOP / COEP):** Để kích hoạt tối ưu đa luồng SIMD WebAssembly (`SharedArrayBuffer`), cấu hình headers HTTP:
   ```http
   Cross-Origin-Opener-Policy: same-origin
   Cross-Origin-Embedder-Policy: require-corp
   ```
2. **Static Asset Caching:** Thiết lập cache dài hạn (`Cache-Control: public, max-age=31536000, immutable`) cho các tệp `.wasm` và mô hình `.onnx` trong thư mục public.
3. **Giao thức HTTPS bắt buộc:** Trình duyệt chỉ cho phép truy cập `navigator.mediaDevices.getUserMedia` trên kết nối bảo mật HTTPS (hoặc localhost).

---

## 12. Final Architecture Summary
Dự án **RemiCare AI — Real-time Strabismus Screening** đã đạt đến trạng thái hoàn thiện toàn bộ tính năng và tiêu chuẩn:
- **Phase 1:** Nền tảng React, WebRTC camera, MediaPipe Face Mesh iris tracking, nghiệm pháp Cover Test 3 chu kỳ và bảo toàn chế độ Đo tĩnh.
- **Phase 2:** Pipeline dữ liệu, kiểm định ảnh, phân tách bệnh nhân, trích xuất đặc trưng hình học, huấn luyện Small MLP và xuất khẩu ONNX 5.1 KB.
- **Phase 3:** Tích hợp ONNX Runtime Web client-side, dung hợp đa phương thức (Multi-Modal Fusion), telemetry thời gian thực, lọc chu kỳ biểu đồ quỹ đạo, và giao diện sàng lọc chuẩn y tế.
