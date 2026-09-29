# RemiCare Strabismus AI Improvement Plan

> **Tài liệu Kế hoạch Nâng cấp & Hoàn thiện Hệ thống AI Sàng lọc Lác Mắt RemiCare**
> *Phiên bản:* 2.1-Review-Corrected
> *Trạng thái:* Phân tích & Đề xuất Kỹ thuật — Chưa chỉnh sửa mã nguồn / Chưa huấn luyện lại mô hình
>
> **Nguyên tắc cốt lõi:**
> - Đảm bảo tính pháp lý về bản quyền (License Compliance).
> - Ưu tiên ổn định pipeline thu nhận camera và đo đạc động học chính xác trước khi nâng cấp mô hình AI.
> - **Không** đưa ra kết luận định lượng độ chính xác (% Accuracy) khi chưa có thực nghiệm lâm sàng đối chứng.
> - **Không** coi `presentationTime` là timestamp phần cứng camera tuyệt đối (xem Section 4.1).
> - **Không** coi `11.7 mm` và `18 PD/mm` là hằng số sinh học tuyệt đối bất biến (xem Section 4.6 & 8).
> - **Không** claim accuracy hoặc PD error margin nếu chưa có benchmark thực nghiệm với ground truth lâm sàng.

---

## 1. Current System

### 1.1. Tóm tắt kiến trúc RemiCare hiện tại

RemiCare là hệ thống hỗ trợ sàng lọc độ lác mắt (strabismus / phoria / tropia) vận hành **100% Client-side** trên trình duyệt thông qua WebAssembly:

- **Ngăn xếp công nghệ:** React 19, Vite, WebRTC MediaStream, Google MediaPipe Face Mesh (`refineLandmarks: true`, 478 điểm mốc), ONNX Runtime Web (`onnxruntime-web`), Web Speech API tiếng Việt.
- **Phương pháp tiếp cận:**
  1. *Đo tĩnh tương quan trục thị giác (Static Alignment):* Đánh giá tỉ lệ vị trí mống mắt so với khóe mắt trong trạng thái nhìn cố định điểm chuẩn (`FixationTarget`).
  2. *Nghiệm pháp Che mắt Luân phiên Kỹ thuật số (Digital Alternate Cover Test):* Máy trạng thái 3 chu kỳ (3s Baseline → 3s Cover → 3s Uncover), ghi nhận quỹ đạo tái định vị (Refixation Saccade) trong cửa sổ 500 ms sau khi bỏ che.
  3. *Mô hình AI nơ-ron cục bộ:* Mạng Small MLP (32-16 node, tệp ONNX 5.1 KB) nhận vector đặc trưng hình học 10 chiều, suy luận 10 FPS, làm mượt qua 8 mẫu.
  4. *Dung hợp Đa phương thức (Multi-Modal Fusion):* $w_{CV} = 0.60$, $w_{AI} = 0.40$ — **các trọng số V1 này chưa được tối ưu hóa thực nghiệm, sẽ được thay thế ở V2 (xem Section 5.12A).**

```
Webcam (640x480) ──► MediaPipe Face Mesh (478 LMs) ──► OneEuroFilter ──► extractEyeFeatures()
                                                                              │
              ┌───────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┐
              ▼                                                                                                              ▼
 Computer Vision Motion Engine                                                                              AI Static Inference Loop
 - Robust Baseline (Median, IQR)                                                                          - 10-D Normalized Vector
 - Uncover Window Analysis (500 ms)                                                                       - ONNX Small MLP (32, 16)
 - Net/Peak Displacement & Velocity                                                                       - Moving Average (w = 8)
              │                                                                                                              │
              └─────────────────────────────────────────────┬──────────────────────────────────────────────────────────────┘
                                                            ▼
                                            Multi-Modal Fusion (60% CV + 40% AI) [V1 weights — unvalidated]
                                                            ▼
                                            3-Cycle Majority Voting & Final Verdict
```

### 1.2. Điểm mạnh (Strengths)

1. **Zero Data Transmission:** Toàn bộ pipeline xử lý nội bộ trên trình duyệt. Không có video hay ảnh khuôn mặt nào được gửi lên server.
2. **One Euro Filter thích ứng thời gian thực:** Triệt tiêu jitter ở vận tốc thấp mà không làm trễ pha vận tốc cao.
3. **Robust Baseline (Median + IQR):** Phát hiện mất cố định thị giác, ngăn baseline ảo.
4. **Quality Gate đa chiều:** `FrontendQualityGate` kiểm tra phát hiện mặt, EAR, khoảng cách IPD, tư thế đầu.
5. **Bộ kiểm thử tự động:** `coverTestTimeSeriesTestCases.js`, `cvModulesTestCases.js` kiểm soát tính hồi quy khi cải tiến logic.

### 1.3. Điểm yếu (Weaknesses)

1. **Vòng lặp thu nhận khung hình chưa tối ưu:** `useFaceMesh` chạy bằng `requestAnimationFrame` (rAF). Trên màn hình > 30 Hz, rAF kích hoạt liên tục khiến MediaPipe nhận trùng khung hình cũ từ webcam, gây lãng phí CPU/GPU và sai lệch $\Delta t$.
2. **Timestamp chưa per-frame:** Dùng `performance.now()` tại thời điểm JS callback thay vì `presentationTime` từ rVFC — giá trị nhất quán hơn cho mỗi decoded frame. **Lưu ý:** `presentationTime` cũng là browser-level timestamp, không phải hardware sensor timestamp (xem Section 4.1).
3. **Bù trừ chuyển động đầu chưa hoàn chỉnh:** Chỉ có gate từ chối frame nếu lệch quá ngưỡng; chưa có bù trừ tương đối trong phạm vi góc được chấp nhận.
4. **Blink filtering còn đơn giản:** Chỉ kiểm tra $EAR < 0.18$ tức thời, thiếu temporal buffer để xử lý frame chuyển tiếp.
5. **Xung đột Feature Contract Python ↔ JS:** Công thức feature extraction có thể không đồng nhất. Xem `FEATURE_CONTRACT_V1.md` để biết định nghĩa chính tắc.
6. **Mô hình AI chỉ nhìn ảnh tĩnh:** MLP tĩnh bỏ phí toàn bộ đặc tính động học của chuỗi thời gian Cover Test.

