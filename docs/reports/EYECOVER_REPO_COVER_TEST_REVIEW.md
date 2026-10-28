# Nhận xét EyeCover và khả năng cải tiến sàng lọc Cover Test

Ngày đánh giá: **28/10/2026**. Repo: [bhanumeet/EyeCover](https://github.com/bhanumeet/EyeCover).

## 1. Kết luận

**Có thể học hỏi EyeCover để cải thiện khâu thu nhận bằng chứng và kiểm tra thao tác che/bỏ che. Chưa có cơ sở dùng repo này làm bộ phân loại lác hoặc khẳng định nó tăng độ chính xác sàng lọc.**

Với dự án RemiCare hiện tại, nên giữ bộ phân tích chuỗi thời gian và cải tiến ba điểm: xác nhận che đúng mắt, neo phân tích vào sự kiện thực tế, bổ sung phân tích mắt đối diện ngay khi bắt đầu che. Thay toàn bộ bằng cơ chế tự chụp của EyeCover sẽ làm mất thông tin chuyển động đang có.

## 2. Phạm vi và mức độ kiểm chứng

- Đọc README, cây repo qua GitHub API, toàn bộ `ViewController.swift`, `FaceOverlayView.swift`, `Info.plist` và `project.pbxproj`.
- Phiên bản EyeCover đã kiểm tra: **`10256c769649e17985d6ab150ee4a0f6b29f48e8`**. Các liên kết mã nguồn bên dưới khóa theo commit này.
- Đối chiếu các service Cover Test và luồng `CoverTestStep.jsx` trong workspace `D:\AI_Check_Lac`. HEAD local: `dcf073f86283fe582af32bb9d6e1df508f31e51d`; có thay đổi chưa commit trong những file liên quan, nên nhận xét phản ánh nội dung working tree tại thời điểm đọc.
- Đây là **phân tích tĩnh mã nguồn**. Không build/chạy iOS trên Windows; không tải hoặc chạy hai model CoreML; không đo FPS, độ trễ thực tế hay hiệu năng lâm sàng. Không chạy test ứng dụng vì đầu ra yêu cầu là tài liệu nhận xét và không sửa code.
- Chưa tìm thấy trong cây repo tài liệu dữ liệu huấn luyện, model card, báo cáo đánh giá lâm sàng, bộ test tự động hoặc file LICENSE. Điều này chỉ mô tả những tài liệu quan sát được; không chứng minh tác giả chưa từng thực hiện đánh giá ở nơi khác.

## 3. EyeCover thực sự cung cấp gì?

Theo [README](https://github.com/bhanumeet/EyeCover/blob/10256c769649e17985d6ab150ee4a0f6b29f48e8/README.md), đây là ứng dụng iOS hỗ trợ nhân viên nhãn khoa chụp ảnh khi bỏ che, có chế độ LC/RC/AC và xem/lưu ảnh. Mã nguồn cho thấy phần cốt lõi là phát hiện vùng mắt và kích hoạt chụp, chưa phải phân tích chuyển động nhãn cầu để sàng lọc.

| Phát hiện từ mã nguồn | Ý nghĩa đối với việc tái sử dụng |
|---|---|
| `setupModel()` gọi `best().model`, trong khi README nhắc `bestNMS.mlmodel`; cây repo có cả hai model khoảng 28,5 MB mỗi file. | Phải xác minh model đang dùng, nhãn đầu ra, tiền xử lý và NMS trước khi thử chuyển đổi. Không thể coi model được nhắc trong README là model thực tế đang chạy. |
| Lọc detection với confidence `> 0.6`; dùng đúng hai box và khoảng cách tâm box trong `[0.1, 0.5]` để xét chụp. | Đây là điều kiện hình học/nhận diện, không phải xác suất lác, chất lượng định thị hay xác nhận thao tác đúng. |
| Có bộ đếm nhìn thấy một mắt và kiểm tra chế độ LC/RC/AC. | Hữu ích về ý tưởng kiểm tra quy trình, nhưng cần sửa cách quản lý thời gian và trạng thái. |
| Chụp ảnh độ phân giải cao, xem lại, lưu ảnh có thông tin chèn lên ảnh. | Phù hợp lưu hồ sơ; nên giữ ảnh gốc và metadata riêng để phục vụ phân tích. |

Nguồn: [`ViewController.swift`](https://github.com/bhanumeet/EyeCover/blob/10256c769649e17985d6ab150ee4a0f6b29f48e8/EyeDetector/ViewController.swift), đặc biệt dòng 171–179, 451–492, 581–599, 616–675; [cấu hình Xcode](https://github.com/bhanumeet/EyeCover/blob/10256c769649e17985d6ab150ee4a0f6b29f48e8/EyeDetector.xcodeproj/project.pbxproj).

## 4. Hạn chế quan trọng của EyeCover

### 4.1. Chưa ràng buộc chụp với một lần che hợp lệ ngay trước đó — ưu tiên cao

Trong `handleDetections()`, điều kiện chụp tại dòng 454–459 chỉ cần bật chế độ chụp, thấy hai mắt đúng khoảng cách và chưa đang chụp. Cửa sổ một mắt chỉ điều khiển nút bật tại dòng 492; nhánh chụp không yêu cầu một chuyển tiếp che → mở mới, đúng bên và còn hiệu lực. Vì vậy, thao tác che trước đó có thể cho phép bật chụp, rồi hệ thống chụp khi thấy hai mắt mà chưa xác thực một lần bỏ che tương ứng.

**Cải tiến:** state machine có baseline → xác nhận che đúng bên → chờ bỏ che → lưu sự kiện → khóa chụp lặp. Reset khi đổi camera/chế độ, mất mặt hoặc hết hạn chờ.

### 4.2. Ảnh chụp sau detection không phải khung hình đã phát hiện

Mã thêm `asyncAfter(... + 0.05)` rồi mới gọi `capturePhoto()`. Có ít nhất khoảng chờ lập lịch 50 ms được yêu cầu, cộng độ trễ suy luận, hàng đợi và camera chưa đo. Không có liên kết bằng timestamp giữa ảnh trả về và sample buffer đã kích hoạt sự kiện.

**Cải tiến:** giữ khung hình nguồn đầu tiên mở rõ, xác nhận bằng quan sát tiếp theo nhưng lưu timestamp/ảnh của khung đầu tiên; ghi đoạn video quanh sự kiện. Nếu cần ảnh độ phân giải cao cho hồ sơ, lưu riêng và không mặc định dùng nó để đo thời điểm tái định thị.

### 4.3. Bộ đếm phụ thuộc số lần callback, chưa xác nhận chuỗi thao tác

`oneEyeLeftCount`/`oneEyeRightCount` tăng tại dòng 463–478, không nằm trong điều kiện `shouldCountEyes`; cờ này chỉ bao phần cập nhật nhãn. Ngưỡng 10/5 tại `updateCaptureResult()` không quy đổi theo timestamp. Hai bên có đủ số đếm chưa chứng minh đã che luân phiên đúng thứ tự; nhánh AC cũng thiếu gán lại giá trị khi không thỏa điều kiện, tạo nguy cơ giữ kết quả trước đó.

**Cải tiến:** ghi sự kiện có thời gian, thứ tự và bên che; tách đếm phục vụ debug khỏi xác nhận quy trình. Reset toàn bộ lịch sử cửa sổ/nhãn khi bắt đầu lượt mới.

### 4.4. Rủi ro nhầm bên mắt và sai tọa độ hiển thị

Phân bên theo tâm box so với giữa màn hình ở dòng 465–472, có đảo quy tắc camera trước/sau. `transformBoundingBox()` chỉ nhân theo kích thước view, trong khi preview dùng `.resizeAspectFill` và mirroring. Chưa thấy phép biến đổi bù crop của preview; khi mặt lệch giữa hoặc thay hướng thiết bị, có nguy cơ gán bên và overlay không đúng. Đây là suy luận từ code, cần thử thiết bị để xác nhận mức ảnh hưởng.

**Cải tiến:** định nghĩa trái/phải theo giải phẫu người được đo; chuyển tọa độ ảnh → preview rõ ràng; kiểm thử ảnh có nhãn bên mắt với camera trước/sau và nhiều hướng máy.

### 4.5. Các thông số chưa đủ làm chuẩn sàng lọc

`estimateDistance()` dùng chiều rộng mặt giả định 16 cm, tiêu cự giả định 500 pixel và chiều rộng view. Kết quả chỉ cập nhật nhãn Too Close/Too Far, không chặn nhánh chụp. Không nên bê phép ước lượng này sang trẻ em hoặc xem đó là khoảng cách đã hiệu chuẩn.

README ghi iOS 13+, nhưng cấu hình target là iOS 16.0 và cấu hình project có 17.4. Hướng dẫn build cần được kiểm chứng lại. Quyền camera/thư viện ảnh được khai báo trong build settings, vì vậy không nên kết luận thiếu quyền chỉ vì không thấy trong `Info.plist`.

Các mục 4.1–4.5 đều dựa trên [mã Swift](https://github.com/bhanumeet/EyeCover/blob/10256c769649e17985d6ab150ee4a0f6b29f48e8/EyeDetector/ViewController.swift) và [project Xcode](https://github.com/bhanumeet/EyeCover/blob/10256c769649e17985d6ab150ee4a0f6b29f48e8/EyeDetector.xcodeproj/project.pbxproj); đây chưa phải kết quả thử nghiệm thiết bị.

## 5. Điểm quyết định đối với mục tiêu sàng lọc

Trong pha đặt che, phải quan sát chuyển động tái định thị của **mắt đối diện đang mở**. Chuyển động sau bỏ che có ý nghĩa khác; không được dùng riêng nó để kết luận lác hiện. Nghiệm pháp alternate cover còn cần chuyển che giữa hai bên mà không cho nhìn hai mắt giữa các lần chuyển. Tham chiếu: [PEDIG IXT7 Procedures Manual, mục Ocular Alignment, trang in 15–16](https://s3.amazonaws.com/publicfiles.jaeb.org/pedig/protocol/IXT7ProcManualv1_2_10Oct2023.pdf#page=15).

Hệ quả thiết kế: lưu riêng `cover_on_fellow_eye` và `uncover_recovery`. Nhãn LC/RC/AC, một ảnh hai mắt hoặc việc hoàn thành đủ lượt chụp không tự chứng minh nghiệm pháp có giá trị sàng lọc. Nếu chỉ thu được dữ liệu sau bỏ che, kết quả nên mô tả quan sát chuyển động và giới hạn dữ liệu, chưa suy ra tropia/phoria.

## 6. Đối chiếu với RemiCare hiện tại

| Thành phần local đã đọc | Hiện trạng quan sát được | Việc nên làm |
|---|---|---|
| `src/services/coverTest/uncoverCaptureService.js` | Đã có xác nhận che, giữ khung mở rõ đầu tiên, đợi khung sau xác nhận; xuất `onsetIntervalMs`, `timingUncertaintyMs`, `frameId`. | Giữ thiết kế này. Về liên kết sự kiện với khung nguồn, đã giải quyết nhiều hạn chế thấy trong EyeCover. |
| Cùng service và `src/services/cv/eyeCoverDetector.js` | Visibility còn dựa vào contrast, da, độ mở mí và fallback baseline; nhánh hỗ trợ có thể nâng mắt đối diện từ OCCLUDED lên VISIBLE theo heuristic khác. | Phân biệt bằng chứng quan sát trực tiếp và suy luận; kiểm chứng chớp mắt, kính, che một phần, sắc độ da, thiếu sáng. Tên biến/comment có chữ AI chưa chứng minh có model học máy riêng tại nhánh này. |
| `src/components/binocular/CoverTestStep.jsx` | `elapsed = captured.timestampMs - startT` được gán vào mẫu TRACKING; `analyzeUncoverTrajectory()` nhận trực tiếp buffer này. | Neo lại cửa sổ sớm theo thời điểm bỏ che đã quan sát, thay vì chỉ theo lúc pha hướng dẫn bắt đầu. |
| `src/services/coverTestMeasurementService.js` | Chọn mẫu sớm bằng `f.t <= earlyWindowMs`; có baseline, vận tốc, jitter và tổng hợp nhiều lượt. | Với người bỏ che chậm hơn cửa sổ sớm, có nguy cơ bỏ lỡ tín hiệu cần đo. Lưu đồng thời thời gian pha và thời gian tương đối sự kiện; đánh dấu không đủ bằng chứng khi khoảng bất định quá lớn. |
| `src/services/coverTestTimeSeriesService.js` | Đã ghi mắt đang mở trong pha COVER; luồng tạo kết quả chính ở UI vẫn truyền hai phân tích mắt vừa bỏ che vào `createCycleRecord()`. | Bổ sung kết quả riêng cho chuyển động mắt đối diện lúc đặt che; chưa thấy kết quả này được đưa rõ ràng vào đầu vào kết luận chính đã đọc. |
| `src/services/coverTestTimeline.js` và luồng chạy 3 chu kỳ | Che trái → mở hai mắt → che phải → mở hai mắt. | Mô tả là các lượt cover–uncover hai bên; nếu thêm alternate cover, phải có quy trình riêng và sự kiện chuyển che tương ứng. |

**Lưu ý về chất lượng:** `occlusionVerified` hiện được gán theo việc cả hai sự kiện có trạng thái CAPTURED. Trạng thái này phản ánh detector và pipeline lưu ảnh, chưa phải xác minh lâm sàng rằng che kín, đúng bên, đủ lâu và định thị tốt. Cần tách các điều kiện thay vì dùng chung một cờ.

## 7. Phương án cải tiến đề xuất

### P0 — Làm đúng mốc thời gian và nội dung quan sát

1. Tách hai loại sự kiện: đặt che và bỏ che. Mỗi sự kiện lưu `coveredEye`, `observedEye`, thời gian khung nguồn, khoảng bất định, chất lượng và loại bằng chứng.
2. Khi đặt che mắt trái, đo mắt phải và ngược lại; baseline lấy trước đặt che. Khi bỏ che, lưu riêng diễn biến mắt vừa mở và trạng thái mắt đối diện.
3. Đồng bộ đồng hồ ảnh nguồn và inference; chuyển `t` của phân tích sang thời gian tương đối sự kiện. Không coi thời gian phát âm thanh là thời gian tay thực sự bỏ che.
4. Phân tách trạng thái: thu được ảnh, xác nhận thao tác, đủ tín hiệu chuyển động, kết quả sàng lọc. Thiếu một điều kiện thiết yếu phải trả không kết luận được, không chuyển thành không phát hiện bất thường.

### P1 — Tăng độ tin cậy detector và bằng chứng

- Dùng bộ đệm metadata/đặc trưng liên tục và đoạn ảnh/video ngắn quanh sự kiện; giới hạn dung lượng theo thiết bị. Có thể thử 0,5 giây trước và 1–2 giây sau như **cấu hình kỹ thuật thí điểm**, không phải chuẩn lâm sàng.
- Giữ các trạng thái `VISIBLE`, `OCCLUDED`, `UNKNOWN`; nếu phân biệt được thì bổ sung `BLINK`. Không suy ra che đúng chỉ từ việc không phát hiện mắt.
- Xác nhận trái/phải theo giải phẫu; giữ hệ tọa độ phân tích độc lập với preview soi gương.
- Đo tỷ lệ khung hợp lệ, khoảng mất tracking, khoảng bất định sự kiện và độ dịch đầu. Ngưỡng loại phải được định trước và đánh giá trên dữ liệu thật.
- Cung cấp ảnh gốc, crop hai mắt, timeline sự kiện và lý do đo lại cho người xem xét chuyên môn.

### P2 — Thử model học máy nếu heuristic còn là nút thắt

Chỉ thử model EyeCover sau khi xác minh quyền sử dụng code/trọng số, metadata, nhãn và tiền xử lý. CoreML không dùng trực tiếp trong ứng dụng React hiện tại; khả năng chuyển sang ONNX phải được thử, kiểm tra độ tương đương đầu ra và chi phí chạy trình duyệt. Repo có trọng số không đồng nghĩa có sẵn quy trình huấn luyện tái lập.

Nếu cần huấn luyện detector mới, dữ liệu phải phân biệt mắt mở, chớp/nhắm mắt, vật che, che một phần và mất tracking. Đánh giá detector và bộ phân tích chuyển động độc lập để biết thành phần nào gây sai số.

## 8. Kế hoạch kiểm chứng trước khi thay đổi kết luận sàng lọc

| Nhóm | Tình huống cần kiểm tra | Chỉ số cần báo cáo |
|---|---|---|
| Sự kiện | Chưa che đã mở hai mắt, che sai bên, che cả hai mắt, bỏ che chậm, che lặp, chớp mắt | Precision/recall sự kiện; bắt nhầm mỗi phiên; nhầm bên; sai số thời gian so với nhãn video |
| Camera | Camera trước/sau, ảnh soi gương, đổi hướng, khung trùng, FPS thấp, gián đoạn stream | Phân bố khoảng khung; p50/p95 độ trễ; tỷ lệ mất dữ liệu; tính đúng của frame ID/timestamp |
| Chất lượng | Kính/phản sáng, thiếu sáng, chuyển đầu, mặt lệch khung, tay/vật che nhiều màu | Tỷ lệ hoàn thành, đo lại, không kết luận được; kết quả theo nhóm điều kiện |
| Tín hiệu | Đầu dịch nhưng mắt ổn định, mắt chuyển khi đặt che, hồi phục sau bỏ che | Tách đúng loại chuyển động; độ lặp giữa các lượt; tỷ lệ nhầm với nhiễu đầu |
| Sàng lọc | Thu video cùng đánh giá chuyên khoa theo quy trình đã thống nhất | Độ nhạy, độ đặc hiệu, khoảng tin cậy 95%, và tỷ lệ không kết luận được trên toàn bộ người tham gia |

Chia tập theo người tham gia; nếu có thể, giữ riêng thiết bị/địa điểm để kiểm tra khả năng khái quát. Người gán nhãn và người đánh giá kết quả nên độc lập. So sánh cùng tập video giữa bản hiện tại và bản cải tiến; không chỉ so tỷ lệ chụp đủ ảnh. Chưa đặt mục tiêu độ chính xác hoặc cỡ mẫu cụ thể khi chưa thống nhất đối tượng và tiêu chí tham chiếu.

## 9. Quyết định đề xuất

**Dùng EyeCover làm tài liệu tham khảo cho thu nhận ảnh và kiểm tra thao tác; chưa đưa trực tiếp code/model vào sản phẩm.** Ưu tiên P0 trên pipeline RemiCare đang có, sau đó kiểm thử video gán nhãn để quyết định có cần detector học máy mới hay không. Khả năng cải tiến kỹ thuật là rõ ràng; mức tăng hiệu quả sàng lọc vẫn cần được đo.

Tài liệu này chỉ bổ sung nhận xét và kế hoạch triển khai; không thay đổi mã nguồn ứng dụng hoặc các chỉnh sửa đang có của người dùng.

## 10. Triển khai tiếp theo

Sau yêu cầu thực hiện cải tiến, các thay đổi về mốc sự kiện, phép đo mắt đối diện khi đặt che và tách chất lượng ảnh/phép đo đã được triển khai trong workspace. Xem [chi tiết triển khai và kiểm chứng](COVER_TEST_EVENT_IMPROVEMENTS.md). Các nhận xét ở trên ghi lại trạng thái tại thời điểm đánh giá ban đầu.
