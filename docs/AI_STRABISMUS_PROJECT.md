# REMICARE AI — REAL-TIME STRABISMUS SCREENING
## Tài liệu Kỹ thuật Tổng quan Dự án (Comprehensive Master Document)

---

## 1. Giới thiệu Dự án (Introduction)
**RemiCare AI — Real-time Strabismus Screening** là hệ thống hỗ trợ sàng lọc độ lác mắt (strabismus / phoria / tropia) theo thời gian thực hoạt động hoàn toàn trên trình duyệt người dùng (100% Client-side AI & Computer Vision).

Hệ thống kết hợp hai phương pháp lâm sàng chính:
1. **Đo tĩnh tương quan trục thị giác (Static Eye Alignment Ratio):** Đánh giá độ lệch tâm mống mắt khi nhìn cố định vào điểm chuẩn phía trước.
2. **Nghiệm pháp Che mắt Luân phiên Đa phương thức (Multi-Modal Alternate Cover Test):** Mô phỏng quy trình kiểm tra lâm sàng chuẩn trong nhãn khoa, kết hợp theo dõi chuyển động giật tái định vị (Refixation Saccade) của Computer Vision với suy luận xác suất hình thái học từ mô hình AI nơ-ron cục bộ (ONNX Runtime Web).

---

## 2. Triết lý Thiết kế Cốt lõi (Core Principles)
- **Bảo mật tuyệt đối (Privacy-First):** 100% khung hình video và dữ liệu sinh trắc học được xử lý cục bộ trên thiết bị qua WebAssembly. Không có bất kỳ hình ảnh, video hay dữ liệu cá nhân nào được gửi lên máy chủ.
- **Không phụ thuộc Backend AI:** Toàn bộ quá trình theo dõi điểm mốc (MediaPipe Face Mesh) và suy luận mô hình (ONNX Runtime Web) chạy trực tiếp trong trình duyệt người dùng.
- **Công cụ Giáo dục Sàng lọc (Educational Screening Tool):** Không thay thế thiết bị y tế hay chẩn đoán chuyên khoa của bác sĩ nhãn khoa. Kết quả sàng lọc chỉ đóng vai trò gợi ý và nâng cao nhận thức sức khỏe thị giác.
- **Hiệu năng & Trải nghiệm Người dùng:** Giao diện tối ưu hóa cho màn hình máy tính và thiết bị di động, vận hành ổn định ở tốc độ 30 FPS với đồ thị trực quan và hướng dẫn bằng giọng nói tiếng Việt.

---

## 3. Lộ trình Triển khai Toàn diện (3-Phase Overview)

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: NỀN TẢNG (FOUNDATION)                     [COMPLETE]│
│ - Khởi tạo kiến trúc React 19 + Vite 8                      │
│ - WebRTC camera streaming & cơ chế dọn dẹp track an toàn    │
│ - MediaPipe Face Mesh (refineLandmarks: true, iris 468/473) │
│ - Máy trạng thái Cover Test (3 chu kỳ) & Đồ thị Quỹ đạo     │
│ - Bảo toàn chế độ Đo tĩnh & Cảnh báo y khoa                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: DỮ LIỆU & HUẤN LUYỆN MODEL                [COMPLETE]│
│ - Bộ công cụ tiền xử lý, kiểm định & hash SHA-256           │
│ - Phân tách độc lập theo bệnh nhân (Patient-Level 70/15/15) │
│ - Trích xuất 10 đặc trưng hình học chuẩn hóa                │
│ - Huấn luyện mạng nơ-ron Small MLP (32, 16) Reproducible    │
│ - Đánh giá đa chiều (Sensitivity, Specificity, ROC-AUC)     │
│ - Đóng gói mô hình ONNX siêu nhẹ (5.1 KB)                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: TÍCH HỢP REAL-TIME & FUSION               [COMPLETE]│
│ - Dịch vụ ONNX Runtime Web client-side (aiInferenceService) │
│ - Custom hook useStrabismusAI (Throttling 10 FPS, Smoothing)│
│ - Thuật toán Dung hợp Đa phương thức (Multi-Modal Fusion)   │
│ - Telemetry trạng thái thời gian thực (AIStatus: Face/Eye/AI)│
│ - Giao diện báo cáo kết quả lâm sàng & Lọc chu kỳ đồ thị    │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Kiến trúc Hệ thống Tổng thể (System Architecture)

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