### 1.4. Những thành phần còn thiếu (Missing Components)

1. **Hirschberg / Corneal Light Reflex (CLR):** Thiếu hoàn toàn. Việc triển khai trên webcam thông thường gặp nhiều giới hạn kỹ thuật quan trọng — xem Section 4.6 và 8.
2. **Savitzky-Golay Filter:** Chưa có SG filter để bảo toàn đỉnh vận tốc giật mắt cho phân tích Uncover.
3. **Saccade Detection tự thích ứng:** Đang dùng ngưỡng cứng `gazeVelocity > 2.0` — không thích ứng với nhiễu nền webcam.
4. **Kinematics đầy đủ:** Chưa tính gia tốc, saccade latency, settling time, và chưa phân biệt Eso/Exo/Hyper/Hypo theo dấu.

---

## 2. Problems Found

| STT | Module ảnh hưởng | Vấn đề kỹ thuật cụ thể | Hậu quả |
| :--- | :--- | :--- | :--- |
| **P-01** | `src/hooks/useFaceMesh.js` | Dùng rAF độc lập với luồng video, không dùng rVFC khi browser hỗ trợ. | Xử lý trùng frame trên màn hình > 30 Hz; méo mó $\Delta t$. |
| **P-02** | `src/services/cameraService.js` | Không dùng `presentationTime` từ rVFC; dùng `performance.now()` tại thời điểm JS callback. | Jitter ΔT do JS Event Loop; sai lệch vi phân vận tốc. |
| **P-03** | `training/extract_features.py` `src/services/eyeFeatureService.js` | Khả năng lệch công thức feature — cần kiểm tra và đồng bộ theo `FEATURE_CONTRACT_V1.md`. | Phân phối feature lệch giữa training và inference. |
| **P-04** | `src/services/cv/frontendQualityGate.js` | Head pose bằng xấp xỉ 2D. | Đủ trong phạm vi ±15° Quality Gate; chưa xử lý out-of-plane đầy đủ. |
| **P-05** | `src/services/eyeFeatureService.js` | Blink filter tức thời $EAR < 0.18$, thiếu temporal buffer. | False peak velocity spikes từ frame chuyển tiếp mi mắt. |
| **P-06** | `src/services/cv/gazeTracker.js` | Ngưỡng saccade cố định `saccadeVelocityThreshold = 2.0`. | Không thích ứng nhiễu nền; cần adaptive threshold từ Baseline. |
| **P-07** | `src/services/coverTestMeasurementService.js` | Chỉ chuẩn hóa theo `eyeWidth` 2D. | Chưa tương thích đơn vị lâm sàng (deg/s, PD). |
| **P-08** | Toàn bộ hệ thống | Chưa có Hirschberg detection. | Thiếu công cụ sàng lọc tĩnh — nhưng có giới hạn vật lý lớn trên webcam, xem Section 4.6. |

---

## 3. GitHub Research

### 3.1. OptiHealth-Innovators/StrabismusCare

- **License:** MIT License.
- **Công nghệ:** React Native/Expo + Python backend; ViT-B/16 trên ảnh $224 \times 224$.
- **Đánh giá:**
  - ViT Image Backbone: **Không phù hợp** cho RemiCare client-side.
  - ROI cropping & EAR: **Có thể port/reimplement** sang JavaScript.

### 3.2. aaryanpatil2007/vision-screen

- **License:** **KHÔNG CÓ LICENSE — All Rights Reserved.**
  - **Cảnh báo:** Tuyệt đối không sao chép mã nguồn. Chỉ tham chiếu nguyên lý toán học để Clean-room reimplementation.
- **Công nghệ:** Module `alignment.py` dùng HVID 11.7 mm và 18 PD/mm làm tham chiếu. **Các giá trị này là population mean, không phải hằng số sinh học — xem Section 8.**
- **Đánh giá:**
  - Nguyên lý toán học Hirschberg: **Có thể port/reimplement** (clean-room bắt buộc).
  - Mã nguồn: **Không được reuse.**

### 3.3. Haakeye/Gaze-Tracking

- **License:** MIT License.
- **Đánh giá:** Triển khai RemiCare hiện tại đã tiên tiến hơn. **Chỉ tham khảo.**

### 3.4. martin-vasilev/eyemovements

- **License:** MIT License.
- **Công nghệ:** Savitzky-Golay Filter (p=2/3, n=5/7), Engbert-Kliegl saccade detection, DVA conversion.
- **Đánh giá:** SG Filter, Engbert-Kliegl, DVA: **Có thể port/reimplement** sang JavaScript.

### 3.5. berenslab/uneye

- **License:** **KHÔNG CÓ LICENSE — academic research.**
  - **Cảnh báo:** Không sao chép mã nguồn. Chỉ tham khảo kiến trúc từ bài báo.
