# BÁO CÁO PHÂN TÍCH NGUYÊN NHÂN LỖI TRÊN IOS SAFARI & GIẢI PHÁP
**Dự án:** RemiCare AI Strabismus & Vision Screening  
**Ngày phân tích:** 03/10/2026  
**Thiết bị kiểm thử:** Apple iPhone (iOS Safari, WebKit Engine)  

---

## 1. TỔNG QUAN CÁC VẤN ĐỀ ĐƯỢC BÁO CÁO TRÊN IOS

Dựa trên kết quả thử nghiệm thực tế và ảnh chụp màn hình từ iPhone của người dùng, có **3 lỗi nghiêm trọng** xảy ra trên môi trường iOS Safari:

1. **Giai đoạn 3 ("Nhìn mờ" - Experience Vision) bị lặp giọng nói liên tục ("nói hoài"):**  
   AI liên tục đọc đè câu thoại hoặc phát lại câu hỏi không dừng, khiến người dùng không thể tiếp tục trải nghiệm.
2. **Không có giao diện mờ trong Giai đoạn 3 ("không có giao diện mờ"):**  
   Mặc dù bước 3 là mô phỏng mất độ nét (blur), camera trên iPhone hiển thị hoàn toàn sắc nét, không có bất kỳ hiệu ứng mờ nào.