## 5. Đặc tả Điểm mốc Sinh trắc học (Landmark Specifications)

MediaPipe Face Mesh cung cấp 478 tọa độ không gian 3 chiều khi bật `refineLandmarks: true`:

| Bộ phận | Chỉ số Landmark | Vai trò sinh học |
| :--- | :--- | :--- |
| **Mắt trái (Trái bệnh nhân)** | | |
| Tâm mống mắt (Left Iris Center) | `468` | Xác định tọa độ hướng nhìn mống mắt trái |
| Khóe mắt trong (Nasal Corner) | `362` | Điểm chuẩn cố định phía mũi mắt trái |
| Khóe mắt ngoài (Temporal Corner) | `263` | Điểm chuẩn biên thái dương mắt trái |
| Mi trên (Top Eyelid) | `386` | Điểm cực trên khe mi trái |
| Mi dưới (Bottom Eyelid) | `374` | Điểm cực dưới khe mi trái |
| **Mắt phải (Phải bệnh nhân)** | | |
| Tâm mống mắt (Right Iris Center) | `473` | Xác định tọa độ hướng nhìn mống mắt phải |
| Khóe mắt trong (Nasal Corner) | `133` | Điểm chuẩn cố định phía mũi mắt phải |
| Khóe mắt ngoài (Temporal Corner) | `33` | Điểm chuẩn biên thái dương mắt phải |
| Mi trên (Top Eyelid) | `159` | Điểm cực trên khe mi phải |
| Mi dưới (Bottom Eyelid) | `145` | Điểm cực dưới khe mi phải |

---

## 6. Hợp đồng Đặc trưng & Công thức Toán học (Feature Contract)

Hệ thống tính toán và chuyển giao vector 10 chiều chuẩn hóa theo đúng thứ tự:

1. **Tỉ lệ mống mắt ngang trái ($Ratio_{H,L}$):**
   $$Ratio_{H,L} = \frac{X_{468} - X_{362}}{X_{263} - X_{362}}$$
2. **Tỉ lệ mống mắt ngang phải ($Ratio_{H,R}$):**
   $$Ratio_{H,R} = \frac{X_{473} - X_{133}}{X_{33} - X_{133}}$$
3. **Tỉ lệ độ mở khe mi dọc trái ($Ratio_{V,L}$):**
   $$Ratio_{V,L} = \frac{Y_{468} - Y_{386}}{Y_{374} - Y_{386}}$$
4. **Tỉ lệ độ mở khe mi dọc phải ($Ratio_{V,R}$):**
   $$Ratio_{V,R} = \frac{Y_{473} - Y_{159}}{Y_{145} - Y_{159}}$$
5. **Khoảng cách gian khóe mắt trong ($IOD$):**
   $$IOD = \sqrt{(X_{362} - X_{133})^2 + (Y_{362} - Y_{133})^2}$$
6. **Chênh lệch ngang đối xứng ($Diff_H$):**
   $$Diff_H = |Ratio_{H,L} - Ratio_{H,R}|$$
7. **Chênh lệch dọc đối xứng ($Diff_V$):**
   $$Diff_V = |Ratio_{V,L} - Ratio_{V,R}|$$
8. **Độ rộng mắt trái ($W_L$):**
   $$W_L = \sqrt{(X_{263} - X_{362})^2 + (Y_{263} - Y_{362})^2}$$
9. **Độ rộng mắt phải ($W_R$):**
   $$W_R = \sqrt{(X_{33} - X_{133})^2 + (Y_{33} - Y_{133})^2}$$
10. **Tỉ lệ khoảng cách mống mắt ($IDR$):**
    $$IDR = \frac{\sqrt{(X_{468} - X_{473})^2 + (Y_{468} - Y_{473})^2}}{IOD}$$

---

## 7. Động lực học Tái định vị & Thuật toán Dung hợp (Fusion Algorithm)

