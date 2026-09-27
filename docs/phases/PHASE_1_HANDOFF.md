# PHASE 1 HANDOFF

## 1. Status
- **Trạng thái:** COMPLETE (Hoàn thành 100% phạm vi Phase 1).
- **Mục tiêu đạt được:** Nền tảng React UI + Webcam WebRTC + MediaPipe Face Mesh (refineLandmarks) + Trích xuất đặc trưng mắt chuẩn hóa + Máy trạng thái Cover Test + Thu thập quỹ đạo Refixation Saccade + Đồ thị Canvas + Đo tĩnh bảo toàn + Cảnh báo y khoa + Hướng dẫn giọng nói tiếng Việt.
- **Tiêu chí Phase 2:** Không bắt đầu Phase 2 trong lượt này. Chờ hướng dẫn tiếp theo.

---

## 2. Completed
1. **Khởi tạo và cấu trúc React/Vite:**
   - Xây dựng kiến trúc module tách biệt theo đúng chuẩn: `components/`, `pages/`, `hooks/`, `services/`, `constants/`.
   - Giữ nguyên ngôn ngữ JavaScript JSX (`.jsx`) theo quy định.
2. **Quản lý Camera (WebRTC):**
   - Đảm bảo luồng dữ liệu `getUserMedia` -> `<video>` element -> MediaPipe Face Mesh.
   - Cơ chế dọn dẹp track triệt để: gọi `MediaStreamTrack.stop()` khi component unmount hoặc rời trang, không để rò rỉ webcam.
3. **MediaPipe Face Mesh:**
   - Cấu hình bắt buộc `refineLandmarks: true`.
   - Theo dõi chính xác các landmark: Mống mắt (`468`, `473`), Khóe mắt (`362`, `263`, `133`, `33`), Bờ mi (`386`, `374`, `159`, `145`).
   - Lớp vẽ Canvas (`EyeOverlay.jsx`) hiển thị tâm mống mắt (cyan crosshair) và khóe mắt (amber).
4. **Trích xuất đặc trưng mắt (Feature Extraction Service):**
   - Trả về cấu trúc chuẩn hóa:
     `timestamp`, `leftIrisX`, `leftIrisY`, `rightIrisX`, `rightIrisY`, `leftEyeWidth`, `rightEyeWidth`, `leftHorizontalRatio`, `rightHorizontalRatio`, `leftVerticalRatio`, `rightVerticalRatio`, `interocularDistance`.
   - Chuẩn hóa theo chiều rộng mắt (`leftEyeWidth`, `rightEyeWidth`) và khoảng cách gian khóe mắt (`interocularDistance`).
5. **Kiểm định chất lượng dữ liệu (Data Quality Gate):**
   - Kiểm tra `faceDetected`, `leftEyeDetected`, `rightEyeDetected`, `irisValid`.
   - Hiển thị thông báo trạng thái rõ ràng: "Không phát hiện khuôn mặt", "Không nhận diện đủ hai mắt".
   - Ngăn chặn triệt để dữ liệu không hợp lệ đi vào buffer phân tích.
6. **Máy trạng thái nghiệm pháp Cover Test (State Machine):**
   - Các trạng thái: `INTRO` -> `BASELINE` -> `COVER_LEFT` -> `UNCOVER_LEFT` -> `COVER_RIGHT` -> `UNCOVER_RIGHT` -> `COMPLETE` / `CANCELLED`.
   - Đồng hồ đếm ngược (`Countdown.jsx`) và điểm cố định thị giác (`FixationTarget.jsx`) đập nhịp 1.4s.
   - Cơ chế Hủy bài test (`CANCELLED`) lập tức ngắt chu kỳ và dọn dẹp trạng thái.
7. **Theo dõi tái định vị (Refixation Saccade Tracking):**
   - Trong cửa sổ mở mắt che: ghi nhận `timestamp`, `irisX`, `irisY`, `normalizedX`, `normalizedY`.
   - Che mắt trái -> theo dõi mắt phải. Che mắt phải -> theo dõi mắt trái.
   - Tính độ dịch chuyển chuẩn hóa (Normalized Displacement) trong cửa sổ 500ms so với ngưỡng cấu hình 0.10.
