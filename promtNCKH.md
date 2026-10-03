# Prompt thực hiện từng phase — RemiCare Strabismus AI

Tài liệu điều phối AI thực hiện kế hoạch `D:/AI_Check_Lac/NCKH.md`.
Ngày soạn: 03/10/2026. Các prompt bên dưới là chỉ dẫn cho lần thực thi sau; việc tạo file này không có nghĩa đã thực hiện hoặc duyệt bất kỳ phase nào.

## Cách sử dụng

1. Mở workspace có thể đọc cả hai repository. Khi cần sửa backend, cấp quyền ghi cho `D:/REMICARE-STRABISMUS-AI`; không để AI lách quyền hoặc tạo backend giả trong frontend.
2. Sao chép **một khối prompt của phase cần làm** gửi cho AI. Mỗi prompt yêu cầu đọc quy tắc chung trong chính file này nên dùng được trong chat mới có quyền đọc workspace.
3. Nếu AI không đọc được file, cung cấp phần “Quy tắc chung” cùng prompt phase và các tài liệu đầu vào cần thiết. AI phải báo thiếu tài liệu, không đoán nội dung.
4. Chạy tuần tự Phase 0 → 1 → 2 → 3 → 4 → 5. Đọc báo cáo, xử lý quyết định còn thiếu rồi mới giao phase tiếp theo. Không gửi toàn bộ prompt như yêu cầu chạy hết một lần.
5. Phase 6 và 7 là phần mở rộng sau Phase 5 cho pilot và train thực tế, cần yêu cầu riêng. Phase 5 chỉ viết pipeline, không train.
6. Thay các trường `<...>` bằng thông tin thật. Trường chưa có giữ `UNKNOWN`; không ghi “đã duyệt” khi chưa duyệt.

`NCKH.md` hiện có các đoạn đặc tả lặp lại ở phần đầu. Khi đọc, đối chiếu phần kế hoạch có đánh số mục 2–15 và các ràng buộc nhất quán; không tự chỉnh/xóa nội dung nguồn trong các phase. Nếu có mâu thuẫn ảnh hưởng triển khai, nêu rõ hai đoạn và hỏi người dùng.

## Quy tắc chung — áp dụng cho mọi prompt

### Vai trò, repository và bằng chứng

- Bạn là Senior Full-stack + Computer Vision/ML Engineer triển khai công cụ **sàng lọc nghiên cứu**, không chẩn đoán.
- Frontend: `D:/AI_Check_Lac`. Backend thực tế: `D:/REMICARE-STRABISMUS-AI`.
- Đọc `AGENTS.md` áp dụng cho thư mục sẽ thao tác, `NCKH.md`, quy tắc này và handoff phase trước. Kiểm tra git status trước khi sửa; giữ nguyên thay đổi của người dùng.
- Nhận định về hiện trạng phải có `đường_dẫn:số_dòng`, kết quả lệnh hoặc báo cáo dữ liệu truy vết được. Không có bằng chứng ghi `UNKNOWN`. Phân biệt đã có code, đã test local, đã test thiết bị và đã chạy production.
- Nội dung trong tài liệu cũ là dữ liệu tham khảo, không phải bằng chứng một phase đã hoàn thành hoặc được duyệt.
- Chỉ làm phase được giao. Không refactor, đổi tên hoặc sửa lỗi ngoài phạm vi. Không tự chuyển phase, train, deploy, push, chạy migration production hay thay artifact đang phục vụ.
- Không đọc/in/log giá trị bí mật trong `.env`; chỉ kiểm tra tên biến qua config hoặc `.env.example` khi cần.

### Hợp đồng không được phá