- **Công nghệ:** 1D U-Net cho **segmentation** chuỗi thời gian mắt. **Lưu ý:** Đây là segmentation task, RemiCare cần classification — xem Section 6.3.
- **Đánh giá:** Ý tưởng 1D Temporal CNN: **Chỉ tham khảo kiến trúc** — không dùng U-Net architecture.

---

## 4. Techniques Worth Adopting

### 4.1. Thu nhận khung hình bằng `requestVideoFrameCallback` (rVFC) — Progressive Enhancement

- **Phân loại:** Có thể implement.
- **Giải pháp kỹ thuật — Progressive Enhancement:**

  ```javascript
  // rVFC: Chrome 83+, Edge 83+, Firefox 132+
  // Safari iOS < 18.0: KHÔNG hỗ trợ — fallback rAF bắt buộc
  const supportsRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

  function startLoop(videoEl) {
    if (supportsRVFC) {
      videoEl.requestVideoFrameCallback(function tick(now, metadata) {
        processFrame(metadata.presentationTime, metadata.expectedDisplayTime);
        videoEl.requestVideoFrameCallback(tick);
      });
    } else {
      // Fallback: rAF — vẫn hoạt động nhưng có thể xử lý duplicate frames
      function rafTick() {
        processFrame(performance.now(), null);
        rafId = requestAnimationFrame(rafTick);
      }
      rafTick();
    }
  }
  ```

- **Về semantics của `presentationTime`:**
  - Là **DOMHighResTimeStamp browser-level** — thời điểm browser giải mã và trình bày frame lên compositor, cùng epoch với `performance.now()`.
  - **Không phải** timestamp cảm biến phần cứng camera (CMOS capture timestamp).
  - **Không phải** NTP-synchronized hardware clock.
  - **Cải thiện thực sự so với `performance.now()` trong rAF:**
    - Tránh xử lý trùng frame trên màn hình > 30 Hz.
    - Giá trị cố định cho mỗi decoded frame — không drift theo JS event loop jitter.
  - **Ngôn ngữ đúng:** *"browser-decoded frame timestamp — nhất quán hơn performance.now() trong rAF vì không bị drift bởi JS Event Loop jitter".*

- **Lợi ích:** Loại bỏ duplicate frame processing, giảm CPU/GPU, ΔT nhất quán hơn.

### 4.2. Khử nhiễu chớp mắt — Blink Blanking Window

- **Phân loại:** Có thể implement.
- **Giải pháp:**
  - Giữ ngưỡng: $EAR < 0.18$.
  - **Blink Blanking Window:** Khi phát hiện blink, mask tọa độ mống mắt trong $[t_{blink\_start} - 60\text{ ms}, t_{blink\_end} + 120\text{ ms}]$.
  - **Tham số cần benchmark thực nghiệm:** Giá trị $-60\text{ ms}$ và $+120\text{ ms}$ là tham chiếu từ y văn nhãn học. Cần đo với webcam thực tế và MediaPipe để xác nhận.
  - **Edge case cover eye:** Trong pha `coverState === 'COVER'`, chỉ mask blink cho **mắt mở**. Mắt bị che đã loại khỏi phân tích — không mask thêm.
- **Lợi ích:** Triệt tiêu false peak velocity spikes.

### 4.3. Bù trừ chuyển động đầu — 2D Canthal Normalization (V2)

- **Phân loại:** Có thể implement (2D approximation cho V2).
- **Giải pháp:**
  - Hệ quy chiếu cục bộ tại trung điểm khóe mắt trong (mốc 133, 362).
  - Trừ translation và bù canthal roll bằng ma trận xoay 2D:
    $$\vec{P}'_{iris} = \mathbf{R}^T \cdot (\vec{P}_{iris} - \vec{P}_{midCanthi})$$
- **Giới hạn — phải nêu rõ:**
  - Chỉ xử lý 2D translation và roll. **Chưa xử lý** Yaw/Pitch out-of-plane đầy đủ.
  - **Chưa xử lý** Z-axis depth changes.
  - Trong phạm vi Quality Gate ±15°, xấp xỉ 2D chấp nhận được.
  - **V3 Research Item:** MediaPipe Face Geometry module hoặc PnP 3D. Chưa cần cho V2.
- **Lợi ích:** Khử iris drift khi đầu lắc nhẹ trong phạm vi cho phép.

### 4.4. Bộ lọc Savitzky-Golay cho Uncover trajectory

- **Phân loại:** Có thể implement.
- **Giải pháp:**
  - Giữ One Euro Filter cho real-time rendering (< 15 ms latency).
  - Post-processing sau Uncover window: SG bậc 2, cửa sổ 5 điểm, mirror-padding ở biên.
  - **Fallback khi valid samples < 5:** Bỏ qua SG, dùng raw data. Ghi log cảnh báo.
- **Lợi ích:** Smooth trajectory mà không làm cùn $V_{peak}$.

### 4.5. Saccade Detection tự thích ứng — Engbert-Kliegl

- **Phân loại:** Có thể implement.
- **Nguồn σ — quan trọng:**
  - Tính $\sigma_x, \sigma_y$ từ **Baseline phase** (~3s × ~30 FPS ≈ ~90 valid samples).
  - **Không** tính từ Uncover window (~15 samples — quá ít để MAD ổn định).
  - Lưu $\sigma_x, \sigma_y$ từ Baseline để dùng nhất quán cho tất cả Uncover windows trong phiên.
- **Công thức MAD estimator:**
  $$\sigma_x = \frac{\text{median}(|\dot{x} - \text{median}(\dot{x})|)}{0.6745}$$
  (Hệ số 0.6745 = Φ⁻¹(0.75) — chuyển MAD sang ước lượng σ Gaussian)
