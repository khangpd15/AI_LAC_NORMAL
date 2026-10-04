# NCKH — Kế hoạch xây dựng RemiCare Strabismus AI

Ngày soạn: 03/10/2026. Phạm vi: front-end, back-end, dữ liệu nghiên cứu và pipeline huấn luyện AI cho sàng lọc lác ngang.

**Đây là tài liệu kế hoạch triển khai, không phải báo cáo đã hoàn thành hệ thống hoặc đã kiểm chứng lâm sàng.** Lần làm việc này chỉ đọc mã nguồn và tạo tài liệu; không sửa ứng dụng, thay model, chạy train, migration hoặc triển khai production. Nội dung yêu cầu đính kèm là đặc tả đầu vào; các phase bên dưới là công việc tương lai, thực hiện tuần tự và chờ duyệt sau mỗi phase.

## 1. Mục tiêu đề tài và sản phẩm đầu ra# VAI TRÒ
Bạn là Senior Full-stack + Computer Vision/ML Engineer. Dự án RemiCare Strabismus AI (web, đang chạy production).
Công cụ SÀNG LỌC nghiên cứu, KHÔNG phải chẩn đoán.

# PHẠM VI CỐ ĐỊNH
- Chỉ LÁC NGANG (esotropia/exotropia). Lác đứng/xoắn/liệt dây thần kinh/rung giật/sụp mi → UNSUITABLE_FOR_SCREENING.
- Trẻ ≥ 7 tuổi (giới hạn tuổi nằm trong config). Web, camera sau, điện thoại cố định trên giá đỡ, người lớn hỗ trợ che mắt.
- Quy trình: Hirschberg (ảnh tĩnh) + Cover-Uncover (chuỗi thời gian). Giai đoạn nghiên cứu: chạy cả hai cho mọi người tham gia.

# QUY TẮC TỐI CAO
1. Chỉ dựa trên code/dữ liệu thực tế. Không có bằng chứng → ghi "UNKNOWN", không đoán.
2. Mọi nhận định kèm dẫn chứng `đường_dẫn:số_dòng`.
3. Chỉ sửa đúng phạm vi phase đang làm. Không refactor, không đổi tên, không tiện tay cải tiến.
4. Ngưỡng chưa có nguồn / quyết định lâm sàng / điểm mơ hồ → DỪNG và hỏi. Mọi ngưỡng để trong config, mặc định `TODO_PILOT`.
5. Làm tuần tự. Hết mỗi phase: báo cáo ngắn rồi CHỜ tôi duyệt.
6. Không phá production: `POST /predict` và model hiện tại giữ nguyên; tính năng mới chạy song song sau feature flag.

# KHÔNG ĐƯỢC
- Retrain/thay model production, đổi threshold, đổi thứ tự/số feature của model hiện tại; pad/truncate/reshape feature.
- Coi checkbox người dùng tự tick là điều kiện đã đạt.
- Hard-code hệ số PD/mm, khoảng cách, hay ngưỡng lâm sàng.
- Giả định FPS cố định; dùng frame index thay timestamp.
- Ép kết quả kém chất lượng thành NORMAL (phải INCONCLUSIVE). Lỗi hệ thống → SYSTEM_ERROR, không bao giờ NORMAL.
- Gọi output là chẩn đoán; nhận diện bệnh mắt khác.
- Dùng feature hình dáng mắt/khoảng cách mắt–mũi (tránh nhầm lác giả do epicanthus).
- Dùng dữ liệu production để train mặc định; lưu ảnh mặt không cần thiết; log ảnh mặt.
- Tạo thêm endpoint/bảng/abstraction ngoài yêu cầu.

# QUY ƯỚC DỮ LIỆU
- Chỉ trục ngang (x). Bỏ feature trục y trong pipeline mới.
- Dấu theo mũi/thái dương, KHÔNG theo trái/phải của ảnh: `+` = về phía mũi, `−` = về phía thái dương.
- Điểm tham chiếu: TÂM MỐNG MẮT (iris/limbus), không dùng tâm đồng tử.
- Hirschberg, đại lượng chính mỗi mắt: `(reflex_x − iris_center_x) / iris_diameter` theo dấu mũi/thái dương; thêm hiệu giữa hai mắt (triệt tiêu một phần angle kappa và yaw). Lưu giá trị thô (px); KHÔNG quy đổi sang PD/độ.
- Cover: timestamp thực của frame (`requestVideoFrameCallback` nếu có); mốc che/mở lấy từ DỮ LIỆU (mống mắt bị che/hiện lại), không lấy thời điểm UI hiện lệnh. Bù chuyển động đầu: đo iris_x tương đối với khóe mắt trong/ngoài, chuẩn hóa theo chiều rộng khe mắt.
- Mắt bị che = OCCLUDED, không phải bất thường; chỉ theo dõi mắt còn lại.
- `possible_inward/possible_outward` chỉ là thông tin phụ, không phải chẩn đoán loại lác.
- Nhãn cuối: SCREENING_NORMAL | REVIEW_REQUIRED | INCONCLUSIVE | QUALITY_FAIL | SYSTEM_ERROR. Ranh giới nhãn và bảng chân lý H×C×quality chưa có → hỏi tôi, không tự quyết.
- Giới hạn phải ghi trong UI/tài liệu: Hirschberg bình thường không loại trừ lác (nhất là lác ngoài ngắt quãng, góc nhỏ); nhìn gần có thể che khuất lác ngoài ngắt quãng.

# PHASE 0 — RECON (chỉ đọc)
Đọc frontend (luồng sàng lọc, camera, MediaPipe, UI) và backend (API, feature, model, DB). Tạo `RECON.md`: luồng hiện tại, file liên quan, framework UI, cách gọi `getUserMedia`, model hiện tại (input_dimension, feature_version, threshold), file SẼ sửa / KHÔNG sửa. → DỪNG.

# PHASE 1 — DATASET AUDIT (chỉ đọc)
Tôi có tập ảnh có nhãn loại lác nhưng KHÔNG chụp theo protocol Hirschberg; chưa có dữ liệu Cover. Hãy:
1. Quét thư mục ảnh, báo cáo: số ảnh, độ phân giải, có ID người không, các nhãn và phân bố, có ảnh người không lác không, ảnh nào thấy chấm phản xạ rõ.
2. Gắn cờ domain = "legacy_non_hirschberg" cho toàn bộ tập.
3. Cảnh báo nếu lớp lác và lớp bình thường đến từ nguồn/máy/ánh sáng khác nhau (nguy cơ học khác biệt nguồn).
4. Loại khỏi phạm vi nhãn không phải lác ngang.
5. KHÔNG dùng tập này để chọn ngưỡng độ dịch reflex, KHÔNG train model Hirschberg, KHÔNG báo sensitivity/specificity từ nó. Chỉ dùng cho: phát triển/kiểm tra bộ phát hiện mặt–mống mắt, kiểm tra quality gate, phân tích thăm dò (ghi "exploratory, không phải bằng chứng lâm sàng").
6. Thiếu thông tin (ai gán nhãn, thời điểm khám, consent) → ghi UNKNOWN và hỏi tôi. → DỪNG.

# PHASE 2 — CHECKLIST + LUỒNG BẬT CAMERA (frontend)
Khi bấm "Sàng lọc", hiện checklist TRƯỚC khi xin quyền camera. Mỗi màn hình một việc, chữ lớn, có hình minh họa, ngôn ngữ cho phụ huynh:
 1. Consent phụ huynh/người giám hộ + tuổi (ngoài khoảng cho phép → chặn) + câu hỏi red flag (danh sách do bác sĩ cung cấp; chưa có → placeholder và hỏi tôi). Có red flag → dừng, hướng dẫn đi khám, không chạy test.
 2. Trẻ có đeo kính không (lưu `glasses_on`; chế độ cho phép do bác sĩ quyết, chưa có → hỏi).
 3. "Bạn đã cố định điện thoại chưa?" (giá đỡ/tripod, camera sau).
 4. "Vui lòng ngồi thẳng lưng, đầu song song với điện thoại."
 5. Nguồn sáng, tách theo thiết bị (phát hiện OS + kiểm tra năng lực thực tế):
    - Android + trình duyệt hỗ trợ torch (`track.getCapabilities().torch`): hướng dẫn "Hãy bật đèn" và bật bằng `applyConstraints`. Torch không khả dụng/lỗi → chuyển nhánh đèn ngoài.
    - iOS hoặc torch không khả dụng: "Hãy tìm một chiếc đèn nhỏ chiếu từ phía sau điện thoại, đặt sát camera, hướng vào mặt trẻ, độ sáng vừa". Không dùng ring light/đèn khuếch tán lớn (cần phản xạ là một chấm nhỏ).
 6. Target nhìn: vật nhỏ dán sát ống kính (màn hình quay về phía người lớn, không hiển thị target cho trẻ).
 7. Người lớn sẵn sàng che mắt (tự khai).
Quy tắc: câu trả lời được LƯU làm metadata (`selfReported`) nhưng KHÔNG thay quality gate. Mục xác minh tự động được thì xác minh ở Phase 3; fail → chặn chụp và nói rõ cần sửa gì. Giới hạn số lần thử lại (config, TODO_PILOT) → hết lượt thì INCONCLUSIVE.
Camera: `facingMode: environment`, xin độ phân giải cao nhất khả dụng, ghi `imageWidth/Height`, từ chối thiết bị dưới mức tối thiểu (config). Lưu device/browser/os. Giữ luồng cũ sau feature flag. → DỪNG (kèm mô tả/ảnh chụp UI).

# PHASE 3 — AI DETECT Ở FRONTEND (quality gate, KHÔNG phải kết quả)
Client chỉ làm quality gate với ngưỡng NỚI; không tính feature chẩn đoán ở client (tránh lệch JS/Python). Trạng thái GOOD / WARNING / INVALID cho từng mục:
 - Có mặt; hai mắt + hai mống mắt thấy rõ; không bị tóc/mi/tay che.
 - Head pose: yaw chặt nhất (yaw giả lập lác ngang), pitch/roll nới hơn.
 - Khoảng cách: mục tiêu 20–25 cm là GIẢ THUYẾT pilot (config, TODO_PILOT), ước lượng từ đường kính mống mắt, ghi rõ sai số (~10%). KHÔNG hard-code.
 - Độ nét là điều kiện bắt buộc ở cự ly gần; từ chối thiết bị không lấy nét được ở khoảng cách mục tiêu. Kiểm tra thêm phơi sáng, kích thước ảnh, ngược sáng.
 - Nguồn sáng: có đúng 1 điểm sáng nhỏ bão hòa trong vùng mống mắt của CẢ HAI mắt, không có phản xạ phụ (cửa sổ/đèn phòng/kính). Đây là module CV MỚI (MediaPipe không cung cấp corneal reflex); ở client chỉ cần có/không + vị trí thô.
 - Ổn định điện thoại/fixation: độ ổn định landmark trong vài giây.
 - Cover: state machine INITIALIZING → READY → BASELINE → COVER_OD → UNCOVER_OD → COVER_OS → UNCOVER_OS → DONE; mắt bị che = OCCLUDED; thời lượng từng pha lấy từ config (chưa có số bác sĩ xác nhận → hỏi).
Gửi backend: ảnh Hirschberg GỐC chất lượng cao (JPEG nén nhẹ) + metadata; Cover gửi chuỗi {timestamp thực, iris_x, eye_corner, visibility, phase}.
Metadata mỗi ảnh: distance_estimate_cm (kèm sai số), distance_bucket, device, camera_used (main/ultrawide nếu biết), focus score, light_offset_note, lighting {source: torch|external, reflexCountPerEye}.
Mọi ngưỡng ở config, ghi nguồn hoặc TODO_PILOT. → DỪNG.