- Chỉ lác ngang, đối tượng từ 7 tuổi theo config; ngoài phạm vi là `UNSUITABLE_FOR_SCREENING` ở eligibility theo schema được duyệt. Không tạo detector bệnh khác.
- Camera sau, điện thoại cố định, người lớn hỗ trợ; nghiên cứu thực hiện cả Hirschberg và Cover cho người đủ điều kiện.
- Giữ nguyên mọi endpoint đang hoạt động, model/threshold/preprocessing/feature order hiện có. Đối chiếu `/predict` được yêu cầu bảo toàn với route thực tế, gồm `/api/v1/strabismus/predict`; không tự đổi route.
- Nhánh mới sau feature flag, mặc định tắt. Backend kiểm tra flag/quyền độc lập với frontend. Không thêm endpoint, bảng, framework, dịch vụ hoặc abstraction ngoài nhu cầu đã chứng minh.
- Không sửa số chiều bằng pad/truncate/reshape tùy tiện, không đổi feature thiếu thành 0 để vượt kiểm tra. Sai contract phải dừng inference.
- Chỉ feature đo sàng lọc theo trục x. Tọa độ y chỉ được dùng cho crop/pose/visibility khi cần, không làm feature lệch dọc của model mới.
- Dùng tâm mống mắt/limbus; không tâm đồng tử. Dấu `+` về mũi, `−` về thái dương; OD/OS theo người tham gia, không theo màn hình.
- Không dùng hình dáng mắt hoặc khoảng cách mắt–mũi để phân loại; không quy đổi pixel/normalized displacement thành PD/độ khi chưa có hiệu chuẩn được duyệt.
- Client thu dữ liệu và kiểm tra quality, server tính feature đo lường chính thức. Không có hai implementation quyết định sàng lọc khác nhau giữa JS và Python.
- Timestamp gắn đúng frame, có đơn vị và nguồn. Không suy từ frame index/FPS giả định. Mốc che/mở lấy từ visibility thực, không từ thời điểm UI ra lệnh.
- Mắt bị che = `OCCLUDED`; chỉ đo mắt còn quan sát được. Không tính vận tốc xuyên gap hoặc baseline không hợp lệ.
- Cover luôn `EXPERIMENTAL`; không dùng Cover để cấp `SCREENING_NORMAL`. `possible_inward/outward` chỉ là thông tin phụ.
- Kết quả: `SCREENING_NORMAL | REVIEW_REQUIRED | INCONCLUSIVE | QUALITY_FAIL | SYSTEM_ERROR`. Bảng H × C × quality và ranh giới nhãn phải được duyệt; không tự chuyển nhãn cũ bằng đổi tên.
- Low quality không ra bình thường; lỗi hệ thống không ra bình thường. Checkbox tự khai không thay phép kiểm tra thực.
- Ngưỡng chưa có căn cứ: `value: null`, `status: TODO_PILOT`, có trường nguồn/phê duyệt/version. Không dùng chuỗi TODO trong phép toán hay mặc định về 0.
- Khi thiếu quyết định lâm sàng: dừng phần phụ thuộc và hỏi rõ. Chỉ tiếp tục việc độc lập, an toàn, trong phase; không tự nhận phần bị chặn là hoàn tất. Có thể viết scaffold chưa hoạt động, không tự tạo ngưỡng để bật pilot.
- Không dùng production để train mặc định, không log ảnh mặt/base64, không lưu hình không cần thiết. Consent nghiên cứu riêng, dữ liệu người tham gia được giả danh hóa.
- Legacy không đúng Hirschberg chỉ dùng audit/detector/quality/thăm dò; không train classifier Hirschberg, chọn ngưỡng reflex hoặc báo sensitivity/specificity lâm sàng từ tập đó.

### Báo cáo và điểm dừng

Mọi phase ghi handoff tại `D:/AI_Check_Lac/docs/nckh/PHASE_<N>_HANDOFF.md` để không ghi đè handoff cũ trong `docs/phases/`. Tạo thư mục nếu cần. Nếu handoff đã tồn tại, cập nhật có ngữ cảnh, giữ quyết định đã duyệt; không coi file tồn tại là bằng chứng phê duyệt.

Handoff gồm:

1. Mục tiêu; phần đã làm; phần còn thiếu; trạng thái `READY_FOR_REVIEW` hoặc `BLOCKED`.
2. File đã đọc/tạo/sửa, đường dẫn và dẫn chứng dòng quan trọng.
3. Thay đổi UI/API/DB/model; tác động khi flag tắt/bật.
4. Lệnh kiểm tra thực sự đã chạy; PASS/FAIL/NOT_RUN và nguyên nhân. Không ghi PASS cho test chưa chạy.
5. Config còn TODO_PILOT, quyết định cần người dùng/bác sĩ, rủi ro và cách tắt/hoàn tác nhánh mới.
6. Kết luận Có/Không/UNKNOWN kèm bằng chứng về: quality chặn đúng, torch fallback, dấu tọa độ, low-quality không thành bình thường, model cũ được giữ, leakage, sử dụng legacy.
7. Điều kiện cần đủ để làm phase sau. Kết thúc lượt, không tự bắt đầu phase sau.

## Prompt Phase 0 — Recon hai repository