- **Ellipse criterion:**
  $$\left(\frac{\dot{x}(t)}{\lambda \sigma_x}\right)^2 + \left(\frac{\dot{y}(t)}{\lambda \sigma_y}\right)^2 > 1.0, \quad \lambda = 5$$
- **Minimum sample note:** Nếu valid Baseline samples < 60, cảnh báo chất lượng σ estimation.
- **Lợi ích:** Adaptive threshold, tự thích ứng với nhiễu nền của từng webcam.

### 4.6. Hirschberg / Corneal Light Reflex — Screening-grade Approximation

- **Phân loại:** Có thể implement với cảnh báo giới hạn kỹ thuật quan trọng.

#### Nguyên lý lâm sàng

Hirschberg Test đo độ lệch giữa corneal glint và tâm mống mắt:
$$\Delta_{PD} = \|\vec{\delta}_{mm}\| \times K_{Hirschberg}$$

#### ⚠️ Giới hạn kỹ thuật khi triển khai trên webcam thông thường

**Giới hạn 1 — Thiếu IR illuminator:**
Hirschberg lâm sàng chuẩn dùng đèn LED hồng ngoại cố định (coaxial với camera) để tạo glint xác định và tái lập được. Webcam thông thường không có nguồn sáng cố định. Glint từ đèn phòng/màn hình thay đổi theo ánh sáng môi trường → vị trí glint không nhất thiết phản ánh độ lệch trục thị giác.

**Giới hạn 2 — MediaPipe không detect corneal glint:**
`refineLandmarks: true` trả về **iris center** (điểm 468, 473), không phải glint. Detect glint yêu cầu pixel-level brightness analysis trên Iris ROI qua `getImageData()` từ `<canvas>` hoặc `OffscreenCanvas`. Phải xây dựng glint detection pipeline riêng biệt.

**Giới hạn 3 — Pixel resolution thấp:**
Webcam 640×480: iris ≈ 60–80 px. Mỗi 1 pixel sai số ≈ $11.7/70 \approx 0.167\text{ mm}$. Kết quả PD phụ thuộc nhiều vào ánh sáng và quality của glint detection.

**Giới hạn 4 — Góc Kappa sinh lý:**
Trục thị giác và trục giải phẫu giác mạc lệch 3°–5° (5–10 PD về phía mũi) trong mắt bình thường. Phải kết hợp với Cover Test để phân biệt góc Kappa với lác thực.

#### Giải pháp kỹ thuật (nếu triển khai)

- Detect glint từ brightness peak analysis trên Iris ROI.
- **Stability filter bắt buộc:** Chỉ ghi nhận glint khi brightness rõ ràng và vị trí ổn định ≥ 20 frames liên tiếp.
- Scale: $px\_per\_mm = \text{IrisDiameter}_{px} / HVID_{ref}$ (xem Section 8).
- PD: $\Delta_{PD} = \|\vec{\delta}_{mm}\| \times K_{Hirschberg}$ (xem Section 8).
- **Nếu < 20 stable frames: output `INDETERMINATE`, không output số PD.**

#### Phân loại kết quả

- Kết quả là **screening-grade approximation** — chỉ phù hợp phát hiện lác hiện góc lớn khi glint ổn định.
- **Không thay thế** Prism Cover Test lâm sàng.
- **Không claim** PD accuracy hay error margin nếu chưa có benchmark thực nghiệm với ground truth.

---

## 5. RemiCare V2 Pipeline

```
[Camera WebRTC Stream]
         │ (rVFC — progressive enhancement; fallback: rAF)
         ▼
[Eye / Iris Tracking] (MediaPipe 478 LMs; Iris 468/473; Boundary 469-477)
         │
         ▼
[Timestamp / FPS Engine] (presentationTime — browser-decoded frame timestamp, not hardware sensor)
         │
         ▼
[Quality Check] (Face centering, distance 28-65cm, landmark confidence, FPS ≥ 24)
         │
         ▼
[Blink / Occlusion Filter] (Dual EAR + [-60ms, +120ms] masking — params need benchmark)
         │
         ▼
[Head Pose & 2D Compensation] (Canthal normalization; ±15° Quality Gate; Z-depth not handled — V3 item)
         │
         ▼
[Dual Smoothing] (Real-time: OneEuroFilter | Post-processing: Savitzky-Golay p=2 n=5 + fallback)
         │
         ▼
[Robust Baseline] (Median & IQR; compute σ_x/σ_y for Engbert-Kliegl; min 60 valid samples)
         │
         ▼
[Cover / Uncover State Machine] (3 Cycles: Latency 0-150ms → Saccade 150-400ms → Settling 400-800ms)
         │
         ▼
[Eye Movement Kinematics] (Signed Eso/Exo/Hyper/Hypo; Engbert-Kliegl with Baseline σ; DVA; acceleration)
         │
         ▼
[Hirschberg / CLR Engine] (Pixel ROI glint detection; screening-grade; INDETERMINATE if < 20 stable frames)
         │
         ▼
[Multi-Modal Fusion] (w1·Kinematics + w2·Hirschberg + w3·MorphologyAI — HYPERPARAMETER weights)
         │
         ▼
[Final Verdict] (Orthophoria / Phoria / Tropia — with INDETERMINATE for Hirschberg if unstable)
```

### Chi tiết từng giai đoạn

#### Stage 1. Camera Input

- Constraints: `{ width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, min: 25 }, facingMode: 'user' }`.
- rVFC progressive enhancement với rAF fallback (xem Section 4.1).

