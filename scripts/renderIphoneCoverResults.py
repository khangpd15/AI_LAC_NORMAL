"""Create three standalone Vietnamese result files, including embedded JSON."""
import base64
import html
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "tracking-benchmark.local" / "iphone-cover"
OUT = ROOT / "docs" / "reports" / "iphone-cover-test-2026-10-28"
REASONS = {
    "VISIBILITY_UNCERTAIN": "Visibility không chắc chắn trong lượt che",
    "COVER_NOT_CONFIRMED": "Chưa xác nhận được đặt che hợp lệ",
    "UNCOVER_NOT_CONFIRMED": "Chưa xác nhận được bỏ che",
    "INSUFFICIENT_EVENT_COVERAGE": "Thiếu độ phủ khung hợp lệ quanh sự kiện",
    "BASELINE_UNSTABLE": "Baseline chưa ổn định hoặc thiếu mẫu",
    "TRACKING_INTERRUPTED": "Gián đoạn tracking/tư thế không đạt",
}
NOTES = {
    "4K_30FPS": "Clip dùng bàn tay. Detector ghi sự kiện bỏ che ở 18,333 s và 62,100 s trong khi ảnh đối chiếu vẫn thấy bàn tay phủ vùng mắt. Vì vậy các cờ đạt gate kỹ thuật không bảo đảm sự kiện thực sự đúng. Các lượt khác cũng có trạng thái không chắc chắn hoặc thiếu mẫu sau bỏ che.",
    "4K_60FPS": "Clip dùng bàn tay. Chỉ 2/6 lượt vượt gate phép đo chính và không có chu kỳ đủ cả hai mắt. Một số ảnh tại sự kiện còn bàn tay trong vùng mắt hoặc đang rút tay; cần kiểm tra độ mở mắt thực sự. Tên 60FPS không trùng với stream 30 FPS trong file nhận được.",
    "HD_30FPS": "Clip dùng thìa trắng. Các sự kiện bỏ che ở 27,867 s, 50,900 s và 61,100 s xuất hiện khi thìa vẫn nằm trước vùng mắt trong ảnh đối chiếu. Một số lượt che do đó bị cắt rất ngắn, dẫn tới thiếu độ phủ phép đo chính. Không có lượt đo chính nào vượt gate.",
}


def esc(v):
    return html.escape(str(v), quote=True)


def num(v, digits=3):
    return "—" if v is None else f"{v:.{digits}f}"


def image_data(path):
    return "data:image/jpeg;base64," + base64.b64encode(path.read_bytes()).decode()


