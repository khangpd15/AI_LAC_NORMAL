# So sánh bắt mắt và timestamp ở 30 FPS

> Cập nhật 23/10/2026: xem [đối chiếu desktop hiện tại](desktop/REPORT.md). COVER hiện đã tắt smoothing và loại timestamp trùng; các mô tả pipeline bên dưới là lịch sử ngày 20/10.

Ngày thực hiện: 20/10/2026. Phân tích bản mã đang làm việc sau sửa vùng mí của mô phỏng.

**Mô phỏng phản ứng với mí nhanh hơn bộ lọc của cover test trong phép thử này. Nhưng phản ứng nhanh không đồng nghĩa đo đúng thời điểm chuyển động mắt hơn. Cách ghi timestamp hiện tại của cả hai cần được phân biệt với thời gian khung hình gốc.**

## Phạm vi và phương pháp

- Đọc toàn bộ 6 video, tổng cộng **7.079 khung hình**, không bỏ khung để tiết kiệm xử lý.
- Video đầu tiên là 29,9972 FPS, các video còn lại là 30 FPS; timestamp giải mã tăng đơn điệu, khoảng cách khung hình khoảng 33,33 ms.
- Trích landmark một lần cho mỗi khung bằng **Python MediaPipe 0.10.14 FaceMesh, refine_landmarks=True**, cạnh dài tối đa 640 pixel. Sau đó đưa cùng landmark và timestamp gốc vào các hàm JavaScript thật của dự án:
  - Mô phỏng: `stabilizeSimulationLandmarks`, cấu hình mobile.
  - Cover test: `extractEyeFeatures`, `applySmoothing: true`, dùng One Euro hiện tại.
- Không chạy hai bộ nhận diện khác nhau. Đây là so sánh bộ lọc phía sau một nguồn FaceMesh chung.
- Không chạy toàn bộ React/browser pipeline, không đo hiệu năng Android/iOS, không tái tạo thao tác người khám hay giai đoạn che/bỏ che của giao thức.
- Độ trễ trong bảng là độ dịch nguyên khung tối ưu từ 0–10 khung, làm nhỏ nhất sai số bình phương so với FaceMesh chưa lọc. Tọa độ mí dùng điểm mí trên; hướng nhìn dùng vị trí iris chiếu lên trục hai khóe mắt, giảm ảnh hưởng tịnh tiến đầu. Chỉ dùng chuỗi có ít nhất 11 khung liên tục nhận diện được.
- Đây là độ trễ **tương đối với landmark gốc**, không phải sai số so với nhãn thủ công, thời điểm sinh lý thực hay tổng độ trễ camera đến màn hình. “0 khung” không chứng minh độ trễ bằng 0 ms.

## Kết quả trên từng video

| Video | Khung có FaceMesh | Trễ mí: mô phỏng / cover | Trễ hướng nhìn tương đối: mô phỏng / cover |
|---|---:|---:|---:|
| esotropia_1 | 4286/4286 (100%) | 0 / 3 khung | 0 / 2 khung |
| esotropia_2 | 100/372 (26,9%) | 0 / 3 khung | 2 / 2 khung |
| exotropia_1 | 562/562 (100%) | 0 / 2 khung | 1 / 2 khung |
| exotropia_2 | 243/304 (79,9%) | 0 / 3 khung | 0 / 1 khung |
| exotropia_3 | 574/759 (75,6%) | 0 / 2 khung | 0 / 0 khung |
| normal_1 | 796/796 (100%) | 0 / 3 khung | 1 / 1 khung |

Ở 30 FPS: 1 khung ≈ 33,3 ms; 2 khung ≈ 66,7 ms; 3 khung ≈ 100 ms.

Mí của mô phỏng dùng trực tiếp khung hiện tại; cover test làm mượt cả các điểm mí và khóe mắt nên có độ trễ 2–3 khung trong dữ liệu này. Với hướng nhìn tương đối, mô phỏng ít trễ hơn trong 3 video và ngang nhau trong 3 video. Không có cơ sở để kết luận mô phỏng chính xác hơn về vị trí mắt hay thời điểm bắt đầu chuyển động.

**Khung “có FaceMesh” không đồng nghĩa mắt nhìn thấy và đo được.** Hình đối chiếu ở `exotropia_1`, khoảng 3 giây, cho thấy FaceMesh vẫn đặt đường mắt lên dụng cụ che. Cả hai bộ lọc đều có thể tiếp tục xử lý tọa độ đó. Cần dùng trạng thái che mắt/khả năng nhìn thấy để loại khỏi phép đo. Các tên thư mục chỉ là tên dữ liệu do người dùng cung cấp, không phải chẩn đoán từ benchmark.

`esotropia_2` mất nhận diện phần lớn video; các kết quả trễ ở đó chỉ phản ánh đoạn còn bắt được mặt. Tỷ lệ blink/mask trong JSON chỉ là chẩn đoán hành vi ngưỡng, không phải độ chính xác, vì video chưa có nhãn che mắt và chớp mắt theo thời gian.

## Kiểm tra timestamp trong mã hiện tại

