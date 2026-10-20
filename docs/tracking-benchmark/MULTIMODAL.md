# Cover Test: ảnh bỏ che và timestamp

## Hành vi hiện tại

- Lấy timestamp và frameId từ khung camera được đưa vào FaceMesh, không tạo mẫu mới mỗi lần màn hình vẽ lại.
- Giữ nguyên các mẫu nguồn xử lý được, mục tiêu 30 fps. Thiết bị chậm có thể đạt ít hơn; không nội suy để giả đủ 30 fps.
- Hiệu chuẩn độ tương phản mắt lúc BASELINE. Sau khi thấy bằng chứng che một mắt liên tục ≥200 ms, giữ crop của cả hai mắt tại khung đầu tiên nhìn thấy lại. Khung rõ tiếp theo xác nhận sự kiện.
- Crop là pixel chưa lật của đúng khung inference, không lấy lại từ video đã chạy tiếp. JPEG encode sau đó không đổi thời gian chụp.
- Upload tối đa 6 sự kiện/12 JPEG cùng trajectory. Backend kiểm tra frameId, timestamp, t, kích thước và đủ hai ảnh; lưu manifest liên kết và SHA-256.
- Không ghi được ảnh thì lưu trạng thái NOT_CAPTURED/FAILED; không thay bằng ảnh chụp theo đồng hồ.

Đây là bộ phát hiện che dựa trên đặc trưng ảnh, chưa phải mô hình nhận diện bàn tay/vật che được đánh giá đầy đủ. Mất landmarks, che kéo dài làm mất mặt, vật có hoa văn hoặc ánh sáng thay đổi có thể khiến không chụp được. Ở 30 fps, khoảng hai khung thường khoảng 33 ms; trường `onsetIntervalMs` và `timingUncertaintyMs` giữ khoảng thực đo, không khẳng định biết thời điểm dưới một khung hình.

## Dữ liệu và mô hình được kiểm tra

Korean timestamps thực tế nằm ở `D:\REMICARE_TRAIN_AI\COVER_TEST_METHOD\data\normalized\korean`: 41 bản ghi (20 NORMAL, 21 STRABISMUS), 62.404 mẫu. Có 38 ranh giới reset đồng hồ, tạo 79 đoạn tăng đơn điệu; tốc độ gốc khoảng 61,8 Hz. Các đoạn chưa có nhãn pha bỏ che. Không nối qua reset, không chia ngẫu nhiên các khung cùng người vào train/test, không coi các bản hạ mẫu 30/45/60 fps là người độc lập. Chưa có đối chiếu cùng ca với bộ ảnh hoặc tập kiểm thử điện thoại độc lập để công bố độ chính xác kết hợp.

Đã kiểm tra trọng số Hirschberg tại `D:\REMICARE_TRAIN_AI\HIRSCHBERG_METHOD`. Nhánh tùy chọn dùng đúng ONNX và pipeline `hirschberg_candidate_v0.5_safe.joblib`, thứ tự mắt phải rồi mắt trái theo ảnh camera chưa lật. Kết quả là `researchEvidence.imageBranch.uncalibratedScores` cho từng sự kiện; không phải toàn bộ ensemble v0.6, không xác nhận fixation, không chuyển điểm số thành chẩn đoán.

Nhánh thời gian trả fps thực đo, số frame sau bỏ che và khoảng bất định cùng eventId. Nhánh ảnh chạy trong tiến trình riêng, có timeout. Hai nhánh được trả cùng nhau nhưng **chưa có mô hình fusion được huấn luyện/kiểm định trên các ca ghép cặp**, nên kết luận chung vẫn INCONCLUSIVE. Không lấy trung bình xác suất của hai miền đo khác nhau.

## Chạy backend

Backend: `D:\REMICARE-STRABISMUS-AI-COVER-TEST\backend_cover_test`.

Bật nhánh nghiên cứu ảnh bằng hai biến môi trường trước khi khởi động backend:

```powershell
$env:HIRSCHBERG_RESEARCH_ROOT='D:\REMICARE_TRAIN_AI\HIRSCHBERG_METHOD'
$env:HIRSCHBERG_RESEARCH_PYTHON='D:\REMICARE_TRAIN_AI\HIRSCHBERG_METHOD\.venv312\Scripts\python.exe'
```

Máy triển khai phải có runtime và artifact tương ứng; đường dẫn ổ D chỉ có tác dụng trên máy này. Không upload trọng số/dữ liệu lên dịch vụ ngoài trong quá trình sửa.

Khi có model fusion thật, cấu hình `COVER_MULTIMODAL_MODEL_PATH` tới artifact joblib tin cậy do quản trị viên cung cấp, chứa `contract=cover-uncover-multimodal-v1`, `model.predict_multimodal`, classes/name/version. Adapter phải nhận chuỗi thời gian và RGB của từng cặp mắt, trả probabilities hợp lệ và xác nhận toàn bộ analyzedEventIds. Không có artifact thì dữ liệu vẫn được lưu và trả kết quả chưa đủ kết luận.

## Kiểm chứng

Frontend: 48 Node tests + 14 kiểm tra hiện có. Có test khung đầu tiên/khung xác nhận, blink, mất tracking, JPEG bất đồng bộ và 30 mẫu nguồn duy nhất.
Backend: test JPEG sai/thiếu, timestamp không khớp, frame trùng, ảnh lật, field thừa, lưu cả hai ảnh và manifest, giữ INCONCLUSIVE khi chưa có fusion.
Đã chạy smoke test runtime ảnh với fixture tổng hợp; chỉ xác nhận tải model và hợp đồng đầu ra, không đo độ chính xác.

Chưa xác minh bộ phát hiện bỏ che mới bằng ground truth video và chưa test trực tiếp trên điện thoại. Benchmark video trước đó so sánh tracking/lọc mí, không phải đánh giá độ nhạy chụp bỏ che.