#### Stage 2. Eye / Iris Tracking

- 478 MediaPipe landmarks (`refineLandmarks: true`).
- Iris center: điểm 468 (OD) và 473 (OS).
- Iris boundary: 469–472 (OD) và 474–477 (OS) để đo diameter.
- Eye corners: inner 133/362, outer 33/263. Lids: top 159/386, bottom 145/374.

#### Stage 3. Timestamp / FPS Engine

- $\tau_k = \text{metadata.presentationTime}$ nếu dùng rVFC; `performance.now()` nếu fallback.
- **Semantics:** browser-decoded frame timestamp, nhất quán hơn `performance.now()` trong rAF vì không drift theo JS Event Loop. Không phải hardware sensor timestamp.
- $\Delta t_k = \tau_k - \tau_{k-1}$. Nếu $\Delta t_k \le 0$ hoặc $> 200\text{ ms}$: đánh dấu frame invalid.
- FPS thực tế: cửa sổ trượt 30 samples.

#### Stage 4. Quality Check

- Distance: $28 \le D_{cm} \le 65$ (ước lượng qua IPD).
- Face centering: nose tip (LM 1) trong $[0.32, 0.68]$ cả hai trục.
- Landmark validity: $0.25 \le W_{eye}/IOD \le 0.55$.
- FPS gate: nếu FPS < 24 trong giây đầu, cảnh báo ánh sáng.

#### Stage 5. Blink / Occlusion Filter

- EAR: $\frac{\|\vec{P}_{top1} - \vec{P}_{bot1}\| + \|\vec{P}_{top2} - \vec{P}_{bot2}\|}{2 \cdot \|\vec{P}_{outer} - \vec{P}_{inner}\|}$
- $EAR < 0.18$: kích hoạt `isBlinking`.
- Blink masking: $[t_{blink\_start} - 60\text{ ms}, t_{blink\_end} + 120\text{ ms}]$ — **tham số cần benchmark**.
- Trong pha COVER: chỉ mask blink cho mắt mở. Mắt bị che đã loại khỏi phân tích.

#### Stage 6. Head Pose & 2D Compensation

- Translation compensation: $\vec{X}_{comp}(t) = \vec{X}_{raw}(t) - (\vec{M}(t) - \vec{M}_{baseline})$
- Canthal roll compensation: ma trận xoay 2D ngược chiều.
- **Known limitation:** chỉ hiệu quả trong ±15° Quality Gate. Z-depth và full out-of-plane: V3 research item.

#### Stage 7. Dual Smoothing

- **Real-time:** One Euro Filter (minCutoff=1.2 Hz, β=0.008) — giữ nguyên.
- **Post-processing (Uncover buffer):** SG (p=2, n=5, mirror-padding). Fallback raw data nếu < 5 valid samples.

#### Stage 8. Robust Baseline

- Collect valid frames trong 3s Baseline phase.
- Tính Median_X, Median_Y và IQR_X, IQR_Y.
- **Tính $\sigma_x, \sigma_y$ cho Engbert-Kliegl** từ velocity sequence của Baseline. Lưu lại cho tất cả Uncover windows.
- Acceptance: valid samples ≥ 45; $IQR_X \le 0.03$. Nếu < 60 valid samples: cảnh báo σ estimation quality.

#### Stage 9. Cover / Uncover Protocol

- 3 chu kỳ: (1) che mắt trái → đánh giá OD; (2) che mắt phải → đánh giá OS; (3) Alternate Cover Test.
- Uncover sub-windows: Latency (0–150ms), Saccade (150–400ms), Settling (400–800ms).

#### Stage 10. Eye Movement Kinematics

- Signed displacement: $\Delta X > 0$ = Exo/abduction; $\Delta X < 0$ = Eso/adduction; $\Delta Y > 0$ = Hyper; $\Delta Y < 0$ = Hypo.
- DVA conversion dựa trên $D_{cm}$.
- Engbert-Kliegl ellipse với $\sigma_x, \sigma_y$ từ Baseline (không từ Uncover window).
- Extract: $V_{peak}$, $A_{peak}$, $T_{onset}$, post-saccadic drift.

#### Stage 11. Hirschberg / CLR Engine (conditional)

- Pixel ROI brightness analysis để detect glint (không dùng MediaPipe iris landmark làm glint proxy).
- $\vec{\delta}_{px} = \vec{P}_{glint} - \vec{P}_{iris\_center}$.
- Scale: $px\_per\_mm = \text{IrisDiameter}_{px} / HVID_{ref}$ (xem Section 8).
- PD: $\Delta_{PD} = \|\vec{\delta}_{mm}\| \times K_{Hirschberg}$ (xem Section 8).
- Tích lũy ≥ 20 stable frames. Output `INDETERMINATE` nếu không đủ.
- **Không output PD number khi glint không ổn định.**

#### Stage 12. Multi-Modal AI Fusion

- Feature Contract: tuân theo `FEATURE_CONTRACT_V1.md`.
- Fusion:
  $$\text{Final Score} = w_1 \cdot \text{Score}_{Kinematics} + w_2 \cdot \text{Score}_{Hirschberg} + w_3 \cdot \text{Score}_{Morphology\_AI}$$
- **Khi Hirschberg INDETERMINATE:** $w_2 = 0$, renormalize $w_1 + w_3 = 1$.

#### Stage 12A. Fusion Weights — HYPERPARAMETER (chưa validated)

**$w_1, w_2, w_3$ là HYPERPARAMETER chưa được tối ưu hóa thực nghiệm.**