8. **Lưu trữ quỹ đạo và hiển thị đồ thị (Trajectory Charting):**
   - Lưu trữ mảng `trajectories` từng chu kỳ với cấu trúc `{ cycle, eye, points, displacement, displaced }`.
   - Vẽ đồ thị 2 mắt riêng biệt sau 3 chu kỳ hoàn thành với vạch phân tích 500ms nét đứt.
9. **Bảo tồn chế độ Đo tĩnh (Static Eye Alignment):**
   - Tích hợp trang `StaticEyeTest.jsx` với thanh đo vị trí mống mắt ngang, tính chênh lệch trung bình 2s gần nhất (ngưỡng 0.18) và các thẻ kiến thức y khoa.
   - Điều hướng tab rõ ràng: `[ Đo tĩnh ]` và `[ Cover Test ]`.
10. **Thông điệp y khoa (Medical Disclaimer):**
    - Hiển thị banner cảnh báo với đầy đủ câu bắt buộc:
      *"Đây là công cụ sàng lọc mang tính giáo dục, không phải chẩn đoán y khoa. Kết quả có/không phát hiện chuyển động tái định vị không đồng nghĩa với có/không bị lác."*
11. **Giọng nói tiếng Việt (Web Speech API):**
    - Hỗ trợ giọng nói hướng dẫn qua từng bước và đếm nhịp bằng tiếng Việt với nút bật/tắt âm thanh.

---

## 3. Files Created
1. `src/constants/screeningConfig.js`: Định nghĩa các hằng số thời gian (`BASELINE_MS`, `COVER_MS`, `UNCOVER_WINDOW_MS`, `RECORD_MS`, `REST_MS`), chu kỳ (`CYCLES: 3`), ngưỡng giật mống mắt (`DISPLACEMENT_THRESHOLD: 0.10`), danh mục trạng thái (`COVER_TEST_STATES`) và danh mục landmark (`LANDMARKS`).
2. `src/services/cameraService.js`: Dịch vụ điều khiển MediaDevices WebRTC `startCameraStream` và dọn dẹp dừng stream `stopCameraStream`.
3. `src/services/faceMeshService.js`: Dịch vụ khởi tạo MediaPipe Face Mesh (`refineLandmarks: true`), gửi frame qua `requestAnimationFrame`, đóng kết nối an toàn.
4. `src/services/eyeFeatureService.js`: Kiểm tra chất lượng dữ liệu (`validateEyeTrackingQuality`), trích xuất bộ đặc trưng chuẩn hóa (`extractEyeFeatures`), tính toán độ lệch tái định vị (`calculateRefixationDisplacement`).
5. `src/hooks/useCamera.js`: Custom React hook quản lý camera stream, trạng thái active/loading/error và tự động ngắt track khi unmount.
6. `src/hooks/useFaceMesh.js`: Custom React hook quản lý vòng lặp xử lý frame của Face Mesh.
7. `src/hooks/useEyeTracking.js`: Custom React hook kết hợp chất lượng và trích xuất đặc trưng theo thời gian thực.
8. `src/hooks/useSpeech.js`: Custom React hook điều khiển Web Speech API tiếng Việt.
9. `src/components/MedicalDisclaimer.jsx`: Component banner cảnh báo y khoa tuân thủ quy định.
10. `src/components/CameraView.jsx`: Component khung hiển thị video webcam, tích hợp EyeOverlay, loading spinner và badge trạng thái tracking.
11. `src/components/EyeOverlay.jsx`: Component Canvas overlay vẽ mống mắt (cyan crosshair 468/473) và khóe mắt (amber 362/263/133/33).
12. `src/components/FixationTarget.jsx`: Chấm đỏ chuẩn hóa nhấp nháy cho người dùng tập trung nhìn thẳng.
13. `src/components/Countdown.jsx`: Component đồng hồ đếm ngược số to, rõ ràng cho từng pha test.
14. `src/components/TestInstruction.jsx`: Hướng dẫn thao tác theo từng bước, có badge báo rõ che mắt nào.
15. `src/components/TestProgress.jsx`: Đèn tín hiệu tiến trình chu kỳ 1, 2, 3 và pha hiện tại.
16. `src/pages/StaticEyeTest.jsx`: Trang đo tĩnh vị trí mống mắt nguyên bản chuyển đổi sang React.
17. `src/pages/StrabismusScreening.jsx`: Trang thực hiện quy trình Cover Test luân phiên 3 chu kỳ kèm biểu đồ quỹ đạo và phán quyết.
18. `docs/AI_STRABISMUS_PROJECT.md`: Tài liệu tổng quan dự án RemiCare AI.
19. `docs/phases/PHASE_1_HANDOFF.md`: File handoff kỹ thuật Phase 1.

