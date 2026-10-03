# Báo Cáo Kỹ Thuật Phase 6B: Huấn Luyện Mô Hình Phân Loại Nghiên Cứu Hirschberg (Exploratory Research Candidate)

> **Ngày thực hiện:** 03/10/2026  
> **Trạng thái:** Hoàn thành thử nghiệm nghiên cứu (`COMPLETED_RESEARCH_CANDIDATE`)  
> **Phạm vi áp dụng:** Nghiên cứu khám phá (Exploratory Research Only) — **Tuyệt đối không đưa vào môi trường Production lâm sàng**.  
> **Tệp mô hình lưu trữ:** `D:\REMICARE-STRABISMUS-AI\app\models\research\hirschberg_candidate_v0.1.joblib`  
> **Báo cáo đánh giá chi tiết:** `D:\AI_Check_Lac\manifests\hirschberg_candidate_eval.json`

---

## 1. Mục Tiêu & Cơ Sở Thực Hiện

Sau khi Phase 6A hoàn thành việc nâng cấp các bộ phát hiện đồng tử (`pupil_center`) và ánh phản xạ giác mạc (`corneal_reflex`) cùng cơ chế tiền sàng lọc tại giao diện người dùng, **Phase 6B** được tiến hành theo yêu cầu của người dùng nhằm:
1. Xây dựng pipeline trích xuất đặc trưng hình học kết hợp thị giác máy tính chuyên sâu cho tập dữ liệu ảnh cắt mắt Hirschberg 224x224 (`data_hirschberg/eye-classification`).
2. Huấn luyện và so sánh các kiến trúc mô hình phân loại đa lớp (`esotropia`, `exotropia`, `normal`).
3. Đánh giá khách quan trên tập kiểm thử độc lập (Test Set) không bị rò rỉ dữ liệu (leakage-free group split).
4. Đóng gói mô hình thành tạo tác nghiên cứu độc lập (`research_candidate`), đăng ký vào `MODEL_REGISTRY.md` và giữ nguyên 100% hệ thống suy luận Production hiện hành (`/api/v1/strabismus/predict`).

---

## 2. Thiết Kế Tập Dữ Liệu & Phân Chia Tập (Splits)

Tập dữ liệu được chuẩn hóa và lập chỉ mục trong `manifests/hirschberg_folder_labels.jsonl`:
- **Tổng số ảnh:** 696 ảnh cắt mắt độ phân giải 224x224.
- **Phân bố nhãn:**
  - `esotropia` (Lác trong): 246 mẫu.
  - `exotropia` (Lác ngoài): 270 mẫu.
  - `normal` (Bình thường): 180 mẫu.
- **Chính sách phân chia tập (Split Policy):**
  - Để ngăn chặn rò rỉ dữ liệu (data leakage) do các ảnh có cùng nguồn gốc/tiền tố basename, tập dữ liệu được gom cụm theo `group_id = label:basename_prefix` với 504 cụm duy nhất.
  - Tỷ lệ phân chia:
    - **Tập Train (Huấn luyện):** 467 ảnh (163 esotropia, 173 exotropia, 131 normal).
    - **Tập Val (Hiệu chỉnh/Chọn mô hình):** 104 ảnh (35 esotropia, 45 exotropia, 24 normal).
    - **Tập Test (Kiểm thử độc lập held-out):** 125 ảnh (48 esotropia, 52 exotropia, 25 normal).
  - Số cụm bị rò rỉ giữa các tập (`crossSplitGroupCount`): **0 cụm (Hoàn toàn độc lập)**.

---

## 3. Không Gian Đặc Trưng (Feature Engineering - 73 Features)

Pipeline trích xuất 73 đặc trưng số hóa toàn diện từ mỗi ảnh mắt:

