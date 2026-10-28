# Cover Test v4: chất lượng đầu vào và bằng chứng CI

## Kết quả thực tế

Đã giải mã **13.394 frame của 9 video** trong `video/VIDEO_COVER_TEST`. Nhãn thư mục gồm 4 NORMAL, 2 ESOTROPIA, 3 EXOTROPIA. Người dùng xác nhận ngày 28/10/2026 rằng ba video iPhone (4K_30FPS, 4K_60FPS, HD_30FPS) thuộc **cùng một người**, nhãn NORMAL đã được bác sĩ xác nhận. Gán mã nghiên cứu nội bộ `IPHONE_SUBJECT_001`, ghi nguồn xác nhận là thông tin người dùng cung cấp; không tự điền tên bác sĩ hoặc cơ sở. Người dùng tiếp tục xác nhận sáu video còn lại thuộc sáu người khác nhau và cho phép train theo nhãn hiện có; đã gán `VIDEO_SUBJECT_001` đến `006`, giữ nhãn thư mục là nhãn yếu. Ba video iPhone phải ở cùng một split, không tính thành ba người độc lập.

| Video | Frames | Frame có nhận diện khuôn mặt |
|---|---:|---:|
| esotropia_1 | 4.286 | 100% |
| esotropia_2 | 372 | 26,9% |
| exotropia_1 | 562 | 100% |
| exotropia_2 | 304 | 79,9% |
| exotropia_3 | 759 | 74,6% |
| 4K_30FPS | 2.105 | 100% |
| 4K_60FPS | 2.094 | 100% |
| HD_30FPS | 2.116 | 100% |
| normal_1 | 796 | 100% |

Tỷ lệ nhận diện mặt không phải accuracy của bộ phân loại. Kiểm tra hình từ ba clip có tỷ lệ thấp thấy khung hình cận mặt bị cắt, khẩu trang, viền đen, chữ và đoạn cuối không có người; chưa gán nguyên nhân cho từng frame. Đầu vào offline dùng Python MediaPipe/OpenCV, không đo được FPS Safari/iPhone thực tế.

Phát lại bộ đo trên ba video iPhone với cửa sổ thao tác đã kiểm tra trước đây:

| Video | Sự kiện đủ điều kiện chụp trước → sau | Lượt đo chính hợp lệ trước → sau |
|---|---:|---:|
| 4K_30FPS | 6 → 6 | 5 → 5 |
| 4K_60FPS | 6 → 6 | 6 → 6 |
| HD_30FPS | 5 → 5 | 6 → 6 |

Không có bằng chứng tăng tỷ lệ chụp trên ba clip này. Các sự kiện cùng video có tương quan; **17/18 không phải accuracy hay CI lâm sàng**. Không đánh giá phân loại trên sáu video còn lại vì chưa có kế hoạch thao tác được gán nhãn và định danh người tham gia.

## Thay đổi

- Bài đo yêu cầu cả baseline tọa độ và mẫu ảnh mắt mở của hai mắt đã sẵn sàng. Trước đây có thể vượt bước chuẩn bị dù baseline ảnh chưa đủ, dẫn đến UNKNOWN suốt bài đo.
- Mẫu ảnh chuẩn phải đến từ các timestamp nguồn khác nhau, ít nhất 5 mẫu trải ít nhất 120 ms, mẫu mới nhất không cũ quá 1.500 ms và hiện tại cả hai mắt phải được xác nhận VISIBLE. Mất mẫu lâu phải hiệu chuẩn lại. Không học mẫu mắt mở trong pha che.
- Giữ nguyên ngưỡng tương quan cấu trúc 0,65 và điều kiện xác nhận mở mắt liên tục. Không nâng xác suất hoặc gán VISIBLE chỉ dựa vào pixel tối/độ mở mí.
- Pipeline train yêu cầu cận dưới Wilson 95% của accuracy, sensitivity và specificity đều vượt 90%, đồng thời các điểm ước lượng vượt 90% và không có người bị bỏ khỏi báo cáo. Trước đây chỉ accuracy có kiểm tra cận dưới CI.
- Khôi phục file kiểm thử `uncoverCapture.test.js` đã bị thay toàn bộ bằng NUL từ bản Git cuối còn đọc được (`dcf073f`), cập nhật fixture theo hợp đồng đang dùng: xác nhận mở liên tục, giới hạn gap 250 ms và frame/crop phải khớp timestamp nguồn.