```text
Chỉ thực hiện PHASE 0 — RECON cho RemiCare Strabismus AI.

Trước tiên đọc và tuân thủ “Quy tắc chung” trong
D:/AI_Check_Lac/promtNCKH.md và kế hoạch D:/AI_Check_Lac/NCKH.md.
Frontend: D:/AI_Check_Lac.
Backend: D:/REMICARE-STRABISMUS-AI.

PHẠM VI: chỉ đọc code/config/metadata; được tạo báo cáo. Không sửa code,
dataset, model, dependency hoặc cấu hình runtime. Không gọi API production.

CÔNG VIỆC:
1. Kiểm tra hướng dẫn repository và git status của cả hai repo.
2. Vẽ luồng hiện tại từ nút sàng lọc đến camera, MediaPipe, capture,
   ONNX client, request backend, storage và màn hình kết quả.
3. Đọc camera constraints/fallback, lifecycle, mirror/orientation,
   timestamp và cách gắn landmark với frame; không suy từ comment.
4. Kiểm kê endpoint đang đăng ký, schema, validation, lỗi, DB models,
   migration, storage thật/fallback và feature flag hiện có.
5. Lập bảng từng model: artifact path, version, input shape/dimension,
   feature order/version, preprocessing, threshold, nơi load và nơi gọi.
   Phân biệt metadata khai báo với graph/model thực sự đã kiểm tra.
   Không nạp joblib/pickle chưa rõ nguồn gốc chỉ để đọc metadata.
6. Đối chiếu mục tiêu Hirschberg + Cover với hiện trạng; xác định phần
   dùng lại được, phần thiếu và điểm xung đột. Không sửa trong phase này.
7. Kiểm kê test/command hiện có; nêu phạm vi kiểm tra an toàn trên local.
8. Lập bảng file dự kiến sửa theo từng phase và file/model không được sửa.

ĐẦU RA:
- D:/AI_Check_Lac/RECON.md.
- D:/AI_Check_Lac/docs/nckh/PHASE_0_HANDOFF.md.
- Mỗi nhận định hiện trạng có đường_dẫn:số_dòng; runtime chưa kiểm tra
  ghi UNKNOWN. Nêu riêng thông tin dataset và quyết định lâm sàng còn thiếu.

NGHIỆM THU: có sơ đồ luồng, bảng API/model/DB, kế hoạch file theo phase,
UNKNOWN và không có thay đổi code ứng dụng.
Kết thúc bằng báo cáo ngắn và dừng chờ duyệt. Không thực hiện Phase 1.
```

## Prompt Phase 1 — Audit dữ liệu, không train

```text
Chỉ thực hiện PHASE 1 — DATASET AUDIT.
Đọc Quy tắc chung tại D:/AI_Check_Lac/promtNCKH.md, NCKH.md,
RECON.md và docs/nckh/PHASE_0_HANDOFF.md. Kiểm tra bằng chứng Phase 0
đã được duyệt; nếu thiếu, nêu rõ và chưa thực hiện công việc phụ thuộc.

ĐẦU VÀO:
- Thư mục ảnh legacy: <đường dẫn hoặc UNKNOWN>.
- Mô tả nguồn/nhãn/consent: <tài liệu hoặc UNKNOWN>.
- Nguồn chuỗi thời gian khác, nếu có: <đường dẫn hoặc UNKNOWN>.
Nếu đường dẫn chưa có, kiểm tra các vị trí dataset đã được xác nhận trong
RECON; nếu vẫn thiếu thì hỏi đường dẫn, không quét toàn máy hoặc suy đoán.

PHẠM VI: dữ liệu gốc chỉ đọc. Chỉ ghi báo cáo và manifest audit mới.
Không di chuyển/xóa/đổi nhãn nguồn, không train và không chọn threshold.

CÔNG VIỆC:
1. Đếm ảnh hợp lệ/hỏng/trùng, kích thước, định dạng, nhãn và phân bố.
2. Kiểm tra có lớp bình thường, lác ngang, ngoài phạm vi; đánh dấu loại
   khỏi phân tích trong manifest, không xóa ảnh gốc.
3. Đánh giá participant ID và các lần chụp cùng người. Không coi tên file
   là ID đã xác minh; thiếu thông tin ghi UNKNOWN.
4. Gắn domain=legacy_non_hirschberg trong manifest của tập legacy.
   Dữ liệu chuỗi nguồn khác phải audit riêng, không tự coi là Cover đúng protocol.
5. Lập rubric reflex rõ/không rõ/không xác định. Báo kiểm tra toàn bộ hay
   mẫu, số mẫu đã xem và giới hạn; không ngoại suy thành đã gán nhãn toàn tập.
6. Kiểm tra nguồn/máy/ánh sáng có đồng biến với nhãn không. Metadata thiếu
   phải ghi UNKNOWN, không khẳng định không có domain bias.
7. Kiểm tra người gán nhãn, phương pháp/ngày khám, consent/quyền dùng.
8. Đề xuất dữ liệu cần thu thêm cho detector, Hirschberg và Cover.

ĐẦU RA:
- docs/nckh/DATASET_AUDIT.md.
- docs/nckh/dataset_audit_manifest.jsonl, dùng ID giả danh và thông tin
  tối thiểu; không đưa tên thật/ảnh vào báo cáo công khai hoặc commit.
- docs/nckh/PHASE_1_HANDOFF.md.

NGHIỆM THU: số liệu có mẫu số và nguồn; manifest khớp báo cáo; dữ liệu
nguồn nguyên vẹn. Ghi “exploratory, không phải bằng chứng lâm sàng”.
Không báo sensitivity/specificity, không train Hirschberg bằng legacy.
Dừng sau báo cáo; hỏi thông tin thiếu, không chuyển Phase 2.
```