| Nhóm đặc trưng | Số lượng | Mô tả chi tiết |
| :--- | :---: | :--- |
| **Hình học mống mắt (Iris Geometry)** | 3 | Tọa độ tâm chuẩn hóa $(cx, cy)$ và đường kính mống mắt ước tính từ Hough Circles. |
| **Phản xạ giác mạc (Purkinje Reflex)** | 5 | Trạng thái phát hiện, tọa độ tâm phản xạ, diện tích pixel phản xạ, mã phân tầng độ tin cậy (Strict=3, Medium=2, Adaptive=1, None=0). |
| **Phát hiện đồng tử (Pupil Center)** | 4 | Trạng thái phát hiện, tọa độ tâm đồng tử $(px, py)$, đường kính đồng tử tương đương. |
| **Vector độ lệch Hirschberg** | 5 | Cờ phát hiện đồng thời cả hai thành phần, vector khoảng cách Hirschberg $(h_{iris\_x}, h_{iris\_y})$, vector Hirschberg đồng tử $(h_{pupil\_x}, h_{pupil\_y})$. |
| **Trọng tâm vùng tối (Dark Centroid)** | 3 | Trọng tâm phân bố sắc tố tối $(cx_{dark}, cy_{dark})$ và độ lệch so với trục trung tâm ($cx_{dark} - 0.5$). Đây là chỉ số then chốt phân biệt độ xoay nhãn cầu vào trong (esotropia) hay ra ngoài (exotropia). |
| **Bất đối xứng nhãn cầu (Asymmetry)** | 2 | Tỷ lệ và hiệu số độ sáng giữa nửa trái (40% diện tích) và nửa phải của mắt (sclera vs iris contrast). |
| **Biểu đồ cường độ ngang (Horizontal Profile)** | 16 | Cường độ sáng trung bình theo 16 lát cắt dọc từ khóe mắt trong đến khóe mắt ngoài. |
| **Lưới không gian 4x4 (Spatial Pyramid Grid)** | 32 | Giá trị trung bình và độ lệch chuẩn ánh sáng trên 16 ô lưới cục bộ ($4 \times 4 \times 2 = 32$). |
| **Biểu diễn đông kết ResNet18 (Transfer Logits)** | 3 | Logit 0, Logit 1 và xác suất lác từ backbone ResNet18 ROI hiện có (chỉ trích xuất đặc trưng, không can thiệp trọng số). |
| **Tổng cộng** | **73** | **Không gian vector đặc trưng liên tục, không chứa giá trị NaN/Inf.** |

---

## 4. Kết Quả Huấn Luyện & So Sánh Mô Hình (Trên Tập Validation)

Các mô hình được huấn luyện trên tập Train (467 ảnh) và đánh giá đối chuẩn trên tập Val (104 ảnh) với cơ chế cân bằng trọng số lớp (`class_weight='balanced'`):

| Kiến trúc mô hình | Validation Accuracy | Validation Balanced Accuracy | Validation Macro F1 | Kết quả lựa chọn |
| :--- | :---: | :---: | :---: | :--- |
| **HistGradientBoosting** | **79.81%** | **78.41%** | **0.7917** | 🏆 **Được chọn làm Candidate** |
| **RandomForest (150 trees)** | 73.08% | 73.24% | 0.7343 | Không chọn |
| **LogisticRegression (L2, C=0.5)** | 74.04% | 72.25% | 0.7255 | Không chọn |
| **MLPClassifier (64, 32)** | 73.08% | 71.96% | 0.7244 | Không chọn |

---

## 5. Kết Quả Đánh Giá Trên Tập Kiểm Thử Độc Lập (Held-out Test Set - 125 ảnh)

Mô hình tốt nhất (`HistGradientBoosting`) được cố định và đánh giá một lần duy nhất trên tập Test (125 ảnh chưa từng xuất hiện trong quá trình học):

### 5.1. Hiệu Suất Phân Loại 3 Lớp (Esotropia / Exotropia / Normal)

- **Độ chính xác tổng thể (Test Accuracy):** **76.00%**
- **Độ chính xác cân bằng (Test Balanced Accuracy):** **75.97%**
- **Điểm Macro F1:** **0.7532**
- **Điểm Weighted F1:** **0.7606**

#### Báo Cáo Phân Lớp Chi Tiết:

| Nhãn lâm sàng | Precision | Recall (Độ nhạy từng lớp) | F1-Score | Số lượng mẫu (Support) |
| :--- | :---: | :---: | :---: | :---: |
| **Esotropia (Lác trong)** | 78.26% | 75.00% | 0.7660 | 48 |
| **Exotropia (Lác ngoài)** | 78.43% | 76.92% | 0.7767 | 52 |
| **Normal (Bình thường)** | 67.86% | 76.00% | 0.7170 | 25 |
| **Trung bình Macro** | **74.85%** | **75.97%** | **0.7532** | **125** |