1. `useFaceMesh.js:214` truyền thời gian khung đã gửi, lấy `presentationTime` từ rVFC ở dòng 359. Đây là nền tảng tốt hơn thời gian nhận kết quả, nhưng là thời gian trình bày của trình duyệt, không mặc nhiên là thời điểm camera phơi sáng hay timestamp nội dung video.
2. `StrabismusSimulationPage.jsx:164` dùng `performance.now()` khi nhận kết quả để tính khoảng thời gian làm mượt. Độ dao động thời gian suy luận sẽ đi vào khoảng thời gian bộ lọc. Mô phỏng giữ cặp ảnh/landmark cùng nguồn, nhưng chưa có chuỗi timestamp đo chuyển động hoàn chỉnh.
3. `CoverTestStep.jsx:475–507` đọc lại `latestFeaturesRef.current` theo vòng `requestAnimationFrame`, gọi `createCoverFrame(..., now, elapsed)` và `processFrame(now, ...)`. Không kiểm tra timestamp của feature đã được lấy trước đó. Vì thế một kết quả camera có thể được ghi nhiều lần với thời gian mới; thời gian khung đã có trong `features.timestamp` không được dùng ở đây.
4. `screeningConfig.js:12–13` đặt nhịp lưu dataset là **15 Hz**, nên dữ liệu lưu không mặc nhiên giữ đủ độ phân giải thời gian 30 FPS.
5. `useEyeTracking.js:139` chỉ đồng bộ trạng thái React khoảng **10 Hz**, trong khi ref được cập nhật theo kết quả. Một lớp hiển thị dùng state có thể trông kém nhạy dù việc xử lý ref nhanh hơn.

Mô hình lịch gọi 10 giây, camera 30 FPS và màn hình 60 Hz, với cách đọc lại feature như trên, tạo khoảng 600 lần đọc từ 300 khung: **xấp xỉ 50% lượt đọc trùng nguồn**. Đây là thí nghiệm lịch gọi có kiểm soát, không phải tỷ lệ đo trực tiếp trên điện thoại.

Trong kịch bản giả lập thời gian suy luận 40 ms, sai lệch giữa thời gian ghi và timestamp nguồn lên tới khoảng 66,7 ms. Không dùng con số này làm dự đoán độ trễ cho thiết bị cụ thể.

## Hướng phù hợp cho cover test trên điện thoại

- Dùng timestamp của chính khung camera và giữ nguyên qua toàn bộ suy luận → feature → mẫu đo; lưu thời gian nhận kết quả riêng để đo latency.
- Giữ cả `mediaTime`/PTS (khi đọc file), frame ID và timestamp monotonic được ánh xạ cùng đồng hồ với các giai đoạn giao thức. Không trộn trực tiếp thời gian tương đối của video với `performance.now()` hay `Date.now()`.
- Mỗi frame ID chỉ được ghi một lần. Giữ riêng dữ liệu khung gốc, dữ liệu làm mượt cho hiển thị và bản downsample dùng xuất dataset.
- Lưu các khung thực sự xử lý được ở nhịp nguồn tối đa 30 FPS cho phân tích thời gian, thay vì tạo mẫu mới từ feature cũ. Nếu thực tế chỉ xử lý được 15 FPS, phải thể hiện khoảng cách khung khoảng 66,7 ms và số khung bỏ.
- Không lấy mốc chuyển động trực tiếp từ đường mí/iris đã làm mượt mà chưa lượng hóa độ trễ. Cần nhãn thủ công thời điểm bỏ che và mắt bắt đầu chuyển động để đo sai số onset.
- Giữ kiểm tra che mắt và chất lượng khi dùng cơ chế bám nhanh của mô phỏng.

**Kết luận lựa chọn:** mô phỏng hiện tại phù hợp hơn cho cảm giác bám mí tức thời. Cover test có điểm xuất phát tốt hơn về timestamp ở đầu pipeline nhờ rVFC, nhưng đường ghi mẫu hiện tại làm mất lợi thế đó. Muốn đo thời điểm ở 30 FPS, ưu tiên sửa cách giữ timestamp và loại mẫu trùng trước khi chọn bộ lọc.

## Bằng chứng và cách chạy lại

- `comparison.webm`: 48 giây, 30 FPS; mỗi video lấy đoạn 2–10 giây. Ba cột: FaceMesh gốc, mô phỏng, cover test. Chỉ vẽ landmark, không làm lệch mắt bằng hiệu ứng.
- `preview.jpg`: khung đối chiếu tại khoảng 3 giây của từng video.
- `gaze-traces.png`: toàn bộ quỹ đạo iris trái tương đối theo timestamp nguồn.
- `results.json`, `results.csv`: số liệu đầy đủ. Thời gian suy luận native trong JSON không đại diện hiệu năng trình duyệt/điện thoại.
- `python scripts/extractTrackingBenchmark.py`
- `node scripts/compareTrackingBenchmark.mjs`
- `python scripts/renderTrackingBenchmark.py`

Landmark trung gian được lưu cục bộ trong `tracking-benchmark.local/` (đã khớp quy tắc bỏ qua Git `*.local`). Không tải video lên dịch vụ ngoài. Lượt so sánh này chỉ thêm công cụ/báo cáo, chưa đổi logic cover test trong ứng dụng.