## Prompt Phase 2 — Checklist và camera

```text
Chỉ thực hiện PHASE 2 — CHECKLIST + CAMERA FRONTEND.
Đọc Quy tắc chung tại D:/AI_Check_Lac/promtNCKH.md, NCKH.md,
RECON.md và handoff Phase 0–1. Chỉ triển khai trên cơ sở phase trước
đã được duyệt; quyết định chưa có phải giữ TODO_PILOT.

PHẠM VI: frontend và test/tài liệu liên quan. Không thay backend/model.
Nhánh nghiên cứu sau feature flag mặc định tắt, giữ luồng cũ.

CÔNG VIỆC:
1. Checklist trước getUserMedia: consent/version, tuổi theo config,
   red flag do bác sĩ cung cấp, kính, cố định điện thoại, tư thế, ánh sáng,
   target sát ống kính và người hỗ trợ. Mỗi màn hình một việc, chữ lớn,
   minh họa đơn giản và ngôn ngữ cho phụ huynh.
2. Red flag hoặc tuổi không phù hợp: dừng, không inference. Thiếu danh sách
   red flag/chế độ kính: placeholder chưa cho vận hành, hỏi người dùng.
3. Lưu câu trả lời dưới selfReported; không coi là quality đã đạt.
4. Chỉ xin quyền camera sau checklist. Yêu cầu camera sau, đàm phán
   resolution và xác minh settings thật; không fallback camera trước.
5. Sau khi có track, Android kiểm tra capability torch và thử bật.
   Không hỗ trợ/lỗi → hướng dẫn đèn nhỏ bên ngoài sát camera.
   iOS dùng nhánh đèn ngoài theo protocol. OS không thay capability check.
6. Ghi imageWidth/Height, device/browser/OS/camera; không biết lens thì UNKNOWN.
7. Xử lý quyền từ chối, thiết bị không đạt, xoay máy/background, tắt track
   và torch khi thoát. Không làm mất luồng cũ.
8. Tạo giao diện tích hợp quality cho Phase 3: trạng thái chưa có kết quả
   xác minh phải chặn thu mẫu, không mock GOOD trong runtime.

KIỂM TRA:
- Chưa hoàn tất checklist không gọi getUserMedia.
- Consent/tuổi/red flag không hợp lệ không gọi inference.
- Torch hỗ trợ, không hỗ trợ và lỗi; fallback đúng.
- Flag tắt giữ hành vi cũ; chưa có quality không cho chụp nghiên cứu.
- Chạy test phù hợp, lint/build; kiểm tra UI bằng công cụ sẵn có.
  Mock test không thay thử thiết bị thật; trường hợp chưa thử ghi NOT_RUN.

ĐẦU RA: code frontend, ảnh chụp UI thực nếu công cụ cho phép,
docs/nckh/PHASE_2_HANDOFF.md và danh sách config cần duyệt.
Không tự triển khai reflex detector hoặc backend Phase 3–4. Dừng chờ duyệt.
```

## Prompt Phase 3 — Quality gate và thu dữ liệu chuẩn

