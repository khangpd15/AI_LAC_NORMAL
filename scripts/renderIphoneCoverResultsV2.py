"""Standalone v2 reports. Keep v1 reports and their embedded data unchanged."""
import base64
import html
import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "tracking-benchmark.local" / "iphone-cover"
OUT = ROOT / "docs" / "reports" / "iphone-cover-test-2026-10-28-v2"
NAMES = ["4K_30FPS", "4K_60FPS", "HD_30FPS"]
REASONS = {
    "COVER_NOT_CONFIRMED": "Chưa xác nhận được thời điểm đặt che đủ tin cậy",
    "UNCOVER_NOT_CONFIRMED": "Chưa xác nhận bỏ che đủ tin cậy; giữ phép đo đặt che độc lập",
    "INSUFFICIENT_EVENT_COVERAGE": "Thiếu mẫu hoặc có khoảng trống quá lớn trong cửa sổ đo",
    "BASELINE_UNSTABLE": "Baseline chưa đủ ổn định",
}
NOTES = {
    "4K_30FPS": "Vẫn chưa đủ kết luận: lượt 3 không xác nhận được đặt che với khoảng bất định cho phép; lượt 5 thiếu độ phủ khung hợp lệ. Các ứng viên bỏ che sai trước đây ở 18,333 s và 62,100 s không còn xuất hiện; ứng viên mới chuyển đến 23,700 s và 66,967 s. Số chu kỳ đủ chất lượng vẫn là 1/3.",
    "4K_60FPS": "Đã có phép đo chính hợp lệ ở cả 6 lượt, tạo 3/3 chu kỳ đủ chất lượng. Không ghi nhận chuyển động đáng chú ý theo tiêu chí kỹ thuật. Hai phép đo hồi phục vẫn thiếu độ phủ; chúng không xóa các cửa sổ đặt che đã đo đủ trước đó.",
    "HD_30FPS": "Đã có phép đo chính hợp lệ ở cả 6 lượt dù dùng thìa trắng. Các ứng viên bỏ che sai ở 27,867 s, 50,900 s và 61,100 s được thay bằng các mốc muộn hơn 35,333 s, 58,533 s và 68,467 s. Một ứng viên ảnh trùng vùng chớp mắt bị loại, còn 5/6 ứng viên chụp. Một lượt chưa xác nhận được sự kiện hồi phục và các cửa sổ hồi phục còn thiếu dữ liệu được giữ trạng thái không hợp lệ.",
}


def esc(value):
    return html.escape(str(value), quote=True)


def fmt(value, digits=3):
    return "—" if value is None else f"{value:.{digits}f}"


def data_image(path):
    return "data:image/jpeg;base64," + base64.b64encode(path.read_bytes()).decode()