# PHASE 4 — BACKEND: ĐO HÌNH HỌC + COVER (giữ model cũ)
 - Endpoint mới tối thiểu (hoặc mở rộng có phiên bản), KHÔNG đổi `/predict`. Request có schemaVersion, featureVersion, testType (HIRSCHBERG|COVER), sessionId, distance_bucket. Validate bằng schema: thiếu/sai landmark, NaN/Infinity, ảnh sai định dạng, payload quá lớn, timestamp lùi/trùng/gap lớn, thiếu pha, tuổi ngoài khoảng, red flag.
 - Hirschberg: phát hiện iris + corneal reflex trên ảnh gốc ở SERVER (một implementation duy nhất), tính độ dịch chuẩn hóa theo quy ước, so sánh hai mắt. Reflex không thấy / nhiều reflex → INCONCLUSIVE. Ngưỡng gắn theo distance_bucket, không dùng chung giữa các bucket. Chưa có nhãn lâm sàng đúng protocol → KHÔNG chốt ngưỡng (TODO_PILOT).
 - Cover: rule-based, ngưỡng TODO_PILOT, kết quả gắn nhãn EXPERIMENTAL, KHÔNG dùng để cho SCREENING_NORMAL (chỉ được hỗ trợ cờ REVIEW_REQUIRED hoặc ghi dữ liệu). Chuyển động chỉ tính khi baseline ổn định + chất lượng tốt + timestamp hợp lệ + biên độ vượt ngưỡng đã hiệu chuẩn. Tính biên độ, hướng, vận tốc = Δvị trí/Δt thực, độ trễ, thời gian ổn định. Gap lớn → frame_valid=false, không tính xuyên gap.
 - Quality-aware: nhận score, validFrameRatio, trackingConfidence, fps, blinkRatio, occlusionRatio; dưới ngưỡng (config) → INCONCLUSIVE/QUALITY_FAIL.
 - Tổng hợp H + C bằng rule-based theo bảng chân lý TÔI DUYỆT; không weighted average.
 - Log mỗi kết quả: requestId, sessionId, schema/feature/model/preprocessing version, timestamp, latency, quality, result. Lỗi chuẩn hóa (INVALID_REQUEST, INVALID_LANDMARKS, TIMESERIES_INVALID, LOW_QUALITY_INPUT, FEATURE_CONTRACT_MISMATCH, INFERENCE_ERROR...) không lộ stack trace.
 - Model hiện tại tiếp tục chạy; feature mới KHÔNG đưa vào model production. Trước inference: feature count == model input, lệch → FEATURE_CONTRACT_MISMATCH. Model load một lần lúc startup; có `GET /health`.
 - Test Cover bằng chuỗi tín hiệu tổng hợp (chỉ để test code, không phải bằ# VAI TRÒ
Bạn là Senior Full-stack + Computer Vision/ML Engineer. Dự án RemiCare Strabismus AI (web, đang chạy production).
Công cụ SÀNG LỌC nghiên cứu, KHÔNG phải chẩn đoán.

# PHẠM VI CỐ ĐỊNH# VAI TRÒ
Bạn là Senior Full-stack + Computer Vision/ML Engineer. Dự án RemiCare Strabismus AI (web, đang chạy production).
Công cụ SÀNG LỌC nghiên cứu, KHÔNG phải chẩn đoán.

# PHẠM VI CỐ ĐỊNH
- Chỉ LÁC NGANG (esotropia/exotropia). Lác đứng/xoắn/liệt dây thần kinh/rung giật/sụp mi → UNSUITABLE_FOR_SCREENING.
- Trẻ ≥ 7 tuổi (giới hạn tuổi nằm trong config). Web, camera sau, điện thoại cố định trên giá đỡ, người lớn hỗ trợ che mắt.
- Quy trình: Hirschberg (ảnh tĩnh) + Cover-Uncover (chuỗi thời gian). Giai đoạn nghiên cứu: chạy cả hai cho mọi người tham gia.

# QUY TẮC TỐI CAO
1. Chỉ dựa trên code/dữ liệu thực tế. Không có bằng chứng → ghi "UNKNOWN", không đoán.
2. Mọi nhận định kèm dẫn chứng `đường_dẫn:số_dòng`.
3. Chỉ sửa đúng phạm vi phase đang làm. Không refactor, không đổi tên, không tiện tay cải tiến.
4. Ngưỡng chưa có nguồn / quyết định lâm sàng / điểm mơ hồ → DỪNG và hỏi. Mọi ngưỡng để trong config, mặc định `TODO_PILOT`.
5. Làm tuần tự. Hết mỗi phase: báo cáo ngắn rồi CHỜ tôi duyệt.
6. Không phá production: `POST /predict` và model hiện tại giữ nguyên; tính năng mới chạy song song sau feature flag.

# KHÔNG ĐƯỢC
- Retrain/thay model production, đổi threshold, đổi thứ tự/số feature của model hiện tại; pad/truncate/reshape feature.
- Coi checkbox người dùng tự tick là điều kiện đã đạt.
- Hard-code hệ số PD/mm, khoảng cách, hay ngưỡng lâm sàng.
- Giả định FPS cố định; dùng frame index thay timestamp.
- Ép kết quả kém chất lượng thành NORMAL (phải INCONCLUSIVE). Lỗi hệ thống → SYSTEM_ERROR, không bao giờ NORMAL.
- Gọi output là chẩn đoán; nhận diện bệnh mắt khác.
- Dùng feature hình dáng mắt/khoảng cách mắt–mũi (tránh nhầm lác giả do epicanthus).
- Dùng dữ liệu production để train mặc định; lưu ảnh mặt không cần thiết; log ảnh mặt.
- Tạo thêm endpoint/bảng/abstraction ngoài yêu cầu.

# QUY ƯỚC DỮ LIỆU
- Chỉ trục ngang (x). Bỏ feature trục y trong pipeline mới.
- Dấu theo mũi/thái dương, KHÔNG theo trái/phải của ảnh: `+` = về phía mũi, `−` = về phía thái dương.
- Điểm tham chiếu: TÂM MỐNG MẮT (iris/limbus), không dùng tâm đồng tử.
- Hirschberg, đại lượng chính mỗi mắt: `(reflex_x − iris_center_x) / iris_diameter` theo dấu mũi/thái dương; thêm hiệu giữa hai mắt (triệt tiêu một phần angle kappa và yaw). Lưu giá trị thô (px); KHÔNG quy đổi sang PD/độ.
- Cover: timestamp thực của frame (`requestVideoFrameCallback` nếu có); mốc che/mở lấy từ DỮ LIỆU (mống mắt bị che/hiện lại), không lấy thời điểm UI hiện lệnh. Bù chuyển động đầu: đo iris_x tương đối với khóe mắt trong/ngoài, chuẩn hóa theo chiều rộng khe mắt.
- Mắt bị che = OCCLUDED, không phải bất thường; chỉ theo dõi mắt còn lại.
- `possible_inward/possible_outward` chỉ là thông tin phụ, không phải chẩn đoán loại lác.
- Nhãn cuối: SCREENING_NORMAL | REVIEW_REQUIRED | INCONCLUSIVE | QUALITY_FAIL | SYSTEM_ERROR. Ranh giới nhãn và bảng chân lý H×C×quality chưa có → hỏi tôi, không tự quyết.
- Giới hạn phải ghi trong UI/tài liệu: Hirschberg bình thường không loại trừ lác (nhất là lác ngoài ngắt quãng, góc nhỏ); nhìn gần có thể che khuất lác ngoài ngắt quãng.

# PHASE 0 — RECON (chỉ đọc)
Đọc frontend (luồng sàng lọc, camera, MediaPipe, UI) và backend (API, feature, model, DB). Tạo `RECON.md`: luồng hiện tại, file liên quan, framework UI, cách gọi `getUserMedia`, model hiện tại (input_dimension, feature_version, threshold), file SẼ sửa / KHÔNG sửa. → DỪNG.

# PHASE 1 — DATASET AUDIT (chỉ đọc)
Tôi có tập ảnh có nhãn loại lác nhưng KHÔNG chụp theo protocol Hirschberg; chưa có dữ liệu Cover. Hãy:
1. Quét thư mục ảnh, báo cáo: số ảnh, độ phân giải, có ID người không, các nhãn và phân bố, có ảnh người không lác không, ảnh nào thấy chấm phản xạ rõ.
2. Gắn cờ domain = "legacy_non_hirschberg" cho toàn bộ tập.
3. Cảnh báo nếu lớp lác và lớp bình thường đến từ nguồn/máy/ánh sáng khác nhau (nguy cơ học khác biệt nguồn).
4. Loại khỏi phạm vi nhãn không phải lác ngang.
5. KHÔNG dùng tập này để chọn ngưỡng độ dịch reflex, KHÔNG train model Hirschberg, KHÔNG báo sensitivity/specificity từ nó. Chỉ dùng cho: phát triển/kiểm tra bộ phát hiện mặt–mống mắt, kiểm tra quality gate, phân tích thăm dò (ghi "exploratory, không phải bằng chứng lâm sàng").
6. Thiếu thông tin (ai gán nhãn, thời điểm khám, consent) → ghi UNKNOWN và hỏi tôi. → DỪNG.

# PHASE 2 — CHECKLIST + LUỒNG BẬT CAMERA (frontend)
Khi bấm "Sàng lọc", hiện checklist TRƯỚC khi xin quyền camera. Mỗi màn hình một việc, chữ lớn, có hình minh họa, ngôn ngữ cho phụ huynh:
 1. Consent phụ huynh/người giám hộ + tuổi (ngoài khoảng cho phép → chặn) + câu hỏi red flag (danh sách do bác sĩ cung cấp; chưa có → placeholder và hỏi tôi). Có red flag → dừng, hướng dẫn đi khám, không chạy test.
 2. Trẻ có đeo kính không (lưu `glasses_on`; chế độ cho phép do bác sĩ quyết, chưa có → hỏi).
 3. "Bạn đã cố định điện thoại chưa?" (giá đỡ/tripod, camera sau).
 4. "Vui lòng ngồi thẳng lưng, đầu song song với điện thoại."
 5. Nguồn sáng, tách theo thiết bị (phát hiện OS + kiểm tra năng lực thực tế):
    - Android + trình duyệt hỗ trợ torch (`track.getCapabilities().torch`): hướng dẫn "Hãy bật đèn" và bật bằng `applyConstraints`. Torch không khả dụng/lỗi → chuyển nhánh đèn ngoài.
    - iOS hoặc torch không khả dụng: "Hãy tìm một chiếc đèn nhỏ chiếu từ phía sau điện thoại, đặt sát camera, hướng vào mặt trẻ, độ sáng vừa". Không dùng ring light/đèn khuếch tán lớn (cần phản xạ là một chấm nhỏ).
 6. Target nhìn: vật nhỏ dán sát ống kính (màn hình quay về phía người lớn, không hiển thị target cho trẻ).
 7. Người lớn sẵn sàng che mắt (tự khai).
Quy tắc: câu trả lời được LƯU làm metadata (`selfReported`) nhưng KHÔNG thay quality gate. Mục xác minh tự động được thì xác minh ở Phase 3; fail → chặn chụp và nói rõ cần sửa gì. Giới hạn số lần thử lại (config, TODO_PILOT) → hết lượt thì INCONCLUSIVE.
Camera: `facingMode: environment`, xin độ phân giải cao nhất khả dụng, ghi `imageWidth/Height`, từ chối thiết bị dưới mức tối thiểu (config). Lưu device/browser/os. Giữ luồng cũ sau feature flag. → DỪNG (kèm mô tả/ảnh chụp UI).

# PHASE 3 — AI DETECT Ở FRONTEND (quality gate, KHÔNG phải kết quả)
Client chỉ làm quality gate với ngưỡng NỚI; không tính feature chẩn đoán ở client (tránh lệch JS/Python). Trạng thái GOOD / WARNING / INVALID cho từng mục:
 - Có mặt; hai mắt + hai mống mắt thấy rõ; không bị tóc/mi/tay che.
 - Head pose: yaw chặt nhất (yaw giả lập lác ngang), pitch/roll nới hơn.
 - Khoảng cách: mục tiêu 20–25 cm là GIẢ THUYẾT pilot (config, TODO_PILOT), ước lượng từ đường kính mống mắt, ghi rõ sai số (~10%). KHÔNG hard-code.
 - Độ nét là điều kiện bắt buộc ở cự ly gần; từ chối thiết bị không lấy nét được ở khoảng cách mục tiêu. Kiểm tra thêm phơi sáng, kích thước ảnh, ngược sáng.
 - Nguồn sáng: có đúng 1 điểm sáng nhỏ bão hòa trong vùng mống mắt của CẢ HAI mắt, không có phản xạ phụ (cửa sổ/đèn phòng/kính). Đây là module CV MỚI (MediaPipe không cung cấp corneal reflex); ở client chỉ cần có/không + vị trí thô.
 - Ổn định điện thoại/fixation: độ ổn định landmark trong vài giây.
 - Cover: state machine INITIALIZING → READY → BASELINE → COVER_OD → UNCOVER_OD → COVER_OS → UNCOVER_OS → DONE; mắt bị che = OCCLUDED; thời lượng từng pha lấy từ config (chưa có số bác sĩ xác nhận → hỏi).
Gửi backend: ảnh Hirschberg GỐC chất lượng cao (JPEG nén nhẹ) + metadata; Cover gửi chuỗi {timestamp thực, iris_x, eye_corner, visibility, phase}.
Metadata mỗi ảnh: distance_estimate_cm (kèm sai số), distance_bucket, device, camera_used (main/ultrawide nếu biết), focus score, light_offset_note, lighting {source: torch|external, reflexCountPerEye}.
Mọi ngưỡng ở config, ghi nguồn hoặc TODO_PILOT. → DỪNG.

# PHASE 4 — BACKEND: ĐO HÌNH HỌC + COVER (giữ model cũ)
 - Endpoint mới tối thiểu (hoặc mở rộng có phiên bản), KHÔNG đổi `/predict`. Request có schemaVersion, featureVersion, testType (HIRSCHBERG|COVER), sessionId, distance_bucket. Validate bằng schema: thiếu/sai landmark, NaN/Infinity, ảnh sai định dạng, payload quá lớn, timestamp lùi/trùng/gap lớn, thiếu pha, tuổi ngoài khoảng, red flag.
 - Hirschberg: phát hiện iris + corneal reflex trên ảnh gốc ở SERVER (một implementation duy nhất), tính độ dịch chuẩn hóa theo quy ước, so sánh hai mắt. Reflex không thấy / nhiều reflex → INCONCLUSIVE. Ngưỡng gắn theo distance_bucket, không dùng chung giữa các bucket. Chưa có nhãn lâm sàng đúng protocol → KHÔNG chốt ngưỡng (TODO_PILOT).
 - Cover: rule-based, ngưỡng TODO_PILOT, kết quả gắn nhãn EXPERIMENTAL, KHÔNG dùng để cho SCREENING_NORMAL (chỉ được hỗ trợ cờ REVIEW_REQUIRED hoặc ghi dữ liệu). Chuyển động chỉ tính khi baseline ổn định + chất lượng tốt + timestamp hợp lệ + biên độ vượt ngưỡng đã hiệu chuẩn. Tính biên độ, hướng, vận tốc = Δvị trí/Δt thực, độ trễ, thời gian ổn định. Gap lớn → frame_valid=false, không tính xuyên gap.
 - Quality-aware: nhận score, validFrameRatio, trackingConfidence, fps, blinkRatio, occlusionRatio; dưới ngưỡng (config) → INCONCLUSIVE/QUALITY_FAIL.
 - Tổng hợp H + C bằng rule-based theo bảng chân lý TÔI DUYỆT; không weighted average.
 - Log mỗi kết quả: requestId, sessionId, schema/feature/model/preprocessing version, timestamp, latency, quality, result. Lỗi chuẩn hóa (INVALID_REQUEST, INVALID_LANDMARKS, TIMESERIES_INVALID, LOW_QUALITY_INPUT, FEATURE_CONTRACT_MISMATCH, INFERENCE_ERROR...) không lộ stack trace.
 - Model hiện tại tiếp tục chạy; feature mới KHÔNG đưa vào model production. Trước inference: feature count == model input, lệch → FEATURE_CONTRACT_MISMATCH. Model load một lần lúc startup; có `GET /health`.
 - Test Cover bằng chuỗi tín hiệu tổng hợp (chỉ để test code, không phải bằng chứng lâm sàng) và video người bình thường (đo tỉ lệ báo động giả). → DỪNG.

# PHASE 5 — THU DỮ LIỆU + PIPELINE TRAIN (chuẩn bị, KHÔNG train)
 - Chế độ thu dữ liệu tách khỏi production, chỉ khi có consent riêng. Cấu trúc: Participant → Hirschberg {ảnh, quality, iris, reflex, metadata, lighting, glasses, distance_bucket} + Cover {pha, landmarks, timestamps, quality}; ưu tiên lưu video/landmark thô nếu consent cho phép để chạy lại thuật toán phiên bản mới.
 - "Distance experiment mode": thu ảnh nhiều bucket trên cùng người; xuất báo cáo tỉ lệ nét, tỉ lệ đúng 1 reflex/mắt, độ lặp lại, phân bố độ dịch theo bucket. KHÔNG tự chọn khoảng cách chuẩn; báo cáo để tôi quyết định.
 - Trường nhãn ground truth từ bác sĩ/orthoptist (loại lác ngang, ngắt quãng hay không, nhóm kính, lác giả, phương pháp khám, ngày khám); KHÔNG dùng output model làm nhãn.
 - Script train tái lập: lưu seed, dataset version, feature version, hyperparameter, ngày, artifact, metrics. Split THEO BỆNH NHÂN. Metrics: sensitivity, specificity, PPV, NPV, ROC-AUC, PR-AUC, confusion matrix; đo độ lệch: MAE, RMSE, bias, Bland–Altman.
 - Model registry có metadata (version, featureVersion, inputDimension, threshold, preprocessingVersion, metrics; chưa biết → null). Backend tự quyết model production, bỏ qua modelVersion do client gửi.
 - Viết `DATA_GOVERNANCE.md` (lưu gì, vì sao, ai truy cập, bao lâu, xóa thế nào, có dùng train không; consent phụ huynh).
 - CHỈ viết code + tài liệu; CHƯA chạy train. Chỉ train khi tôi xác nhận có dataset đủ lớn, đúng protocol, có nhãn bác sĩ. → DỪNG.

# TESTS BẮT BUỘC
Checklist tick "đã bật đèn" nhưng quality gate fail vẫn bị chặn · nhánh Android/iOS đúng · torch không hỗ trợ → fallback đèn ngoài · red flag/tuổi ngoài khoảng → không chạy inference · dấu mũi/thái dương đúng cho cả hai mắt, nhất quán frontend–backend · timestamp đơn điệu · thiếu frame an toàn · FPS thấp không làm sai vận tốc · mắt bị che không bị tính bất thường · low quality → INCONCLUSIVE · lỗi backend → SYSTEM_ERROR · Cover luôn gắn EXPERIMENTAL · `/predict` cũ vẫn chạy · feature count == model input · split theo bệnh nhân không rò rỉ.

# BÁO CÁO CUỐI (ngắn)
Files đọc/sửa/tạo · thay đổi UI/API/DB · test pass/fail · ngưỡng còn TODO_PILOT · rủi ro còn lại · những gì CHƯA nên lên production. Trả lời Có/Không/UNKNOWN kèm dẫn chứng:
1. Checklist có chặn khi quality gate fail không?
2. Torch Android có fallback không?
3. Dấu mũi/thái dương nhất quán cả hai phía?
4. Low-quality có bị ép ra kết quả không?
5. Model production có bị thay đổi không?
6. Có data leakage trong pipeline train/validation không?
7. Dữ liệu legacy có bị dùng để chọn ngưỡng/train không?

# BẮT ĐẦU
Chỉ thực hiện PHASE 0 rồi dừng. Không sửa code trước khi tôi duyệt.
- Chỉ LÁC NGANG (esotropia/exotropia). Lác đứng/xoắn/liệt dây thần kinh/rung giật/sụp mi → UNSUITABLE_FOR_SCREENING.
- Trẻ ≥ 7 tuổi (giới hạn tuổi nằm trong config). Web, camera sau, điện thoại cố định trên giá đỡ, người lớn hỗ trợ che mắt.
- Quy trình: Hirschberg (ảnh tĩnh) + Cover-Uncover (chuỗi thời gian). Giai đoạn nghiên cứu: chạy cả hai cho mọi người tham gia.

# QUY TẮC TỐI CAO
1. Chỉ dựa trên code/dữ liệu thực tế. Không có bằng chứng → ghi "UNKNOWN", không đoán.
2. Mọi nhận định kèm dẫn chứng `đường_dẫn:số_dòng`.
3. Chỉ sửa đúng phạm vi phase đang làm. Không refactor, không đổi tên, không tiện tay cải tiến.
4. Ngưỡng chưa có nguồn / quyết định lâm sàng / điểm mơ hồ → DỪNG và hỏi. Mọi ngưỡng để trong config, mặc định `TODO_PILOT`.
5. Làm tuần tự. Hết mỗi phase: báo cáo ngắn rồi CHỜ tôi duyệt.
6. Không phá production: `POST /predict` và model hiện tại giữ nguyên; tính năng mới chạy song song sau feature flag.

# KHÔNG ĐƯỢC
- Retrain/thay model production, đổi threshold, đổi thứ tự/số feature của model hiện tại; pad/truncate/reshape feature.
- Coi checkbox người dùng tự tick là điều kiện đã đạt.
- Hard-code hệ số PD/mm, khoảng cách, hay ngưỡng lâm sàng.
- Giả định FPS cố định; dùng frame index thay timestamp.
- Ép kết quả kém chất lượng thành NORMAL (phải INCONCLUSIVE). Lỗi hệ thống → SYSTEM_ERROR, không bao giờ NORMAL.
- Gọi output là chẩn đoán; nhận diện bệnh mắt khác.
- Dùng feature hình dáng mắt/khoảng cách mắt–mũi (tránh nhầm lác giả do epicanthus).
- Dùng dữ liệu production để train mặc định; lưu ảnh mặt không cần thiết; log ảnh mặt.
- Tạo thêm endpoint/bảng/abstraction ngoài yêu cầu.

# QUY ƯỚC DỮ LIỆU
- Chỉ trục ngang (x). Bỏ feature trục y trong pipeline mới.
- Dấu theo mũi/thái dương, KHÔNG theo trái/phải của ảnh: `+` = về phía mũi, `−` = về phía thái dương.
- Điểm tham chiếu: TÂM MỐNG MẮT (iris/limbus), không dùng tâm đồng tử.
- Hirschberg, đại lượng chính mỗi mắt: `(reflex_x − iris_center_x) / iris_diameter` theo dấu mũi/thái dương; thêm hiệu giữa hai mắt (triệt tiêu một phần angle kappa và yaw). Lưu giá trị thô (px); KHÔNG quy đổi sang PD/độ.
- Cover: timestamp thực của frame (`requestVideoFrameCallback` nếu có); mốc che/mở lấy từ DỮ LIỆU (mống mắt bị che/hiện lại), không lấy thời điểm UI hiện lệnh. Bù chuyển động đầu: đo iris_x tương đối với khóe mắt trong/ngoài, chuẩn hóa theo chiều rộng khe mắt.
- Mắt bị che = OCCLUDED, không phải bất thường; chỉ theo dõi mắt còn lại.
- `possible_inward/possible_outward` chỉ là thông tin phụ, không phải chẩn đoán loại lác.
- Nhãn cuối: SCREENING_NORMAL | REVIEW_REQUIRED | INCONCLUSIVE | QUALITY_FAIL | SYSTEM_ERROR. Ranh giới nhãn và bảng chân lý H×C×quality chưa có → hỏi tôi, không tự quyết.
- Giới hạn phải ghi trong UI/tài liệu: Hirschberg bình thường không loại trừ lác (nhất là lác ngoài ngắt quãng, góc nhỏ); nhìn gần có thể che khuất lác ngoài ngắt quãng.

# PHASE 0 — RECON (chỉ đọc)
Đọc frontend (luồng sàng lọc, camera, MediaPipe, UI) và backend (API, feature, model, DB). Tạo `RECON.md`: luồng hiện tại, file liên quan, framework UI, cách gọi `getUserMedia`, model hiện tại (input_dimension, feature_version, threshold), file SẼ sửa / KHÔNG sửa. → DỪNG.

# PHASE 1 — DATASET AUDIT (chỉ đọc)
Tôi có tập ảnh có nhãn loại lác nhưng KHÔNG chụp theo protocol Hirschberg; chưa có dữ liệu Cover. Hãy:
1. Quét thư mục ảnh, báo cáo: số ảnh, độ phân giải, có ID người không, các nhãn và phân bố, có ảnh người không lác không, ảnh nào thấy chấm phản xạ rõ.
2. Gắn cờ domain = "legacy_non_hirschberg" cho toàn bộ tập.
3. Cảnh báo nếu lớp lác và lớp bình thường đến từ nguồn/máy/ánh sáng khác nhau (nguy cơ học khác biệt nguồn).
4. Loại khỏi phạm vi nhãn không phải lác ngang.
5. KHÔNG dùng tập này để chọn ngưỡng độ dịch reflex, KHÔNG train model Hirschberg, KHÔNG báo sensitivity/specificity từ nó. Chỉ dùng cho: phát triển/kiểm tra bộ phát hiện mặt–mống mắt, kiểm tra quality gate, phân tích thăm dò (ghi "exploratory, không phải bằng chứng lâm sàng").
6. Thiếu thông tin (ai gán nhãn, thời điểm khám, consent) → ghi UNKNOWN và hỏi tôi. → DỪNG.

# PHASE 2 — CHECKLIST + LUỒNG BẬT CAMERA (frontend)
Khi bấm "Sàng lọc", hiện checklist TRƯỚC khi xin quyền camera. Mỗi màn hình một việc, chữ lớn, có hình minh họa, ngôn ngữ cho phụ huynh:
 1. Consent phụ huynh/người giám hộ + tuổi (ngoài khoảng cho phép → chặn) + câu hỏi red flag (danh sách do bác sĩ cung cấp; chưa có → placeholder và hỏi tôi). Có red flag → dừng, hướng dẫn đi khám, không chạy test.
 2. Trẻ có đeo kính không (lưu `glasses_on`; chế độ cho phép do bác sĩ quyết, chưa có → hỏi).
 3. "Bạn đã cố định điện thoại chưa?" (giá đỡ/tripod, camera sau).
 4. "Vui lòng ngồi thẳng lưng, đầu song song với điện thoại."
 5. Nguồn sáng, tách theo thiết bị (phát hiện OS + kiểm tra năng lực thực tế):
    - Android + trình duyệt hỗ trợ torch (`track.getCapabilities().torch`): hướng dẫn "Hãy bật đèn" và bật bằng `applyConstraints`. Torch không khả dụng/lỗi → chuyển nhánh đèn ngoài.
    - iOS hoặc torch không khả dụng: "Hãy tìm một chiếc đèn nhỏ chiếu từ phía sau điện thoại, đặt sát camera, hướng vào mặt trẻ, độ sáng vừa". Không dùng ring light/đèn khuếch tán lớn (cần phản xạ là một chấm nhỏ).
 6. Target nhìn: vật nhỏ dán sát ống kính (màn hình quay về phía người lớn, không hiển thị target cho trẻ).
 7. Người lớn sẵn sàng che mắt (tự khai).
Quy tắc: câu trả lời được LƯU làm metadata (`selfReported`) nhưng KHÔNG thay quality gate. Mục xác minh tự động được thì xác minh ở Phase 3; fail → chặn chụp và nói rõ cần sửa gì. Giới hạn số lần thử lại (config, TODO_PILOT) → hết lượt thì INCONCLUSIVE.
Camera: `facingMode: environment`, xin độ phân giải cao nhất khả dụng, ghi `imageWidth/Height`, từ chối thiết bị dưới mức tối thiểu (config). Lưu device/browser/os. Giữ luồng cũ sau feature flag. → DỪNG (kèm mô tả/ảnh chụp UI).

# PHASE 3 — AI DETECT Ở FRONTEND (quality gate, KHÔNG phải kết quả)
Client chỉ làm quality gate với ngưỡng NỚI; không tính feature chẩn đoán ở client (tránh lệch JS/Python). Trạng thái GOOD / WARNING / INVALID cho từng mục:
 - Có mặt; hai mắt + hai mống mắt thấy rõ; không bị tóc/mi/tay che.
 - Head pose: yaw chặt nhất (yaw giả lập lác ngang), pitch/roll nới hơn.
 - Khoảng cách: mục tiêu 20–25 cm là GIẢ THUYẾT pilot (config, TODO_PILOT), ước lượng từ đường kính mống mắt, ghi rõ sai số (~10%). KHÔNG hard-code.
 - Độ nét là điều kiện bắt buộc ở cự ly gần; từ chối thiết bị không lấy nét được ở khoảng cách mục tiêu. Kiểm tra thêm phơi sáng, kích thước ảnh, ngược sáng.
 - Nguồn sáng: có đúng 1 điểm sáng nhỏ bão hòa trong vùng mống mắt của CẢ HAI mắt, không có phản xạ phụ (cửa sổ/đèn phòng/kính). Đây là module CV MỚI (MediaPipe không cung cấp corneal reflex); ở client chỉ cần có/không + vị trí thô.
 - Ổn định điện thoại/fixation: độ ổn định landmark trong vài giây.
 - Cover: state machine INITIALIZING → READY → BASELINE → COVER_OD → UNCOVER_OD → COVER_OS → UNCOVER_OS → DONE; mắt bị che = OCCLUDED; thời lượng từng pha lấy từ config (chưa có số bác sĩ xác nhận → hỏi).
Gửi backend: ảnh Hirschberg GỐC chất lượng cao (JPEG nén nhẹ) + metadata; Cover gửi chuỗi {timestamp thực, iris_x, eye_corner, visibility, phase}.
Metadata mỗi ảnh: distance_estimate_cm (kèm sai số), distance_bucket, device, camera_used (main/ultrawide nếu biết), focus score, light_offset_note, lighting {source: torch|external, reflexCountPerEye}.
Mọi ngưỡng ở config, ghi nguồn hoặc TODO_PILOT. → DỪNG.

# PHASE 4 — BACKEND: ĐO HÌNH HỌC + COVER (giữ model cũ)
 - Endpoint mới tối thiểu (hoặc mở rộng có phiên bản), KHÔNG đổi `/predict`. Request có schemaVersion, featureVersion, testType (HIRSCHBERG|COVER), sessionId, distance_bucket. Validate bằng schema: thiếu/sai landmark, NaN/Infinity, ảnh sai định dạng, payload quá lớn, timestamp lùi/trùng/gap lớn, thiếu pha, tuổi ngoài khoảng, red flag.
 - Hirschberg: phát hiện iris + corneal reflex trên ảnh gốc ở SERVER (một implementation duy nhất), tính độ dịch chuẩn hóa theo quy ước, so sánh hai mắt. Reflex không thấy / nhiều reflex → INCONCLUSIVE. Ngưỡng gắn theo distance_bucket, không dùng chung giữa các bucket. Chưa có nhãn lâm sàng đúng protocol → KHÔNG chốt ngưỡng (TODO_PILOT).
 - Cover: rule-based, ngưỡng TODO_PILOT, kết quả gắn nhãn EXPERIMENTAL, KHÔNG dùng để cho SCREENING_NORMAL (chỉ được hỗ trợ cờ REVIEW_REQUIRED hoặc ghi dữ liệu). Chuyển động chỉ tính khi baseline ổn định + chất lượng tốt + timestamp hợp lệ + biên độ vượt ngưỡng đã hiệu chuẩn. Tính biên độ, hướng, vận tốc = Δvị trí/Δt thực, độ trễ, thời gian ổn định. Gap lớn → frame_valid=false, không tính xuyên gap.
 - Quality-aware: nhận score, validFrameRatio, trackingConfidence, fps, blinkRatio, occlusionRatio; dưới ngưỡng (config) → INCONCLUSIVE/QUALITY_FAIL.
 - Tổng hợp H + C bằng rule-based theo bảng chân lý TÔI DUYỆT; không weighted average.
 - Log mỗi kết quả: requestId, sessionId, schema/feature/model/preprocessing version, timestamp, latency, quality, result. Lỗi chuẩn hóa (INVALID_REQUEST, INVALID_LANDMARKS, TIMESERIES_INVALID, LOW_QUALITY_INPUT, FEATURE_CONTRACT_MISMATCH, INFERENCE_ERROR...) không lộ stack trace.
 - Model hiện tại tiếp tục chạy; feature mới KHÔNG đưa vào model production. Trước inference: feature count == model input, lệch → FEATURE_CONTRACT_MISMATCH. Model load một lần lúc startup; có `GET /health`.
 - Test Cover bằng chuỗi tín hiệu tổng hợp (chỉ để test code, không phải bằng chứng lâm sàng) và video người bình thường (đo tỉ lệ báo động giả). → DỪNG.

# PHASE 5 — THU DỮ LIỆU + PIPELINE TRAIN (chuẩn bị, KHÔNG train)
 - Chế độ thu dữ liệu tách khỏi production, chỉ khi có consent riêng. Cấu trúc: Participant → Hirschberg {ảnh, quality, iris, reflex, metadata, lighting, glasses, distance_bucket} + Cover {pha, landmarks, timestamps, quality}; ưu tiên lưu video/landmark thô nếu consent cho phép để chạy lại thuật toán phiên bản mới.
 - "Distance experiment mode": thu ảnh nhiều bucket trên cùng người; xuất báo cáo tỉ lệ nét, tỉ lệ đúng 1 reflex/mắt, độ lặp lại, phân bố độ dịch theo bucket. KHÔNG tự chọn khoảng cách chuẩn; báo cáo để tôi quyết định.
 - Trường nhãn ground truth từ bác sĩ/orthoptist (loại lác ngang, ngắt quãng hay không, nhóm kính, lác giả, phương pháp khám, ngày khám); KHÔNG dùng output model làm nhãn.
 - Script train tái lập: lưu seed, dataset version, feature version, hyperparameter, ngày, artifact, metrics. Split THEO BỆNH NHÂN. Metrics: sensitivity, specificity, PPV, NPV, ROC-AUC, PR-AUC, confusion matrix; đo độ lệch: MAE, RMSE, bias, Bland–Altman.
 - Model registry có metadata (version, featureVersion, inputDimension, threshold, preprocessingVersion, metrics; chưa biết → null). Backend tự quyết model production, bỏ qua modelVersion do client gửi.
 - Viết `DATA_GOVERNANCE.md` (lưu gì, vì sao, ai truy cập, bao lâu, xóa thế nào, có dùng train không; consent phụ huynh).
 - CHỈ viết code + tài liệu; CHƯA chạy train. Chỉ train khi tôi xác nhận có dataset đủ lớn, đúng protocol, có nhãn bác sĩ. → DỪNG.

# TESTS BẮT BUỘC
Checklist tick "đã bật đèn" nhưng quality gate fail vẫn bị chặn · nhánh Android/iOS đúng · torch không hỗ trợ → fallback đèn ngoài · red flag/tuổi ngoài khoảng → không chạy inference · dấu mũi/thái dương đúng cho cả hai mắt, nhất quán frontend–backend · timestamp đơn điệu · thiếu frame an toàn · FPS thấp không làm sai vận tốc · mắt bị che không bị tính bất thường · low quality → INCONCLUSIVE · lỗi backend → SYSTEM_ERROR · Cover luôn gắn EXPERIMENTAL · `/predict` cũ vẫn chạy · feature count == model input · split theo bệnh nhân không rò rỉ.

# BÁO CÁO CUỐI (ngắn)
Files đọc/sửa/tạo · thay đổi UI/API/DB · test pass/fail · ngưỡng còn TODO_PILOT · rủi ro còn lại · những gì CHƯA nên lên production. Trả lời Có/Không/UNKNOWN kèm dẫn chứng:
1. Checklist có chặn khi quality gate fail không?
2. Torch Android có fallback không?
3. Dấu mũi/thái dương nhất quán cả hai phía?
4. Low-quality có bị ép ra kết quả không?
5. Model production có bị thay đổi không?
6. Có data leakage trong pipeline train/validation không?
7. Dữ liệu legacy có bị dùng để chọn ngưỡng/train không?

# BẮT ĐẦU
Chỉ thực hiện PHASE 0 rồi dừng. Không sửa code trước khi tôi duyệt.ng chứng lâm sàng) và video người bình thường (đo tỉ lệ báo động giả). → DỪNG.