- Không được tuyên bố bộ trọng số nào là "tối ưu" trước khi có labeled dataset và ablation study.
- Giá trị khởi đầu đề xuất *dựa trên lý luận kỹ thuật* (chưa phải thực nghiệm):
  - $w_1 \approx 0.50$ — Kinematics (temporal evidence từ Cover Test)
  - $w_2 \approx 0.20$ — Hirschberg (hạ trọng số do webcam limitations)
  - $w_3 \approx 0.30$ — Morphology AI
- Ablation study và cross-validation bắt buộc trước khi chọn trọng số cuối cùng.

---

## 6. Feature Contract & AI Model

### 6.1. Feature Contract — FEATURE_CONTRACT_V1.md

**File chính tắc định nghĩa mọi feature:** `FEATURE_CONTRACT_V1.md`

**Quy tắc bắt buộc:**
1. Mọi thay đổi feature extraction phải được định nghĩa trước trong `FEATURE_CONTRACT_V1.md`.
2. Phải triển khai **đồng thời** trong Python (`training/extract_features.py`) và JavaScript (`src/services/eyeFeatureService.js`).
3. Phải **retrain model** ngay sau khi sửa công thức — **không sửa một phía.**
4. Chỉ sửa JS-side mà không retrain sẽ làm phân phối feature lệch ngược chiều → inference tệ hơn trước.

### 6.2. Hạn chế của mô hình AI hiện tại

- **Static snapshot only:** MLP (32, 16) không phát hiện được lác ẩn (Phoria) — mắt đã hợp thị khi chụp ảnh tĩnh.
- **Dataset drift:** Ảnh training và webcam stream có điều kiện ánh sáng/góc chụp không đồng nhất.

### 6.3. Đề xuất Kiến trúc Mô hình AI V2

#### Giai đoạn A: Tabular Classifier với Extended Features

- Thống nhất Feature Contract theo `FEATURE_CONTRACT_V1.md`.
- Feature vector mở rộng: 10 đặc trưng morphology tĩnh + 8 kinematics động học:
  1. $\Delta X_{normalized}$ (có dấu: Eso/Exo)
  2. $\Delta Y_{normalized}$ (có dấu: Hyper/Hypo)
  3. $V_{peak}$ (chuẩn hóa DVA nếu khoảng cách đo được)
  4. $A_{peak}$
  5. $T_{onset}$
  6. $HVID_{ratio}$ (tỷ lệ iris diameter)
  7. $\Delta_{Hirschberg}$ (PD nếu hợp lệ; `NaN` nếu INDETERMINATE)
  8. $Stability_{post}$
- Mô hình: MLP sâu hơn (64, 32, 16) hoặc LightGBM/XGBoost → ONNX < 100 KB.

#### Giai đoạn B: 1D Temporal CNN (Long-term Research)

- **Kiến trúc:** TCN (Temporal Convolutional Network) hoặc 1D CNN + GlobalAveragePooling cho **classification**.
  - **Lưu ý:** `uneye` (berenslab) là 1D U-Net cho *segmentation* (gắn nhãn từng time step). RemiCare cần *sequence classification* — **không dùng U-Net architecture.**
- **Input:** $[1, 4, T]$ — 4 channels ($X, Y, \dot{X}, \dot{Y}$); $T \approx 30$ frames ở 30 FPS.
- **Output:** Xác suất phân loại Orthophoria / Phoria / Tropia.
- **Deployment:** ONNX nén, `onnxruntime-web` WebAssembly.
- **Inference latency:** Cần benchmark thực tế trên mobile Chrome/Safari trước khi commit target. **Không claim `< 5ms` chưa có benchmark.**
- **Đây là long-term research direction** — không blocking V2 delivery.

---

## 7. Clinical Validation Protocol

> **Ghi chú:** Section này mô tả yêu cầu validation trước khi triển khai lâm sàng. Chưa có dữ liệu thực nghiệm nào được thu thập tại thời điểm viết tài liệu này.

### 7.1. Ethics & Regulatory Requirements

- **IRB/Ethics Board Approval:** Bắt buộc trước khi thu thập dữ liệu người dùng.
- **Informed Consent:** Tất cả người tham gia phải ký consent form mô tả mục đích, rủi ro và quyền rút khỏi.
- **Data Privacy:** Tuân thủ quy định bảo vệ dữ liệu y tế áp dụng (HIPAA, GDPR, hoặc địa phương).
- **Regulatory Classification:** Xác định xem RemiCare cần đăng ký là medical device. Hiện tại được frame là "educational screening aid", không phải diagnostic medical device.

### 7.2. Ground Truth Protocol

- **Reference standard:** Prism Cover Test (PCT) do bác sĩ nhãn khoa có chứng chỉ thực hiện, **độc lập** với kết quả RemiCare.
- **Blinding:** Bác sĩ không biết kết quả RemiCare và ngược lại.
- **PCT measurement:** Prism bar hoặc Risley prism. Ghi nhận PD cho primary gaze + cardinal directions.

### 7.3. Inclusion / Exclusion Criteria

**Inclusion:**
- Tuổi: ưu tiên 3–18 tuổi; người lớn để mở rộng dataset.
- Có thể nhìn cố định FixationTarget 3 giây và ngồi yên toàn bộ phiên đo.

**Exclusion:** Nystagmus (cần protocol riêng); lác liệt giai đoạn cấp; không có khả năng hợp tác.

**Sub-groups phân tích riêng:**
- Có kính / không kính
- Strabismus type: Esotropia, Exotropia, Hypertropia, Hypotropia, Phoria
- Severity: < 8 PD, 8–30 PD, > 30 PD
- Age: < 6, 6–12, 12–18, > 18 tuổi