---

## 4. Files Modified
1. `src/App.jsx`: Tái cấu trúc thành điều hướng 2 chế độ (`[ Đo tĩnh ]` & `[ Cover Test ]`), hỗ trợ chuyển giao diện Sáng / Tối (Light/Dark theme) và footer cam kết bảo mật 100% client-side.
2. `src/index.css`: Toàn bộ Design System với CSS custom properties, màu sắc HSL chuyên biệt, glassmorphism, responsive grid, và font chữ Plus Jakarta Sans.
3. `index.html`: Cập nhật tiêu đề trang, kết nối trước Google Fonts và nhúng CDN script MediaPipe Face Mesh đảm bảo chạy mượt trên WebAssembly.
4. `package.json`: Tích hợp các script build, lint, dev của Vite React.

---

## 5. Current Architecture

```
                          index.html (MediaPipe Face Mesh CDN)
                                      │
                                  App.jsx (Routing & Theme)
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
       StaticEyeTest.jsx                          StrabismusScreening.jsx
        (Chế độ Đo tĩnh)                          (Nghiệm pháp Cover Test)
               │                                             │
               ├──────────────────────┬──────────────────────┤
               ▼                      ▼                      ▼
         CameraView.jsx       MedicalDisclaimer     FixationTarget.jsx
         (EyeOverlay.jsx)     Countdown.jsx         TestInstruction.jsx
                                                    TestProgress.jsx
                                      │
               ┌──────────────────────┼──────────────────────┐
               ▼                      ▼                      ▼
         useCamera.js           useFaceMesh.js       useEyeTracking.js
               │                      │                      │
               ▼                      ▼                      ▼
        cameraService.js      faceMeshService.js     eyeFeatureService.js
               │                      │                      │
               ▼                      ▼                      ▼
          getUserMedia       refineLandmarks: true   Feature Extraction
          Track cleanup       468/473, 362/263...    Displacement logic
```

---

## 6. Current Data Flow
1. **Webcam Stream:**
   `useCamera` gọi `startCameraStream()` trong `cameraService.js` $\rightarrow$ gán `srcObject` vào `<video>` trong `CameraView.jsx`.
2. **Khung hình sang Face Mesh:**
   `useFaceMesh` chạy vòng lặp `requestAnimationFrame` $\rightarrow$ gọi `faceMesh.send({ image: videoElement })`.
3. **Phân tích Landmark & Kiểm định chất lượng:**
   Kết quả trả về qua `onResults` $\rightarrow$ đưa vào `useEyeTracking.processResults()`:
   - `validateEyeTrackingQuality()`: Kiểm tra sự hiện diện của khuôn mặt, 2 mắt và tọa độ mống mắt hợp lệ trong khung hình.
   - Nếu không đạt: Hủy đưa vào buffer, hiển thị badge cảnh báo "Không phát hiện khuôn mặt" hoặc "Không nhận diện đủ hai mắt".
   - Nếu hợp lệ: `extractEyeFeatures()` tính toán 11 tham số chuẩn hóa.
4. **Vẽ Overlay:**
   `rawLandmarks` được truyền tức thì vào `EyeOverlay.jsx` để vẽ crosshair tại 468, 473 và điểm khóe mắt 362, 263, 133, 33.
5. **Vòng lặp Cover Test:**
   `StrabismusScreening.jsx` chạy qua Promise-based state machine:
   - `BASELINE` (3000ms) $\rightarrow$ `COVER_LEFT` (3000ms) $\rightarrow$ `UNCOVER_LEFT` (1500ms, thu thập quỹ đạo mắt phải) $\rightarrow$ `COVER_RIGHT` (3000ms) $\rightarrow$ `UNCOVER_RIGHT` (1500ms, thu thập quỹ đạo mắt trái) $\rightarrow$ lặp lại 3 chu kỳ.