### 7.1. Chuyển động Tái định vị (Refixation Saccade - CV Signal)
Trong cửa sổ phân tích $W = 500\text{ms}$ sau khi bỏ che mắt:
- **Độ dịch chuyển chuẩn hóa (Normalized Displacement):**
  $$D = \frac{\sqrt{(X_{end} - X_{start})^2 + (Y_{end} - Y_{start})^2}}{EyeWidth}$$
- **Vận tốc tức thời đỉnh (Peak Saccadic Velocity):**
  $$V_{peak} = \max_{i} \left( \frac{\sqrt{(X_i - X_{i-1})^2 + (Y_i - Y_{i-1})^2}}{EyeWidth \cdot \Delta t} \right)$$
- Ngưỡng kích hoạt lâm sàng: $D > 0.10$ (tương đương độ dịch chuyển $> 10\%$ độ rộng mắt).

### 7.2. Điểm sàng lọc Đa phương thức (Multi-Modal Composite Score)
$$Score_{composite} = w_{CV} \cdot Score_{motion} + w_{AI} \cdot Score_{AI}$$
Trong đó:
- $w_{CV} = 0.60$ (Trọng số dấu hiệu động học nghiệm pháp Cover Test)
- $w_{AI} = 0.40$ (Trọng số dấu hiệu hình thái học mô hình AI)
- $Score_{motion} = \min\left(1.0, \frac{D}{1.8 \times D_{threshold}}\right)$
- $Score_{AI}$ là xác suất lệch trục từ mô hình Small MLP sau khi làm mượt qua 8 mẫu.

---

## 8. Cấu trúc Mã nguồn Dự án (Project Directory Structure)

```
d:/AI_Check_Lac/
├── public/
│   ├── models/
│   │   ├── strabismus_model.onnx    # Mô hình ONNX client-side (5.1 KB)
│   │   └── model_metadata.json      # Bản đặc tả hợp đồng đặc trưng
│   ├── favicon.svg
│   └── icons.svg
│
├── src/
│   ├── components/
│   │   ├── AIStatus.jsx             # Telemetry trạng thái Face/Eye/AI thời gian thực
│   │   ├── CameraView.jsx           # Khung hình webcam, mirror và indicators
│   │   ├── Countdown.jsx            # Đồng hồ đếm ngược số to rõ ràng
│   │   ├── EyeOverlay.jsx           # Canvas overlay vẽ tâm mống mắt và khóe mắt
│   │   ├── FixationTarget.jsx       # Điểm đỏ nhấp nháy định chuẩn thị giác
│   │   ├── MedicalDisclaimer.jsx    # Banner cảnh báo an toàn y khoa bắt buộc
│   │   ├── TestInstruction.jsx      # Hướng dẫn thao tác theo từng bước
│   │   └── TestProgress.jsx         # Tiến trình chu kỳ và pha kiểm tra
│   │
│   ├── pages/
│   │   ├── StaticEyeTest.jsx        # Chế độ Đo tĩnh tương quan mống mắt
│   │   └── StrabismusScreening.jsx  # Nghiệm pháp Cover Test + AI hoàn chỉnh
│   │
│   ├── hooks/
│   │   ├── useCamera.js             # Quản lý stream getUserMedia và cleanup track
│   │   ├── useFaceMesh.js           # Vòng lặp xử lý khung hình MediaPipe
│   │   ├── useEyeTracking.js        # Kiểm định chất lượng & trích xuất đặc trưng
│   │   ├── useSpeech.js             # Hướng dẫn giọng nói tiếng Việt Web Speech
│   │   └── useStrabismusAI.js       # Quản lý suy luận ONNX, 10 FPS, smoothing
│   │
│   ├── services/
│   │   ├── aiInferenceService.js    # Nạp ONNX Runtime Web, suy luận Tensor [1, 10]
│   │   ├── cameraService.js         # Giao tiếp WebRTC mediaDevices
│   │   ├── eyeFeatureService.js     # Trích xuất 10 đặc trưng & vận tốc giật bù trừ
│   │   ├── faceMeshService.js       # Khởi tạo Face Mesh (refineLandmarks: true)
│   │   └── fusionService.js         # Thuật toán dung hợp CV + AI và đa chu kỳ
│   │
│   ├── constants/
│   │   └── screeningConfig.js       # Hằng số thời gian, ngưỡng lâm sàng, landmarks
│   │
│   ├── App.jsx                      # Navigation header, Dark/Light theme, Footer
│   ├── index.css                    # Design Tokens, Glassmorphism, Responsive Grid
│   └── main.jsx                     # React DOM entry point
│
├── training/                        # Bộ công cụ huấn luyện & kiểm định Python
│   ├── validate_dataset.py          # Kiểm định ảnh hỏng, trùng lặp, mất cân bằng
│   ├── prepare_dataset.py           # Quét dataset, bóc tách Patient ID
│   ├── split_dataset.py             # Phân chia 70/15/15 độc lập theo bệnh nhân
│   ├── extract_features.py          # Trích xuất đặc trưng mắt qua MediaPipe
│   ├── train.py                     # Huấn luyện Small MLP (seed 42)
│   ├── evaluate.py                  # Đo đạc chỉ số lâm sàng, xuất biểu đồ ROC/CM
│   ├── export_onnx.py               # Xuất ONNX và kiểm tra suy luận
│   └── run_pipeline.py              # Điều phối chạy toàn bộ pipeline bằng 1 lệnh
│
├── models/                          # Trọng số mô hình và nhật ký huấn luyện
│   ├── strabismus_model.onnx
│   ├── model_metadata.json
│   ├── trained_model.joblib
│   ├── scaler.joblib
│   └── training_summary.json
│
├── reports/                         # Báo cáo đánh giá lâm sàng
│   ├── metrics.json
│   ├── confusion_matrix.png
│   ├── roc_curve.png
│   └── dataset_validation.json
│
├── docs/
│   ├── AI_STRABISMUS_PROJECT.md     # Tài liệu tổng quan dự án (Tài liệu này)
│   └── phases/
│       ├── PHASE_1_HANDOFF.md       # Bàn giao Phase 1
│       ├── PHASE_2_HANDOFF.md       # Bàn giao Phase 2
│       └── PHASE_3_HANDOFF.md       # Bàn giao Phase 3
│
├── index.html                       # HTML shell, preconnect fonts, MediaPipe CDN
├── package.json                     # Vite, React 19, onnxruntime-web
└── vite.config.js                   # Cấu hình Vite build tool
```