```text
Chỉ thực hiện PHASE 3 — FRONTEND QUALITY GATE + CAPTURE.
Đọc Quy tắc chung tại D:/AI_Check_Lac/promtNCKH.md, NCKH.md,
RECON.md và handoff Phase 0–2; kiểm tra Phase 2 đã được duyệt.

PHẠM VI: client quality, capture và hợp đồng dữ liệu đề xuất.
Không tính kết luận sàng lọc ở client, không thay model hiện tại.

CÔNG VIỆC:
1. Quality từng mục GOOD/WARNING/INVALID: mặt/hai mắt/iris, che khuất,
   pose yaw/pitch/roll, nét, phơi sáng, ngược sáng, resolution và ổn định.
2. Viết module reflex quality riêng: ROI iris, vùng sáng ứng viên, số điểm
   mỗi mắt và vị trí thô. Phân biệt phản xạ kính/nguồn sáng phụ; không coi
   MediaPipe đã cung cấp corneal reflex. Không xuất diagnosis/PD.
3. Khoảng cách 20–25 cm và sai số khoảng 10% chỉ là giả thuyết pilot.
   Ghi uncertainty và cơ sở hiệu chuẩn; thiếu dữ liệu không tạo số cm giả.
4. Config chưa được duyệt phải chặn quyết định phụ thuộc; threshold trong
   fixture test chỉ là dữ liệu test, không trở thành default runtime.
5. Chỉ chụp khi gate bắt buộc đạt, dù checklist đã tick. Retry theo config;
   hết retry theo quy tắc đã duyệt thì INCONCLUSIVE.
6. Capture Hirschberg ảnh gốc chất lượng cao, JPEG nén nhẹ theo config,
   không resize thành crop input model cũ; ghi orientation/mirror, width/
   height, distance/bucket/uncertainty, focus, lighting/reflex count, kính,
   thiết bị và ghi chú nguồn sáng. Không lưu dài hạn nếu chưa consent riêng.
7. Cover state machine:
   INITIALIZING → READY → BASELINE → COVER_OD → UNCOVER_OD
   → COVER_OS → UNCOVER_OS → DONE.
   Tách instructedPhase và observedPhase; sự kiện từ visibility.
8. Timestamp gắn frame đầu vào tracker; ưu tiên requestVideoFrameCallback,
   định nghĩa time origin/đơn vị/timestampSource. Fallback phải ghi giới hạn.
   Chống landmark trả muộn bị ghép vào timestamp frame khác.
9. Thu iris_x, canthi, visibility, phase, quality và timestamp; mắt bị che
   OCCLUDED, không dùng để đo chuyển động. Đánh dấu gap, blink, mất tracking.
10. Chưa có endpoint nghiên cứu thì dùng fixture adapter local tách biệt,
    không gửi ảnh gốc sang endpoint bilateral ROI cũ, không giả response thật.

KIỂM TRA: tick đèn nhưng gate fail vẫn chặn; reflex 0/1/nhiều; blur/pose;
orientation/mirror và OD/OS; timestamp lùi/trùng/gap; FPS không đều;
async tracking; occlusion/blink; stop/resume; metadata và ảnh gốc đúng kích thước.

ĐẦU RA:
- Code và test frontend đúng phạm vi.
- docs/nckh/RESEARCH_DATA_CONTRACT.md: schema/feature/protocol version,
  hệ tọa độ, timestamp, null semantics, payload mẫu giả lập và field required.
- docs/nckh/PHASE_3_HANDOFF.md; kết quả thiết bị thật hoặc NOT_RUN.
Dừng chờ duyệt. Không triển khai backend Phase 4.
```

## Prompt Phase 4 — Backend hình học, Cover và tổng hợp

```text
Chỉ thực hiện PHASE 4 — BACKEND RESEARCH PIPELINE.
Đọc Quy tắc chung tại D:/AI_Check_Lac/promtNCKH.md, NCKH.md,
RECON.md, RESEARCH_DATA_CONTRACT.md và handoff Phase 0–3.
Kiểm tra phase trước và contract đã được duyệt; xác minh quyền ghi backend.

PHẠM VI: backend tại D:/REMICARE-STRABISMUS-AI và adapter frontend tối
thiểu để tích hợp contract mới. Không thay model/threshold/contract cũ.

CÔNG VIỆC:
1. Chốt endpoint nghiên cứu tối thiểu có version sau audit; reuse health,
   lifecycle, schema/validation hiện có khi phù hợp. Flag mặc định tắt.
2. Validate schemaVersion, featureVersion, testType, sessionId, eligibility,
   consent, distance_bucket, image format/byte/pixel limits và landmarks.
   Reject NaN/Infinity, timestamp lùi/trùng, thiếu/sai pha. Gap lớn phải
   đánh dấu và chia đoạn, không tính xuyên gap.
3. Hirschberg server: decode ảnh gốc/orientation; tìm iris/limbus và reflex;
   quy đổi hướng mũi/thái dương; tính raw px và normalized displacement
   theo đường kính iris cùng feature liên mắt trong contract được duyệt.
   Reflex không có/nhiều không phân biệt được → INCONCLUSIVE.
   Không đổi sang PD/độ; chưa hiệu chuẩn bucket thì không phân loại.
4. Cover server: baseline ổn định, sự kiện che/mở từ quan sát, bù tịnh tiến
   đầu bằng iris tương đối canthi, chuẩn hóa theo khe mắt; chỉ phân tích
   mắt quan sát được. Tính amplitude/hướng/velocity/latency/settling theo Δt.
   Luôn EXPERIMENTAL; chưa có ngưỡng chỉ ghi measurements, không kết luận giả.
5. Quality-aware: định nghĩa validFrameRatio/trackingConfidence/fps/blink/
   occlusion và mẫu số theo pha; occlusion chủ đích không tự làm phiên fail.
6. Tổng hợp H × C × quality chỉ theo bảng người dùng/bác sĩ đã duyệt.
   Chưa có bảng thì hỏi và khóa chức năng kết luận; có thể hoàn tất đo lường
   độc lập, không tự gán SCREENING_NORMAL hoặc weighted average.
7. Lỗi chuẩn hóa, SYSTEM_ERROR không NORMAL; không lộ stack trace ra client.
   Log ID/version/latency/quality/result, không ảnh/base64/PII/secret.
8. Model load một lần, server quyết model. Feature mới không vào model cũ.
   Bảo toàn endpoint ảnh ROI hiện có và đường inference cũ.
9. Chỉ thay DB nếu contract được duyệt thực sự cần; viết migration riêng
   và thử trên DB local cô lập, không chạy trên production.

KIỂM TRA:
- Hình học đã biết đáp án cho cả OD/OS/mirror, mẫu số bằng 0, reflex mơ hồ.
- Cover tổng hợp có amplitude/thời điểm đã biết, head shift, blink, gap,
  timestamp lỗi/FPS không đều; không coi kết quả này là bằng chứng lâm sàng.
- Low quality/lỗi hệ thống, sai feature contract, thiếu config/bảng kết hợp.
- Integration client-server theo fixture; flag off và endpoint/model cũ.
- Nếu có video người bình thường đã consent/ground truth, đo báo động giả;
  nếu không có ghi NOT_RUN, không suy sensitivity từ dữ liệu giả lập.

ĐẦU RA: code/tests, contract cập nhật nếu được duyệt,
docs/nckh/PHASE_4_HANDOFF.md. Báo quyết định còn thiếu và phần bị khóa.
Dừng; không thu dữ liệu người thật, train hoặc deploy tự động.
```

