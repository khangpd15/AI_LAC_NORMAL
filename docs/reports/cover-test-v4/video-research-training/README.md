# Lần train nghiên cứu với 6 người bổ sung

Đã train mô hình thực sự từ 9 video, 7 nhóm người theo xác nhận của người dùng: ba video iPhone thuộc `IPHONE_SUBJECT_001`; sáu video còn lại thuộc sáu người khác nhau. Nhãn NORMAL của nhóm iPhone được bác sĩ xác nhận theo lời người dùng. Sáu nhãn còn lại dùng tên thư mục làm **nhãn yếu**, không ghi thành nhãn lâm sàng đã xác minh.

## Mô hình và cách đánh giá

- Đặc trưng video offline: HOG từ pixel hai vùng mắt mở có tương phản, tọa độ mống mắt theo hệ trục khóe mắt, phân bố dịch chuyển hai mắt và tốc độ chỉ qua các khoảng nguồn ≤100 ms. Không nội suy qua mất bám; không đưa tên video, nhãn thư mục, FPS, thiết bị hoặc mã người vào vector đặc trưng.
- 408 đặc trưng; StandardScaler + LogisticRegression, C=0,01, ngưỡng 0,5 cố định. Không thử nhiều tham số để chọn theo điểm test.
- Leave-one-subject-out: 7 lượt, mỗi lượt giữ toàn bộ video của một người ở ngoài train. Cả ba video iPhone luôn cùng split. Scaler chỉ fit trong fold train; trọng số cân bằng theo người và lớp, không nhân ba trọng số người iPhone.
- Mỗi người có một dự đoán đánh giá, trung bình xác suất nếu có nhiều clip. Clip/người thiếu đặc trưng không bị âm thầm xóa khỏi mẫu đánh giá.
- Trọng số cuối fit trên tất cả dữ liệu chỉ để lưu candidate. Điểm trong báo cáo là dự đoán ngoài fold, không phải điểm fit lại trên train.

| Chỉ số ngoài fold, theo nhãn nghiên cứu | Kết quả |
|---|---:|
| Số người | 7: 2 NORMAL, 5 STRABISMUS |
| Accuracy | 57,14% = 4/7 |
| Balanced accuracy | 40% |
| Sensitivity | 80% = 4/5 |
| Specificity | 0% = 0/2 |
| Khoảng Wilson 95% mô tả cho accuracy | 25,05–84,18% |
| Tỷ lệ người có dự đoán | 100% |

Mốc so sánh luôn đoán STRABISMUS đạt accuracy 71,43%, balanced accuracy 50% trên đúng phân bố nhãn này. Candidate hiện tại còn yếu hơn mốc đơn giản đó; **không đạt để thay mô hình ứng dụng**. Đã xác minh tải lại trọng số cho xác suất giống mô hình vừa fit.

Khoảng Wilson ở đây chỉ mô tả 7 dự đoán theo nhóm người; các fold dùng tập train chồng lấn, nhãn yếu và tập rất nhỏ. Không coi đây là CI xác thực ngoài độc lập hoặc hiệu năng lâm sàng. Không dùng kết quả test này để chọn lại C hoặc ngưỡng rồi công bố như tập test mới.

## Artifact và tái lập

- `video_research_candidate.joblib`: pipeline đã fit, `clinicalValidation=false`, `promoted=false`.
- `training_report.json`: chi tiết từng người, danh sách người train/giữ ngoài mỗi fold, chất lượng từng video, SHA-256 nguồn/mã và điểm so sánh.
- `../subject-label-review.csv`: các nhóm người đã cập nhật; nguồn nhãn không bị nâng cấp.

Chạy từ thư mục dự án:

```powershell
python -B scripts/cover_training_v3/train_video_research.py --review docs/reports/cover-test-v4/subject-label-review.csv --output docs/reports/cover-test-v4/video-research-training
python -B -m pytest scripts/cover_training_v3/test_video_research.py scripts/cover_training_v3/test_evidence.py scripts/cover_training_v3/test_training.py -q
```

Hợp đồng đầu vào là **đặc trưng video offline**, khác hợp đồng crop/sự kiện live của backend. Không tự thay trọng số live, không thay xác suất trên giao diện và không xuất kết luận bệnh từ candidate này. Phần còn thiếu để cải thiện khả năng tổng quát là thêm người NORMAL và người có nhãn lâm sàng đa dạng, cùng các mốc cover/uncover đã được gán nhãn.
