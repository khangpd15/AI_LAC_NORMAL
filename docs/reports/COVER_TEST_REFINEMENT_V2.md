# Cover Test v2 — sửa lỗi visibility và phục hồi phép đo

Ngày: 28/10/2026. Tiếp nối [triển khai theo sự kiện](COVER_TEST_EVENT_IMPROVEMENTS.md) và kết quả kiểm thử ba video iPhone.

**Bản tiếp theo:** [v3 có crop từng mắt, manifest và xử lý đoạn ổn định sau gián đoạn](COVER_TEST_CROPS_V3.md). Các kết quả bên dưới ghi lại bản v2 tại thời điểm triển khai.

## Những thay đổi đã triển khai

1. **Nhận diện mắt mở bằng cấu trúc ảnh.** `EyeCoverDetector.sampleEyePatch()` xuất thêm lưới độ sáng 8×6 ô. `UncoverCaptureObserver` so sánh cấu trúc với baseline riêng của từng mắt bằng tương quan chuẩn hóa, kết hợp tương phản tương đối và phát hiện bề mặt che sáng. Không dùng sắc độ da hoặc một pixel tối làm bằng chứng mắt mở. Có bù thay đổi phơi sáng chung khi mắt đối diện còn có cấu trúc tin cậy.
2. **Xác nhận mở ổn định.** Cần ít nhất 3 khung nguồn duy nhất và 120 ms mở rõ; vẫn giữ timestamp và ảnh của khung đầu tiên. Không tạo ảnh từ mẫu bị đánh dấu chớp mắt, mất iris hoặc tư thế đầu không hợp lệ.
3. **UNKNOWN có phục hồi hữu hạn.** Không còn giữ một lỗi visibility cho toàn bộ lượt chỉ vì một mẫu bị loại. Khoảng gián đoạn tối đa vẫn là 250 ms, mẫu lỗi vẫn bị bỏ. UNKNOWN không làm mới thời điểm che và không tạo tọa độ mống mắt giả. Mất dữ liệu dài trong cửa sổ phân tích vẫn làm phép đo không hợp lệ.
4. **Tách chất lượng đặt che và bỏ che.** Cửa sổ `cover_on_fellow_eye` hoàn chỉnh được giữ lại khi lần bỏ che sau đó không được xác nhận. `uncoverRecovery` vẫn ghi lỗi riêng. `primaryOcclusionVerified` mô tả xác nhận thao tác cho phép đo chính; `occlusionVerified` giữ ý nghĩa đầy đủ cả hai sự kiện. Hai mắt và thứ tự lượt được kiểm tra trước khi chấp nhận chu kỳ.
5. **Chờ đủ cửa sổ có giới hạn.** UI có thể đợi thêm tối đa 3 giây cho sự kiện vật lý muộn, cập nhật hướng dẫn/countdown trong thời gian thu thêm. Thời gian sự kiện vẫn dùng timestamp nguồn. Deadline của âm thanh lỗi vẫn được áp dụng.
6. **Sửa replay.** Mỗi lượt có recorder riêng và lịch sử trước đặt che; có thể tiếp tục đến hết cửa sổ hồi phục, tối đa 3 giây sau mốc kết thúc danh nghĩa. Baseline pixel chỉ học trong phần chuẩn bị đầu clip. Bộ kiểm thử giữ nguyên kết quả v1 và tạo kết quả `.v2` riêng.

Ngưỡng dịch chuyển, vận tốc, số mẫu hợp lệ, số mẫu/cửa sổ sớm và số chu kỳ lặp không được hạ để các video NORMAL vượt kiểm thử. Các ngưỡng appearance mới vẫn là tham số kỹ thuật, chưa được hiệu chuẩn lâm sàng.

## Kết quả chạy lại 6.315 khung

| Clip | Chu kỳ hợp lệ v1 → v2 | Lượt đo chính v1 → v2 | Kết quả v2 |
|---|---:|---:|---|
| 4K_30FPS | 1/3 → 1/3 | 3/6 → 4/6 | INCONCLUSIVE |
| 4K_60FPS | 0/3 → 3/3 | 2/6 → 6/6 | NO_SIGNIFICANT_REFIXATION |
| HD_30FPS | 0/3 → 3/3 | 0/6 → 6/6 | NO_SIGNIFICANT_REFIXATION |