## Prompt Phase 5 — Thu nghiên cứu và chuẩn bị pipeline train

```text
Chỉ thực hiện PHASE 5 — DATA COLLECTION INFRASTRUCTURE + TRAINING PIPELINE.
Đọc Quy tắc chung tại D:/AI_Check_Lac/promtNCKH.md, NCKH.md,
RECON.md, dataset audit, contract và handoff Phase 0–4 đã được duyệt.
Đọc DATA_GOVERNANCE.md và MODEL_REGISTRY.md hiện có trong backend trước
khi cập nhật; không tạo tài liệu/bảng trùng chức năng.

GIỚI HẠN: viết code + tài liệu + test bằng fixture giả lập. CHƯA chạy train,
chưa thu người thật, chưa tự export dữ liệu production hoặc thay artifact.

CÔNG VIỆC:
1. Thiết kế dữ liệu logic Participant → Session → Hirschberg/Cover,
   consent nghiên cứu/version, pseudonymous ID, nhãn bác sĩ và provenance.
   Reuse schema hiện có nếu đủ; chỉ thêm persistence tối thiểu được duyệt.
2. Tách consent sàng lọc, lưu ảnh/video và sử dụng train. Không consent
   tương ứng thì không lưu hoặc xuất dataset cho mục đích đó.
3. Ground truth gồm loại lác ngang, ngắt quãng, kính, lác giả, phương pháp/
   ngày khám, người gán nhãn được giả danh hóa; không dùng model làm nhãn.
4. Distance experiment: cấu hình nhiều bucket đã duyệt trên cùng người,
   ghi khoảng cách tham chiếu; xuất báo cáo nét, một reflex/mắt, độ lặp lại
   và phân bố độ dịch. Không tự chọn khoảng cách chuẩn.
5. Chuẩn bị pipeline audit → validate consent/labels → manifest → group
   split → extract features → train candidate → validation → locked test
   → registry. Các bước train chưa được chạy trong phase này.
6. Split theo participant trước crop/augmentation; kiểm tra trùng dữ liệu,
   nhiều session/bucket và cross-source identity. Thiếu ID đáng tin phải chặn.
7. Scaler/feature selection/sampling chỉ fit train fold; threshold chỉ chọn
   validation theo mục tiêu đã duyệt; test không được dùng tuning.
8. Ghi seed, environment, code commit, dataset/split/annotation/feature/
   preprocessing version, hyperparameter, artifact hash và ngày chạy.
9. Chuẩn bị metrics sensitivity/specificity/PPV/NPV/ROC-AUC/PR-AUC/confusion
   matrix, coverage/inconclusive và khoảng tin cậy theo người. MAE/RMSE/
   bias/Bland–Altman chỉ khi có đại lượng tham chiếu cùng đơn vị.
10. Registry file-based nếu đủ: unknown threshold/metrics là null,
    trạng thái research_candidate; không tự thêm DB registry hoặc publish model.
11. Governance: lưu gì/vì sao/ai truy cập/bao lâu/xóa thế nào/được train không;
    retention chưa duyệt không tự điền. Kiểm tra storage lưu bền vững,
    không coi fallback bộ nhớ là lưu nghiên cứu thành công.
12. Viết hướng dẫn annotation iris/reflex/visibility và model card template;
    tách detector/CV, rule-based baseline và classifier nghiên cứu.

KIỂM TRA CHO PHÉP: schema/consent validation, split overlap, dedup,
manifest/version, reproducibility của split, registry validation và report
generation bằng fixture giả lập. Không gọi fit/training như một cách test
để vượt giới hạn CHƯA TRAIN.

ĐẦU RA:
- Code pipeline và README hướng dẫn, không tạo kết quả huấn luyện giả.
- Cập nhật governance/registry đúng repository khi có quyền.
- docs/nckh/DATA_COLLECTION_PROTOCOL.md.
- docs/nckh/TRAINING_READINESS.md: READY/NOT_READY với từng bằng chứng.
- docs/nckh/PHASE_5_HANDOFF.md.
Dừng chờ duyệt. Chỉ chạy train trong yêu cầu riêng sau khi đủ điều kiện.
```