#### Ma Trận Nhầm Lẫn 3 Lớp (Confusion Matrix):

$$\begin{pmatrix}
\text{Esotropia dự đoán} & \text{Exotropia dự đoán} & \text{Normal dự đoán} \\
36 & 10 & 2 \\
5 & 40 & 7 \\
5 & 1 & 19
\end{pmatrix}$$

### 5.2. Hiệu Suất Sàng Lọc Nhị Phân (Lác Mắt vs Bình Thường)

Khi quy đổi bài toán về mục tiêu sàng lọc phát hiện lác (Esotropia + Exotropia gộp thành Nhóm Bệnh, Normal là Nhóm Chứng):
- **Độ nhạy (Sensitivity / Recall on Strabismus):** **91.00%** (Phát hiện chính xác 91 trên 100 ca lác mắt).
- **Độ đặc hiệu (Specificity / Recall on Normal):** **76.00%** (Xác định đúng 19 trên 25 ca bình thường).
- **Giá trị tiên đoán dương (PPV):** **93.81%**.
- **Giá trị tiên đoán âm (NPV):** **67.86%**.
- **Diện tích dưới đường cong ROC (ROC-AUC):** **0.9124** (Khả năng phân tách nhị phân rất tốt).

---

## 6. Đóng Gói Tạo Tác & Quản Trị Hệ Thống (Governance)

1. **Vị trí lưu trữ mô hình:**
   - Tạo thư mục riêng: `D:\REMICARE-STRABISMUS-AI\app\models\research\`
   - Tệp mô hình: `hirschberg_candidate_v0.1.joblib`
   - Cấu trúc gói chứa:
     - `pipeline`: Scikit-learn Pipeline gồm `StandardScaler` + `HistGradientBoostingClassifier`.
     - `feature_names`: Danh sách đầy đủ 73 tên đặc trưng.
     - `classes`: `["esotropia", "exotropia", "normal"]`.
     - `status`: `"research_candidate"`.
     - `is_production`: `False`.
     - `non_clinical_declaration`: Tuyên bố pháp lý nghiêm cấm dùng cho chẩn đoán độc lập.
2. **Cập nhật sổ đăng ký mô hình ([`MODEL_REGISTRY.md`](file:///D:/REMICARE-STRABISMUS-AI/MODEL_REGISTRY.md)):**
   - Đã bổ sung mục `Research Candidate Models (Non-Production, Exploratory)`.
   - Ghi nhận đầy đủ thông số kỹ thuật, phiên bản dữ liệu và metrics kiểm thử.
3. **Bảo toàn hệ thống Production:**
   - Tệp mô hình `app/models/best_model.onnx` và endpoint `/api/v1/strabismus/predict` **hoàn toàn không bị sửa đổi hay thay thế**.
4. **Kiểm thử tự động (Unit Tests):**
   - Đã bổ sung [`tests/research/test_phase6b_research_classifier.py`](file:///D:/REMICARE-STRABISMUS-AI/tests/research/test_phase6b_research_classifier.py).
   - Kiểm thử toàn diện 23/23 tests backend và 9/9 tests frontend đều **PASS 100%**.

---

## 7. Khuyến Cáo & Giới Hạn Nghiên Cứu

1. **Giới hạn dữ liệu:**
   - Dữ liệu `data_hirschberg` gồm các ảnh cắt kích thước 224x224 với nhãn dựa theo tên thư mục (`user_attested_doctor_confirmed_folder_label`), chưa có manifest định danh từng bệnh nhân (`participant_id` là `UNKNOWN`).
   - Mặc dù split đã ngăn chặn trùng lặp ảnh cơ sở, tính độc lập tuyệt đối giữa các bệnh nhân chỉ có thể được chứng minh khi có mã định danh bệnh nhân chuẩn hóa.
2. **Phạm vi sử dụng:**
   - Mô hình này là bước thử nghiệm tiền khả thi (exploratory candidate) nhằm chứng minh tiềm năng phân loại từ các đặc trưng Hirschberg và phản xạ giác mạc.
   - **Không dùng kết quả này để cấp chứng nhận lâm sàng hay thay đổi ngưỡng sàng lọc của RemiCare.**
