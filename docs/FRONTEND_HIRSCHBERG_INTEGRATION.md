# Giao diện và tích hợp Hirschberg — 16/10/2026

Đích: `D:/AI_Check_Lac`. Giao diện nguồn: `D:/REMICARE_TRAIN_AI/FRONT_END_MEDIA_FACE`.
Đã tích hợp trang chủ, navbar/footer, trang giới thiệu, mô phỏng, hình ảnh và hướng dẫn nghe.
Giữ phần tích hợp Cover Test hiện có ở đích, gồm timeout/cold-start và persistence;
không đưa các lệnh transfer thử nghiệm cũ từ giao diện nguồn vào luồng đang chạy.

## Gọi backend

Hirschberg dùng `POST /api/v1/hirschberg/predict`, multipart:
`image`, `orientation`, `fixation`, `kind=auto`, `save_session=false`, session ID nếu có.
Ảnh gốc người dùng xác nhận được gửi, không thay bằng ảnh ROI hoặc ảnh giảm cỡ của preview.
Giới hạn client 10 MB; backend tiếp tục kiểm tra định dạng, số pixel và QC.
Không gọi API ONNX `/api/v1/strabismus/*` hoặc API đo nghiên cứu trong bước Hirschberg.

URL mặc định lấy từ `VITE_AI_BACKEND_URL`; có thể đặt `VITE_HIRSCHBERG_BACKEND_URL`
nếu Hirschberg chạy ở service khác. Các biến Vite cần được đặt trước lúc build.
Backend phải cho phép origin frontend trong `REMICARE_FRONTEND_ORIGINS`.
Không thay `.env.local` hoặc `.env.production` hiện có trong lần tích hợp này.

Người dùng xác nhận hướng ảnh và hướng nhìn khi chụp. Mặc định chưa xác nhận:
`orientation=auto`, `fixation=unknown`. Không tự đoán hai giá trị này để vượt gate.
Giữ hành vi eligibility trước đó: chặn khi consent được đặt false hoặc có red flag.

## Cách hiển thị

- Dùng `status` và `screening.classifier_called` từ backend, không suy status từ
  việc tồn tại `predictedClass` (chuỗi INCONCLUSIVE vẫn là một chuỗi có giá trị).
- Đọc `uncalibratedModelScores`, `screening.uncalibrated_model_scores` hoặc
  `probabilities`; hiển thị các điểm hợp lệ từ 0 đến 1 dưới dạng phần trăm.
- Nếu chỉ có `confidence` hợp lệ thì hiển thị đúng điểm đó. Không lấy điểm quality
  làm điểm phân loại, không tạo lớp còn thiếu bằng phép trừ 100%.
- Điểm chưa hiệu chuẩn ghi rõ là điểm mô hình, không phải xác suất mắc bệnh.
- HUMAN_REVIEW hiển thị gợi ý sàng lọc và yêu cầu chuyên gia xem xét.
- INCONCLUSIVE có điểm: hiển thị điểm nhưng vẫn giữ kết luận chưa đủ điều kiện.
- INCONCLUSIVE thiếu điểm: hiện lý do và thông báo chưa có điểm phần trăm; không tạo 0%.
- Nếu backend nói classifier chưa chạy, không hiển thị điểm hoặc lớp suy đoán còn sót.
- Thông báo lỗi mạng/503 không được đổi thành kết quả bình thường.

Hai màn hình Hirschberg và kết quả tổng hợp dùng chung `HirschbergOutcome` và
`hirschbergResultService` để giữ cách đọc dữ liệu nhất quán. Kết quả raw vẫn được giữ
trong session. Các thông tin model/latency trong chi tiết kỹ thuật lấy từ Hirschberg.

## Kiểm tra

- `npm run build`: thành công.
- `npm test`: 14 kiểm tra hiện có và 12 test Node thành công (11 test hợp đồng mới).
- `npm run lint`: không có lỗi; còn cảnh báo React trong các phần camera/trải nghiệm.
- Browser desktop 1440 px/mobile 390 px: upload → xác nhận metadata → kết quả bước 2
  → kết quả tổng hợp, không tràn ngang, không có page error. Test browser dùng prescreen
  giả lập và ba response fixture (có điểm, không điểm, INCONCLUSIVE có điểm).
- Đã lấy response thật từ API Hirschberg local bằng ảnh trống tổng hợp,
  `save_session=false`, và kiểm tra UI mobile với JSON này. Đây là kiểm tra hợp đồng
  tích hợp; không phải đánh giá độ chính xác mô hình hay kiểm thử backend Render đang deploy.
- Vite còn cảnh báo bundle lớn từ ONNX web/mô phỏng cục bộ đã có trong frontend.
  Pipeline ONNX web này tách biệt model ONNX backend đã gỡ.

Chưa push hoặc publish frontend. Cần deploy bản build mới để người dùng ngoài máy thấy thay đổi.