## Prompt Phase 6 — Pilot và kiểm tra dữ liệu sẵn sàng (mở rộng)

Chỉ sử dụng sau Phase 5; đây không phải sự cho phép AI tự tuyển người hoặc tiến hành nghiệm pháp y khoa. Con người phụ trách thu theo protocol đã được duyệt; AI hỗ trợ kiểm tra và phân tích dữ liệu được phép sử dụng.

```text
Chỉ thực hiện PHASE 6 — PILOT DATA REVIEW + TRAINING READINESS.
Đọc Quy tắc chung tại D:/AI_Check_Lac/promtNCKH.md, NCKH.md,
handoff Phase 0–5, DATA_COLLECTION_PROTOCOL.md và TRAINING_READINESS.md.

ĐẦU VÀO CẦN XÁC NHẬN:
- Protocol/config/consent được duyệt: <tài liệu và phiên bản>.
- Dataset pilot được phép phân tích: <đường dẫn hoặc UNKNOWN>.
- Ground truth và liên kết participant: <manifest hoặc UNKNOWN>.
- Mục tiêu thống kê/cỡ mẫu/điều kiện đánh giá: <quyết định hoặc UNKNOWN>.
Thiếu đầu vào thì hỏi, không tự thay bằng dữ liệu production/legacy.

CÔNG VIỆC:
1. Kiểm tra dữ liệu đúng protocol, consent, version, label và identity.
2. Báo attrition, completeness, quality fail/inconclusive, thiết bị/kính/
   bucket và số người, không chỉ số ảnh/frame.
3. Đánh giá detector/reflex, nét, độ lặp lại và timestamp/phase bằng
   reference annotation khi có; thiếu reference thì nêu giới hạn.
4. Phân tích thí nghiệm khoảng cách, error modes và domain/source bias.
5. Đề xuất điều chỉnh protocol/ngưỡng trên dữ liệu phát triển cho người
   phụ trách duyệt; không tự cập nhật runtime, không nhìn test để chọn.
6. Kiểm tra đủ dữ liệu cho thiết kế train/validation/test độc lập, leakage,
   nhân lực annotation và nguồn lực tính toán. Không tự bịa cỡ mẫu tối thiểu.
7. Cập nhật TRAINING_READINESS.md với READY hoặc NOT_READY và bằng chứng.

ĐẦU RA: docs/nckh/PILOT_REPORT.md, TRAINING_READINESS.md cập nhật,
docs/nckh/PHASE_6_HANDOFF.md. Không fit model hoặc deploy.
Dừng; READY chỉ là đề xuất sẵn sàng, không phải người dùng đã cho chạy train.
```

## Prompt Phase 7 — Train ứng viên và đánh giá độc lập (mở rộng)

Chỉ gửi prompt này khi người dùng thực sự cho phép chạy huấn luyện. Không dùng phê duyệt Phase 5 thay cho phê duyệt train.