## Giới hạn về CI và dữ liệu cần bổ sung

Sau xác nhận nhóm người, bộ dữ liệu có **7 người**. Kể cả giả sử toàn bộ nhãn đều đúng và dự đoán đúng 7/7, Wilson 95% CI accuracy vẫn là **64,57–100%**. Đây chỉ là ví dụ giới hạn cỡ mẫu, không phải hiệu năng đã đạt. Nhãn lâm sàng của sáu người bổ sung vẫn chưa được xác nhận.

Để cận dưới 95% CI của từng lớp vượt 90%, trường hợp lý tưởng hoàn toàn đúng cần ít nhất **35 người kiểm tra độc lập mỗi lớp**. Nếu giả định tỷ lệ đúng 95%, trường hợp cỡ mẫu khả thi đầu tiên là 140 người/lớp; đây là giả định lập kế hoạch, không bảo đảm hiệu năng và không thay thế thiết kế nghiên cứu. Cần tách thêm người cho train và validation, không dùng người test để chọn tham số.

`subject-label-review.csv` đã điền nhóm người và nhãn của ba clip iPhone theo xác nhận. `iphone-training-manifest.json` ánh xạ toàn bộ 17 sự kiện đó về một người NORMAL, giữ nguồn xác nhận, chưa tự chọn split hoặc suy đoán site/mirror. Bổ sung thông tin cho sáu clip còn lại, thiết bị, cơ sở và split để tiếp tục. Mô hình paired chưa được huấn luyện lại: audit vẫn trả `NEEDS_VERIFIED_PAIRED_SUBJECTS`, accuracy/CI giữ null vì chưa đủ người và nhóm bệnh độc lập.

**Đã train candidate nghiên cứu video riêng** theo yêu cầu tiếp tục với sáu nhãn thư mục. Đánh giá leave-one-subject-out đạt accuracy 57,14%, balanced accuracy 40%, specificity 0%; không đưa lên live. [Báo cáo và trọng số](video-research-training/README.md). Không nhầm kết quả này với mô hình paired live hoặc validation lâm sàng.

## Kiểm thử và tái lập

- `npm test`: 133 kiểm thử Node đạt, cùng 14 kiểm tra cơ bản của `runAllTests.js`.
- `python -m pytest scripts/cover_training_v3/test_evidence.py scripts/cover_training_v3/test_training.py -q`: 9 kiểm thử đạt.
- `npm run build`: thành công.
- `python scripts/extractIphoneCoverReplay.py --all`: giải mã toàn bộ video, có cache SHA-256.
- `node scripts/replayIphoneCover.mjs --tag=v4-after`: phát lại ba video iPhone, lưu trace có lý do UNKNOWN.
- `python scripts/cover_training_v3/audit_dataset.py --output docs/reports/cover-test-v4/dataset-audit.json`: kiểm kê dữ liệu và cỡ mẫu.
- `python scripts/cover_training_v3/train.py --manifest docs/reports/cover-test-v4/iphone-training-manifest.json --output docs/reports/cover-test-v4/training-audit --train`: kiểm tra điều kiện train với metadata đã xác nhận; chưa đủ người độc lập để tạo model.

`replay-comparison.json` lưu các chỉ số trước/sau và SHA-256 mã nguồn; `dataset-audit.json` lưu kiểm kê từng video. Các nguồn video không được tải lên dịch vụ bên ngoài.

Phương pháp: [Wilson CI — NIST](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm), [cross-validation theo nhóm — scikit-learn](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators-for-grouped-data).