# PHASE 5 — THU DỮ LIỆU + PIPELINE TRAIN (chuẩn bị, KHÔNG train)
 - Chế độ thu dữ liệu tách khỏi production, chỉ khi có consent riêng. Cấu trúc: Participant → Hirschberg {ảnh, quality, iris, reflex, metadata, lighting, glasses, distance_bucket} + Cover {pha, landmarks, timestamps, quality}; ưu tiên lưu video/landmark thô nếu consent cho phép để chạy lại thuật toán phiên bản mới.
 - "Distance experiment mode": thu ảnh nhiều bucket trên cùng người; xuất báo cáo tỉ lệ nét, tỉ lệ đúng 1 reflex/mắt, độ lặp lại, phân bố độ dịch theo bucket. KHÔNG tự chọn khoảng cách chuẩn; báo cáo để tôi quyết định.
 - Trường nhãn ground truth từ bác sĩ/orthoptist (loại lác ngang, ngắt quãng hay không, nhóm kính, lác giả, phương pháp khám, ngày khám); KHÔNG dùng output model làm nhãn.
 - Script train tái lập: lưu seed, dataset version, feature version, hyperparameter, ngày, artifact, metrics. Split THEO BỆNH NHÂN. Metrics: sensitivity, specificity, PPV, NPV, ROC-AUC, PR-AUC, confusion matrix; đo độ lệch: MAE, RMSE, bias, Bland–Altman.
 - Model registry có metadata (version, featureVersion, inputDimension, threshold, preprocessingVersion, metrics; chưa biết → null). Backend tự quyết model production, bỏ qua modelVersion do client gửi.
 - Viết `DATA_GOVERNANCE.md` (lưu gì, vì sao, ai truy cập, bao lâu, xóa thế nào, có dùng train không; consent phụ huynh).
 - CHỈ viết code + tài liệu; CHƯA chạy train. Chỉ train khi tôi xác nhận có dataset đủ lớn, đúng protocol, có nhãn bác sĩ. → DỪNG.