### 7.4. Dataset Split & Cross-validation

- **Subject-level split** (toàn bộ phiên đo của một người chỉ thuộc một split).
- **Cross-validation:** Leave-One-Site-Out hoặc k-fold ≥ 5, stratified theo strabismus type và severity.
- **External validation:** Validate trên cohort độc lập từ cơ sở khác sau khi training.
- **Sample size:** Cần power analysis dựa trên sensitivity/specificity target trước khi thu thập.

### 7.5. Performance Metrics

Báo cáo đầy đủ: Sensitivity, Specificity, PPV, NPV, AUC-ROC, Bland-Altman plot (cho PD comparison), Limits of Agreement với PCT reference.

### 7.6. Calibration & Bias Assessment

- Kiểm tra bias theo tuổi, giới tính, ethnicity (iris color ảnh hưởng Hirschberg).
- Calibration curve cho xác suất output.
- Subgroup performance analysis bắt buộc trước khi deploy rộng rãi.

---

## 8. HVID, Hirschberg Constant & Physical Calibration

> **Nguyên tắc:** Các giá trị sau là population mean / thực nghiệm reference values — không phải hằng số sinh học tuyệt đối. Phải được xử lý như tham số cấu hình có thể điều chỉnh, không hard-code vô điều kiện.

### 8.1. HVID (Horizontal Visible Iris Diameter)

| Thuộc tính | Giá trị |
|:---|:---|
| Reference value | 11.7 mm (population mean người lớn) |
| Phân tán | SD ≈ 0.5 mm (Hashemi et al. 2010, n ≈ 2,000) |
| Phạm vi sinh lý | 10.5 – 13.0 mm (người lớn bình thường) |
| Trẻ em 3–5 tuổi | ≈ 10.0–11.0 mm → sai số ~6–15% nếu dùng 11.7 mm |

- **Không hard-code 11.7 mm như hằng số tuyệt đối.** Dùng làm default reference, cho phép calibration override.
- Nếu đo được `IrisDiameter_px` từ MediaPipe boundary landmarks, dùng giá trị đó thay vì assume fixed size.
- Nếu `IrisDiameter_px` IQR > 10% mean: cảnh báo chất lượng đo lường.

### 8.2. Hirschberg Constant

| Thuộc tính | Giá trị |
|:---|:---|
| Reference value | 18 PD/mm (phổ biến nhất trong y văn) |
| Phạm vi thực nghiệm | 14–22 PD/mm tùy phương pháp (Choi & Tychsen 2019; Hasebe et al. 2005) |

- **Không hard-code 18 PD/mm như hằng số tuyệt đối.** Dùng làm default configurable value.
- Trẻ em: đặc biệt thận trọng, thiếu tài liệu về Hirschberg constant qua webcam cho trẻ < 6 tuổi.
- **Không claim** PD accuracy nào nếu chưa benchmark với ground truth lâm sàng.

### 8.3. Pixel-to-mm Calibration

```
px_per_mm = IrisDiameter_px / HVID_ref_mm
```

- Dùng median `IrisDiameter_px` trên nhiều frame để ổn định.
- Đây là **per-session approximation**, không phải individual calibration.

---

## 9. Priority Roadmap

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 1: ỔN ĐỊNH CAMERA, TIMESTAMP & FEATURE CONSISTENCY (PRIORITY 1)         │
│ 1. rVFC progressive enhancement (primary) + rAF fallback (bắt buộc)          │
│ 2. presentationTime — browser-decoded frame timestamp (không phải hardware)  │
│ 3. FEATURE_CONTRACT_V1.md — đồng bộ Python ↔ JS; retrain model sau khi sửa  │
│ 4. Blink Blanking Window [-60ms, +120ms] + edge case cover eye               │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 2: BÙ TRỪ ĐẦU, ĐỘNG HỌC & ĐO ĐẠC (PRIORITY 2)                         │
│ 5. 2D Head Motion Compensation (canthal norm, ±15° scope, Z-depth = V3)      │
│ 6. Savitzky-Golay (p=2, n=5, mirror-padding, fallback < 5 samples)           │
│ 7. Engbert-Kliegl σ từ Baseline (~90 frames, không từ Uncover ~15 frames)    │
│ 8. Signed kinematics (Eso/Exo/Hyper/Hypo) + acceleration                    │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 3: HIRSCHBERG (SCREENING-GRADE) & CLINICAL METRICS (PRIORITY 3)         │
│ 9. Glint detection từ pixel ROI (không dùng MediaPipe iris LM làm proxy)     │
│ 10. HVID configurable (default 11.7mm) + K_H configurable (default 18PD/mm) │
│ 11. Stability filter ≥ 20 frames; INDETERMINATE nếu glint không ổn định      │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ TẦNG 4: AI UPGRADE & CLINICAL VALIDATION (PRIORITY 4)                        │
│ 12. Retrain MLP/LightGBM với extended feature vector (sau P1-P3 xong)        │
│ 13. Ablation study cho fusion weights w1/w2/w3 — HYPERPARAMETER              │
│ 14. Clinical validation: IRB, PCT ground truth, sample size planning         │
│ 15. 1D Temporal CNN (TCN/CNN+GAP, không phải U-Net) — long-term research     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Risks & Limitations

### 10.1. Rủi ro kỹ thuật