Đây là kết quả kỹ thuật offline. Ba file thực nhận đều là 720×1280 ở khoảng 30 FPS; không dùng tên file để khẳng định thông số quay gốc hoặc hiệu năng Safari/iPhone.

Những mốc bỏ che sớm rõ ràng đã thay đổi: clip 4K_30FPS từ 18,333 s sang 23,700 s và từ 62,100 s sang 66,967 s; clip HD từ 27,867 s sang 35,333 s, từ 50,900 s sang 58,533 s và từ 61,100 s sang 68,467 s. Các mốc là ứng viên ảnh của detector, không phải nhãn chuẩn thời gian được bác sĩ xác nhận.

Clip 4K_30FPS còn hai lượt không hợp lệ: lượt 3 chưa xác nhận được onset đặt che đủ tin cậy; lượt 5 có khoảng trống mẫu 366,7 ms, vượt giới hạn 250 ms. Kết quả được giữ INCONCLUSIVE. Clip HD chỉ giữ 5/6 ứng viên ảnh sau khi bỏ ứng viên ở vùng chớp mắt; không tạo ảnh bù để đạt đủ sáu.

Chạy đối chứng với **code v2 và cửa sổ cố định cũ** cho cùng số chu kỳ phép đo chính như v2 đã sửa cửa sổ. Việc sửa cửa sổ vẫn bảo toàn thêm khung hồi phục, nhưng không được trình bày như nguyên nhân duy nhất làm các clip vượt gate. Một số cửa sổ hồi phục vẫn thiếu mẫu sớm hoặc có gián đoạn và tiếp tục bị loại.

## Báo cáo mới

- [4K_30FPS — so sánh v1/v2](iphone-cover-test-2026-10-28-v2/4K_30FPS_COVER_TEST_RESULT_V2.html)
- [4K_60FPS — so sánh v1/v2](iphone-cover-test-2026-10-28-v2/4K_60FPS_COVER_TEST_RESULT_V2.html)
- [HD_30FPS — so sánh v1/v2](iphone-cover-test-2026-10-28-v2/HD_30FPS_COVER_TEST_RESULT_V2.html)

Mỗi báo cáo chứa ảnh khung nguồn đã đối chiếu theo frame ID, bảng thời gian, số đo, độ phủ từng cửa sổ, dữ liệu JSON nhúng và hash code. Báo cáo v1 không bị ghi đè.

## Kiểm tra và giới hạn

- Build sản phẩm thành công; còn cảnh báo kích thước bundle đã có.
- 37 kiểm tra Cover Test, visibility và timeline đạt.
- 101/101 test khả dụng đạt, cùng 14 kiểm tra trong `runAllTests.js`.
- Oxlint trên phần thay đổi không có lỗi; còn cảnh báo truy cập ref trong render đã có ở UI.
- File `scripts/uncoverCapture.test.js` có sẵn 10.826 byte NUL vẫn được giữ nguyên; file này làm lệnh test/lint toàn repo chưa hoàn thành. Các con số test ở trên loại trừ đúng file hỏng này.

Các ca test có đối chứng nếp tay, vật che sáng, thay đổi ánh sáng chung, chớp mắt, timestamp trùng, dữ liệu nguồn bị ngắt, sai bên mắt, phục hồi UNKNOWN ngắn, mất dữ liệu dài, bỏ che muộn và giữ tín hiệu chuyển động mô phỏng. Ba clip được dùng để phát hiện lỗi và kiểm tra hồi quy, không phải tập kiểm định độc lập; chưa thể suy ra độ nhạy/đặc hiệu hoặc chẩn đoán từ các kết quả này. Chưa thử camera trực tiếp sau thay đổi và chưa triển khai backend.

Tái lập:

```powershell
python scripts/extractIphoneCoverReplay.py
node scripts/replayIphoneCover.mjs --v2
node scripts/replayIphoneCover.mjs --fixed-windows
python scripts/renderIphoneCoverResultsV2.py
```