# TESTS BẮT BUỘC
Checklist tick "đã bật đèn" nhưng quality gate fail vẫn bị chặn · nhánh Android/iOS đúng · torch không hỗ trợ → fallback đèn ngoài · red flag/tuổi ngoài khoảng → không chạy inference · dấu mũi/thái dương đúng cho cả hai mắt, nhất quán frontend–backend · timestamp đơn điệu · thiếu frame an toàn · FPS thấp không làm sai vận tốc · mắt bị che không bị tính bất thường · low quality → INCONCLUSIVE · lỗi backend → SYSTEM_ERROR · Cover luôn gắn EXPERIMENTAL · `/predict` cũ vẫn chạy · feature count == model input · split theo bệnh nhân không rò rỉ.

# BÁO CÁO CUỐI (ngắn)
Files đọc/sửa/tạo · thay đổi UI/API/DB · test pass/fail · ngưỡng còn TODO_PILOT · rủi ro còn lại · những gì CHƯA nên lên production. Trả lời Có/Không/UNKNOWN kèm dẫn chứng:
1. Checklist có chặn khi quality gate fail không?
2. Torch Android có fallback không?
3. Dấu mũi/thái dương nhất quán cả hai phía?
4. Low-quality có bị ép ra kết quả không?
5. Model production có bị thay đổi không?
6. Có data leakage trong pipeline train/validation không?
7. Dữ liệu legacy có bị dùng để chọn ngưỡng/train không?

# BẮT ĐẦU
Chỉ thực hiện PHASE 0 rồi dừng. Không sửa code trước khi tôi duyệt.

Tên đề tài đề xuất: **Nghiên cứu xây dựng hệ thống web hỗ trợ sàng lọc lác ngang bằng ảnh phản xạ giác mạc và phân tích chuỗi chuyển động mắt trong nghiệm pháp che–mở mắt.**

Hệ thống phục vụ nghiên cứu sàng lọc, không chẩn đoán bệnh và không thay thế khám chuyên khoa. Hai phép đo cần nghiên cứu là:

- **Hirschberg:** lấy ảnh tĩnh đúng protocol, xác định tâm mống mắt và chấm phản xạ, tính độ dịch theo trục ngang.
- **Cover–Uncover:** thu chuỗi landmark kèm timestamp thực, xác định sự kiện che/mở từ dữ liệu và phân tích chuyển động của mắt đang quan sát được.

Trong nghiên cứu, mọi người tham gia đủ điều kiện đều thực hiện cả hai. Không bỏ Cover chỉ vì Hirschberg có kết quả thuận lợi.

Sản phẩm cần bàn giao:

| Hạng mục | Đầu ra cụ thể |
|---|---|
| Front-end | Luồng consent → chuẩn bị → camera sau → kiểm tra chất lượng → Hirschberg → Cover → kết quả nghiên cứu |
| Back-end | Schema có phiên bản, kiểm tra dữ liệu, đo hình học trên server, xử lý chuỗi thời gian, tổng hợp theo quy tắc được duyệt |
| Dataset | Manifest, consent nghiên cứu, mã người tham gia, metadata thiết bị/protocol, nhãn bác sĩ, phân chia theo người |
| AI/CV | Bộ phát hiện mống mắt/phản xạ và baseline đo lường; model học máy mới chỉ là ứng viên nghiên cứu sau khi đủ dữ liệu |
| Đánh giá | Kiểm thử kỹ thuật, độ lặp lại phép đo, báo cáo khả thi pilot, đánh giá độc lập khi có nhãn hợp lệ |
| Tài liệu | RECON, audit dataset, hợp đồng dữ liệu, protocol thu mẫu, quản trị dữ liệu, báo cáo thí nghiệm và model registry |

### 1.1. Câu hỏi nghiên cứu

1. Có thu được ảnh đủ nét với một phản xạ rõ trên mỗi mắt bằng cấu hình điện thoại mục tiêu không?
2. Độ dịch phản xạ chuẩn hóa có lặp lại được giữa các lần chụp, thiết bị, nhóm kính và khoảng cách không?
3. Có đo được chuyển động mắt trong Cover sau bù chuyển động đầu với timestamp không đều không?
4. Quality gate giúp phát hiện dữ liệu không sử dụng được đến mức nào?
5. Khi có dữ liệu đúng protocol và nhãn bác sĩ, phép đo/mô hình đạt hiệu năng nào trên những người chưa từng xuất hiện trong tập phát triển?

Không đặt sẵn kết luận “độ chính xác cao”, không tự đặt số người tham gia hoặc ngưỡng đạt lâm sàng. Cỡ mẫu cần tính từ mục tiêu nghiên cứu, tỷ lệ nhóm bệnh và độ rộng khoảng tin cậy mong muốn cùng người phụ trách thống kê.

## 2. Cơ sở kiểm chứng và hiện trạng hai repository

Quy ước dẫn chứng trong tài liệu:

