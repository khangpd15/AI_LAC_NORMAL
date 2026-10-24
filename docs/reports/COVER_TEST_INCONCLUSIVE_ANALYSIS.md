# BÁO CÁO RÀ SOÁT VÀ NGUYÊN NHÂN KẾT QUẢ AI COVER TEST: INCONCLUSIVE (4/6 CẶP ẢNH)

> **Mã phiên kiểm tra (Session ID):** `586711e5-f73a-4afb-86c6-e60a06cd4c1f`  
> **Thời gian rà soát:** 24/10/2026  
> **Phạm vi kiểm tra:** Giao thức Nghiệm pháp Che mắt (Cover Test) - Hệ thống RemiCare AI  
> **Trạng thái kết quả:** `INCONCLUSIVE` (Chưa thể kết luận)  

---

## 1. Tóm tắt Hiện tượng quan sát trên Giao diện

Trong phiên kiểm tra vừa qua, hệ thống hiển thị thông báo với các chi tiết sau:

```text
⚠️ Lưu ý nghiên cứu: Kết quả này là đầu ra thử nghiệm của mô hình nghiên cứu, không phải chẩn đoán y khoa.
Kết quả AI Cover Test
Model Prediction: INCONCLUSIVE
Chưa có model được nạp
Dữ liệu đã được nhận; chưa có kết quả mô hình kết hợp ảnh mắt và chuỗi thời gian.
Xử lý phiên kiểm tra: 586711e5-f73a-4afb-86c6-e60a06cd4c1f
Đã xử lý 557 mẫu. Máy chủ không lưu ảnh hoặc dữ liệu phiên kiểm tra.
Đã chụp 4/6 cặp ảnh hai mắt lúc bỏ che.
Còn thiếu 2 lần chụp. Phân tích lại chỉ gửi lại dữ liệu hiện có; hãy đo lại để bổ sung ảnh, che kín đúng mắt rồi bỏ tay hoàn toàn khi có hiệu lệnh.
```

Hiện tượng này **không phải là lỗi sập phần mềm (crash/bug)**, mà là sự kích hoạt đồng thời của:
1. **Quy tắc an toàn lâm sàng (Fail-Safe Clinical Guardrails):** Hệ thống từ chối đưa ra kết luận nếu thiếu điều kiện mô hình hoặc thiếu dữ liệu đa phương thức (multimodal).
2. **Cơ chế bảo vệ dữ liệu riêng tư không lưu trữ (Stateless Privacy Architecture):** Máy chủ không ghi dữ liệu sinh trắc học vào cơ sở dữ liệu.
3. **Cơ chế phát hiện sự kiện bỏ che bằng thị giác máy tính (Computer Vision Occlusion & Uncover Observer):** 2 trong 6 lần thao tác chưa đáp ứng đủ tiêu chuẩn hình ảnh chuyển tiếp.

---

## 2. Rà soát Chi tiết từng Thành phần

### 2.1. Tại sao Model Prediction là "INCONCLUSIVE" và "Chưa có model được nạp"?