6. **Xử lý Tái định vị & Kết quả:**
   - Hàm `calculateRefixationDisplacement()` lấy các điểm trong cửa sổ 500ms đầu tiên của pha mở che mắt.
   - Tính khoảng cách dịch chuyển tịnh tiến Euclid chuẩn hóa theo chiều rộng mắt.
   - Đánh giá đa số phiếu (Majority Voting) qua 3 chu kỳ để đưa ra phán quyết "Phát hiện dịch chuyển tái định vị" hoặc "Không phát hiện bất thường".
   - Vẽ đường biểu diễn quỹ đạo mống mắt lên canvas chart.

---

## 7. Configuration (`src/constants/screeningConfig.js`)
```javascript
export const SCREENING_CONFIG = {
  BASELINE_MS: 3000,          // Thời gian cố định mắt ban đầu mỗi chu kỳ
  COVER_MS: 3000,             // Thời gian che một bên mắt
  UNCOVER_WINDOW_MS: 500,     // Cửa sổ phân tích giật tái định vị (300 - 500ms)
  RECORD_MS: 1500,            // Tổng thời gian ghi hình sau khi bỏ che
  REST_MS: 1500,              // Thời gian nghỉ thư giãn giữa các chu kỳ
  CYCLES: 3,                  // Số chu kỳ Cover Test
  DISPLACEMENT_THRESHOLD: 0.10, // Ngưỡng dịch chuyển mống mắt (10% chiều rộng mắt)
  STATIC_HISTORY_MAX: 60,     // Số khung hình lưu trữ đo tĩnh
  STATIC_STABLE_MIN: 30,      // Số khung hình tối thiểu để hiển thị kết luận tĩnh
  STATIC_DIFF_ALERT_THRESHOLD: 0.18, // Ngưỡng chênh lệch tỷ lệ đo tĩnh
};
```

---

## 8. What Has Been Tested
- [x] **React build:** `npm run build` chạy thành công (Vite 8, React 19), 0 lỗi, bundle gọn nhẹ (`index.js`: ~257KB, `index.css`: ~14.6KB).
- [x] **Linting:** `oxlint` đạt 0 warnings, 0 errors trên toàn bộ 20 files.
- [x] **Dev Server:** Chạy trơn tru trên `http://127.0.0.1:5173/`, phản hồi HTTP 200 OK.
- [x] **Điều hướng Tab:** Chuyển đổi qua lại giữa `[ Đo tĩnh ]` và `[ Cover Test ]` tức thì, dọn dẹp sạch sẽ tài nguyên camera khi rời tab.
- [x] **Dọn dẹp Camera:** `MediaStreamTrack.stop()` chạy trong useEffect cleanup của `useCamera.js`, không để camera chạy ngầm.
- [x] **MediaPipe Face Mesh:** Cấu hình `refineLandmarks: true` chính xác, nhận diện iris 468, 473 và khóe mắt.
- [x] **State Machine:** Trình tự các bước `INTRO` $\rightarrow$ `BASELINE` $\rightarrow$ `COVER_LEFT` $\rightarrow$ `UNCOVER_LEFT` $\rightarrow$ `COVER_RIGHT` $\rightarrow$ `UNCOVER_RIGHT` $\rightarrow$ `COMPLETE` diễn ra chuẩn xác với đếm ngược số.
- [x] **Hủy Test (Cancel):** Nút "Hủy bài kiểm tra" ngắt ngay vòng lặp và đưa về trạng thái an toàn.
- [x] **Lưu trữ quỹ đạo (Trajectories):** Mảng điểm `{ t, irisX, irisY, normalizedX, normalizedY }` được lưu trữ đầy đủ 3 chu kỳ và dựng biểu đồ Canvas đồ thị sóng mống mắt.
- [x] **Cảnh báo Y tế:** Hiển thị nổi bật với câu quy định bắt buộc của dự án.
- [x] **Giọng nói (Speech Synthesis):** Tích hợp phát giọng tiếng Việt và hỗ trợ nút bật/tắt (mute/unmute).

---

## 9. Known Issues
- Khi người dùng che mắt quá sát vào camera làm che khuất cả 2 mắt hoặc toàn bộ khuôn mặt, MediaPipe sẽ kích hoạt trạng thái "Không phát hiện khuôn mặt" (đây là hành vi an toàn theo đúng thiết kế Data Quality Gate, không gây crash ứng dụng).
- Web Speech API trên một số trình duyệt không có sẵn voice `vi-VN` cục bộ sẽ sử dụng voice mặc định của hệ điều hành.