- `FE/` = `D:/AI_Check_Lac/`.
- `BE/` = `D:/REMICARE-STRABISMUS-AI/` — tên thư mục thực tế dùng dấu gạch ngang.
- `REQ` = nội dung người dùng đính kèm tại `C:/Users/PC/.codex/attachments/278290eb-8d5c-4585-be85-1abe4e1dfd10/Pasted text.txt`.
- Dẫn chứng `FE/...:n` hoặc `BE/...:n` chỉ đến mã nguồn/metadata tại thời điểm đọc. Những mục ghi “đề xuất”, “sẽ” hoặc `TODO_PILOT` chưa được triển khai hay phê duyệt.
- `UNKNOWN` nghĩa là chưa có đủ bằng chứng. Có code không đồng nghĩa tính năng đã chạy thành công trên production.

### 2.1. Front-end đã quan sát

| Thành phần | Bằng chứng | Ý nghĩa đối với kế hoạch |
|---|---|---|
| React, Vite, ONNX Runtime Web | `FE/package.json:1` | Phát triển trên nền hiện có, không đổi framework |
| Camera mặc định dùng `facingMode: user`; mobile giới hạn độ phân giải | `FE/src/services/cameraService.js:49`, `:61`, `:63` | Nhánh nghiên cứu cần camera sau và kiểm tra độ phân giải thực |
| Xin camera qua `getUserMedia`, có fallback | `FE/src/services/cameraService.js:98`, `:111` | Fallback mới phải giữ ràng buộc camera sau, không âm thầm quay lại camera trước |
| MediaPipe Face Mesh qua CDN | `FE/src/services/faceMeshService.js:5` | Có nền landmark; không coi đó là bộ phát hiện chấm phản xạ |
| Luồng có bước Gaze và Cover | `FE/src/components/binocular/BinocularVisionScreening.jsx:40`, `:471`, `:504` | Tạo nhánh Hirschberg + Cover đúng phạm vi, không xóa luồng cũ |
| Có vòng lặp hỗ trợ `requestVideoFrameCallback` | `FE/src/hooks/useFaceMesh.js:349` | Cần audit cách gắn timestamp vào kết quả landmark, không chỉ kiểm tra API tồn tại |
| ONNX client đóng gói 10 feature, gồm cả trục y/hình học khác | `FE/src/services/aiInferenceService.js:9`, `:135` | Không tái sử dụng hợp đồng này cho pipeline chỉ trục x |
| Metadata client khai báo input `[1,10]`, model version `1.0.0` | `FE/public/models/model_metadata.json:2`, `:11` | Đây là khai báo trong file, chưa kiểm tra graph ONNX thực tế |
| Gửi ảnh đến API version v1 | `FE/src/api/strabismusApi.js:64` | Cần giữ tương thích API ảnh hiện tại |
| Hàm crop mắt tạo ảnh 256×256 | `FE/src/services/screeningImageCaptureService.js:80` | Không dùng crop đã resize thay ảnh gốc để đo Hirschberg |

### 2.2. Back-end đã quan sát

| Thành phần | Bằng chứng | Ý nghĩa đối với kế hoạch |
|---|---|---|
| FastAPI, lifespan, preload model | `BE/app/main.py:43`, `:89` | Tận dụng vòng đời ứng dụng hiện có |
| Router ảnh `/api/v1/strabismus` | `BE/app/api/strabismus.py:20`, `:53` | Endpoint ảnh thực tế là `/api/v1/strabismus/predict`; không tự đổi sang `/predict` |
| Có `/health` và `/health/db` | `BE/app/main.py:194`, `:205` | Mở rộng thông tin cần thiết, không tạo health endpoint trùng |
| Model ảnh mặc định `best_model.onnx`, version `remicare-bilateral-resnet18-v1`, threshold `0.20` | `BE/app/services/strabismus_inference_service.py:35` | Giữ nguyên; con số trong code không phải bằng chứng ngưỡng đã được xác nhận lâm sàng |
| Model ảnh yêu cầu bilateral ocular ROI, chuẩn hóa ImageNet | `BE/app/services/strabismus_inference_service.py:45` | Pipeline ảnh hiện tại khác pipeline đo phản xạ trên ảnh gốc |
| Cover candidate có hợp đồng mặc định 14 feature, kiểm tra chiều đầu vào | `BE/app/services/fps_model_service.py:85`, `:131`, `:166` | Không thay thứ tự hoặc đưa feature Hirschberg vào candidate hiện tại |
| Shared feature contract version `shared-v1.0.0` | `BE/app/services/shared_feature_contract.py:30` | Pipeline ngang mới cần version riêng, không thay ý nghĩa contract cũ |
| Session validation kiểm tra timestamp lùi/trùng | `BE/app/services/cover_test/session_service.py:145`, `:186` | Tận dụng kiểm tra đã có; bổ sung kiểm tra gap/phase theo protocol mới |
| SQLAlchemy async, hỗ trợ PostgreSQL/asyncpg | `BE/app/db/database.py:10`, `:38` | Kiểm tra schema/migration hiện tại trước khi đề xuất thay DB |
| Storage Supabase có fallback bộ nhớ | `BE/app/services/cover_test/storage_service.py:16`, `:34`, `:60` | Thu nghiên cứu phải phân biệt lưu bền vững với fallback tạm |
| Đã có test model contract | `BE/tests/model/test_fps_model_contract.py:16` | Bổ sung test đúng nhánh mới, không tuyên bố các test hiện có đã pass trong lần soạn tài liệu |

`POST /predict` độc lập được nêu trong REQ nhưng chưa xác nhận route đó từ phần mã đã đọc. Phase 0 phải kiểm kê route đầy đủ và khóa mọi endpoint đang được sử dụng, gồm endpoint version v1 thực tế. Không suy luận rằng endpoint nào không thấy trong lần đọc này thì không tồn tại trên deployment.

### 2.3. Những điều hiện còn UNKNOWN

- Artifact, commit, cấu hình môi trường và threshold thực sự đang chạy trên production; chưa truy cập deployment.
- Nguồn gốc, nhãn bác sĩ, quyền sử dụng và split của các model hiện có.
- Vị trí chính xác của tập ảnh legacy người dùng mô tả; chưa audit số ảnh/chất lượng.
- Có dữ liệu JSON nghiên cứu trong backend không chứng minh đã có Cover đúng protocol RemiCare. Nguồn, consent và khả năng dùng train phải audit riêng.
- Độ chính xác ước lượng khoảng cách, giới hạn thiết bị, danh sách red flag, chế độ kính và bảng kết hợp hai phép đo.
- Trạng thái migration, chính sách truy cập và lưu trữ thực tế của DB production.

## 3. Phạm vi và các nguyên tắc bắt buộc

Theo REQ:

1. Chỉ nghiên cứu lác ngang. Lác đứng, xoắn, liệt dây thần kinh, rung giật và sụp mi nằm ngoài phạm vi. Không xây thêm model chẩn đoán các bệnh này.
2. Đối tượng từ 7 tuổi theo yêu cầu đề tài; đặt tuổi trong config. Giới hạn trên nếu cần: `UNKNOWN`, không tự bổ sung.
3. Camera sau, điện thoại cố định, người lớn hỗ trợ che mắt, target nhỏ đặt sát ống kính.
4. Front-end chỉ kiểm tra chất lượng và thu quan sát; back-end tính feature đo lường bằng một implementation thống nhất.
5. Chỉ dùng độ dịch ngang trong feature sàng lọc mới. Có thể dùng tọa độ y cho crop, kiểm tra pose hoặc visibility, nhưng không đưa feature lệch dọc vào model sàng lọc mới.
6. Điểm tham chiếu là tâm mống mắt/limbus, không thay bằng tâm đồng tử.
7. Không dùng hình dáng mắt, khoảng cách mắt–mũi hoặc hình thái khuôn mặt làm feature phân loại.
8. Ngưỡng chưa có căn cứ phải là `TODO_PILOT`; không kế thừa threshold model cũ thành threshold mới.
9. Dữ liệu lỗi/thiếu chất lượng không được chuyển thành `SCREENING_NORMAL`. Lỗi hệ thống là `SYSTEM_ERROR`.
10. Không dùng dữ liệu production để train mặc định. Consent sàng lọc và consent dùng dữ liệu nghiên cứu là hai phạm vi riêng.

`UNSUITABLE_FOR_SCREENING` nên được biểu diễn ở trạng thái eligibility, tách khỏi năm nhãn kết quả. Đây là đề xuất schema để giải quyết việc REQ có trạng thái ngoài phạm vi nhưng không đưa nó vào enum kết quả; cần duyệt trước triển khai.

## 4. Kiến trúc mục tiêu

```text
Phụ huynh/người hỗ trợ
    → Consent + tuổi + điều kiện tham gia + chuẩn bị
    → Camera sau + quality gate tại trình duyệt
    → Hirschberg: ảnh gốc + metadata
    → Cover: quan sát thô + timestamp + visibility + phase
    → API nghiên cứu có phiên bản, sau feature flag
    → Backend validate + quality gate có thẩm quyền
    → Hirschberg geometry / Cover rule-based EXPERIMENTAL
    → Kết hợp theo bảng quy tắc đã duyệt
    → UI kết quả sàng lọc + lý do + giới hạn

Nhánh dữ liệu nghiên cứu, chỉ khi có consent riêng
    → Kho dữ liệu riêng + nhãn bác sĩ + manifest
    → Audit → split theo người → train ứng viên → đánh giá độc lập
    → Model registry; không tự động thay model production
```

Không bổ sung dịch vụ, hàng đợi, bảng registry hoặc nhiều endpoint nếu yêu cầu hiện tại chưa cần. Ưu tiên service/schema hiện có và file manifest cho thí nghiệm. Feature flag phía client chỉ điều khiển giao diện; backend cũng phải kiểm tra quyền bật nghiên cứu.

## 5. Front-end: sẽ làm gì và cách thực hiện

### 5.1. Luồng trước khi xin quyền camera

Mỗi màn hình một việc, chữ lớn, minh họa dễ hiểu, có nút quay lại và giải thích vì sao chưa thể tiếp tục.

| Màn hình | Nội dung cần làm | Dữ liệu lưu / điều kiện chuyển bước |
|---|---|---|
| Giới thiệu | Nêu đây là sàng lọc nghiên cứu; thông báo giới hạn | Chấp thuận xem thông tin không thay consent |
| Consent và tuổi | Consent phụ huynh/người giám hộ, kiểm tra tuổi | Consent version, thời điểm, tuổi; không cần lưu ngày sinh đầy đủ nếu không cần thiết |
| Điều kiện tham gia | Câu hỏi red flag do bác sĩ cung cấp | Có red flag → dừng theo hướng dẫn đã duyệt; thiếu danh sách → chưa mở pilot |
| Kính | Hỏi trẻ có đeo kính khi đo không | `glasses_on`; chế độ cho phép `TODO_PILOT` |
| Thiết bị và tư thế | Cố định điện thoại, camera sau, đầu thẳng | Lưu dưới `selfReported`, chưa kết luận đã đạt |
| Ánh sáng và target | Hướng dẫn đèn phù hợp, vật nhỏ sát ống kính | Dự kiến nguồn sáng; xác minh thật sau khi có track |
| Người hỗ trợ | Sẵn sàng che/mở mắt theo hướng dẫn | Tự khai, không thay xác minh occlusion từ dữ liệu |
| Bật camera | Chỉ gọi camera sau khi hoàn tất các bước bắt buộc | Xử lý quyền bị từ chối, camera bận, thiết bị không đạt |

Trước khi xin quyền chỉ có thể hướng dẫn lựa chọn ánh sáng. Sau khi có camera track mới kiểm tra torch thật; không thể cam kết torch khả dụng chỉ từ tên OS.

### 5.2. Camera và nguồn sáng

1. Tạo cấu hình riêng cho nhánh nghiên cứu với `facingMode: environment`. Kiểm tra `getSettings()` sau khi mở; không chỉ tin constraint đã yêu cầu.
2. Đàm phán độ phân giải cao nhất khả dụng phù hợp khả năng thiết bị, ghi lại kích thước thật. Không phóng to ảnh nhỏ rồi ghi là ảnh độ phân giải cao.
3. Android: kiểm tra capability torch trên track, thử bật bằng `applyConstraints`, xác nhận trạng thái nếu có thể. Lỗi/không hỗ trợ thì chuyển hướng dẫn đèn ngoài.
4. iOS hoặc nhánh không có torch: hướng dẫn đèn nhỏ sát camera từ phía sau điện thoại theo protocol được duyệt. Không dùng ring light/đèn khuếch tán lớn theo REQ.
5. Khi mở lại camera, xoay máy, đổi lens hoặc quay lại từ background: chạy lại kiểm tra chất lượng, hủy đoạn đo không còn liên tục.
6. Không xác định main/ultrawide bằng suy đoán; không biết thì lưu `camera_used: UNKNOWN`.
7. Khi dừng hoặc thoát: giải phóng track, tắt torch, hủy callback và ngừng thu mẫu.

### 5.3. Quality gate trực tiếp

Mỗi mục có `GOOD`, `WARNING`, `INVALID`, kèm mã lý do và hướng dẫn sửa. Ngưỡng client có thể nới để hướng dẫn nhưng backend vẫn kiểm tra độc lập; client đạt không bảo đảm được kết quả cuối.