def coverage(trace, eye, event, end_ms):
    if not event:
        return None
    t0 = event["timestampMs"]
    times = [r["timestampMs"] - t0 for r in trace
             if t0 <= r["timestampMs"] <= t0 + 1500 and r["timestampMs"] < end_ms
             and r["validSamples"][eye]]
    early = [t for t in times if t <= 500]
    return dict(validSamples=len(times), earlyValidSamples=len(early),
                firstOffsetMs=times[0] if times else None, lastOffsetMs=times[-1] if times else None,
                earlySpanMs=early[-1] - early[0] if early else None,
                maxGapMs=max((b-a for a, b in zip(times, times[1:])), default=None))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name in ["4K_30FPS", "4K_60FPS", "HD_30FPS"]:
        d = json.loads((DATA / f"{name}.result.json").read_text(encoding="utf-8"))
        trace = json.loads((DATA / f"{name}.trace.json").read_text(encoding="utf-8"))
        s, m = d["statistics"], d["source"]
        assert s["decodedFrames"] == m["expectedFrames"] == len(trace)
        assert m["maxEdge"] == 960
        assert all(b["timestampMs"] > a["timestampMs"] for a, b in zip(trace, trace[1:]))
        assert len(d["legs"]) == 6 and len(d["summary"]["cycles"]) == 3
        rows, metrics, windows = [], [], []
        failures = Counter()
        for i, leg in enumerate(d["legs"], 1):
            r = leg["result"]
            e = r["evidence"]
            on, off = r["coverOn"], r["uncoverRecovery"]
            ce, ue = e["coverEvent"], e["uncoverEvent"]
            for result in [on, off]:
                if not result["dataQuality"]["isValid"]:
                    failures[result["dataQuality"]["reason"]] += 1
            leg["replayCoverage"] = {
                "primary": coverage(trace, "left" if leg["eye"] == "right" else "right", ce,
                                    min(leg["endMs"], ue["timestampMs"] if ue else float("inf"))),
                "recovery": coverage(trace, leg["eye"], ue, leg["endMs"]),
            }
            event_time = lambda event: num(event["timestampMs"] / 1000) if event else "—"
            gate = lambda q: '<span class="ok">Đạt gate</span>' if q["isValid"] else '<span class="bad">Chưa đạt</span>'
            reason = on["dataQuality"].get("reason") or off["dataQuality"].get("reason")
            rows.append(f'<tr><td>{i}</td><td>{leg["cycle"]}</td><td>{"Trái ảnh" if leg["screenSide"] == "IMAGE_LEFT" else "Phải ảnh"}</td>'
                        f'<td>{event_time(ce)}</td><td>{event_time(ue)}</td><td>{"Có" if e["procedureValid"] else "Chưa"}</td>'
                        f'<td>{gate(on["dataQuality"])}</td><td>{gate(off["dataQuality"])}</td>'
                        f'<td>{esc(REASONS.get(reason, reason or "Không có lỗi gate"))}</td></tr>')
            if on["dataQuality"]["isValid"]:
                metrics.append(f'<tr><td>{i}</td><td>{on["sampleCount"]}</td><td>{num(on["normalizedHorizontal"],4)}</td>'
                               f'<td>{num(on["normalizedVertical"],4)}</td><td>{num(on["peakVelocity"],4)}</td>'
                               f'<td>{num(on["jitter"],4)}</td><td>{num(on["trajectoryStability"],4)}</td>'
                               f'<td>{"Có" if on["isNotableMovement"] else "Không"}</td></tr>')
            windows.append(f'<tr><td>{i}</td><td>{leg["startMs"]/1000:g}</td><td>{leg["trackingStartMs"]/1000:g}</td><td>{min(leg["endMs"]/1000,s["actualDurationSeconds"]):.3f}</td></tr>')
        d["visualReview"] = {"method": "Manual inspection of contact sheets and event source-frame samples",
                             "noteVi": NOTES[name], "clinicalGroundTruth": None}
        title = f"Kết quả Cover Test · {name}"
        data_json = json.dumps(d, ensure_ascii=False, indent=2).replace("<", "\\u003c")
        visibility_rows = "".join(f'<tr><td>{"Trái ảnh" if eye == "right" else "Phải ảnh"}</td>'
                                  f'<td>{c["VISIBLE"]}</td><td>{c["OCCLUDED"]}</td><td>{c["UNKNOWN"]}</td></tr>'
                                  for eye, c in s["directVisibility"].items())
        reason_rows = "".join(f'<tr><td><code>{esc(key)}</code></td><td>{esc(REASONS.get(key,key))}</td><td>{value}</td></tr>'
                              for key, value in failures.items())
        doc = f'''<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title><style>
:root{{color-scheme:light;font-family:system-ui,Arial,sans-serif;color:#19323c;background:#eef3f5}}*{{box-sizing:border-box}}
body{{margin:0}}main{{max-width:1120px;margin:36px auto;padding:32px;background:white;border-radius:16px}}
h1{{font-size:30px;margin:10px 0}}h2{{font-size:21px;margin-top:32px}}p,li{{line-height:1.7}}.muted{{color:#516772}}
.eyebrow{{font-size:13px;letter-spacing:.08em;color:#376578}}.banner{{background:#fff2d7;border-left:5px solid #b47c14;padding:18px 22px;border-radius:6px}}
.cards{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}}.card{{padding:18px;background:#edf5f7;border-radius:10px}}.card strong{{display:block;font-size:26px}}
.scroll{{overflow:auto}}table{{border-collapse:collapse;width:100%;font-size:14px}}th,td{{padding:10px;border-bottom:1px solid #dce5e9;text-align:left;vertical-align:top}}th{{background:#edf3f6}}
.ok{{color:#19715c}}.bad{{color:#a15c14}}code{{overflow-wrap:anywhere;font-size:12px}}.note{{background:#f2f6fa;padding:16px;border-radius:8px}}
img{{display:block;max-width:100%;height:auto;margin:12px auto;border-radius:8px}}summary{{cursor:pointer;font-weight:600;padding:12px 0}}pre{{white-space:pre-wrap;overflow-wrap:anywhere;max-height:620px;overflow:auto;background:#edf3f6;padding:16px;font-size:12px}}
button{{border:0;border-radius:7px;background:#215a70;color:white;padding:12px 18px;font-size:14px;cursor:pointer}}footer{{border-top:1px solid #dce5e9;margin-top:28px;padding-top:15px;font-size:13px;color:#516772}}
@media(max-width:750px){{main{{margin:0;padding:18px;border-radius:0}}.cards{{grid-template-columns:repeat(2,1fr)}}h1{{font-size:24px}}}}@media print{{body{{background:white}}main{{margin:0;padding:0}}button{{display:none}}details{{break-inside:avoid}}}}
</style></head><body><main>
<div class="eyebrow">REMICARE · OFFLINE VIDEO REPLAY · 28/10/2026</div><h1>{title}</h1>
<p class="muted">Phân tích toàn bộ khung hình · bộ đo theo sự kiện hiện tại · không thay đổi ngưỡng</p>
<div class="banner"><strong>Kết quả tự động: INCONCLUSIVE — Chưa đủ dữ liệu để kết luận.</strong><br>
Chu kỳ đạt gate phép đo chính: <b>{d["summary"]["validCycles"]}/3</b>; cần ít nhất 2 chu kỳ. Tên thư mục NORMAL là nhãn do người dùng cung cấp, không phải xác nhận chẩn đoán.</div>
<div class="cards"><div class="card"><strong>{s["decodedFrames"]:,}</strong>khung đã xử lý</div>
<div class="card"><strong>{s["faceDetectionPercent"]:g}%</strong>khung tìm thấy mặt</div>
<div class="card"><strong>{s["primaryValidLegs"]}/6</strong>lượt đo chính đạt gate</div>
<div class="card"><strong>{s["captureEligibleEvents"]}/6</strong>sự kiện đủ điều kiện chụp theo detector</div></div>
<p class="note"><b>Phát hiện qua đối chiếu hình ảnh:</b> {NOTES[name]} Nhận diện được mặt không đồng nghĩa nhìn thấy được mống mắt hoặc xác nhận đúng lần bỏ che.</p>
<h2>1. File đầu vào và cách chạy</h2><div class="scroll"><table><tbody>
<tr><th>Video</th><td>{esc(m["file"])}</td></tr><tr><th>Thông số stream thực nhận</th><td>{m["width"]}×{m["height"]}, {m["fps"]:.6f} FPS, {s["actualDurationSeconds"]:.3f} giây; {m["bytes"]:,} byte</td></tr>
<tr><th>Kích thước đưa vào pipeline</th><td>{m["processingWidth"]}×{m["processingHeight"]}; cạnh lớn 960 px, theo capture canvas hiện tại</td></tr>
<tr><th>Khung kỳ vọng / giải mã</th><td>{m["expectedFrames"]} / {s["decodedFrames"]}; timestamp tăng nghiêm ngặt, không lấy mẫu thưa</td></tr>
<tr><th>Khoảng khung trung vị / lớn nhất</th><td>{s["sourceFrameIntervalMedianMs"]:.3f} / {s["sourceFrameIntervalMaxMs"]:.3f} ms</td></tr>
<tr><th>Engine landmark</th><td>{esc(m["engine"])} FaceMesh, refine_landmarks, 1 mặt, confidence 0.5</td></tr>
<tr><th>Adapter pixel</th><td>OpenCV {esc(m["cv2Version"])} bilinear RGBA 32×24; tính thống kê và phân loại bằng code JS thật. Sai khác hình học crop tối đa {s["maxPatchGeometryErrorPixels"]:.3g} px.</td></tr>
<tr><th>SHA-256 video</th><td><code>{m["sha256"]}</code></td></tr></tbody></table></div>
<p>Đây là replay offline trên máy tính, dùng MediaPipe Python thay cho MediaPipe Web và lấy pixel bằng OpenCV thay cho Canvas trình duyệt. Không mô phỏng giới hạn lập lịch của iPhone/Safari và không đo FPS chạy trực tiếp trên điện thoại. Tên 4K/HD/60FPS không thay thế metadata file; ba bản file hiện có đều là 720×1280 ở khoảng 30 FPS. Không thể quy khác biệt kết quả cho chế độ quay gốc.</p>
<h2>2. Sáu lượt che — kết quả đo và lý do loại</h2>
<p>“Đo chính” theo dõi mắt đối diện lúc đặt che; “sau bỏ che” được lưu riêng. “Đạt gate” chỉ là cờ tự động, chưa xác nhận sự kiện đúng qua người xem. Bên trái/phải dưới đây là <b>bên trong ảnh</b>; video không có log xác nhận mirroring nên tên mắt giải phẫu trong JSON giả định ảnh không soi gương.</p>
<div class="scroll"><table><thead><tr><th>Lượt</th><th>Chu kỳ</th><th>Bên che</th><th>Đặt che (s)</th><th>Bỏ che (s)</th><th>Trình tự đạt gate</th><th>Đo chính</th><th>Sau bỏ che</th><th>Lý do</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>
<p>Trình tự được detector xác nhận {s["procedureValidLegs"]}/6 lượt; phép đo sau bỏ che đạt gate {s["recoveryValidLegs"]}/6 lượt. {s["captureEligibleEvents"]} mốc đủ điều kiện chụp chưa phải ảnh JPEG đã lưu và có thể chứa kích hoạt nhầm. Không gọi mô hình AI phía máy chủ.</p>
<h2>3. Số đo chính ở các lượt vượt gate</h2><p>Đơn vị dịch chuyển là phần chiều rộng khóe mắt; vận tốc là chiều rộng khóe mắt/giây. Không quy đổi sang góc lác hoặc prism diopter.</p>
<div class="scroll"><table><thead><tr><th>Lượt</th><th>Mẫu</th><th>Dịch ngang</th><th>Dịch dọc</th><th>Vận tốc đỉnh</th><th>Jitter</th><th>Ổn định</th><th>Tín hiệu đáng chú ý</th></tr></thead><tbody>{''.join(metrics) or '<tr><td colspan="8">Không có lượt đủ chất lượng để báo số đo chính.</td></tr>'}</tbody></table></div>
<h2>4. Chất lượng toàn video</h2><div class="scroll"><table><thead><tr><th>Vùng mắt theo ảnh</th><th>VISIBLE</th><th>OCCLUDED</th><th>UNKNOWN</th></tr></thead><tbody>{visibility_rows}</tbody></table></div>
<p>Số khung có blink/mask: {s["blinkMaskedFrames"]}; bị loại do tư thế đầu: {s["headPoseRejectedFrames"]}; cả hai mắt được phân loại trực tiếp VISIBLE: {s["bothDirectlyVisibleFrames"]}. Những giá trị này là đầu ra detector, không phải nhãn chuẩn của con người.</p>
<div class="scroll"><table><thead><tr><th>Mã lỗi</th><th>Ý nghĩa</th><th>Số phép đo bị loại /12</th></tr></thead><tbody>{reason_rows}</tbody></table></div>
<h2>5. Ảnh đối chiếu tại sự kiện</h2><p>Nhãn số là lượt đo có sự kiện bỏ che; nhãn P là ứng viên chụp ảnh. Ảnh được seek gần timestamp sự kiện, có thể lệch khoảng một khung giải mã. Dùng để xem vật che còn trong vùng mắt, không phải ground truth thời gian chính xác.</p>
<img alt="Đối chiếu ảnh tại sự kiện bỏ che và ứng viên chụp" src="{image_data(DATA / f'{name}_events.jpg')}">
<details><summary>Xem diễn biến toàn video mỗi 5 giây</summary><img alt="Contact sheet video mỗi 5 giây" src="{image_data(DATA / f'{name}_contact.jpg')}"></details>
<h2>6. Diễn giải và việc cần sửa</h2><ul>
<li>Không thể báo NORMAL từ video này vì chất lượng chu kỳ chưa đủ. Các phép đo không hợp lệ không được gán biên độ bằng 0.</li>
<li>Ưu tiên phân biệt ảnh mắt thật với landmark bị suy diễn trên bàn tay/thìa; không cho hai khung bị phân loại VISIBLE nhầm kết thúc lượt che.</li>
<li>Gate hiện tại có thể loại cả lượt vì một đoạn visibility không chắc chắn. Cần nghiên cứu phục hồi có giới hạn thời gian và kiểm chứng bằng video gán nhãn; không nới ngưỡng chỉ để các clip NORMAL vượt test.</li>
<li>Cần log phase/cue từ ứng dụng và video gốc chưa giảm chất lượng để đánh giá sát luồng iPhone. Ba clip không đủ tính độ nhạy/đặc hiệu hoặc so sánh các chế độ camera.</li></ul>
<details><summary>Cửa sổ phase dùng để replay</summary><p>Cửa sổ được quan sát thủ công từ contact sheet 1 giây, chỉ xác định lượt và bên che. Timestamp sự kiện trong bảng kết quả do detector tính, không được gán bằng nhãn thủ công. Các lượt bắt đầu ở trái ảnh, khác thứ tự trái giải phẫu mặc định của UI khi giả định ảnh không soi gương.</p><table><thead><tr><th>Lượt</th><th>Bắt đầu che (s)</th><th>Bắt đầu phase bỏ che (s)</th><th>Kết thúc (s)</th></tr></thead><tbody>{''.join(windows)}</tbody></table></details>
<details><summary>Giới hạn kỹ thuật và khả năng tái lập</summary><p>Baseline gần nhất 2 giây; xác nhận che 120 ms; khoảng gián đoạn tối đa 250 ms; phân tích 1.500 ms; ít nhất 15 mẫu hợp lệ, 5 mẫu trong cửa sổ 0–500 ms trải ít nhất 300 ms và độ phủ ít nhất 1.000 ms. Đây là cấu hình kỹ thuật, chưa được hiệu chuẩn lâm sàng.</p>
<p>Thời gian suy luận Python trên CPU: trung vị {s["nativeInferenceMedianMs"]:.3f} ms, p95 {s["nativeInferenceP95Ms"]:.3f} ms. Chỉ là số đo trên máy chạy replay, chịu ảnh hưởng tải CPU; không dùng để xếp hạng iPhone hay chế độ quay.</p>
<p>Tái lập trong workspace: <code>python scripts/extractIphoneCoverReplay.py</code> → <code>node scripts/replayIphoneCover.mjs</code> → <code>python scripts/renderIphoneCoverResults.py</code>. Hash các service và dữ liệu sự kiện được lưu trong JSON nhúng dưới đây.</p></details>
<h2>7. Dữ liệu kết quả đầy đủ</h2><p>JSON nhúng gồm metadata nguồn, hash code, các mốc sự kiện và khoảng bất định, phép đo từng mắt, gate chất lượng, độ phủ cửa sổ và kết quả tổng hợp.</p>
<button type="button" id="download">Tải kết quả JSON</button><details><summary>Xem JSON</summary><pre id="json-view"></pre></details>
<script type="application/json" id="result-data">{data_json}</script><script>
const raw=document.getElementById('result-data').textContent;
document.getElementById('json-view').textContent=raw;
document.getElementById('download').addEventListener('click',()=>{{const u=URL.createObjectURL(new Blob([raw],{{type:'application/json'}}));const a=document.createElement('a');a.href=u;a.download='{name}_cover_test_result.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}});
</script><footer>File độc lập, không tải tài nguyên bên ngoài và không gửi video hoặc dữ liệu khuôn mặt lên mạng. Kết quả là kiểm thử kỹ thuật offline, không phải chẩn đoán hoặc kiểm định lâm sàng.</footer></main></body></html>'''
        target = OUT / f"{name}_COVER_TEST_RESULT.html"
        target.write_text(doc, encoding="utf-8")
        assert doc.count('src="data:image/jpeg;base64,') == 2
        assert json.loads(data_json)["source"]["sha256"] == m["sha256"]
        print(f"WROTE {target} ({target.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