```text
Tôi yêu cầu thực hiện PHASE 7 — TRAIN VÀ ĐÁNH GIÁ MODEL NGHIÊN CỨU,
với điều kiện bằng chứng dưới đây đầy đủ và được xác minh trước khi chạy.
Đọc Quy tắc chung tại D:/AI_Check_Lac/promtNCKH.md, NCKH.md,
handoff Phase 5–6, TRAINING_READINESS.md và protocol/config đã duyệt.

PHẠM VI ĐƯỢC PHÉP:
- Bài toán được train: <detector iris/reflex HOẶC classifier Hirschberg
  HOẶC ứng viên Cover; không mặc định train tất cả>.
- Dataset manifest/version: <đường dẫn + version>.
- Split manifest/version: <đường dẫn + version>.
- Tiêu chí model/threshold/evaluation đã duyệt: <tài liệu>.
- Giới hạn compute/thời gian/lưu trữ: <giá trị được phép>.
- Thư mục artifact nghiên cứu riêng: <đường dẫn được phép ghi>.
Không thay model/threshold production. Trường bắt buộc chưa có → hỏi và
chưa train; không tự dùng legacy hoặc dữ liệu thiếu nhãn/consent.

CÔNG VIỆC:
1. Preflight consent, đúng protocol, ground truth, participant split,
   duplicate, leakage, schema/feature contract và quyền sử dụng dataset.
2. Khóa manifest/hash/code commit/environment/seed; xác nhận test chưa
   dùng tuning. Fit preprocessing chỉ trên train.
3. Huấn luyện baseline đơn giản và ứng viên đã duyệt trong ngân sách;
   ghi mọi experiment, không chỉ lần tốt nhất. Không tự thêm kiến trúc lớn.
4. Chọn model/hyperparameter/threshold trên validation theo mục tiêu đã
   duyệt, giữ ngưỡng theo bucket nếu contract quy định; không tự gộp bucket.
5. Khóa model rồi đánh giá test độc lập; báo metrics, confusion matrix,
   khoảng tin cậy theo người, coverage, inconclusive và các nhóm dữ liệu.
   Không báo metric bệnh học cho detector; dùng chỉ số đúng bài toán.
6. Với phép đo độ dịch, MAE/RMSE/bias/Bland–Altman chỉ so đại lượng cùng
   đơn vị. Không tự chuyển sang PD từ normalized displacement.
7. Báo false positive/false negative và giới hạn tổng quát hóa; hiệu năng
   thấp phải báo thật, không chỉnh test hoặc bỏ ca khó để làm đẹp kết quả.
8. Package artifact, model card, registry research_candidate; kiểm tra
   input dimension/order/version và inference parity nếu export.
9. Chứng minh artifact/model production không bị ghi đè. Không deploy,
   bật flag production hoặc cho model tự lựa chọn bằng input client.

ĐẦU RA: artifacts nghiên cứu, experiment logs/manifest,
docs/nckh/TRAINING_REPORT.md, docs/nckh/MODEL_CARD.md,
docs/nckh/PHASE_7_HANDOFF.md và registry cập nhật trạng thái nghiên cứu.
Dừng sau báo cáo; việc phát hành cần yêu cầu và đánh giá riêng.
```

## Prompt tiếp tục một phase đang dở

```text
Tiếp tục PHASE <N> đang dở, không chuyển sang phase khác.
Đọc D:/AI_Check_Lac/promtNCKH.md, prompt phase tương ứng,
docs/nckh/PHASE_<N>_HANDOFF.md và git diff hiện tại.

Thông tin/quyết định bổ sung của tôi: <nội dung thực tế>.
Chỉ cập nhật mục được quyết định; mục chưa trả lời vẫn UNKNOWN/TODO_PILOT.
Kiểm tra phần đã hoàn thành để tránh làm lại hoặc ghi đè thay đổi người dùng.
Hoàn tất phần còn lại trong phạm vi, chạy kiểm tra phù hợp và cập nhật handoff.
Nếu vẫn thiếu điều kiện bắt buộc, chỉ rõ phần bị chặn cùng câu hỏi cụ thể.
Kết thúc lượt sau báo cáo, không tự train/deploy hoặc chuyển phase.
```

## Prompt rà soát trước khi duyệt phase

```text
Chỉ REVIEW kết quả PHASE <N>, chưa sửa code và chưa thực hiện phase tiếp.
Đọc Quy tắc chung và prompt phase trong D:/AI_Check_Lac/promtNCKH.md,
NCKH.md, handoff tương ứng và diff của cả hai repository nếu liên quan.
Đối chiếu từng điều kiện nghiệm thu với code/test/output thực tế.
Ưu tiên tìm sai contract, thay model cũ, bypass quality/consent, sai dấu,
timestamp/gap/occlusion, nhãn NORMAL không hợp lệ, leakage hoặc train vượt quyền.
Liệt kê phát hiện theo mức độ, đường_dẫn:số_dòng, tác động và cách tái hiện.
Test chưa chạy ghi NOT_RUN; không có bằng chứng ghi UNKNOWN.
Kết luận READY_FOR_REVIEW hoặc NEEDS_FIX, kèm điều kiện còn thiếu.
Không tự coi kết luận review của AI là quyết định phê duyệt của người dùng.
```