| Hạng mục | Cách kiểm tra dự kiến | Phản hồi UI |
|---|---|---|
| Mặt và mắt | Landmark hợp lệ, đủ hai mống mắt trong Hirschberg, kiểm tra vùng bị che | “Đưa cả hai mắt vào khung hình” |
| Head pose | Ước lượng yaw/pitch/roll; yaw được kiểm soát chặt hơn theo protocol | “Quay mặt thẳng về camera” |
| Nét/phơi sáng | Độ nét vùng mắt, vùng cháy sáng/tối, ngược sáng | “Ảnh chưa rõ, điều chỉnh vị trí hoặc ánh sáng” |
| Khoảng cách | Ước lượng có hiệu chuẩn theo thiết bị, ghi uncertainty | Không hiển thị số cm như phép đo chính xác nếu chưa kiểm chứng |
| Phản xạ | Module CV riêng tìm chấm sáng trong ROI mống mắt ở cả hai mắt | “Điều chỉnh đèn để thấy một chấm phản xạ rõ mỗi mắt” |
| Ổn định | Biến thiên landmark/pose theo thời gian | “Giữ đầu và điện thoại ổn định” |
| Cover | Kiểm tra mắt quan sát còn thấy rõ, phát hiện mắt bị che | Mắt được che là `OCCLUDED`, không hiển thị cảnh báo lác |

Khoảng cách 20–25 cm và sai số khoảng 10% trong REQ là **giả thuyết pilot**, không phải đặc tính đã đo của ứng dụng. Chỉ đường kính mống mắt trong ảnh chưa đủ để bảo đảm khoảng cách tuyệt đối; phải kiểm chứng ảnh hưởng camera, tiêu cự và biến thiên sinh học. Giá trị chưa xác nhận để `null`/`UNKNOWN` cùng trạng thái `TODO_PILOT`.

MediaPipe cung cấp nền landmark, không cung cấp sẵn kết quả corneal reflex cho yêu cầu này. Module reflex dự kiến: lấy ROI mống mắt → tìm vùng sáng ứng viên → đánh giá số lượng, kích thước và vị trí → trả quality và tọa độ thô. Không coi mọi pixel bão hòa là phản xạ hợp lệ; có thể là kính hoặc nguồn sáng phụ.

### 5.4. Thu ảnh Hirschberg

- Chỉ bật nút chụp khi các điều kiện bắt buộc đạt; checkbox “đã bật đèn” không mở khóa khi phản xạ chưa đạt.
- Lấy frame ở độ phân giải capture thật, JPEG nén nhẹ theo config; không dùng screenshot UI, overlay hoặc crop resize của model cũ.
- Lưu metadata: `imageWidth`, `imageHeight`, camera/device/browser/OS, orientation/mirror transform, `glasses_on`, chất lượng nét, nguồn sáng, số reflex mỗi mắt, ghi chú lệch nguồn sáng, ước lượng khoảng cách và uncertainty, `distance_bucket`.
- Giới hạn retry trong config. Hết lượt mà chưa có dữ liệu đạt → `INCONCLUSIVE`; chi tiết phân biệt với `QUALITY_FAIL` cần duyệt theo mục 7.
- Chỉ giữ ảnh trong bộ nhớ cho inference thông thường; lưu dài hạn chỉ khi có consent nghiên cứu phù hợp.

### 5.5. Thu Cover–Uncover

State machine mục tiêu theo REQ:

```text
INITIALIZING → READY → BASELINE → COVER_OD → UNCOVER_OD
             → COVER_OS → UNCOVER_OS → DONE
```

OD là mắt phải của người tham gia, OS là mắt trái của người tham gia; không phải bên phải/trái màn hình.

- Lệnh UI chỉ là thời điểm hướng dẫn; sự kiện che/mở dùng thay đổi visibility từ dữ liệu.
- Lưu riêng `instructedPhase`, `observedPhase` hoặc ánh xạ tương đương trong schema được duyệt.
- Dùng frame timestamp gắn với chính ảnh đã đưa vào tracker. Với `requestVideoFrameCallback`, có thể lấy `metadata.mediaTime` làm mốc trên timeline media; ghi rõ đơn vị và `timestampSource`.
- Nếu phải fallback sang clock monotonic tại lúc nhận frame, ghi đây là timestamp ước lượng; không gọi đó là thời điểm phơi sáng chính xác. Không suy timestamp từ frame index hoặc FPS giả định.
- Không ghép kết quả landmark từ frame trước với timestamp frame sau khi xử lý bất đồng bộ.
- Lưu timestamp tăng nghiêm ngặt, iris x, khóe mắt trong/ngoài, visibility, tracking confidence, quality và thông tin pha.
- Mắt bị che không được dùng để đo chuyển động. Tách blink, mất tracking và che có chủ đích.
- Không phát hiện được sự kiện hoặc không đủ baseline: đoạn không hợp lệ, không tự dùng thời điểm UI thay thế.
- Mất frame/gap lớn: đánh dấu, không tính vận tốc xuyên gap. Thời lượng pha và số lần lặp mới đều chờ duyệt, không sao chép thời lượng cũ.

Tham khảo ngữ nghĩa timestamp của API: [MDN — requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback). Đây là nguồn kỹ thuật, không xác nhận độ chính xác lâm sàng của phép đo.

### 5.6. Những file front-end dự kiến liên quan

| File/nhóm file hiện có | Công việc dự kiến sau duyệt phase |
|---|---|
| `src/components/binocular/BinocularVisionScreening.jsx` | Điểm vào nhánh nghiên cứu, điều phối bước và giữ luồng cũ |
| `src/components/binocular/PositionCheck.jsx`, `src/components/CameraQualityStatus.jsx` | Hiển thị quality theo từng điều kiện |
| `src/components/binocular/CoverTestStep.jsx` | Ánh xạ pha hướng dẫn với pha thực, trạng thái mắt bị che |
| `src/services/cameraService.js`, `src/hooks/useCamera.js` | Cấu hình camera sau, capability và lifecycle cho nhánh mới |
| `src/hooks/useFaceMesh.js` | Timestamp gắn đúng frame, xử lý kết quả bất đồng bộ |
| `src/services/screeningImageCaptureService.js` | Đường capture ảnh gốc riêng cho Hirschberg |
| `src/services/coverTestTimeSeriesService.js` | Xuất quan sát thô theo contract mới, giữ contract cũ |
| `src/constants/screeningConfig.js` | Tổ chức config nghiên cứu có trạng thái phê duyệt, không ghi đè ngưỡng cũ |
| `src/api/` | Client cho contract nghiên cứu tối thiểu sau khi thống nhất backend |

Checklist và reflex quality có thể cần component/service mới nhỏ; tên file cuối cùng quyết định ở phase tương ứng. Không tạo trước hệ thống abstraction hoặc refactor toàn bộ giao diện.

## 6. Back-end: sẽ làm gì và cách thực hiện

### 6.1. Khóa hợp đồng cũ, tách contract nghiên cứu

- Giữ model ảnh, model Cover, feature order, threshold và preprocessing cũ.
- Không đưa ảnh gốc Hirschberg vào endpoint chỉ nhận bilateral ROI hiện tại.
- Ưu tiên một endpoint nghiên cứu có phiên bản hỗ trợ `testType`, hoặc mở rộng endpoint có version sau audit. Tên route mới là `TBD`, không tự tạo nhiều route.
- Khi feature flag chưa bật hoặc config lâm sàng còn thiếu: chưa cho chạy sàng lọc mới. Chế độ chỉ thu/đo nghiên cứu nếu được phép phải ghi rõ chưa có kết luận.
- Model được chọn ở server; `modelVersion` do client gửi không quyết định artifact được chạy.

### 6.2. Hợp đồng request/response đề xuất

| Nhóm | Trường cần có |
|---|---|
| Phiên bản | `schemaVersion`, `featureVersion`, `protocolVersion`, `configVersion` |
| Định danh | `sessionId`, `requestId`; mã người tham gia giả danh chỉ trong nghiên cứu |
| Bài đo | `testType: HIRSCHBERG \| COVER`, `distance_bucket` |
| Điều kiện | Tuổi, consent/version, eligibility, `glasses_on`, metadata tự khai |
| Ảnh | Binary ảnh gốc + kích thước, orientation, camera, lighting, quality |
| Cover | Chuỗi timestamp, đơn vị/time origin, iris/canthi, visibility, phase và quality |
| Kết quả | Nhãn hợp lệ hoặc chưa có kết luận trong chế độ chỉ đo, reason codes, measurements, quality, versions |
| Lỗi | Mã lỗi chuẩn, request ID và thông báo an toàn; không trả stack trace |

Schema phải định nghĩa rõ field bắt buộc theo `testType`; không chấp nhận payload nửa ảnh nửa chuỗi thiếu cấu trúc. Session eligibility/consent phải được backend kiểm tra; không dùng các checkbox như bằng chứng đo lường.

Validation cần bao phủ:

1. Schema/version không hỗ trợ; thiếu ID hoặc trường bắt buộc.
2. Binary không khớp định dạng, ảnh không giải mã được, giới hạn byte và kích thước pixel.
3. Landmark thiếu, nằm ngoài miền tọa độ, `NaN`/`Infinity`, mẫu số bằng 0.
4. Timestamp trùng/lùi, đơn vị không thống nhất, gap lớn, thiếu pha hoặc sai thứ tự.
5. Tuổi ngoài phạm vi, red flag hoặc chưa consent: không chạy inference.
6. Feature sai số lượng/thứ tự/version: `FEATURE_CONTRACT_MISMATCH`; không pad/truncate hoặc điền feature thiếu bằng 0.
7. Session kết hợp H và C không cùng protocol/điều kiện được phép: từ chối tổng hợp.

### 6.3. Đo Hirschberg trên server

Quy trình đề xuất:

1. Decode ảnh gốc, chuẩn hóa orientation có truy vết transform; giữ hệ tọa độ rõ ràng.
2. Xác định vùng mắt và iris/limbus; ước lượng tâm mống mắt và đường kính theo định nghĩa đã khóa.
3. Phát hiện reflex trong mỗi iris ROI. Không thấy hoặc có nhiều ứng viên không phân biệt được → không xuất phép đo hợp lệ.
4. Xác định hướng từ phía thái dương sang phía mũi cho từng mắt, nhất quán với metadata mirror.
5. Tính độ dịch thô và chuẩn hóa, lưu quality/confidence cùng phiên bản preprocessing.
6. Kiểm tra khoảng cách/bucket có được hiệu chuẩn không. Bucket chưa có ngưỡng → chỉ đo, không tự dùng ngưỡng bucket khác.

Ký hiệu `s_eye` là dấu đổi từ chiều x ảnh sang chiều về phía mũi, `D_eye` là đường kính mống mắt hợp lệ:

```text
delta_px_eye = s_eye × (reflex_x_px − iris_center_x_px)
h_eye        = delta_px_eye / D_eye_px
delta_h      = h_OD − h_OS
```

`+` là phía mũi, `−` là phía thái dương. Định nghĩa `delta_h` và mọi phép tổng hợp hai mắt phải được cố định trong feature contract và kiểm thử bằng dữ liệu có đáp án, không đổi dấu ngầm theo ảnh mirror.

Theo REQ, phân tích liên mắt được dùng để khảo sát giảm một phần ảnh hưởng angle kappa/yaw. Không coi việc lấy hiệu là bảo đảm đã triệt tiêu sai số; cần đánh giá thực nghiệm. Không đổi độ dịch thành PD/độ khi chưa có hiệu chuẩn và phê duyệt.

### 6.4. Phân tích Cover trên server

Ban đầu dùng rule-based, luôn gắn `EXPERIMENTAL`. Quan sát thô ở client phục vụ tính toán trên server; không dùng kết quả sàng lọc tính ở JS rồi tính lại khác công thức bằng Python.

Một biểu diễn ngang đề xuất dùng khóe thái dương làm gốc và chiều về phía mũi:

```text
u_eye(t) = (iris_x(t) − temporal_canthus_x(t))
           / (nasal_canthus_x(t) − temporal_canthus_x(t))
du(t)    = u_eye(t) − baseline_eye
v(t)     = (u_eye(t) − u_eye(t_prev)) / Δt_seconds
```

Đây là hợp đồng hình học dự kiến, cần kiểm thử hướng, pose và denominator trước sử dụng. Chuẩn hóa theo khóe mắt giúp giảm ảnh hưởng tịnh tiến đầu nhưng không tự xử lý hết yaw/perspective; quality gate pose vẫn cần thiết. Các khóe mắt chỉ là mốc bù chuyển động, không biến thành feature hình thái phân loại.

Các bước xử lý:

1. Kiểm tra timestamp và chia đoạn ở gap/mất tracking.
2. Xác nhận baseline ổn định của mắt sẽ theo dõi trước sự kiện tương ứng.
3. Xác định che/mở từ visibility, tách blink; loại đoạn không xác định được sự kiện.
4. Chỉ phân tích mắt không bị che và dữ liệu đủ quality.
5. Tính biên độ, hướng, vận tốc theo thời gian thực, latency so với sự kiện quan sát và thời gian ổn định.
6. Nếu dùng lọc, lưu tham số và đo ảnh hưởng trễ; không smoothing xuyên sự kiện/gap làm mất chuyển động.
7. So sánh với ngưỡng đã hiệu chuẩn. Chưa có ngưỡng thì chỉ ghi measurements và `EXPERIMENTAL`.
8. Cover chỉ có thể hỗ trợ cờ cần xem lại theo bảng đã duyệt hoặc ghi dữ liệu; không dùng để cấp `SCREENING_NORMAL`.

`possible_inward`/`possible_outward` chỉ là thông tin phụ, không phải chẩn đoán esotropia/exotropia.

### 6.5. Logging, lỗi và lưu trữ

- Log có cấu trúc: request/session ID, schema/feature/model/preprocessing/config version, thời điểm, latency, quality, kết quả và mã lỗi.
- Không log ảnh, base64, tên người tham gia, token hoặc khóa dịch vụ.
- Phân biệt `INVALID_REQUEST`, `INVALID_LANDMARKS`, `TIMESERIES_INVALID`, `LOW_QUALITY_INPUT`, `FEATURE_CONTRACT_MISMATCH`, `INFERENCE_ERROR`.
- Lỗi hệ thống không đổi thành “bình thường”; UI hiển thị lỗi tách khỏi kết luận sàng lọc.
- Reuse lifespan và health hiện có, kiểm tra khả năng phục vụ nhánh mới. Model cần dùng được load một lần, không load theo request.
- Lưu nghiên cứu phải xác nhận thành công ở storage bền vững. Với fallback bộ nhớ hiện có, không báo dữ liệu đã được bảo toàn sau restart.
- Phân biệt “đã lưu dữ liệu” với “đã inference thành công”; retry phải tránh tạo bản ghi trùng theo hợp đồng idempotency được duyệt.