---

## 9. Hướng dẫn Khởi chạy và Sử dụng (Getting Started)

### 9.1. Khởi động Ứng dụng Web
1. Cài đặt các gói phụ thuộc (nếu chưa cài):
   ```bash
   npm install
   ```
2. Khởi chạy máy chủ phát triển (Dev Server):
   ```bash
   npm run dev
   ```
3. Truy cập trên trình duyệt: `http://localhost:5173/`

### 9.2. Huấn luyện Lại Mô hình AI (Khi có Dataset mới)
1. Đặt hình ảnh vào thư mục `dataset/normal/` và `dataset/strabismus/`.
2. Chạy toàn bộ pipeline tự động:
   ```bash
   python training/run_pipeline.py
   ```
3. Sao chép mô hình mới vào thư mục public của React:
   ```powershell
   Copy-Item models/strabismus_model.onnx public/models/
   Copy-Item models/model_metadata.json public/models/
   ```

---

## 10. Tuyên bố Tuân thủ An toàn Y tế (Medical Safety & Compliance)

> **THÔNG ĐIỆP BẮT BUỘC:**  
> **"Đây là công cụ sàng lọc mang tính giáo dục, không phải chẩn đoán y khoa. Kết quả có/không phát hiện chuyển động tái định vị không đồng nghĩa với có/không bị lác. Kết quả sàng lọc không thay thế khám chuyên khoa mắt."**

Ứng dụng tuân thủ nghiêm ngặt các nguyên tắc sau:
- Không đưa ra kết luận chẩn đoán xác định bệnh lý (không tuyên bố "Bạn bị lác" hay "Bạn không bị lác").
- Chỉ đưa ra các nhận định khách quan về tín hiệu quan sát:
  - *"Có ghi nhận tín hiệu chuyển động đáng chú ý."*
  - *"Không ghi nhận tín hiệu chuyển động đáng chú ý trong lần sàng lọc này."*
- Khuyến nghị bệnh nhân thăm khám trực tiếp với bác sĩ chuyên khoa Mắt để được đo độ lác chính xác bằng lăng kính và các thiết bị chuyên dụng.