def event_sheet(name, result):
    events = sorted(result["captureEligibleEvents"], key=lambda event: event["timestampMs"])
    sheet = np.zeros((((len(events) + 2) // 3) * 456, 720, 3), np.uint8)
    cap = cv2.VideoCapture(str(ROOT / result["source"]["file"]))
    for i, event in enumerate(events):
        index = event["sourceFrameId"]
        cap.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, frame = cap.read()
        if not ok or int(cap.get(cv2.CAP_PROP_POS_FRAMES)) != index + 1:
            raise RuntimeError(f"Cannot verify source-frame seek {name}:{index}")
        frame = cv2.resize(frame, (240, 426))
        leg_number = (event["cycle"] - 1) * 2 + (1 if event["coveredEye"] == "right" else 2)
        cv2.putText(frame, f'L{leg_number}: {event["timestampMs"]/1000:.3f}s', (5, 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 255), 2)
        cv2.putText(frame, f'frame {index}', (5, 44), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)
        y, x = (i // 3) * 456, (i % 3) * 240
        sheet[y:y+426, x:x+240] = frame
    cap.release()
    target = DATA / f"{name}.v2.events.jpg"
    cv2.imwrite(str(target), sheet)
    return target


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        current = json.loads((DATA / f"{name}.v2.result.json").read_text(encoding="utf-8"))
        before = json.loads((DATA / f"{name}.result.json").read_text(encoding="utf-8"))
        control = json.loads((DATA / f"{name}.v2-fixed.result.json").read_text(encoding="utf-8"))
        s, old, src = current["statistics"], before["statistics"], current["source"]
        assert src["sha256"] == before["source"]["sha256"] == control["source"]["sha256"]
        assert s["decodedFrames"] == src["expectedFrames"]
        assert len(current["legs"]) == 6 and len(current["summary"]["cycles"]) == 3
        inconclusive = current["summary"]["verdict"] == "INCONCLUSIVE"
        label = "Chưa đủ kết luận" if inconclusive else "Đủ dữ liệu kỹ thuật; không ghi nhận chuyển động đáng chú ý"
        rows, metrics, coverage_rows, events = [], [], [], []
        for i, leg in enumerate(current["legs"], 1):
            result = leg["result"]
            evidence = result["evidence"]
            on, off = result["coverOn"], result["uncoverRecovery"]
            ce, ue = evidence["coverEvent"], evidence["uncoverEvent"]
            gate = lambda q: '<span class="ok">Đạt</span>' if q["isValid"] else '<span class="warn">Chưa đạt</span>'
            event_time = lambda e: fmt(e["timestampMs"]/1000) if e else "—"
            reason = on["dataQuality"].get("reason") or off["dataQuality"].get("reason")
            rows.append(f'<tr><td>{i}</td><td>{leg["cycle"]}</td><td>{"Trái ảnh" if leg["eye"] == "right" else "Phải ảnh"}</td>'
                        f'<td>{event_time(ce)}</td><td>{event_time(ue)}</td><td>{gate(on["dataQuality"])}</td>'
                        f'<td>{gate(off["dataQuality"])}</td><td>{esc(REASONS.get(reason,reason or "Không có lỗi gate"))}</td></tr>')
            if on["dataQuality"]["isValid"]:
                metrics.append(f'<tr><td>{i}</td><td>{on["sampleCount"]}</td><td>{fmt(on["normalizedHorizontal"],4)}</td>'
                               f'<td>{fmt(on["normalizedVertical"],4)}</td><td>{fmt(on["peakVelocity"],4)}</td>'
                               f'<td>{fmt(on["jitter"],4)}</td><td>{fmt(on["trajectoryStability"],4)}</td>'
                               f'<td>{"Có" if on["isNotableMovement"] else "Không"}</td></tr>')
            for kind, measurement in [("Đặt che", on), ("Hồi phục", off)]:
                c = measurement.get("coverage") or {}
                coverage_rows.append(f'<tr><td>{i}</td><td>{kind}</td><td>{c.get("validSamples","—")}</td>'
                                     f'<td>{c.get("earlyValidSamples","—")}</td><td>{fmt(c.get("earlySpanMs"),1)}</td>'
                                     f'<td>{fmt(c.get("lastOffsetMs"),1)}</td><td>{fmt(c.get("maxGapMs"),1)}</td></tr>')
            old_photo = next((e for e in before["captureEligibleEvents"] if e["cycle"] == leg["cycle"] and e["coveredEye"] == leg["eye"]), None)
            new_photo = next((e for e in current["captureEligibleEvents"] if e["cycle"] == leg["cycle"] and e["coveredEye"] == leg["eye"]), None)
            events.append(f'<tr><td>{i}</td><td>{event_time(old_photo)}</td><td>{event_time(new_photo)}</td>'
                          f'<td>{fmt(new_photo["confirmedAtMs"]-new_photo["timestampMs"],1) if new_photo else "—"}</td></tr>')
        comparisons = [
            ("Chu kỳ đo chính đạt chất lượng", f'{before["summary"]["validCycles"]}/3', f'{current["summary"]["validCycles"]}/3'),
            ("Lượt đo chính hợp lệ", f'{old["primaryValidLegs"]}/6', f'{s["primaryValidLegs"]}/6'),
            ("Lượt hồi phục hợp lệ", f'{old["recoveryValidLegs"]}/6', f'{s["recoveryValidLegs"]}/6'),
            ("Ứng viên chụp theo detector", f'{old["captureEligibleEvents"]}/6', f'{s["captureEligibleEvents"]}/6'),
        ]
        comparison_rows = ''.join(f'<tr><td>{a}</td><td>{b}</td><td>{c}</td></tr>' for a,b,c in comparisons)
        current["visualReview"] = {"noteVi": NOTES[name], "method": "Source-frame contact-sheet inspection",
                                    "clinicalGroundTruth": None, "independentValidationSet": False}
        bundle = dict(before=before, current=current, fixedWindowControl={
            "statistics": control["statistics"], "summary": control["summary"], "method": control["method"]})
        raw = json.dumps(bundle, ensure_ascii=False, indent=2).replace('<', '\\u003c')
        title = f"Cover Test v2 · {name}"
        doc = f'''<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title>
<style>*{{box-sizing:border-box}}body{{margin:0;background:#edf3f5;color:#19343e;font:15px/1.65 system-ui,Arial,sans-serif}}main{{max-width:1120px;margin:32px auto;padding:30px;background:white;border-radius:15px}}h1{{font-size:30px;line-height:1.25}}h2{{font-size:21px;margin-top:30px}}.eyebrow{{font-size:13px;letter-spacing:.08em;color:#376578}}.banner,.note{{padding:18px 22px;border-radius:8px;background:#edf7f4;border-left:5px solid #247661}}.banner.warn{{background:#fff3d9;border-color:#ac7616}}.note{{background:#f1f5fa;border:0;margin:18px 0}}.muted{{color:#536b75}}.cards{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}}.card{{background:#eef5f7;padding:16px;border-radius:10px}}.card strong{{display:block;font-size:26px}}.scroll{{overflow:auto}}table{{width:100%;border-collapse:collapse;font-size:14px}}th,td{{padding:10px;border-bottom:1px solid #dce6e9;text-align:left;vertical-align:top}}th{{background:#edf4f7}}.ok{{color:#176a54}}.warn{{color:#976015}}code{{overflow-wrap:anywhere;font-size:12px}}img{{max-width:100%;height:auto;display:block;margin:12px auto;border-radius:8px}}summary{{cursor:pointer;font-weight:600;padding:12px 0}}pre{{background:#f0f4f7;padding:16px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:600px;overflow:auto;font-size:12px}}button{{background:#215b70;color:white;border:0;padding:12px 18px;border-radius:7px;cursor:pointer}}footer{{margin-top:25px;padding-top:15px;border-top:1px solid #dce6e9;font-size:13px;color:#536b75}}@media(max-width:750px){{main{{margin:0;padding:18px;border-radius:0}}.cards{{grid-template-columns:repeat(2,1fr)}}h1{{font-size:24px}}}}@media print{{body{{background:white}}main{{margin:0;padding:0}}button{{display:none}}}}</style></head><body><main>
<div class="eyebrow">REMICARE · KIỂM THỬ HỒI QUY V2 · 28/10/2026</div><h1>{title}</h1><p class="muted">Chạy lại toàn bộ khung nguồn · giữ báo cáo v1 · so sánh trước và sau</p>
<div class="banner {"warn" if inconclusive else ""}"><strong>{label}</strong><br><code>{esc(current["summary"]["verdict"])}</code> · {current["summary"]["validCycles"]}/3 chu kỳ đủ chất lượng phép đo chính. Đây không phải kết quả chẩn đoán hoặc xác nhận NORMAL.</div>
<div class="cards"><div class="card"><strong>{s["decodedFrames"]:,}</strong>khung đã xử lý</div><div class="card"><strong>{s["faceDetectionPercent"]:g}%</strong>khung tìm thấy mặt</div><div class="card"><strong>{s["primaryValidLegs"]}/6</strong>lượt đặt che đạt gate</div><div class="card"><strong>{s["recoveryValidLegs"]}/6</strong>lượt hồi phục đạt gate</div></div>
<p class="note">{NOTES[name]}</p>
<h2>1. Kết quả trước và sau</h2><div class="scroll"><table><thead><tr><th>Chỉ số</th><th>v1</th><th>v2</th></tr></thead><tbody>{comparison_rows}</tbody></table></div>
<p>Chạy đối chứng v2 với cửa sổ phase cố định cũ vẫn cho <b>{control["summary"]["validCycles"]}/3 chu kỳ chính</b>. Vì vậy thay đổi kết quả chính trên các clip này không chỉ do kéo dài cửa sổ replay. Dữ liệu hồi phục thiếu hoặc không chắc chắn vẫn bị loại riêng.</p>
<h2>2. Những gì đã thay đổi</h2><ul><li>So sánh cấu trúc ảnh 8×6 ô với baseline của từng mắt; kiểm tra tương phản tương đối và dấu hiệu bề mặt che sáng. Không dùng riêng một pixel tối hoặc tương phản lớn để xác nhận mắt mở.</li><li>Xác nhận mở qua ít nhất 3 khung nguồn duy nhất và 120 ms; vẫn giữ ảnh/timestamp của khung mở đầu tiên.</li><li>UNKNOWN ngắn được phục hồi trong giới hạn 250 ms; không cập nhật thời điểm che bằng UNKNOWN và không nội suy mống mắt ẩn.</li><li>Phép đo lúc đặt che độc lập với kết quả bỏ che về sau; chỉ kết luận từ các cửa sổ đủ chất lượng.</li><li>Giao diện chờ thêm có giới hạn tối đa 3 giây cho cửa sổ quan sát muộn. Replay giữ thêm dữ liệu sau mốc kết thúc danh nghĩa thay vì cắt đúng một timestamp thủ công.</li></ul>
<p>Giữ nguyên các điều kiện phân tích chuyển động: tối thiểu 15 mẫu, cửa sổ sớm 0–500 ms có ít nhất 5 mẫu trải 300 ms, độ phủ 1.000 ms, ngưỡng dịch chuyển/vận tốc và kiểm tra lặp giữa các chu kỳ.</p>
<h2>3. Sáu lượt đo</h2><p>Trái/phải là bên trong ảnh. Tên mắt giải phẫu trong JSON giả định ảnh không soi gương vì không có log mirroring. Hai lượt tạo thành một chu kỳ. “Đạt” là gate kỹ thuật, không phải chứng thực lâm sàng.</p>
<div class="scroll"><table><thead><tr><th>Lượt</th><th>Chu kỳ</th><th>Bên che</th><th>Đặt che (s)</th><th>Bỏ che (s)</th><th>Đo chính</th><th>Hồi phục</th><th>Lý do còn thiếu</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>
<h2>4. Số đo chính hợp lệ</h2><p>Dịch chuyển chuẩn hóa theo chiều rộng hai khóe mắt; vận tốc tính theo chiều rộng khóe mắt/giây. Không quy đổi góc lác hoặc prism diopter.</p>
<div class="scroll"><table><thead><tr><th>Lượt</th><th>Mẫu</th><th>Dịch ngang</th><th>Dịch dọc</th><th>Vận tốc đỉnh</th><th>Jitter</th><th>Ổn định</th><th>Chuyển động đáng chú ý</th></tr></thead><tbody>{''.join(metrics)}</tbody></table></div>
<details><summary>Độ phủ khung trong từng cửa sổ phân tích</summary><p>Đây là thống kê trực tiếp từ mẫu thực sự được đưa vào phép đo v2. Ô trống có nghĩa không có sự kiện hợp lệ để neo cửa sổ.</p><div class="scroll"><table><thead><tr><th>Lượt</th><th>Phép đo</th><th>Mẫu hợp lệ</th><th>Mẫu 0–500 ms</th><th>Độ trải sớm (ms)</th><th>Mốc cuối (ms)</th><th>Khoảng trống lớn nhất (ms)</th></tr></thead><tbody>{''.join(coverage_rows)}</tbody></table></div></details>
<h2>5. Đối chiếu ứng viên ảnh bỏ che</h2><p>Các mốc dưới đây là ứng viên chụp theo detector, không đồng nghĩa phép đo hồi phục đã đạt chất lượng. Nhãn L1–L6 trên ảnh là số lượt; lượt không có ứng viên hợp lệ không được tạo ảnh bù. Không mã hóa/lưu JPEG phiên lên máy chủ trong kiểm thử này.</p>
<table><thead><tr><th>Lượt</th><th>v1 (s)</th><th>v2 (s)</th><th>Thời gian xác nhận v2 (ms)</th></tr></thead><tbody>{''.join(events)}</tbody></table>
<img alt="Khung nguồn tại các ứng viên bỏ che v2" src="{data_image(event_sheet(name,current))}">
<details><summary>Xem ảnh sự kiện v1 để đối chiếu</summary><img alt="Các sự kiện v1 đã lưu trước khi cải tiến" src="{data_image(DATA / f'{name}_events.jpg')}"></details>
<h2>6. Thông số nguồn và giới hạn phép thử</h2><table><tbody><tr><th>File</th><td>{esc(src["file"])}</td></tr><tr><th>Stream thực nhận</th><td>{src["width"]}×{src["height"]}, {src["fps"]:.6f} FPS, {s["actualDurationSeconds"]:.3f} giây</td></tr><tr><th>Khung giải mã / kỳ vọng</th><td>{s["decodedFrames"]} / {src["expectedFrames"]}; xử lý toàn bộ, timestamp tăng nghiêm ngặt</td></tr><tr><th>Đưa vào pipeline</th><td>{src["processingWidth"]}×{src["processingHeight"]}; MediaPipe Python 0.10.14, refine_landmarks</td></tr><tr><th>SHA-256</th><td><code>{src["sha256"]}</code></td></tr></tbody></table>
<p>Cả ba file được cung cấp đều là 720×1280 ở khoảng 30 FPS, dù tên có 4K hoặc 60FPS. Phép thử dùng landmark MediaPipe Python và pixel OpenCV, rồi chạy các service JavaScript của ứng dụng. Không đo tốc độ Safari/iPhone, không gọi mô hình AI máy chủ và không xác nhận danh tính chế độ quay gốc.</p>
<p>Ba clip này đã được dùng để phát hiện lỗi và kiểm tra hồi quy; chúng không phải tập kiểm định độc lập. Các mốc phase còn dựa trên quan sát thủ công. Cần thêm video có nhãn độc lập, tình huống mắt hẹp/kính/ánh sáng và mẫu bất thường để đánh giá khả năng khái quát. Các test mô phỏng vẫn kiểm tra việc giữ tín hiệu chuyển động và không tự chuyển thiếu dữ liệu thành kết quả âm tính.</p>
<h2>7. Dữ liệu đầy đủ và tái lập</h2><p>JSON nhúng chứa kết quả v1/v2, thống kê chạy đối chứng cửa sổ cố định, hash mã nguồn, ngưỡng kỹ thuật và bằng chứng từng lượt.</p><button id="download" type="button">Tải JSON so sánh</button><details><summary>Xem JSON</summary><pre id="json-view"></pre></details>
<p><code>node scripts/replayIphoneCover.mjs --v2</code><br><code>node scripts/replayIphoneCover.mjs --fixed-windows</code><br><code>python scripts/renderIphoneCoverResultsV2.py</code></p>
<script id="result-data" type="application/json">{raw}</script><script>const raw=document.getElementById('result-data').textContent;document.getElementById('json-view').textContent=raw;document.getElementById('download').addEventListener('click',()=>{{const u=URL.createObjectURL(new Blob([raw],{{type:'application/json'}}));const a=document.createElement('a');a.href=u;a.download='{name}_COVER_TEST_V2_COMPARISON.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}});</script>
<footer>Báo cáo v2 độc lập; bản v1 được giữ nguyên ở thư mục báo cáo cũ. Không tải ảnh/video hoặc dữ liệu khuôn mặt lên dịch vụ bên ngoài.</footer></main></body></html>'''
        target = OUT / f"{name}_COVER_TEST_RESULT_V2.html"
        target.write_text(doc, encoding="utf-8")
        assert json.loads(raw)["current"]["source"]["sha256"] == src["sha256"]
        print(f"WROTE {target} ({target.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