### 6.6. File backend dự kiến liên quan

| File/nhóm file | Công việc dự kiến |
|---|---|
| `app/main.py`, `app/config.py` | Flag/config/version, đăng ký tối thiểu nhánh mới |
| `app/schemas/` | Schema ảnh và chuỗi nghiên cứu |
| `app/api/` | Adapter request/response có phiên bản sau khi chốt route |
| `app/services/cover_test/session_service.py` | Validation, lưu session và xử lý version tương thích |
| `app/services/cover_test/storage_service.py` | Consent, trạng thái lưu bền vững và đường dẫn dữ liệu nghiên cứu |
| `app/db/models/`, `app/db/repositories/`, `migrations/` | Chỉ sửa khi schema hiện có không chứa được metadata cần thiết |
| Service hình học/reflex mới, tên `TBD` | Implementation đo Hirschberg duy nhất trên server |
| `tests/` | Test contract, geometry, quality và time series của nhánh mới |

Không sửa `strabismus_inference_service.py`, model artifact hoặc shared feature contract cũ để “chuyển” chúng thành Hirschberg. Nếu audit phát hiện lỗi hiện hữu, lập hạng mục riêng và chờ duyệt đúng phase.

## 7. Kết quả và các quyết định chưa được tự đặt

Năm nhãn theo REQ:

| Nhãn | Ý nghĩa dự kiến trong UI |
|---|---|
| `SCREENING_NORMAL` | Kết quả sàng lọc trong phạm vi đã được xác nhận; không bảo đảm không có lác |
| `REVIEW_REQUIRED` | Cần người chuyên môn xem xét/khám theo hướng dẫn đã duyệt |
| `INCONCLUSIVE` | Không đủ cơ sở kết luận |
| `QUALITY_FAIL` | Dữ liệu không đạt điều kiện chất lượng |
| `SYSTEM_ERROR` | Lỗi kỹ thuật, không có kết luận sàng lọc |

**Chưa có bảng chân lý H × C × quality được phê duyệt.** Không tự chọn precedence giữa quality fail/inconclusive hoặc chuyển nhãn cũ `NORMAL`/`SUSPICIOUS` sang nhãn mới bằng phép đổi tên. Chỉ cố định các ràng buộc từ REQ: lỗi không ra bình thường; dữ liệu chất lượng kém không ra bình thường; Cover thử nghiệm không làm căn cứ cấp bình thường.

Trước khi mở luồng trả kết luận cần duyệt bảng đầy đủ cho: H đạt/không đạt/không kết luận × C có cờ/không có cờ/không hợp lệ × quality × eligibility × lỗi hệ thống. Khi chưa duyệt, chỉ chạy chế độ đo/thu được cho phép, không trả `SCREENING_NORMAL`.