---

## 10. Important Decisions
1. **Sử dụng CDN MediaPipe kết hợp FaceMesh Service:** Để tránh xung đột bundle WebAssembly/CommonJS của gói npm `@mediapipe/face_mesh` trong Vite 8, script được nạp trực tiếp qua CDN với `locateFile` trỏ chính xác về kho tài nguyên WASM chuẩn.
2. **Quy chuẩn tọa độ mống mắt chuẩn hóa:** `normalizedX` được tính bằng khoảng cách từ tâm mống mắt tới khóe mắt trong chia cho chiều rộng của chính mắt đó ($\frac{X_{iris} - X_{inner}}{EyeWidth}$), triệt tiêu sự phụ thuộc vào khoảng cách người dùng xa/gần camera.
3. **Cửa sổ phân tích Refixation Saccade 500ms:** Chuyển động giật tái định vị trong lâm sàng nhãn khoa thường xảy ra trong 300 - 500ms ngay sau khi mở mắt che. Do đó việc chốt cửa sổ `UNCOVER_WINDOW_MS = 500` phản ánh đúng sinh lý học thị giác.

---

## 11. What Phase 2 Must Read
Trước khi bắt đầu Phase 2, Kỹ sư Machine Learning phải đọc kỹ:
1. `src/constants/screeningConfig.js`: Nắm các định nghĩa chỉ số landmark (`468`, `473`, `362`, `263`, `133`, `33`) và cấu hình thời gian.
2. `src/services/eyeFeatureService.js`: Hiểu rõ cấu trúc vector đặc trưng 11 chiều do hàm `extractEyeFeatures()` xuất ra. Đây chính là feature vector đầu vào cho quá trình huấn luyện model ở Phase 2.
3. `src/pages/StrabismusScreening.jsx`: Hiểu quy trình thu thập `trajectories` để kết nối bộ dự đoán AI vào kết quả của bài test.
4. `docs/AI_STRABISMUS_PROJECT.md`: Định hướng tổng thể về mô hình AI client-side (ONNX Runtime Web).

---

## 12. What Phase 2 Must NOT Break
1. **KHÔNG xóa hoặc thay đổi interface của `extractEyeFeatures`:** Các trường (`leftHorizontalRatio`, `rightHorizontalRatio`, `leftEyeWidth`, `interocularDistance`,...) đang phục vụ cả chế độ Đo tĩnh và Cover Test.
2. **KHÔNG xóa hoặc làm gián đoạn chế độ Đo tĩnh (`StaticEyeTest.jsx`):** Đây là tính năng cơ bản cần được duy trì song song với Cover Test.
3. **KHÔNG upload hình ảnh/video người dùng:** Mọi bước xử lý trong Phase 2 (dataset, training, inference) phải duy trì triết lý Privacy-First, tuyệt đối không gửi frame camera của người dùng lên server.
4. **KHÔNG phá vỡ cơ chế giải phóng camera (`MediaStreamTrack.stop()`):** Camera chỉ được kích hoạt khi người dùng cho phép và phải tắt hoàn toàn khi rời khỏi component.
5. **KHÔNG xóa cảnh báo y tế trong `MedicalDisclaimer.jsx`.**

---

## 13. Next Phase Tasks (Dự kiến cho Phase 2)
1. **Dataset chuẩn bị:** Thu thập hoặc định dạng bộ dữ liệu ảnh/đặc trưng mắt mắt bình thường và mắt lác (dữ liệu do người dùng cung cấp).
2. **Trích xuất đặc trưng & Huấn luyện (Training):** Huấn luyện mô hình phân loại (ví dụ: LightGBM / MLP / Tiny-CNN) trên các vector đặc trưng mắt hoặc ROI mống mắt.
3. **Chuyển đổi mô hình (Model Export):** Xuất mô hình sang định dạng ONNX (`.onnx`) hoặc TensorFlow.js có dung lượng nhỏ gọn (< 5MB) để tối ưu cho trình duyệt.
4. **Đánh giá mô hình (Model Evaluation):** Đo đạc các chỉ số Accuracy, Precision, Recall, F1-score, Confusion Matrix.
5. **Tạo tài liệu Handoff:** Hoàn thiện `docs/phases/PHASE_2_HANDOFF.md` trước khi bước vào Phase 3.
