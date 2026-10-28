# Cải tiến Cover Test theo sự kiện quan sát

Ngày triển khai: 28/10/2026. Cơ sở: [đánh giá EyeCover](EYECOVER_REPO_COVER_TEST_REVIEW.md).

**Cập nhật tiếp theo:** xem [Cover Test v2](COVER_TEST_REFINEMENT_V2.md) cho chính sách phục hồi UNKNOWN, xác nhận ảnh mở ổn định và kết quả kiểm thử mới. Nội dung dưới đây ghi lại lần triển khai đầu.

## Thay đổi chính

- Thêm `coverEventMeasurementService.js` để ghi sự kiện đặt che và bỏ che từ timestamp khung nguồn, độc lập với âm thanh hướng dẫn và việc mã hóa/lưu JPEG.
- Khi che trái, phân tích mắt phải; khi che phải, phân tích mắt trái. Đây là dữ liệu chính đưa vào tổng hợp chu kỳ.
- Lưu riêng chuyển động sau bỏ che trong `uncoverRecovery`; không dùng nó để thay thế tín hiệu mắt đối diện lúc đặt che.
- Baseline của từng lượt lấy từ lịch sử hai mắt mở gần nhất. Không dùng mống mắt bị che hoặc baseline giả để xác thực phép đo.
- Xác nhận đặt che cần mắt được yêu cầu ở trạng thái OCCLUDED và mắt đối diện được quan sát VISIBLE. UNKNOWN, che nhầm bên, che cả hai bên và mất tracking không xác nhận được thao tác.
- Chuyển tiếp lưu khung đầu tiên, khoảng thời gian bất định và thời điểm xác nhận sau đó. Cửa sổ chuyển động bắt đầu ở khung nguồn đầu tiên của sự kiện.
- Tính chuyển động trong hệ tọa độ theo hai khóe mắt, có tính kích thước ảnh nguồn. Hai trục chuẩn hóa theo chiều rộng hai khóe; không chuẩn hóa theo độ mở mí. Điều này loại ảnh hưởng của tịnh tiến, xoay trong mặt phẳng và thay đổi tỉ lệ trong mô hình hình học. Vẫn giữ kiểm tra tư thế đầu; chưa khẳng định loại được mọi chuyển động đầu 3D hoặc lỗi landmark.
- Không dùng lại mẫu UNKNOWN khi thiếu mẫu hợp lệ. Thiếu mẫu sớm, baseline không ổn định hoặc gián đoạn tracking trả kết quả không hợp lệ.
- Một chuyển động đơn lẻ chưa lặp lại trả INCONCLUSIVE; không tự biến thành kết quả âm tính. Quy tắc lặp lại vẫn là tiêu chí kỹ thuật chưa hiệu chuẩn lâm sàng.

## Trạng thái được tách riêng

| Trường | Ý nghĩa |
|---|---|
| `imageCaptureComplete` | Đã mã hóa/lưu đủ hai sự kiện ảnh của một chu kỳ |
| `occlusionVerified` | Hai lượt của chu kỳ có trình tự visibility được detector xác nhận; không phải chứng nhận lâm sàng |
| `procedureEvidence` | Sự kiện đặt che/bỏ che, mắt quan sát, khoảng bất định và lý do thất bại |
| `leftEye` / `rightEye` | Kết quả chuyển động mắt đang mở khi đặt che mắt đối diện |
| `uncoverRecovery` | Kết quả sau bỏ che, được giữ riêng |
| `quality.isValid` | Đủ dữ liệu đo chính ở cả hai mắt và quy trình quan sát hợp lệ |

Giao diện hiển thị “Chưa đủ dữ liệu” cho mắt có phép đo không hợp lệ và ưu tiên đo lại khi kết quả chưa kết luận được, kể cả đã chụp đủ ảnh.

## Các giới hạn kỹ thuật hiện tại

Các giá trị trong `COVER_EVENT_LIMITS` phục vụ xử lý tín hiệu, chưa phải ngưỡng y khoa:

| Tham số | Giá trị |
|---|---|
| Thời gian liên tục để xác nhận che | 120 ms |
| Khoảng gián đoạn khung nguồn tối đa | 250 ms |
| Lịch sử baseline hai mắt mở | 2 giây, tối đa 120 khung |
| Cửa sổ phân tích mỗi sự kiện | 1.500 ms |
| Số mẫu hợp lệ tối thiểu | 15 |
| Mẫu trong cửa sổ sớm 0–500 ms | Ít nhất 5, trải ít nhất 300 ms |
| Độ phủ sau sự kiện tối thiểu | 1.000 ms |