#### 📍 Vị trí mã nguồn liên quan:
- Frontend: [`CoverTestStep.jsx`](file:///d:/AI_Check_Lac/src/components/binocular/CoverTestStep.jsx#L1176-L1225)
- Frontend Persistence Service: [`coverTestPersistenceService.js`](file:///d:/AI_Check_Lac/src/services/coverTest/coverTestPersistenceService.js#L74-L90)
- Backend Multimodal Service: [`multimodal_service.py`](file:///d:/AI_Check_Lac/backend-changes.local/app/services/cover_test/multimodal_service.py#L102-L137)
- Backend Session Service: [`session_service.py`](file:///d:/AI_Check_Lac/backend-changes.local/app/services/cover_test/session_service.py#L411-L434)

#### 🔍 Cơ chế hoạt động:
1. Khi frontend hoàn tất bài đo, nó đóng gói toàn bộ chuỗi chuyển động và các cặp ảnh mắt lúc bỏ che kèm theo `uncover_manifest` theo giao thức `cover-test-multimodal-v2` gửi tới backend qua API `POST /api/v1/cover-test/sessions?run_inference=true`.
2. Khi backend nhận được `uncover_manifest`, luồng phân tích được chỉ định bắt buộc chuyển cho **`MultimodalCoverService`** (mô hình kết hợp chuỗi thời gian động học và ảnh cắt mắt độ nét cao).
3. Kiến trúc RemiCare tuân thủ nguyên tắc y khoa nghiêm ngặt:
   > *"The numeric-only classifier is never presented as an image+trajectory classifier. Only a configured, trusted server-side artifact can produce a combined prediction."*
   > *(Không bao giờ dùng mô hình chỉ đọc chuỗi số để giả mạo là mô hình kết hợp ảnh + động học. Chỉ có artifact mô hình đã được nạp chính thức trên máy chủ mới được phép đưa ra kết luận).*
4. Trong hàm khởi tạo `MultimodalCoverService.__init__()`, máy chủ kiểm tra biến môi trường:
   ```python
   path = artifact_path or os.getenv("COVER_MULTIMODAL_MODEL_PATH")
   ```
   Trên môi trường máy chủ hiện tại (Render / Cloud Backend), biến môi trường này **chưa được cấu hình file model `.joblib`** hoặc file model chưa được nạp lên máy chủ (`self.artifact is None`).
5. Khi không có artifact, hàm `predict()` lập tức trả về kết quả dự phòng an toàn:
   ```python
   return inconclusive("MULTIMODAL_MODEL_NOT_LOADED", ids)
   ```
   Với cấu trúc trả về:
   - `prediction`: `"INCONCLUSIVE"`
   - `reason`: `"MULTIMODAL_MODEL_NOT_LOADED"`
   - `model`: `{"name": "cover-uncover-multimodal", "loaded": False}`
   - `notice`: `"Dữ liệu đã được nhận; chưa có kết quả mô hình kết hợp ảnh mắt và chuỗi thời gian."`
6. Ở phía frontend (`CoverTestStep.jsx` dòng 1180):
   ```javascript
   const cleanVersion = modelResult.model?.version || 'Chưa có model được nạp';
   ```
   Do `model.version` không có, giao diện hiển thị chính xác dòng chữ: **`Chưa có model được nạp`**.

---

### 2.2. Tại sao "Đã xử lý 557 mẫu. Máy chủ không lưu ảnh hoặc dữ liệu phiên kiểm tra"?

#### 📍 Vị trí mã nguồn liên quan:
- Frontend: [`CoverTestStep.jsx`](file:///d:/AI_Check_Lac/src/components/binocular/CoverTestStep.jsx#L1269-L1271)
- Backend: [`fix_stateless_cover.py`](file:///d:/AI_Check_Lac/backend-changes.local/fix_stateless_cover.py#L38-L42)
- Session Controller: [`cover_test.py`](file:///d:/AI_Check_Lac/backend-changes.local/app/api/cover_test.py)

#### 🔍 Cơ chế hoạt động:
1. **557 mẫu dữ liệu (samples):**
   - Nghiệm pháp Cover Test chạy ở tần số ~30 FPS trong các pha đo. 557 mẫu tương đương với ~18-19 giây thu thập dữ liệu tọa độ mống mắt ($x, y$), góc mở bờ mi, đường chuẩn baseline và độ lệch chuyển động hợp lệ qua 3 chu kỳ.
2. **"Máy chủ không lưu ảnh hoặc dữ liệu phiên kiểm tra":**
   - Hệ thống backend áp dụng kiến trúc **Stateless Privacy Mode (Tuân thủ quyền riêng tư tuyệt đối)**.
   - Máy chủ chỉ nhận request multipart, giải mã và xác thực dữ liệu ngay trong bộ nhớ RAM để tính toán hoặc suy luận AI, **không lưu trữ** bất kỳ ảnh khuôn mặt hay chuỗi tọa độ nào vào cơ sở dữ liệu (PostgreSQL/Supabase) hay ổ cứng máy chủ.
   - Backend phản hồi về frontend:
     ```python
     return CoverTestSessionResponse(
         success=True,
         sessionId=session_id_str,
         saved=False, # Không lưu trữ cố định
         processingStatus="COMPLETED",
         storageMode="STATELESS",
         cyclesSaved=0,
         imagesSaved=0,
         message="Analysis completed without retaining user measurements or images.",
     )
     ```
   - Khi frontend nhận được `saved = false`, trạng thái được cập nhật thành `processed`:
     ```jsx
     {sessionSaveState.status === 'processed' && (
       <p role="status">
         Đã xử lý {sessionSaveState.sampleCount} mẫu. Máy chủ không lưu ảnh hoặc dữ liệu phiên kiểm tra.
       </p>
     )}
     ```
   - Đây là thông báo **minh bạch về an toàn dữ liệu**, khẳng định hình ảnh mắt và thông tin của người dùng không bị rò rỉ hoặc lưu lại trên máy chủ đám mây.

---

### 2.3. Tại sao "Đã chụp 4/6 cặp ảnh hai mắt lúc bỏ che" và "Còn thiếu 2 lần chụp"?

#### 📍 Vị trí mã nguồn liên quan:
- Observer & Transition: [`uncoverCaptureService.js`](file:///d:/AI_Check_Lac/src/services/coverTest/uncoverCaptureService.js#L23-L107)
- Bộ phát hiện che mắt: [`eyeCoverDetector.js`](file:///d:/AI_Check_Lac/src/services/cv/eyeCoverDetector.js)
- Chu trình đo: [`CoverTestStep.jsx`](file:///d:/AI_Check_Lac/src/components/binocular/CoverTestStep.jsx#L768-L872)

#### 🔍 Cơ chế đếm 6 cặp ảnh:
Giao thức Cover Test chuẩn hóa gồm **3 chu kỳ** ($C_1, C_2, C_3$). Mỗi chu kỳ có 2 pha che và bỏ che luân phiên:
1. **Lượt 1 (Chu kỳ 1 - Mắt trái):** Che mắt trái -> Bỏ che mắt trái $\rightarrow$ **Cặp ảnh 1** (`c1_left_uncover`)
2. **Lượt 2 (Chu kỳ 1 - Mắt phải):** Che mắt phải -> Bỏ che mắt phải $\rightarrow$ **Cặp ảnh 2** (`c1_right_uncover`)
3. **Lượt 3 (Chu kỳ 2 - Mắt trái):** Che mắt trái -> Bỏ che mắt trái $\rightarrow$ **Cặp ảnh 3** (`c2_left_uncover`)
4. **Lượt 4 (Chu kỳ 2 - Mắt phải):** Che mắt phải -> Bỏ che mắt phải $\rightarrow$ **Cặp ảnh 4** (`c2_right_uncover`)
5. **Lượt 5 (Chu kỳ 3 - Mắt trái):** Che mắt trái -> Bỏ che mắt trái $\rightarrow$ **Cặp ảnh 5** (`c3_left_uncover`)
6. **Lượt 6 (Chu kỳ 3 - Mắt phải):** Che mắt phải -> Bỏ che mắt phải $\rightarrow$ **Cặp ảnh 6** (`c3_right_uncover`)

Tổng cộng cần thu được **đủ 6 cặp ảnh hai mắt** ở khoảnh khắc bỏ che để đưa vào mô hình AI đa phương thức.

#### 🔍 Tại sao chỉ đạt 4/6 cặp ảnh (thiếu 2 lần)?
Trong class [`UncoverTransition`](file:///d:/AI_Check_Lac/src/services/coverTest/uncoverCaptureService.js#L23-L73), điều kiện chụp được lập trình tự động bằng thuật toán thị giác máy tính:

1. **Điều kiện Kích hoạt (Armed Condition):**
   - Mắt được yêu cầu che phải được che kín (`OCCLUDED` - độ tương phản đồng tử `pupilContrast` và dải sáng `dynamicRange` rớt mạnh so với mức nền `baseline`).
   - Mắt đối diện phải mở to, nhìn rõ (`VISIBLE`).
   - Trạng thái này phải kéo dài **tối thiểu 200ms**:
     ```javascript
     if (visibility[this.eye] === 'OCCLUDED' && visibility[opposite] === 'VISIBLE') {
       this.coverStart ??= timestampMs;
       this.lastCovered = timestampMs;
       if (timestampMs - this.coverStart >= 200) this.armed = true;
     }
     ```
2. **Điều kiện Chuyển tiếp Bỏ che (Trigger & Confirmation):**
   - Khi có hiệu lệnh "Bỏ che!", tay hạ xuống, trong vòng **500ms** kể từ khung hình che cuối cùng (`timestampMs - this.lastCovered <= 500`), **cả hai mắt phải lập tức nhìn rõ (`VISIBLE`)**.
   - Khung hình đạt chuẩn đầu tiên sẽ đóng băng ảnh ứng viên (`candidate`). Khung hình kế tiếp đạt chuẩn sẽ xác nhận (`confirmedAtMs`) để crop ảnh 2 mắt.

#### ⚠️ Các nguyên nhân thực tế khiến 2 lần chụp bị trượt (`NOT_CAPTURED`):
1. **Che mắt chưa đủ kín hoặc quá nhanh (< 200ms):** Bàn tay đặt hờ, chỉ che một phần con ngươi, hoặc vừa đưa tay lên che chưa đủ 200ms đã bỏ ra $\rightarrow$ Hệ thống chưa kịp chuyển sang trạng thái "Armed".
2. **Bàn tay che lấn sang mắt đối diện hoặc che sống mũi:** Dùng cả bàn tay to che làm khuất luôn khóe mắt đối diện hoặc làm MediaPipe mất các điểm mốc khuôn mặt (Landmarks) $\rightarrow$ Hệ thống không xác nhận được mắt đối diện `VISIBLE`.
3. **Bỏ tay quá chậm (> 500ms):** Khi nghe hiệu lệnh "Bỏ che!", tay rút ra chần chừ, tay che khuất ống kính trong hơn nửa giây $\rightarrow$ Quá cửa sổ thời gian 500ms cho phép, trigger bị hủy.
4. **Nhắm mắt / chớp mắt / nhìn đi chỗ khác ngay lúc bỏ che:** Khi vừa bỏ tay ra, mắt nhắm lại hoặc liếc sang hướng khác $\rightarrow$ Tỷ lệ bờ mi mở `palpebralHeight / canthalWidth < 0.12` $\rightarrow$ Hệ thống đánh giá là `UNKNOWN` thay vì `VISIBLE`.

Khi một lần thao tác không đạt, hệ thống gán nhãn sự kiện là:
```javascript
{ status: 'NOT_CAPTURED', reason: 'NO_CONFIRMED_VISIBLE_TRANSITION' }
```
Vì vậy phiên đo chỉ ghi nhận **4/6** cặp ảnh.

---

### 2.4. Tại sao "Phân tích lại chỉ gửi lại dữ liệu hiện có; hãy đo lại để bổ sung ảnh..."?

#### 📍 Vị trí mã nguồn liên quan:
- Giao diện & Nút bấm: [`CoverTestStep.jsx`](file:///d:/AI_Check_Lac/src/components/binocular/CoverTestStep.jsx#L1273-L1276)
- Hàm `retrySessionSave`: [`CoverTestStep.jsx`](file:///d:/AI_Check_Lac/src/components/binocular/CoverTestStep.jsx#L305-L309)

#### 🔍 Cơ chế hoạt động:
- Nút **"Phân tích lại"** (hoặc retry) chỉ đơn thuần là gửi lại HTTP request với mảng 4 cặp ảnh và chuỗi 557 mẫu đã lưu trong bộ nhớ tạm (`eyeImagesRef.current` và `accumulatedCyclesRef.current`) lên máy chủ.
- Do camera đã kết thúc phiên đo, phần mềm không thể "tự bịa" thêm 2 cặp ảnh đã mất.
- Do đó, thông báo nhắc nhở người dùng: Nếu muốn bổ sung đủ 6/6 cặp ảnh để mô hình có đầy đủ dữ liệu nhất, người dùng cần bấm **"Thực hiện lại bài kiểm tra"** từ đầu.

---

## 3. Bảng Tổng hợp Nguyên nhân & Giải pháp Khắc phục

| Hiện tượng | Nguyên nhân kỹ thuật | Hướng khắc phục / Hành động |
| :--- | :--- | :--- |
| **Model Prediction: INCONCLUSIVE** | Máy chủ backend chưa có file mô hình đa phương thức (`.joblib`) tại `COVER_MULTIMODAL_MODEL_PATH`. | **Phía Backend:** Cần deploy file artifact mô hình multimodal lên server hoặc cấu hình fallback sang mô hình trajectory consensus. |
| **Chưa có model được nạp** | `model.loaded = False` do thiếu checkpoint trên Render/Server. | Bổ sung checkpoint mô hình vào thư mục model của backend. |
| **Đã chụp 4/6 cặp ảnh** | Có 2 lần che/bỏ che người dùng che chưa kín, che quá ngắn (<200ms) hoặc hạ tay quá chậm (>500ms). | **Phía Người dùng:** Làm lại bài test, khi che hãy che kín hẳn một mắt (mắt kia mở to nhìn chấm đỏ), khi có hiệu lệnh "Bỏ che!" thì rút tay ra dứt khoát. |
| **Máy chủ không lưu ảnh** | Chế độ bảo mật `Stateless Privacy Mode` được kích hoạt để không lưu trữ sinh trắc học người dùng. | **Đúng thiết kế:** Đây là tính năng bảo vệ quyền riêng tư, không cần sửa đổi. |
| **Phân tích lại không thêm ảnh** | Nút phân tích lại chỉ retry gói tin hiện có trong bộ nhớ RAM client. | Bấm nút **"Thực hiện lại bài kiểm tra"** để webcam đo lại 3 chu kỳ mới. |

---

## 4. Hướng dẫn Thao tác Chuẩn cho Người dùng khi Đo lại

Để đạt chuẩn **6/6 cặp ảnh** và dữ liệu chuỗi thời gian chất lượng cao:

1. **Tư thế và Ánh sáng:**
   - Ngồi cách camera khoảng 40 – 50 cm, giữ khuôn mặt ở chính giữa khung hình.
   - Đảm bảo ánh sáng chiếu đều phía trước mặt, không ngồi ngược sáng.
2. **Kỹ thuật Che mắt:**
   - Sử dụng lòng bàn tay khum nhẹ để che kín một mắt theo hiệu lệnh (không ấn tay vào mắt).
   - Tuyệt đối không để mép bàn tay che sang sống mũi hoặc che một phần mắt đối diện. Mắt không bị che luôn mở to và nhìn cố định vào chấm tròn đỏ trên màn hình.
   - Giữ nguyên tư thế che trong suốt thời gian hệ thống đếm ngược (khoảng 2.5 giây).
3. **Kỹ thuật Bỏ che:**
   - Ngay khi nghe hiệu lệnh âm thanh và thấy chữ **"Bỏ che!"**, nhanh chóng rút dứt khoát bàn tay ra khỏi khung hình camera.
   - Giữ hai mắt mở to nhìn thẳng vào chấm tròn đỏ, không chớp mắt hoặc lắc lư đầu trong 1 giây đầu sau khi bỏ che.

---

## 5. Các Cải tiến Đã Triển khai trên Hệ thống

Nhằm khắc phục triệt để các hạn chế trên, hệ thống đã được cập nhật với các cải tiến cụ thể:

### 5.1. Nới lỏng dung sai thời gian bắt ảnh chuyển tiếp (`uncoverCaptureService.js`)
- Cửa sổ thời gian cho phép người dùng bỏ tay (`UNCOVER_WINDOW_MS`) được nâng từ **$500\text{ms}$ lên $700\text{ms}$**.
- Giúp người dùng thao tác hạ tay tự nhiên, không bị trượt chụp do rút tay chậm hơn 0.5s.

### 5.2. Phản hồi thị giác thời gian thực khi che mắt (`CoverTestStep.jsx`)
- Trạng thái `captureFeedback` được cập nhật liên tục (~150ms) hiển thị ngay dưới dòng hướng dẫn.
- Người dùng thấy ngay badge xanh: `✅ Đã nhận diện che mắt. Giữ nguyên...` khi che đúng, hoặc cảnh báo cam `👉 Chưa xác nhận che mắt...` khi tay đặt chưa kín hoặc che mất cả hai mắt.

### 5.3. Âm thanh và thông báo tức thì khi chụp thành công 1 cặp ảnh (`coverTestCues.js` & `CoverTestStep.jsx`)
- Bổ sung cue âm thanh `'capture'` (âm 1046Hz ngắn, trong trẻo như tiếng chụp ảnh) phát ngay khi xác nhận chụp thành công.
- Hiển thị banner tức thì: `📸 Đã chụp ảnh hai mắt lúc bỏ che (Lần X/3)!` giúp người dùng biết ngay lượt đó đã đạt chuẩn.

### 5.4. Tối ưu nút bấm và hướng dẫn tại màn hình kết quả
- Khi `capturedPairs < 6`, hệ thống hiển thị hộp nhắc nhở rõ ràng và đặt nút **`🔄 Đo lại để đủ 6 lần chụp`** làm nút chính (Primary Button), giúp người dùng không bị bối rối giữa nút "Phân tích lại" và nút "Đo lại".

### 5.5. Cơ chế Fallback an toàn sang mô hình Động học (`session_service.py` & `coverTestPersistenceService.js`)
- Khi mô hình đa phương thức chưa được nạp checkpoint (`MULTIMODAL_MODEL_NOT_LOADED`), backend tự động dự phòng chuyển sang mô hình chuỗi thời gian động học 14 đặc trưng (`fps_model_service`) để đánh giá 557 mẫu chuyển động mắt thay vì trả về `INCONCLUSIVE`.
- Frontend cho phép hiển thị kết quả dự phòng này với chú thích rõ ràng.