UI phải nêu các giới hạn do REQ yêu cầu: Hirschberg bình thường không loại trừ lác, nhất là lác ngoài ngắt quãng hoặc góc nhỏ; nhìn gần có thể che khuất một số biểu hiện lác ngoài ngắt quãng. Nội dung cụ thể cần bác sĩ duyệt trước pilot. Tài liệu nền về tính ngắt quãng của exotropia: [AAPOS — Exotropia](https://www.aapos.org/glossary/exotropia); nguồn này không xác nhận protocol hay threshold của ứng dụng.

## 8. Dữ liệu nghiên cứu: kiểm kê và thu mới

### 8.1. Audit tập legacy

Chưa biết vị trí bộ ảnh legacy nên chưa thể báo số ảnh, tỷ lệ nhãn hoặc số phản xạ đạt. Phase 1 sẽ tạo manifest với đường dẫn giả danh/hash, kích thước, định dạng, nhãn gốc, nhãn trong phạm vi, participant ID nếu có, nguồn/thiết bị, thông tin consent và cờ chất lượng.

Các bước:

1. Kiểm kê file đọc được/hỏng, ảnh trùng, độ phân giải, lớp bình thường và lớp lác ngang.
2. Gắn `domain = legacy_non_hirschberg` cho tập ảnh không theo protocol như REQ mô tả.
3. Kiểm tra ai gán nhãn, phương pháp khám và thời điểm; thiếu thì `UNKNOWN`.
4. Rà soát khả năng liên kết nhiều ảnh cùng người; không suy ID chắc chắn từ tên file.
5. Báo số ảnh nhìn thấy reflex rõ; phải có rubric và kiểm tra người gán, không chỉ dùng độ sáng tự động.
6. Đối chiếu nguồn/máy/ánh sáng với nhãn để phát hiện nguy cơ model học khác biệt nguồn.
7. Đánh dấu loại khỏi nghiên cứu lác ngang đối với nhãn ngoài phạm vi; không xóa file gốc.

Tập này chỉ phục vụ phát triển/kiểm tra detector mặt–mống mắt, thử quality gate hoặc phân tích thăm dò. Mọi báo cáo ghi **“exploratory, không phải bằng chứng lâm sàng”**. Không train classifier Hirschberg, chọn ngưỡng phản xạ hoặc báo sensitivity/specificity lâm sàng từ tập này. Huấn luyện detector nếu có cần annotation kỹ thuật và consent phù hợp; không đánh đồng với huấn luyện model sàng lọc.

### 8.2. Bộ dữ liệu đúng protocol cần thu

```text
Participant (mã giả danh)
  ├─ Consent/version/phạm vi sử dụng
  ├─ Ground truth bác sĩ + phương pháp + ngày khám
  └─ Session (protocol/config/device/glasses)
      ├─ Hirschberg: ảnh + iris/reflex + quality + distance bucket + lighting
      └─ Cover: timestamp + phase + landmark + visibility + quality
```

Đây là mô hình dữ liệu logic, chưa phải yêu cầu tạo bốn bảng mới. Audit schema hiện có rồi chọn cách biểu diễn tối thiểu.

- Thu nhóm bình thường, lác ngang và nhóm lác giả được chuyên môn xác nhận; nhãn ngắt quãng và tình trạng kính phải có trường riêng.
- Người đánh giá ground truth không lấy output model làm nhãn. Ghi bất đồng giữa người gán nhãn và quy trình phân xử.
- Thời gian giữa thu ảnh và khám cần quy định; chưa có thì `TODO_PILOT`.
- Mỗi người có thể có nhiều session/bucket, nhưng mọi dữ liệu của người đó phải cùng partition.
- Video/landmark thô chỉ lưu khi consent cho phép; giữ khả năng chạy lại preprocessing trên dữ liệu đã được phép lưu.
- Tên file/object key dùng ID giả danh, không mang tên thật. Thông tin liên kết danh tính nếu cần được quản lý riêng.

### 8.3. Thí nghiệm khoảng cách

Thu nhiều bucket trên cùng người, giữ metadata ánh sáng/kính/thiết bị, ghi khoảng cách tham chiếu đo theo protocol. Thứ tự thu cần cân bằng hoặc ngẫu nhiên hóa nếu phù hợp để giảm ảnh hưởng mỏi và thứ tự.

Báo cáo theo bucket: tỷ lệ lấy nét đạt, tỷ lệ một reflex hợp lệ mỗi mắt, tỷ lệ hoàn thành, độ lặp lại trong người, phân bố độ dịch và sai số khoảng cách ước lượng. Không gộp ảnh lặp như các người độc lập. Không tự chọn bucket chuẩn sau khi nhìn kết quả test; báo cáo để nhóm chuyên môn quyết định trên tập phát triển/pilot.

## 9. AI: sẽ train gì và train như thế nào?

### 9.1. Tách ba bài toán

| Bài toán | Phương án ban đầu | Điều kiện học máy |
|---|---|---|
| Phát hiện iris/reflex và quality | Detector có sẵn kết hợp CV minh bạch, kiểm tra trên ảnh đúng protocol | Có nhãn tâm/biên iris, reflex, visibility và annotation quality |
| Hirschberg | Đo hình học và baseline quy tắc được hiệu chuẩn | Có cohort đúng protocol, nhãn bác sĩ và split theo người |
| Cover | Rule-based theo sự kiện thực, `EXPERIMENTAL` | Chỉ nghiên cứu model thời gian khi có chuỗi Cover đúng protocol và nhãn phù hợp |

Không mặc định train CNN end-to-end từ ảnh mặt để phân loại: khó kiểm soát việc học hình thái và khác biệt nguồn, không phù hợp ràng buộc feature của REQ. Model cũ vẫn là nhánh độc lập; khả năng chuyển miền sang protocol mới là `UNKNOWN`.

### 9.2. Phase 5 chỉ chuẩn bị pipeline, chưa chạy train

Chuẩn bị script/config và tài liệu cho các công đoạn sau. Tên dưới đây là **đề xuất**, không phải file hoặc lệnh đang có:

```text
audit_dataset → validate_consent_and_labels → build_manifest
             → split_by_participant → extract_versioned_features
             → train_candidate → validate_and_select_threshold
             → evaluate_locked_test → package_registry_entry
```

Chỉ chạy huấn luyện sau xác nhận dataset đủ lớn theo thiết kế nghiên cứu, đúng protocol, có consent và nhãn bác sĩ. Không tự chuyển từ việc soạn pipeline sang retrain production.

### 9.3. Annotation cho detector

1. Viết hướng dẫn xác định OD/OS, biên mống mắt, tâm, reflex, các vùng không nhìn thấy và chói kính.
2. Cho người gán nhãn đánh dấu không xác định thay vì đoán vị trí bị che.
3. Đo độ đồng thuận, rà soát mẫu bất đồng, lưu annotation version.
4. Tách train/validation/test theo người trước khi crop hoặc augmentation.
5. Nếu CV cổ điển không đủ, đề xuất detector/segmentation nhỏ; kiến trúc cuối cùng dựa trên cỡ dữ liệu, lỗi quan sát và ngân sách tính toán, chưa chốt tùy tiện.
6. Đánh giá lỗi tọa độ pixel và chuẩn hóa theo đường kính iris; đánh giá số reflex, false detection trên kính và độ chính xác quality gate.

### 9.4. Feature của model nghiên cứu mới

Ứng viên Hirschberg: độ dịch chuẩn hóa mỗi mắt và đặc trưng liên mắt đã định nghĩa; giữ raw px để truy vết. Ứng viên Cover: biên độ ngang, hướng, vận tốc, latency, settling time trên đoạn hợp lệ. Feature nào chưa có định nghĩa hoặc không tính được phải dừng inference tương ứng.

Quality dùng để quyết định tính hợp lệ, không tự động trở thành predictor của bệnh. Device/source/glasses/distance dùng phân tầng và kiểm soát domain shift; nếu muốn đưa vào model phải có giả thuyết nghiên cứu và kiểm tra shortcut riêng. Không dùng ID, tên file, nguồn bệnh viện hoặc thứ tự thu làm predictor.

Các baseline tabular như logistic regression có regularization hoặc mô hình cây nhỏ là **ứng viên thiết kế**, không cam kết tối ưu. Bắt đầu từ baseline đơn giản, so sánh bằng cùng split, chỉ tăng độ phức tạp nếu dữ liệu và đánh giá cho thấy cần thiết.

### 9.5. Chống rò rỉ dữ liệu

- Group split theo participant; tất cả ảnh, hai mắt, video frame, session, bucket và augmentation của một người ở cùng tập.
- Không có participant ID đáng tin thì chưa thể tuyên bố split không leakage; cần giải quyết trước đánh giá xác nhận.
- Deduplicate trước split, kiểm tra trùng nội dung và trùng người xuyên nguồn nếu thông tin cho phép.
- Chỉ fit scaler, feature selection, imputation được phép, class weighting hoặc sampling trên train fold. Feature đo bắt buộc thiếu không được impute để vượt quality gate.
- Chọn hyperparameter trên validation hoặc grouped cross-validation; chỉ chọn threshold trên validation theo mục tiêu do chuyên môn duyệt.
- Khóa test và threshold trước đánh giá cuối; không điều chỉnh rồi báo lại cùng test như đánh giá độc lập.
- Augmentation chỉ ở train. Flip ảnh phải biến đổi eye ID/dấu/annotation nhất quán; không tăng cường dữ liệu làm dịch reflex sai nhãn hình học.
- Nếu detector được fine-tune bằng dữ liệu nghiên cứu, detector cũng không được học từ test của hệ thống sàng lọc.

Tỷ lệ split, số fold và cỡ test là `TBD` theo số người thực tế; không dùng một tỷ lệ mặc định như chứng cứ đủ dữ liệu.

### 9.6. Huấn luyện tái lập khi đã được duyệt

1. Khóa dataset manifest và hash, split manifest, label version, feature/preprocessing version.
2. Ghi code commit, môi trường phụ thuộc, seed, CPU/GPU và hyperparameter.
3. Chạy baseline trên train, lưu train log và candidate artifact vào khu vực nghiên cứu.
4. So sánh trên validation, gồm phân tầng thiết bị/kính/khoảng cách; ghi tất cả thí nghiệm, không chỉ lần tốt nhất.
5. Chọn model/threshold theo tiêu chí đã duyệt; khóa cấu hình.
6. Đánh giá test độc lập một lần theo kế hoạch; báo cả tỷ lệ không kết luận.
7. Package artifact và kiểm tra tương đương preprocessing, tên/thứ tự/chiều feature; export ONNX chỉ khi cần và có kiểm tra parity.
8. Đăng ký trạng thái `research_candidate`; không copy đè artifact đang phục vụ.

### 9.7. Đánh giá và giới hạn báo cáo

| Mục tiêu | Chỉ số dự kiến | Điều kiện diễn giải |
|---|---|---|
| Sàng lọc có ground truth | Sensitivity, specificity, PPV, NPV, ROC-AUC, PR-AUC, confusion matrix | Định nghĩa nhãn dương và đơn vị đánh giá trước; PPV/NPV phụ thuộc prevalence của cohort |
| Tính khả thi | Tỷ lệ hoàn thành, quality fail, inconclusive, thời gian và số retry | Mẫu số gồm mọi người đã tham gia theo sơ đồ tuyển mẫu |
| Đo tọa độ/độ dịch | MAE, RMSE, bias, Bland–Altman, độ lặp lại | So sánh đại lượng cùng đơn vị và có tham chiếu độc lập |
| Cover | Sai số thời điểm sự kiện, lỗi biên độ/vận tốc, tỷ lệ báo động giả | Tín hiệu tổng hợp chỉ xác minh code; video người bình thường chỉ đánh giá báo động giả nếu trạng thái được xác nhận |
| Phân nhóm | Theo device, distance, glasses, nhóm tuổi được duyệt, lác giả/ngắt quãng | Báo cỡ mẫu và uncertainty; không kết luận từ nhóm quá ít |

Không so trực tiếp normalized displacement với góc PD bằng MAE/Bland–Altman khi chưa có mapping được xác nhận. Báo khoảng tin cậy theo người, dùng phương pháp có xét dữ liệu lặp. Không loại im lặng những ca `INCONCLUSIVE` để làm đẹp accuracy; báo coverage và quy tắc xử lý các ca này trong phân tích.

## 10. Quản trị dữ liệu và registry

Backend đã có `DATA_GOVERNANCE.md` và `MODEL_REGISTRY.md`; phase dữ liệu sẽ rà soát/cập nhật đúng phần thiếu thay vì tạo tài liệu trùng. Đây là tài liệu định hướng, chưa phải bằng chứng policy đang được thực thi.

| Dữ liệu | Mục đích | Quy tắc đề xuất |
|---|---|---|
| Consent/version | Chứng minh phạm vi sử dụng | Kiểm tra trước thu/lưu/train, ghi thời điểm rút consent |
| Ảnh/video gốc | Tái xử lý detector/geometry | Chỉ khi được phép; lưu riêng, hạn chế truy cập, không log |
| Landmark/timestamp | Tái lập phép đo | Vẫn coi là dữ liệu nhạy cảm có liên kết phiên, không mặc định “vô danh” |
| Ground truth | Đánh giá/huấn luyện | Nguồn bác sĩ, phương pháp/ngày khám, không sinh từ model |
| Metadata thiết bị/quality | Audit và phân tầng | Tối thiểu cần thiết; không đưa khóa bí mật vào client |
| Artifact/metrics | Truy vết thí nghiệm | Lưu manifest/version/hash, trạng thái nghiên cứu |

Thời hạn lưu, vai trò truy cập và quy trình xóa: **chờ duyệt**, không tự áp dụng con số ví dụ trong tài liệu cũ. Quy trình xóa phải bao phủ DB, object storage, bản xuất dataset và chính sách backup; xử lý dữ liệu đã tham gia train theo chính sách được thông báo, không hứa “xóa khỏi model” khi chưa có cơ chế.

Registry tối thiểu: model ID/version, artifact hash/path, featureVersion, inputDimension, preprocessingVersion, protocolVersion, dataset/split version, threshold hoặc `null`, metrics hoặc `null`, thời điểm, code commit, trạng thái và quyết định phê duyệt. File manifest đủ cho giai đoạn đầu; chưa cần tạo bảng registry mới.

## 11. Config và các mục cần quyết định

Mỗi giá trị nên kèm `value`, `unit`, `status`, `source`, `approvedBy`, `approvedAt`, `configVersion`. Với giá trị số chưa xác định dùng `value: null`, `status: TODO_PILOT`, không truyền chuỗi `TODO_PILOT` vào phép toán. Config thiếu phải chặn nhánh quyết định phụ thuộc, không thay bằng 0 hay ngưỡng cũ.

| Mục | Trạng thái hiện tại | Bên cần quyết định/xác minh |
|---|---|---|
| Tuổi tối thiểu | 7 theo REQ, đưa vào config | Chủ đề tài/chuyên môn xác nhận protocol |
| Tuổi tối đa | `UNKNOWN` | Chuyên môn |
| Red flag và hướng dẫn đi khám | `TODO_PILOT` | Bác sĩ |
| Có cho đo khi đeo kính | `TODO_PILOT` | Bác sĩ + pilot ánh sáng |
| Bucket khoảng cách và khoảng cách mục tiêu | `TODO_PILOT`; 20–25 cm là giả thuyết | Pilot + chuyên môn |
| Sai số ước lượng khoảng cách | `UNKNOWN`; chưa xác minh khoảng 10% | Hiệu chuẩn thiết bị |
| Nét, pose, resolution, reflex, ổn định | `TODO_PILOT` | CV + pilot, ghi nguồn |
| Thời lượng pha, số chu kỳ Cover | `TODO_PILOT` | Chuyên môn |
| Gap, tỷ lệ frame hợp lệ, tracking quality | `TODO_PILOT` | Kỹ thuật + đánh giá pilot |
| Threshold Hirschberg theo bucket, threshold Cover | `TODO_PILOT` | Dữ liệu đúng protocol + chuyên môn |
| Bảng H × C × quality và ranh giới nhãn | Chưa duyệt | Chủ đề tài/bác sĩ |
| Số retry, retention, cỡ mẫu/split | Chưa duyệt | Nhóm nghiên cứu tương ứng |

Những mục này chưa ngăn việc soạn tài liệu, nhưng ngăn việc triển khai quyết định lâm sàng hoặc chạy train mà không có phê duyệt thích hợp.

## 12. Lộ trình triển khai tuần tự

| Phase | Công việc | Đầu ra và điều kiện kết thúc |
|---|---|---|
| 0 — Recon | Đọc đủ FE/BE, đối chiếu route/model/DB/camera và deployment được phép | `RECON.md`, sơ đồ luồng, file sẽ/không sửa, UNKNOWN và bằng chứng; dừng chờ duyệt |
| 1 — Dataset audit | Kiểm kê bộ ảnh và các nguồn chuỗi thời gian riêng biệt | Báo cáo phân bố, domain, consent/nhãn/ID, giới hạn sử dụng; dừng chờ duyệt |
| 2 — Checklist/camera | Luồng trước quyền camera, eligibility, camera sau, torch fallback | UI/ảnh chụp, metadata selfReported, flag giữ luồng cũ; dừng chờ duyệt |
| 3 — Quality/thu mẫu | Gate client, reflex thô, ảnh gốc, timestamp và state machine | Demo trên thiết bị mục tiêu, contract dữ liệu, danh sách TODO; dừng chờ duyệt |
| 4 — Backend đo lường | Schema, geometry, Cover experimental, tổng hợp theo bảng được duyệt | API/tests, log/version, không thay model cũ; dừng chờ duyệt |
| 5 — Dữ liệu/pipeline | Consent nghiên cứu, nhãn, manifest, split, script train/eval, governance | Code + tài liệu; **chưa train**; dừng chờ duyệt |
| Sau Phase 5 | Pilot/thu đủ dữ liệu, sau đó train ứng viên nếu có xác nhận riêng | Báo cáo nghiên cứu và model candidate; không tự triển khai production |

Tài liệu này không thay thế báo cáo recon đầy đủ và không đánh dấu Phase 0–5 đã hoàn thành. Khi bắt đầu thực thi, thực hiện Phase 0 trước đúng yêu cầu nguồn.

## 13. Kiểm thử và nghiệm thu

| Nhóm test | Ca cần có | Kết quả bắt buộc |
|---|---|---|
| Consent/tuổi/red flag | Chưa consent, ngoài tuổi, có red flag | Không mở quy trình inference mới |
| Checklist/quality | Tick “đã bật đèn” nhưng reflex không đạt | Không được chụp như dữ liệu hợp lệ |
| Camera | Android torch có/không/lỗi; iOS; camera sau không khả dụng | Nhánh đúng, fallback rõ, không âm thầm dùng camera trước |
| Capture | Ảnh gốc và crop cũ, xoay/mirror, thay camera | Giữ đúng kích thước và transform, không dùng crop sai contract |
| Geometry | OD/OS, chấm phía mũi/thái dương, ảnh mirror | Dấu đúng, raw px và normalized value tái lập |
| Reflex | Không chấm, nhiều chấm, phản xạ kính | Không ép thành kết quả bình thường |
| Timestamp | Trùng/lùi, gap, FPS không đều, callback chậm | Reject/đánh dấu đúng; vận tốc dùng Δt thực, không tính xuyên gap |
| Cover | Mắt bị che, blink, người che sai thời điểm, baseline không ổn định | Phân biệt visibility/sự kiện, không coi occlusion là bệnh |
| Kết quả | Low quality, thiếu phép đo, Cover thử nghiệm | Không cấp `SCREENING_NORMAL` sai quy tắc |
| Hệ thống | Timeout, model lỗi, storage fallback | Lỗi rõ, không giả kết luận hoặc giả lưu bền vững |
| Tương thích | Endpoint/model cũ trước và sau bật flag | Hành vi cũ được bảo toàn bằng fixture/contract test |
| Feature | Thiếu/sai thứ tự/sai chiều/NaN | `FEATURE_CONTRACT_MISMATCH` hoặc lỗi validation thích hợp |
| Dataset | Cùng người ở nhiều session/bucket, ảnh trùng | Không xuất hiện xuyên split |
| Privacy | Không consent nghiên cứu, rút consent, kiểm tra log | Không đưa dữ liệu vào train ngoài phạm vi được phép |

Chuỗi tín hiệu tổng hợp cần có chuyển động đã biết, head shift chung, frame drop, blink và timestamp không đều để kiểm tra công thức. Chúng không chứng minh sensitivity/specificity lâm sàng. Test thiết bị thật cần bao phủ các nhóm thiết bị được dự kiến hỗ trợ; ma trận cụ thể quyết định sau kiểm kê pilot.

Lệnh kiểm tra frontend hiện được khai báo trong `FE/package.json:6`: `npm test`, `npm run lint`, `npm run build`. Backend dùng pytest theo `BE/requirements.txt:8`; chọn test tương ứng thay đổi và tránh gọi DB/storage production. Trong lần soạn tài liệu này chưa chạy các lệnh kiểm thử ứng dụng vì không thay code.

## 14. Bố cục báo cáo NCKH đề xuất

1. Đặt vấn đề, phạm vi sàng lọc và mục tiêu nghiên cứu.
2. Cơ sở về Hirschberg/Cover, các giới hạn và công trình tham khảo đã được kiểm tra.
3. Thiết kế nghiên cứu: tuyển mẫu, consent, protocol, ground truth, cỡ mẫu và đánh giá.
4. Thiết kế hệ thống: frontend, backend, hợp đồng dữ liệu và quản trị dữ liệu.
5. Phương pháp CV/AI: detector, quality, geometry, time series, baseline và train ứng viên.
6. Thực nghiệm: độ lặp lại, khoảng cách/thiết bị, hiệu năng và khoảng tin cậy.
7. Thảo luận: domain shift, lác giả, ngắt quãng, dữ liệu thiếu, giới hạn tổng quát hóa.
8. Kết luận trong phạm vi bằng chứng và kế hoạch nghiên cứu tiếp theo.
9. Phụ lục: phiên bản protocol/config, checklist, data dictionary, split manifest và model card.

Không điền kết quả thí nghiệm giả. Những phần chưa có số liệu ghi “chưa thực hiện” hoặc `UNKNOWN`.

## 15. Tình trạng của lần bàn giao tài liệu này

- Tạo: `D:/AI_Check_Lac/NCKH.md`.
- Đã tham khảo mã FE tại `D:/AI_Check_Lac` và BE tại `D:/REMICARE-STRABISMUS-AI`, cùng đặc tả REQ.
- Thay đổi UI/API/DB/model: không.
- Train, migration, deployment: chưa thực hiện.
- Test ứng dụng: chưa chạy; kiểm tra tài liệu riêng không tương đương test chức năng.
- Chưa được đưa lên production: ngưỡng mới, kết luận H + C chưa duyệt, pipeline Hirschberg chưa hiệu chuẩn, model nghiên cứu chưa đánh giá độc lập.

| Câu hỏi kiểm soát | Trạng thái hiện tại | Bằng chứng/phạm vi |
|---|---|---|
| Checklist mới có chặn khi quality fail? | `UNKNOWN` về runtime; là yêu cầu sẽ triển khai | Mục 5 và 13; chưa thay UI |
| Torch Android có fallback đèn ngoài? | `UNKNOWN` về runtime; là yêu cầu sẽ triển khai | Mục 5.2; camera hiện có tại `FE/src/services/cameraService.js:49` |
| Dấu mũi/thái dương đã nhất quán hai phía? | `UNKNOWN`, cần test | Contract đề xuất mục 6.3–6.4 |
| Low quality có bị ép ra kết quả? | `UNKNOWN` đối với toàn hệ thống đang chạy | Cần audit/test end-to-end; ràng buộc mục 7 |
| Model production có bị thay đổi trong lần này? | Không | Phạm vi thay đổi chỉ file tài liệu |
| Pipeline train/validation có leakage? | `UNKNOWN` đối với pipeline cũ | Chưa audit dữ liệu/split; kế hoạch kiểm soát mục 9.5 |
| Legacy đã bị dùng chọn ngưỡng/train? | `UNKNOWN` về lịch sử; không trong lần này | Chưa chạy train hoặc audit provenance; giới hạn mục 8.1 |

**Bước thực thi đầu tiên sau khi duyệt kế hoạch: Phase 0 — lập RECON.md đầy đủ, khóa hợp đồng hiện tại và danh sách UNKNOWN trước khi sửa code.**