Với FPS thấp hoặc detector không đủ bằng chứng, hệ thống có thể trả nhiều kết quả chưa đủ dữ liệu hơn. Không hạ ngưỡng để cố tạo kết luận âm tính. Các thời lượng hướng dẫn che/bỏ che hiện có vẫn là 7/3 giây; người bỏ che quá muộn có thể không để lại đủ dữ liệu sau sự kiện và cần đo lại.

Visibility dùng cho phép đo lấy trước nhánh fallback hỗ trợ chụp ảnh. Thiếu hình học mắt, chưa có baseline pixel hoặc mí khép không được tự nâng thành bằng chứng visibility hợp lệ. Detector vẫn là heuristic; cần đánh giá bằng video gán nhãn trước khi điều chỉnh các giới hạn trên.

## Hợp đồng dữ liệu

Phiên có `measurementProtocol: observed-cover-uncover-v1` và `primaryMeasurement: cover_on_fellow_eye`. Metadata mô tả phép đo không thay đổi hợp đồng ảnh `cover-test-multimodal-v2` đang có.

Các phép đo theo sự kiện có `coordinateSpace: CANTHAL_FRAME_REFERENCE_WIDTH`. Tọa độ `x/y` trong kết quả phân tích là tọa độ cục bộ quy theo chiều rộng tham chiếu; không phải vị trí điểm ảnh trên ảnh gốc. Chuỗi nguồn gửi trong `samples` vẫn giữ tọa độ ảnh để đối chiếu.

Multipart gửi thêm phép đo và bằng chứng vào JSON mỗi chu kỳ. Đồng thời giữ bản sao trong `session_metadata.clientMetadata.observedCoverMeasurements` để tương thích với backend hiện lưu clientMetadata nhưng chỉ chọn một số trường của raw cycle. Chưa triển khai thay đổi backend hoặc chứng thực việc lưu trên máy chủ thật. Không thay đổi trọng số hay ngưỡng của mô hình AI phía máy chủ.

## Kiểm tra tự động

`scripts/coverEventMeasurement.test.js` kiểm tra thời gian thao tác chậm, đúng bên mắt, bất biến hình học, không che/che nhầm/che cả hai, UNKNOWN, gián đoạn, khung lặp, thiếu baseline, lỗi tư thế đầu, thiếu cửa sổ sớm, dữ liệu pixel thiếu, tách kết quả ảnh/phép đo và đóng gói multipart.

Kết quả kiểm tra sau triển khai:

- `npm run build`: thành công; còn cảnh báo kích thước bundle lớn.
- `node --test scripts/coverEventMeasurement.test.js`: 20/20 test mới đạt.
- `node scripts/runAllTests.js`: 14 kiểm tra đạt.
- Toàn bộ file `*.test.js` khác file bị hỏng nêu dưới: 87/87 test đạt, đã bao gồm 20 test mới.
- Oxlint trên các file triển khai: không có lỗi; còn hai cảnh báo đã có về tham số không dùng và truy cập ref trong render.
- `git diff --check`: không có lỗi whitespace.

Có lỗi sẵn trước khi sửa: `scripts/uncoverCapture.test.js` gồm 10.826 byte NUL khiến `npm test` và `npm run lint` không hoàn thành. File này được giữ nguyên để bảo toàn working tree; bộ kiểm thử mới không thay thế nội dung file đó. Chưa thử luồng camera trực tiếp hoặc đánh giá lâm sàng.

## Thử nghiệm camera tiếp theo

1. Giữ điện thoại cố định, đủ sáng, mở hai mắt trong phần chuẩn bị rồi thực hiện ba chu kỳ theo hướng dẫn.
2. Kiểm tra `procedureEvidence`: đúng bên che/quan sát, timestamp đơn điệu, khoảng bất định đúng các khung nguồn và không phụ thuộc thời điểm lưu JPEG.
3. Cố ý bỏ che chậm, che nhầm, chớp mắt, che cả hai mắt, rời khỏi khung và xoay đầu. Đối chiếu lý do chưa đủ dữ liệu với video gốc.
4. Thử camera trước/sau và video portrait/landscape, kính phản sáng, mắt hẹp, sắc độ da và vật che khác nhau. Ghi tỷ lệ hoàn thành, chụp ảnh, xác nhận thao tác và chất lượng phép đo thành các chỉ số riêng.
5. Đánh giá trên video có nhãn độc lập và kết quả chuyên khoa; chưa suy ra tăng độ nhạy/đặc hiệu từ việc các unit test đã qua.

Không thêm model EyeCover, chuyển đổi CoreML, huấn luyện model hoặc triển khai dịch vụ trong lần thay đổi này.