1. **Webcam quality:** Auto-exposure trong thiếu sáng → FPS tụt 15–20 + motion blur. **Biện pháp:** FPS gate cảnh báo nếu < 24.
2. **Kính mắt:** Phản xạ tròng kính gây glint giả → ảnh hưởng Hirschberg. **Biện pháp:** Yêu cầu tháo kính cho Hirschberg.
3. **Góc Kappa sinh lý:** 5–10 PD lệch mũi bình thường → không kết luận lác từ glint đơn lẻ; kết hợp Cover Test.
4. **Hirschberg webcam limitations:** IR illuminator thiếu, pixel resolution thấp, glint không ổn định → output INDETERMINATE khi không đủ điều kiện. Không claim PD accuracy.

### 10.2. Cảnh báo an toàn y khoa

RemiCare là **công cụ sàng lọc kỹ thuật số mang tính chất giáo dục (Educational & Screening Aid)**, **không phải** thiết bị chẩn đoán y tế và **không thay thế** khám chuyên khoa nhãn khoa. Mọi quyết định can thiệp y khoa bắt buộc dựa trên thăm khám lâm sàng trực tiếp với Prism Cover Test.

---

## 11. References

1. **Nahass et al.** (2025). High-precision periorbital landmark and structure segmentation. *Ophthalmology Science*.
2. **Bellet, M. E., Chen, C. Y., & Berens, P.** (2019). Human-level saccade and microsaccade detection with deep neural networks. *Journal of Neurophysiology*, 121(6), 2160-2179.
3. **Engbert, R., & Kliegl, R.** (2003). Microsaccades uncover the orientation of covert attention. *Vision Research*, 43(9), 1035-1045.
4. **Casiez, G., Roussel, N., & Vogel, D.** (2012). 1€ filter: a simple speed-based low-pass filter. *CHI 2012*, 2527-2530.
5. **Savitzky, A., & Golay, M. J.** (1964). Smoothing and differentiation of data by simplified least squares procedures. *Analytical Chemistry*, 36(8), 1627-1639.
6. **Choi, R. Y., & Tychsen, L.** (2019). Photographic Hirschberg measurement: Calibration and clinical accuracy. *Journal of AAPOS*, 23(3), 145-e1.
7. **Hashemi, H. et al.** (2010). Iris diameter in a population-based study. [Reference for HVID population statistics.]
8. **Patil, A.** (2025). VisionScreen. GitHub: `aaryanpatil2007/vision-screen` [**No license — algorithm reference only, no code reuse**].
9. **OptiHealth Innovators** (2024). StrabismusCare. GitHub: `OptiHealth-Innovators/StrabismusCare` [MIT License].
10. **Vasilev, M. R.** (2026). eyemovements. GitHub: `martin-vasilev/eyemovements` [MIT License].
11. **Antoine Lamé & Haakeye** (2024). Gaze Tracking (MediaPipe AI Edition). GitHub: `Haakeye/Gaze-Tracking` [MIT License].

---

## Bảng Tổng hợp Kế hoạch Nâng cấp (Master Priority Table)

| Priority | Improvement | Why | Difficulty | Notes |
| :---: | :--- | :--- | :---: | :--- |
| **P1** | **rVFC progressive enhancement + rAF fallback** | Tránh duplicate frames > 30Hz; fallback bắt buộc cho Safari iOS | Medium | W3C HTML Video API |
| **P1** | **`presentationTime` — browser-decoded timestamp** | ΔT nhất quán hơn; bắt buộc hiểu đúng semantics: không phải hardware sensor timestamp | Easy | W3C rVFC API |
| **P1** | **Blink Blanking Window** `[-60ms, +120ms]` + cover eye edge case | Loại bỏ false velocity spikes; params cần benchmark | Easy | Ophthalmology literature |
| **P1** | **FEATURE_CONTRACT_V1.md** + đồng bộ Python ↔ JS đồng thời + retrain | Loại bỏ feature distribution drift; phải retrain sau khi sửa | Easy | Internal audit |
| **P2** | **2D Head Motion Compensation** (canthal norm, ±15° scope) | Khử iris drift trong phạm vi QG; Z-depth = V3 item | Medium | 3D Vision principles |
| **P2** | **Savitzky-Golay** (p=2, n=5, mirror-padding, fallback < 5 samples) | Smooth trajectory, bảo toàn V_peak | Medium | eyemovements (MIT) |
| **P2** | **Engbert-Kliegl σ từ Baseline** (không từ Uncover ~15 samples) | Adaptive saccade threshold; min sample size constraint | Medium | Engbert & Kliegl 2003 |
| **P2** | **Signed kinematics** (Eso/Exo/Hyper/Hypo + acceleration) | Phân loại hướng lác; kinematics đầy đủ | Easy | Clinical ophthalmology |
| **P3** | **Hirschberg glint detect từ pixel ROI** (không MediaPipe LM) | Screening-grade; INDETERMINATE nếu < 20 stable frames | Hard | vision-screen (ref only) |
| **P3** | **HVID configurable** (default 11.7mm) + **K_H configurable** (default 18PD/mm) | Population means, not constants; trẻ em cần thận trọng | Medium | Choi & Tychsen 2019 |
| **P4** | **Retrain MLP/LightGBM** extended feature vector | Sau P1–P3 và Feature Contract fix | Medium | Internal |
| **P4** | **Ablation study** fusion weights $w_1/w_2/w_3$ | HYPERPARAMETER — chỉ optimize sau labeled dataset | Medium | Internal |
| **P4** | **Clinical validation** (IRB, PCT ground truth, sample size, metrics) | Bắt buộc trước deployment lâm sàng | Hard | Section 7 |
| **P4** | **1D Temporal CNN** (TCN/CNN+GAP, không phải U-Net) | Long-term research; latency cần benchmark thực tế | Hard | uneye concept (not code) |
