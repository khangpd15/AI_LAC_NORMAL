# Cover Test v3 — crop vùng mắt và kiểm tra ổn định sau gián đoạn

Ngày: 28/10/2026. Tiếp nối [bản v2](COVER_TEST_REFINEMENT_V2.md).

## Ảnh crop đã xuất

Đã tạo **172 file PNG riêng từng mắt**, liên kết với frame ID, timestamp, tọa độ crop và SHA-256. Ảnh là lát cắt trực tiếp từ video gốc, không resize hoặc tạo thêm chi tiết. Có ảnh trước đặt che, lúc đặt che, sau 500 ms, tại ứng viên bỏ che và sau ứng viên 500 ms khi nguồn tương ứng tồn tại.

| Clip | PNG | Cặp crop / tối đa | Chu kỳ đủ phép đo chính |
|---|---:|---:|---:|
| 4K_30FPS | 56 | 28/30 | 2/3 |
| 4K_60FPS | 60 | 30/30 | 3/3 |
| HD_30FPS | 56 | 28/30 | 3/3 |

- [Toàn bộ PNG, manifest, CSV, JSON và báo cáo — ZIP](iphone-cover-test-2026-10-28-v3/EYE_CROPS_AND_RESULTS_V3.zip)
- [Báo cáo crop 4K_30FPS](iphone-cover-test-2026-10-28-v3/4K_30FPS_CROP_RESULT_V3.html)
- [Báo cáo crop 4K_60FPS](iphone-cover-test-2026-10-28-v3/4K_60FPS_CROP_RESULT_V3.html)
- [Báo cáo crop HD_30FPS](iphone-cover-test-2026-10-28-v3/HD_30FPS_CROP_RESULT_V3.html)

Mỗi HTML tự chứa ảnh; bấm vào từng ảnh để tải PNG. Mỗi thư mục video có `crops/`, `crop_manifest.json`, `crop_index.csv` và `result.json`.

Hai mốc đặt che ở lượt 3 của 4K_30FPS không có sự kiện onset tin cậy nên không xuất crop sự kiện thay thế. Hai mốc bỏ che ở lượt 4 của HD không có ứng viên đủ điều kiện nên cũng không tạo ảnh bù. Crop bên đang che có thể cho thấy tay/thìa; không được coi đó là ảnh iris đã đo. Các ảnh +500 ms phục vụ đối chiếu, không thay thế mẫu bị loại khỏi phép đo.

## Dùng chung geometry cho app và replay

Module mới `src/services/coverTest/eyeCropGeometry.js` xác định vùng crop theo contour/khóe mắt trong hệ tọa độ pixel của ảnh nguồn. `freezeEyePair()` trong ứng dụng và script xuất crop dùng cùng module. Không áp dụng phép soi gương của preview vào dữ liệu nguồn; không tạo điểm mí giả khi thiếu landmark.

Encoder kiểm tra timestamp của ảnh khớp sự kiện, có frame ID và kích thước crop nằm trong khung nguồn. Ảnh của hai mắt được copy đồng bộ trước khi mã hóa JPEG. Metadata có phiên bản crop và hệ tọa độ nguồn để đối chiếu.

Đối với ba MP4 có timestamp không hoàn toàn đều, crop được tạo bằng **giải mã tuần tự**, xác minh PTS của frame với dữ liệu inference trong sai số dưới 0,1 ms. Không dựa riêng vào chỉ số seek của OpenCV. Sau khi ghi PNG, đọc lại và so sánh từng pixel với lát cắt gốc; cả 172 file đều khớp.

## Cải tiến phân tích

Trước đây một khoảng mất mẫu muộn hơn cửa sổ chuyển động có thể làm hỏng cả phép đo, dù cửa sổ 0–500 ms đã đủ dữ liệu. Bản v3 đánh giá riêng:

1. **Cửa sổ sớm:** vẫn cần ít nhất 5 mẫu trải 300 ms, không có khoảng trống quá 250 ms cắt qua cửa sổ 0–500 ms; toàn bộ phép đo cần tối thiểu 15 mẫu.
2. **Đoạn ổn định:** cần ít nhất 5 mẫu liên tục trải 200 ms, độ phủ sau sự kiện tối thiểu 1.000 ms và điểm ổn định ít nhất 0,60. Đoạn này nằm sau khoảng gián đoạn muộn cuối cùng, nếu có.

Không nội suy khoảng mất mẫu; các bước bắc qua khoảng đó bị bỏ khỏi phép tính vận tốc và thời điểm ổn định. Cửa sổ sớm thiếu mẫu, đoạn cuối quá ngắn hoặc dao động không ổn định vẫn bị loại. JSON ghi riêng các khoảng mất mẫu muộn và cảnh báo `LATE_GAP_EXCLUDED_FROM_KINEMATICS`.

Đây là thay đổi chính sách kiểm tra chất lượng so với v2, không chỉ đổi hiển thị. Ngưỡng nhận diện biên độ/vận tốc chuyển động không được hạ. Lượt 5 của 4K_30FPS được giữ lại nhờ cửa sổ sớm đầy đủ và đoạn cuối ổn định quan sát được; lượt 3 thiếu onset vẫn bị loại. Kết quả tổng hợp của cả ba clip là `NO_SIGNIFICANT_REFIXATION` trên số chu kỳ hợp lệ nêu trên, không phải xác nhận chẩn đoán NORMAL.

## Kiểm tra

- Build thành công; còn cảnh báo kích thước bundle đã có.
- 108/108 test khả dụng và 14 kiểm tra của `runAllTests.js` đạt. Loại trừ đúng file test cũ chứa byte NUL: `scripts/uncoverCapture.test.js`; file này được giữ nguyên.
- Các test mới kiểm tra tọa độ crop portrait/landscape, đổi kích thước nguồn, clipping biên, thiếu mắt, đóng băng hai crop đồng thời, liên kết frame/timestamp, gián đoạn muộn có hồi phục và gián đoạn sớm/đoạn cuối không ổn định.
- Oxlint trên các file thay đổi và `git diff --check` không có lỗi.

Ba clip này vẫn là dữ liệu phát hiện lỗi và kiểm tra hồi quy, chưa phải tập kiểm định độc lập. Nguồn thực nhận đều là 720×1280 ở khoảng 30 FPS. Chưa thử trực tiếp luồng camera iPhone/Safari sau thay đổi, chưa triển khai backend hoặc kiểm định độ nhạy/đặc hiệu.

Tái lập:

```powershell
node scripts/replayIphoneCover.mjs --v3
node scripts/buildIphoneEyeCropManifests.mjs
python scripts/renderIphoneEyeCropResultsV3.py
```
