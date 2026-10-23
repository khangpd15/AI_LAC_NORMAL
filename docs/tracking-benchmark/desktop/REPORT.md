# Đối chiếu desktop ngày 23/10/2026

Chạy `node scripts/compareTrackingBenchmark.mjs --desktop` với mã hiện tại và landmark đã trích cục bộ từ 6 video trong `video/VIDEO_COVER_TEST`: 7.079 khung. Không trích lại FaceMesh và không đo webcam/browser trực tiếp. Mô phỏng dùng `mobile: false`. Cùng đầu vào, so ba nhánh: mô phỏng, POSITION có One Euro, COVER hiện tại không làm mượt.

## Kết quả

Đơn vị là số khung trễ tương đối với landmark gốc, 1 khung khoảng 33,3 ms. Ước lượng bằng dịch chuỗi 0–10 khung để tối thiểu hóa sai số; không phải nhãn chuyển động mắt thực. Cột POSITION tương ứng các trường `cover*` trong JSON để giữ tương thích công cụ cũ; cột COVER tương ứng `activeCover*`.

| Video | Có mặt | Mí mô phỏng / POSITION / COVER | Hướng nhìn mô phỏng / POSITION / COVER |
|---|---:|---:|---:|
| esotropia_1 | 4286/4286 | 0 / 3 / 0 | 0 / 2 / 0 |
| esotropia_2 | 100/372 | 0 / 3 / 0 | 2 / 2 / 0 |
| exotropia_1 | 562/562 | 0 / 2 / 0 | 0 / 2 / 0 |
| exotropia_2 | 243/304 | 0 / 3 / 0 | 0 / 1 / 0 |
| exotropia_3 | 574/759 | 0 / 2 / 0 | 0 / 0 / 0 |
| normal_1 | 796/796 | 0 / 3 / 0 | 0 / 1 / 0 |

POSITION làm mượt mí trễ 67–100 ms; hướng nhìn trễ hơn mô phỏng ở 4/6 video. COVER không thêm độ trễ landmark do bộ lọc vì đã tắt smoothing. Số 0 không có nghĩa tổng latency camera bằng 0. Không đủ nhãn để kết luận độ nhạy/chính xác phát hiện lác. FaceMesh có thể vẫn đặt landmark trên dụng cụ che; tỷ lệ có mặt không phải tỷ lệ mắt đo được. Video esotropia_2 chỉ nhận diện được 26,9% khung.

## Đối chiếu mã hiện tại

- `BinocularVisionScreening.jsx` đặt `applySmoothing: currentStep !== 'COVER'`.
- `CoverTestStep.jsx` nhận kết quả inference đồng bộ với ảnh nguồn, bỏ timestamp trùng/cũ rồi ghi mẫu bằng `captured.timestampMs`. Nhận xét ghi mẫu trùng trong báo cáo ngày 20/10 là lịch sử, không còn mô tả mã hiện tại. `clockScenarios` trong JSON chỉ là mô hình lịch gọi cũ.
- `useEyeTracking.js` cập nhật ref theo từng kết quả nhưng đồng bộ React state mỗi 100 ms. POSITION nhận landmark qua state, nên có thể trông giật/chậm hơn mô phỏng. Chưa đo tổng độ trễ giao diện để lượng hóa ảnh hưởng này.
- Không đổi bộ lọc, ngưỡng phát hiện hoặc chất lượng đo trong lượt sửa này.

## UI

Khung chờ camera trước đây chỉ cao tối thiểu 160 px, checklist gồm sáu hàng cộng xác nhận và ghi chú nên tạo khoảng trống lớn ở trái. Đã đặt khung chờ desktop tỷ lệ 4:3, cân hai cột, chia sáu điều kiện thành hai cột, cho nút xuống dòng và sửa trạng thái nút khi camera chưa bật. Giữ breakpoint một cột <=860 px.

Build thành công, lint không có lỗi (10 cảnh báo ở các phần khác); 6 kiểm thử timeline và continuous-eye đạt. Chưa xác minh trực quan trên browser hoặc thử webcam thật sau sửa.
