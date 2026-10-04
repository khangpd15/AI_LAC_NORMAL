# Prompt cho AI thực hiện Phase 6 Hirschberg theo NCKH.md

Bạn là Senior Full-stack + Computer Vision/ML Engineer. Hãy tiếp tục dự án RemiCare Strabismus AI theo đúng `NCKH.md`.

## Bối cảnh dự án

- Frontend: `D:\AI_Check_Lac`
- Backend AI: `D:\REMICARE-STRABISMUS-AI`
- Công cụ là SÀNG LỌC nghiên cứu, KHÔNG phải chẩn đoán.
- Phạm vi cố định: chỉ lác ngang gồm `esotropia`, `exotropia`, `normal`.
- Quy trình hiện tại đã đổi từ Gaze4Directions sang Hirschberg ảnh tĩnh + Cover-Uncover chuỗi thời gian.
- Không được thay production model, threshold, endpoint `/predict`, hoặc feature contract cũ.

## Tài liệu bắt buộc phải đọc trước khi sửa code

Đọc và trích dẫn đường dẫn + dòng liên quan trong báo cáo của bạn:

1. `D:\AI_Check_Lac\NCKH.md`
2. `D:\AI_Check_Lac\RECON.md`
3. `D:\AI_Check_Lac\PHASE4_REPORT.md`
4. `D:\AI_Check_Lac\PHASE4_5_HIRSCHBERG_SWITCH_REPORT.md`
5. `D:\AI_Check_Lac\PHASE5_REPORT.md`
6. `D:\AI_Check_Lac\HIRSCHBERG_DATASET_AUDIT.md`
7. `D:\AI_Check_Lac\HIRSCHBERG_PAPER_REVIEW_KARAASLAN_2023.md`
8. Backend files liên quan trong `D:\REMICARE-STRABISMUS-AI\app\services`, `app\schemas`, `app\api`, `tests\research`

## Nghiên cứu tham khảo

Bài tham khảo chính:

`A new method based on deep learning and image processing for detection of strabismus with the Hirschberg test`

Ý tưởng được phép ứng dụng:

- Dùng MediaPipe/landmarks để xác định ROI mắt/iris.
- Detect corneal light reflex bằng xử lý ảnh trong vùng iris/pupil.
- Bổ sung detector `pupil_center` vì `iris_center` có thể lệch so với tâm đồng tử.
- Tính và lưu song song:
  - `h_iris = (reflex_x - iris_center_x) / iris_diameter`
  - `h_pupil = (reflex_x - pupil_center_x) / iris_diameter`
- Theo dõi riêng tỷ lệ detect thành công: face, eyes, iris, pupil, reflex.

Không được copy trực tiếp:

- Không quy đổi sang độ hoặc prism diopter.
- Không hard-code hệ số lâm sàng.
- Không dùng kết quả bài báo để chốt threshold cho RemiCare.
- Không gọi kết quả là chẩn đoán.

## Nhiệm vụ Phase 6A

Thực hiện Phase 6A: cải thiện backend Hirschberg measurement, chưa train production model.

Yêu cầu cụ thể:

1. Backend thêm hoặc mở rộng service đo Hirschberg hiện có để phát hiện `pupil_center` trong ROI mắt.
2. Cải thiện corneal reflex detector theo hướng thử nhiều ngưỡng sáng/threshold trong ROI, nhưng mọi ngưỡng mới phải nằm trong config hoặc constant nghiên cứu có chú thích `TODO_PILOT`.
3. API research measurement trả thêm dữ liệu measurement, ví dụ:
   - `iris_center`
   - `pupil_center`
   - `reflex_center`
   - `iris_diameter`
   - `h_iris`
   - `h_pupil`
   - detector status/reason: `PUPIL_NOT_FOUND`, `REFLEX_NOT_FOUND`, `MULTIPLE_REFLEX`, `LOW_QUALITY_INPUT`, v.v.
4. Nếu pupil/reflex không đủ tin cậy, trả `INCONCLUSIVE` hoặc `MEASUREMENT_ONLY` phù hợp; tuyệt đối không ép thành `SCREENING_NORMAL`.
5. Không đổi endpoint production `/api/v1/strabismus/predict`.
6. Không đổi model ONNX hiện tại, threshold hiện tại, hoặc logic inference production.
7. Thêm test unit cho:
   - phát hiện reflex khi có một chấm sáng rõ.
   - `REFLEX_NOT_FOUND` khi không có chấm.
   - `MULTIPLE_REFLEX` khi có nhiều chấm sáng.
   - pupil detector trả `PUPIL_NOT_FOUND` khi ROI không đủ dữ liệu.
   - output có đủ field mới và vẫn giữ schema tương thích.
8. Nếu cần benchmark nhanh với `data_hirschberg`, chỉ báo detector success rate/coverage, không báo sensitivity/specificity lâm sàng.

## Dataset hiện có

Có folder:

`D:\REMICARE-STRABISMUS-AI\data_hirschberg\eye-classification`

Nhãn được suy từ folder và đã tạo manifest:

- `D:\AI_Check_Lac\manifests\hirschberg_folder_labels.csv`
- `D:\AI_Check_Lac\manifests\hirschberg_folder_labels.jsonl`
- `D:\AI_Check_Lac\manifests\hirschberg_folder_labels_summary.json`

Dataset này được người dùng xác nhận là bác sĩ/tổ chức đã chứng minh nhãn, nhưng ảnh là crop 224x224 và chưa chắc đúng protocol Hirschberg full-frame. Vì vậy:

- Được dùng cho exploratory detector/classifier research.
- Không được dùng để chốt threshold lâm sàng.
- Không được tuyên bố clinical validation.
- Không được deploy production.

## Quy tắc an toàn bắt buộc

- Mọi giá trị chưa được bác sĩ/pilot duyệt phải để `TODO_PILOT`.
- Không dùng dữ liệu production để train.
- Không log ảnh mặt không cần thiết.
- Low quality hoặc đo không chắc chắn phải là `INCONCLUSIVE`/`QUALITY_FAIL`, không bao giờ là normal.
- Lỗi hệ thống phải là `SYSTEM_ERROR`.
- Chỉ làm đúng Phase 6A, không refactor ngoài phạm vi.
- Nếu gặp quyết định lâm sàng hoặc threshold cần chuyên môn, dừng và hỏi.

## Kiểm thử bắt buộc

Chạy tối thiểu:

```powershell
cd D:\REMICARE-STRABISMUS-AI
pytest tests\research -q
```

Nếu sửa phần dùng chung backend, chạy thêm:

```powershell
pytest -q
```

Nếu có sửa frontend, chạy:

```powershell
cd D:\AI_Check_Lac
npm run build
npm run lint
npm test
```

## Báo cáo đầu ra

Sau khi xong, tạo:

`D:\AI_Check_Lac\PHASE6A_HIRSCHBERG_MEASUREMENT_REPORT.md`

Báo cáo phải gồm:

- File đã sửa/thêm.
- Logic pupil/reflex detector.
- Những ngưỡng nào là `TODO_PILOT`.
- Test đã chạy và kết quả.
- Những gì chưa làm.
- Khẳng định rõ: chưa train production, chưa đổi `/predict`, chưa chốt threshold, chưa chẩn đoán.

## Điểm dừng

Sau Phase 6A, dừng lại chờ duyệt.

Không tự chuyển sang Phase 6B train classifier nếu chưa có xác nhận rõ ràng của người dùng.

Nếu người dùng xác nhận Phase 6B sau đó, chỉ train `research_candidate` exploratory từ manifest đã tạo, lưu artifact riêng, không deploy production.