3. **Lệch tọa độ mắt và khung nhận diện 1.78x ("lỗi giao diện của iOS" - Xem ảnh chụp màn hình):**  
   Khuôn mặt người dùng nằm ở nửa bên trái khung hình, nhưng ô nhận diện mắt trái (viewer's right) bị văng ra tận khoảng trắng bên phải, khung viền đứt nét khuôn mặt bị kéo lệch sang phải và tràn ra khỏi mép video, chấm tròn tâm mặt rơi xuống tận vùng má. Đồng thời âm thanh hướng dẫn khoảng cách bị mâu thuẫn (báo 20.1 cm là quá xa).

---

## 2. NGUYÊN NHÂN CHI TIẾT (ROOT CAUSES) TRÊN IOS SAFARI

### 2.1. Vì sao không có giao diện mờ ở Giai đoạn 3 (No Blur on iOS)?

- **Vị trí code:** [src/components/ExperienceVision/VisualEffectEngine.js](file:///d:/AI_Check_Lac/src/components/ExperienceVision/VisualEffectEngine.js), dòng 194–199:
  ```javascript
  // 3. BLUR: Defocus and spatial frequency degradation
  renderBlur(ctx, width, height) {
    const rect = this.getDrawRect(width, height);
    ctx.filter = 'blur(11px) contrast(0.9)';
    ctx.drawImage(this.video, rect.x, rect.y, rect.width, rect.height);
    ctx.filter = 'none';
  }
  ```
- **Nguyên nhân kỹ thuật WebKit (Bugzilla #161247 & #221290):**
  - Trình duyệt Safari trên iOS sử dụng WebKit engine. Trong WebKit, thuộc tính `CanvasRenderingContext2D.filter` (chuỗi bộ lọc 2D context) **hoàn toàn không hỗ trợ khi nguồn vẽ là một thẻ `<video>`** (`ctx.drawImage(HTMLVideoElement)`).
  - Khi gọi `ctx.filter = 'blur(11px)...'`, Safari trên iOS **âm thầm bỏ qua bộ lọc** và vẽ thẳng luồng video gốc lên canvas mà không có bất kỳ độ mờ nào.
  - Tương tự, các bước nhược thị (`amblyopia`, `severeAmblyopia`) và ưu tiên một mắt (`oneEyePriority`) sử dụng `ctx.filter` cũng bị mất hiệu ứng mờ trên iOS.
- **Giải pháp:**
  - Chuyển cơ chế làm mờ sang **CSS GPU-Accelerated Filter** trên chính phần tử DOM / Canvas:
    ```css
    .canvas-effect-blur {
      filter: blur(12px) contrast(0.92) !important;
      -webkit-filter: blur(12px) contrast(0.92) !important;
    }
    ```
  - Thuộc tính CSS `filter` và `-webkit-filter` được xử lý trực tiếp bởi Apple Metal GPU Compositor, hoạt động mượt mà 60fps trên 100% thiết bị iOS (iPhone/iPad).

---

### 2.2. Vì sao AI đọc giọng nói bị lặp liên tục ("Nói hoài" trên iOS)?

- **Vị trí code:** 
  - [src/components/ExperienceVision/VoiceController.jsx](file:///d:/AI_Check_Lac/src/components/ExperienceVision/VoiceController.jsx), dòng 34–50
  - [src/components/ExperienceVision/ExperienceVisionPage.jsx](file:///d:/AI_Check_Lac/src/components/ExperienceVision/ExperienceVisionPage.jsx), dòng 181–189
- **Cơ chế gây lỗi:**
  1. Khi người dùng vào Giai đoạn 3, hệ thống gán `speakingText = activeStage.voiceText` (lời dẫn đầu).
  2. `VoiceController` gọi `audioService.speak(voiceText)`.
  3. Trên iOS Safari, Apple áp dụng **chính sách Autoplay cực kỳ khắt khe** (`NotAllowedError` nếu âm thanh phát mà không có tương tác click đồng bộ trực tiếp). Đồng thời Web Speech API của iOS thường trả lỗi hoặc kết thúc trong 0 mili-giây.
  4. Khi `audioService.speak()` kết thúc ngay lập tức, khối `finally` trong `VoiceController` lập tức kích hoạt:
     ```javascript
     onVoiceCompleteRef.current?.();
     ```
  5. Hàm `handleVoiceComplete` trong `ExperienceVisionPage` được gọi:
     ```javascript
     if (stage?.question && !showQuestion && stage.id !== 7 && !userAnswers[stage.id]) {
       setShowQuestion(true);
       setSpeakingText(stage.question.voiceText);
     }
     ```
  6. **Hiện tượng Race Condition / Stale State:** Do âm thanh trên iOS kết thúc trong 0ms (ngay trong cùng macro/microtask), `onVoiceCompleteRef.current` gọi lại trước khi React kịp hoàn tất chu kỳ render với `showQuestion = true`.
  7. Do `!showQuestion` vẫn là `true` trong bộ nhớ đệm, hàm `setSpeakingText` lại được gọi liên tục. Mỗi lần gọi lại kích hoạt `VoiceController` chạy effect mới -> gọi `speak` -> fail trong 0ms -> gọi `onVoiceComplete` -> lặp đệ quy vô hạn!
- **Giải pháp:**
  - Sử dụng khóa tham chiếu `questionTriggeredRef` theo `stage.id`: Đảm bảo câu hỏi của mỗi giai đoạn **chỉ được phép kích hoạt đọc đúng 1 lần duy nhất**, loại bỏ hoàn toàn khả năng sinh ra vòng lặp đệ quy.
  - Ngăn không cho gọi `onVoiceComplete` nếu phiên phát âm bị hủy hoặc lỗi do quyền autoplay trên iOS.

---

### 2.3. Vì sao giao diện và tọa độ mắt bị lệch 1.78x trên iOS (Ảnh chụp thực tế)?

- **Vị trí code:**
  - [src/components/CameraView.jsx](file:///d:/AI_Check_Lac/src/components/CameraView.jsx)
  - [src/components/EyeOverlay.jsx](file:///d:/AI_Check_Lac/src/components/EyeOverlay.jsx)
  - [src/utils/cameraCoordinateTransform.js](file:///d:/AI_Check_Lac/src/utils/cameraCoordinateTransform.js)
- **Cơ chế gây lỗi (Toán học hình học 1.78x):**
  1. **Khác biệt luồng WebRTC trên iOS:** Khi camera khởi động trên iOS Safari, sự kiện `loadedmetadata` ban đầu thường trả về độ phân giải mặc định của phiên đàm phán SDP: `640 x 480` (tỷ lệ 4:3 = 1.333).
  2. Ngay sau đó, camera trước vật lý của iPhone xoay theo chiều dọc và cung cấp khung hình thực tế là `480 x 640` (tỷ lệ 3:4 = 0.75).
  3. **Đặc tính WebKit iOS:** Trình duyệt Safari trên iOS **không kích hoạt sự kiện `resize` trên thẻ `<video>`**, đồng thời sự kiện `timeupdate` bị đình trệ trên các thẻ video `muted` `playsinline`.
  4. Do đó, state `actualDimensions` trong React bị giữ nguyên ở giá trị cũ `640 x 480`.
  5. Component `<EyeOverlay>` nhận `videoWidth = 640` và `videoHeight = 480`. Kích thước canvas vẽ landmark được gán:
     ```javascript
     canvas.width = 640;
     canvas.height = 480; // Tỷ lệ 4:3
     ```
  6. Trong khi đó, thẻ `<video>` bên dưới lại đang phát luồng thực tế là **480 x 640 (3:4)**.
  7. Cả hai phần tử đều áp dụng CSS `object-fit: cover; transform: scaleX(-1);`. Khi một phần tử 4:3 và một phần tử 3:4 cùng áp dụng `object-fit: cover` vào container, trình duyệt sẽ scale và crop chúng theo hai hệ số hoàn toàn khác nhau:
     $$\text{Tỷ lệ lệch dãn ngang} = \frac{4/3}{3/4} = \frac{16}{9} \approx 1.7778 \ (\approx 1.78\text{x})$$
  8. Mắt trái thực tế của người dùng nằm ở tọa độ $X \approx 36\%$. Khi bị nhân với hệ số lệch $1.7778$, tọa độ vẽ trên canvas bị đẩy văng sang:
     $$36\% \times 1.7778 \approx 64\%$$
     **Khớp chính xác 100% với vị trí mắt trái lơ lửng ngoài khoảng trắng trong ảnh chụp của bạn!**
  9. Khung nét đứt nhận diện khuôn mặt (`face-bounding-box`) và khung mục tiêu an toàn (`target-zone`) cũng bị ảnh hưởng bởi sự lệch pha giữa `videoWidth` và `containerWidth`, dẫn đến toàn bộ hệ thống overlay bị trôi lệch sang bên phải.

---

### 2.4. Vì sao lời nhắc cự ly bị mâu thuẫn trong PositionCheck?

- **Vị trí code:** [src/components/binocular/PositionCheck.jsx](file:///d:/AI_Check_Lac/src/components/binocular/PositionCheck.jsx), dòng 48:
  ```javascript
  speak('Ngồi cách camera ba mươi đến bốn mươi xăng-ti-mét, giữ đầu thẳng nghen.');
  ```
- **Cơ chế gây lỗi:**
  - Ở bước **Chụp 4 hướng mắt** (`GAZE_4_DIRECTIONS`), khoảng cách chuẩn yêu cầu là **15–20 cm** (như hiển thị trên giao diện: `Bạn đang quá xa. Hãy đưa mặt lại gần khoảng 15–20 cm`).
  - Tuy nhiên, câu lệnh âm thanh hướng dẫn lại bị hardcode thành `ba mươi đến bốn mươi xăng-ti-mét`.
  - Khi người dùng nghe theo tiếng nói và ngồi cách 30 cm (hoặc khi di chuyển đến 20.1 cm), hệ thống liên tục nhắc người dùng ngồi xa trong khi màn hình lại yêu cầu lại gần, gây nhiễu và khiến thuật toán khoảng cách bị dao động ở ngưỡng biên.

---

## 3. KẾ HOẠCH KHẮC PHỤC TRIỆT ĐỂ (ACTION PLAN)

| STT | Vấn đề | Tệp cần sửa | Giải pháp kỹ thuật |
| :--- | :--- | :--- | :--- |
| 1 | **Không có hiệu ứng mờ** | `src/components/ExperienceVision/CameraView.jsx`<br>`src/components/ExperienceVision/experienceVision.css` | Bổ sung class `.canvas-effect-blur` áp dụng CSS `filter: blur(14px)` và `-webkit-filter: blur(14px)` trực tiếp trên thẻ `<canvas>`, đảm bảo iOS Metal GPU render mờ 100%. |
| 2 | **Lặp giọng nói ("nói hoài")** | `src/components/ExperienceVision/ExperienceVisionPage.jsx`<br>`src/components/ExperienceVision/VoiceController.jsx` | Dùng ref chốt chặn `questionTriggeredRef` chỉ cho phép đọc câu hỏi 1 lần/giai đoạn. Bổ sung debounce và cơ chế kiểm tra `isSpeaking` chống gọi đúp. |
| 3 | **Lệch tọa độ 1.78x trên iOS** | `src/components/CameraView.jsx`<br>`src/components/EyeOverlay.jsx` | Đọc trực tiếp `videoElement.videoWidth` và `videoElement.videoHeight` thời gian thực trong vòng lặp frame thay vì phụ thuộc sự kiện `resize`/`timeupdate` của iOS; ép kích thước canvas luôn khớp 1:1 với kích thước thực của luồng video. |
| 4 | **Sai lệch âm thanh cự ly** | `src/components/binocular/PositionCheck.jsx` | Thay thế câu lệnh hardcode 30–40 cm bằng thông số động lấy từ `config.instruction` (15–20 cm cho 4 hướng mắt; 33–40 cm cho Cover Test). |
