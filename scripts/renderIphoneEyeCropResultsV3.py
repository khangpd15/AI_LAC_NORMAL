"""Export lossless source-pixel eye crops and standalone reports with manifests."""
import base64
import csv
import hashlib
import html
import json
import zipfile
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "reports" / "iphone-cover-test-2026-10-28-v3"
DATA = ROOT / "tracking-benchmark.local" / "iphone-cover"
NAMES = ["4K_30FPS", "4K_60FPS", "HD_30FPS"]
LABELS = {"baseline": "Baseline trước đặt che", "cover_on": "Khung bắt đầu đặt che",
          "cover_500ms": "+500 ms sau đặt che", "uncover": "Khung bỏ che đủ điều kiện chụp",
          "uncover_500ms": "+500 ms sau ứng viên bỏ che"}


def esc(value):
    return html.escape(str(value), quote=True)


def fmt(value, digits=3):
    return "—" if value is None else f"{value:.{digits}f}"


def image_data(path):
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()


def export_crops(name, manifest):
    directory = OUT / name
    source = ROOT / manifest["source"]["file"]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == manifest["source"]["sha256"]
    cap = cv2.VideoCapture(str(source))
    frames = {}
    wanted = {s['sourceFrameId']: s['timestampMs'] for s in manifest['snapshots'] if s['status'] == 'REGIONS_READY'}
    index, previous_pts = 0, -1
    # Frame-number seeking can silently shift on variable-timestamp MP4 files.
    # Decode sequentially and verify presentation time against the inference input.
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        pts = cap.get(cv2.CAP_PROP_POS_MSEC)
        assert pts > previous_pts
        previous_pts = pts
        if index in wanted:
            assert abs(pts - wanted[index]) < 0.1, (name, index, pts, wanted[index])
            frames[index] = frame.copy()
        index += 1
    cap.release()
    assert index == manifest['source']['expectedFrames']
    assert set(frames) == set(wanted)
    rows = []
    for snapshot in manifest["snapshots"]:
        if snapshot["status"] != "REGIONS_READY":
            continue
        index = snapshot["sourceFrameId"]
        frame = frames[index]
        h, w = frame.shape[:2]
        assert (w, h) == (manifest["source"]["width"], manifest["source"]["height"])
        for side, eye in snapshot["eyes"].items():
            r = eye["cropRegion"]
            x, y, cw, ch = (r[k] for k in ["x", "y", "width", "height"])
            assert all(isinstance(v, int) for v in [x, y, cw, ch])
            assert x >= 0 and y >= 0 and cw >= 8 and ch >= 8 and x + cw <= w and y + ch <= h
            crop = frame[y:y+ch, x:x+cw].copy()
            target = directory / eye["file"]
            if not cv2.imwrite(str(target), crop):
                raise RuntimeError(f"Cannot write {target}")
            # PNG must be a direct pixel slice, with no resize, enhancement or generated detail.
            assert np.array_equal(cv2.imread(str(target)), crop)
            eye.update(width=cw, height=ch, bytes=target.stat().st_size,
                       sha256=hashlib.sha256(target.read_bytes()).hexdigest())
            rows.append(dict(snapshotId=snapshot["snapshotId"], kind=snapshot["kind"], leg=snapshot["leg"],
                             sourceFrameId=index, timestampMs=snapshot["timestampMs"], side=side,
                             imageSide=eye["imageSide"], visibility=eye["visibility"], role=eye["role"],
                             x=x, y=y, width=cw, height=ch, file=eye["file"], sha256=eye["sha256"]))
        snapshot["status"] = "CROPPED"
    manifest["export"] = dict(format="PNG", resampled=False, losslessPixelVerified=True,
                              croppedPairs=sum(s["status"] == "CROPPED" for s in manifest["snapshots"]),
                              imageFiles=len(rows), sequentialSourceDecodeVerified=True,
                              presentationTimeToleranceMs=0.1)
    (directory / "crop_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    with (directory / "crop_index.csv").open("w", newline="", encoding="utf-8-sig") as dest:
        writer = csv.DictWriter(dest, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    return manifest


def eye_pair(snapshot, directory):
    if snapshot["status"] != "CROPPED":
        return f'<p class="missing">Không có crop cho mốc này: {esc(snapshot["status"])}. Không dùng khung khác để bù sự kiện thiếu.</p>'
    cells = []
    # Order by image side, keeping the anatomy assumption explicit in metadata.
    for side in ["right", "left"]:
        eye = snapshot["eyes"][side]
        url = image_data(directory / eye["file"])
        title = "Vùng trái ảnh" if side == "right" else "Vùng phải ảnh"
        role = "Mắt theo dõi" if eye["role"] == "OBSERVED_FELLOW_EYE" else "Bên đang che — không đo iris ẩn" if eye["role"] == "EXPECTED_COVERED_NOT_MEASURED" else "Ảnh đối chiếu"
        cells.append(f'<figure><figcaption>{title} · <b>{esc(eye["visibility"])}</b></figcaption>'
                     f'<a href="{url}" download="{esc(Path(eye["file"]).name)}"><img alt="{title}, {esc(snapshot["snapshotId"])}" src="{url}"></a>'
                     f'<small>{role}<br>{eye["width"]}×{eye["height"]} px · x={eye["cropRegion"]["x"]}, y={eye["cropRegion"]["y"]}</small></figure>')
    return f'<div class="eye-pair">{"".join(cells)}</div><p class="stamp">Frame <b>{snapshot["sourceFrameId"]}</b> · {snapshot["timestampMs"]/1000:.3f} s · lệch mốc yêu cầu {snapshot["timeOffsetMs"]:.3f} ms</p>'


def main():
    total = 0
    for name in NAMES:
        directory = OUT / name
        manifest = json.loads((directory / "crop_manifest.json").read_text(encoding="utf-8"))
        # Make exports repeatable after the verification status was written.
        for snapshot in manifest["snapshots"]:
            if snapshot["status"] == "CROPPED": snapshot["status"] = "REGIONS_READY"
        manifest = export_crops(name, manifest)
        total += manifest["export"]["imageFiles"]
        current = json.loads((directory / "result.json").read_text(encoding="utf-8"))
        previous = json.loads((DATA / f"{name}.v2.result.json").read_text(encoding="utf-8"))
        assert current["source"]["sha256"] == previous["source"]["sha256"]
        gallery, details, rows = [], [], []
        for i, leg in enumerate(current["legs"], 1):
            snapshots = [s for s in manifest["snapshots"] if s["leg"] == i]
            uncover = next(s for s in snapshots if s["kind"] == "uncover")
            gallery.append(f'<article><h3>Lượt {i} · Chu kỳ {leg["cycle"]}</h3>{eye_pair(uncover,directory)}</article>')
            strip = ''.join(f'<section class="snapshot"><h4>{LABELS[s["kind"]]}</h4>{eye_pair(s,directory)}</section>' for s in snapshots)
            details.append(f'<details><summary>Lượt {i}: baseline → đặt che → bỏ che</summary><div class="filmstrip">{strip}</div></details>')
            on, off = leg["result"]["coverOn"], leg["result"]["uncoverRecovery"]
            c = on.get("coverage") or {}
            rows.append(f'<tr><td>{i}</td><td>{"Đạt" if on["dataQuality"]["isValid"] else "Chưa đạt"}</td>'
                        f'<td>{on.get("sampleCount","—")}</td><td>{c.get("earlyValidSamples","—")}</td>'
                        f'<td>{fmt(c.get("earlySpanMs"),1)}</td><td>{c.get("settlingSamples","—")}</td>'
                        f'<td>{fmt(c.get("settlingSpanMs"),1)}</td><td>{len(c.get("lateGaps",[]))}</td>'
                        f'<td>{"Đạt" if off["dataQuality"]["isValid"] else esc(off["dataQuality"].get("reason"))}</td></tr>')
        valid = current["summary"]["validCycles"]
        pair_count = manifest["export"]["croppedPairs"]
        bundle = dict(current=current, previousV2=previous, cropManifest=manifest)
        raw = json.dumps(bundle, ensure_ascii=False, indent=2).replace('<','\\u003c')
        doc = f'''<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cover Test v3 · {name} · Crop mắt</title>
<style>*{{box-sizing:border-box}}body{{margin:0;background:#edf3f5;color:#19343e;font:15px/1.65 system-ui,Arial,sans-serif}}main{{max-width:1160px;margin:30px auto;padding:30px;background:white;border-radius:14px}}h1{{font-size:29px;line-height:1.3}}h2{{font-size:21px;margin-top:30px}}h3{{font-size:16px;margin:0 0 12px}}h4{{margin:0 0 10px}}.eyebrow{{font-size:12px;letter-spacing:.08em;color:#376578}}.banner,.note{{padding:18px 20px;background:#edf7f4;border-left:5px solid #247661;border-radius:7px}}.note{{margin-top:18px;background:#f1f5fa;border:0}}.cards{{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}}.card{{background:#edf4f7;padding:16px;border-radius:8px}}.card strong{{font-size:25px;display:block}}.gallery{{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}}article{{border:1px solid #dce6e9;padding:16px;border-radius:10px}}.eye-pair{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}figure{{margin:0;padding:10px;background:#f2f6f8;border-radius:7px;text-align:center;min-width:0}}figcaption{{font-size:12px;margin-bottom:10px}}figure img{{display:block;width:100%;max-width:240px;height:auto;margin:auto;border:1px solid #b9cbd2}}small,.stamp{{font-size:12px;color:#536b75}}.stamp{{margin:8px 0 0}}.missing{{font-size:13px;color:#976015;background:#fff5df;padding:14px;border-radius:6px}}summary{{cursor:pointer;font-weight:650;padding:14px 0}}details{{border-bottom:1px solid #dce6e9}}.filmstrip{{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;padding-bottom:20px}}.snapshot{{border:1px solid #dce6e9;padding:14px;border-radius:7px}}.scroll{{overflow:auto}}table{{border-collapse:collapse;width:100%;font-size:13px}}td,th{{padding:10px;border-bottom:1px solid #dce6e9;text-align:left;vertical-align:top}}th{{background:#edf4f7}}code{{font-size:12px;overflow-wrap:anywhere}}pre{{max-height:580px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#f0f4f7;padding:16px;font-size:12px}}button{{background:#215b70;color:white;border:0;padding:11px 16px;border-radius:7px;cursor:pointer}}footer{{margin-top:28px;padding-top:16px;border-top:1px solid #dce6e9;color:#536b75;font-size:13px}}@media(max-width:760px){{main{{margin:0;padding:16px;border-radius:0}}.cards{{grid-template-columns:repeat(2,1fr)}}.gallery,.filmstrip{{grid-template-columns:1fr}}h1{{font-size:24px}}}}@media print{{main{{margin:0}}body{{background:white}}button{{display:none}}}}</style></head><body><main>
<div class="eyebrow">REMICARE · CROP MẮT THEO KHUNG NGUỒN · 28/10/2026</div><h1>Cover Test v3 · {name}</h1>
<div class="banner"><strong>{valid}/3 chu kỳ có phép đo chính hợp lệ</strong><br>{esc(current["summary"]["verdict"])} — kết quả kỹ thuật, không phải chẩn đoán NORMAL.</div>
<div class="cards"><div class="card"><strong>{previous["summary"]["validCycles"]} → {valid}</strong>chu kỳ hợp lệ v2 → v3</div><div class="card"><strong>{current["statistics"]["primaryValidLegs"]}/6</strong>lượt đo chính đạt gate</div><div class="card"><strong>{pair_count}</strong>cặp crop nguồn ở các mốc</div><div class="card"><strong>{manifest["export"]["imageFiles"]}</strong>file PNG riêng từng mắt</div></div>
<p class="note">Crop được cắt trực tiếp từ video gốc {current["source"]["width"]}×{current["source"]["height"]}, không resize hoặc sinh thêm chi tiết. Landmark được tính ở {current["source"]["processingWidth"]}×{current["source"]["processingHeight"]} rồi quy sang tọa độ nguồn. Ứng dụng và replay dùng cùng hàm <code>getEyePairCropRegions()</code>. Bấm vào từng ảnh để tải PNG.</p>
<h2>1. Cặp crop tại ứng viên bỏ che</h2><p>Hai mắt của mỗi cặp có cùng frame ID và timestamp. Vùng trái/phải là bên trong ảnh; mirroring của video chưa được xác nhận. Các ứng viên chụp không tự chứng minh phép đo hồi phục đạt chất lượng.</p>
<div class="gallery">{''.join(gallery)}</div>
<h2>2. Crop trước, trong và sau thao tác</h2><p>Mỗi lượt có tối đa 5 mốc, mỗi mốc gồm 2 crop: baseline, đặt che, +500 ms sau đặt che, ứng viên bỏ che và +500 ms sau ứng viên. Crop bên đang che có thể chỉ thấy tay/thìa; không đo hoặc suy diễn iris ẩn. Ảnh +500 ms là đối chiếu, có thể rơi vào chớp mắt và không thay thế mẫu bị loại.</p>{''.join(details)}
<h2>3. Cải tiến phép đo lần này</h2><ul><li>Giữ nguyên yêu cầu dữ liệu cửa sổ sớm 0–500 ms: ít nhất 5 mẫu trải 300 ms, khoảng trống tối đa 250 ms và tổng tối thiểu 15 mẫu.</li><li>Khoảng mất mẫu muộn chỉ được chấp nhận nếu còn đoạn ổn định liên tục tối thiểu 5 mẫu trải 200 ms, với độ phủ sau sự kiện ít nhất 1.000 ms. Các bước qua khoảng mất mẫu không được dùng để tính vận tốc.</li><li>Thêm manifest crop, frame ID, timestamp, hình chữ nhật nguồn, kích thước và SHA-256 mỗi PNG. Encoder ứng dụng từ chối ảnh không khớp frame/timestamp sự kiện.</li></ul>
<p>Chính sách đánh giá đoạn ổn định đã thay đổi so với v2; đây không chỉ là thay cách hiển thị. Những cửa sổ sớm thiếu hoặc có gián đoạn dài vẫn không đạt. Không nội suy mẫu mất và không hạ ngưỡng phát hiện chuyển động.</p>
<div class="scroll"><table><thead><tr><th>Lượt</th><th>Đo chính</th><th>Tổng mẫu</th><th>Mẫu sớm</th><th>Trải sớm (ms)</th><th>Mẫu ổn định</th><th>Trải ổn định (ms)</th><th>Khoảng mất muộn</th><th>Hồi phục</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>
<p>{'Clip còn một lượt chưa xác nhận được onset đặt che; lượt đó vẫn bị loại, không tạo crop sự kiện thay thế. Hai chu kỳ còn lại đủ phép đo chính.' if name=='4K_30FPS' else 'Các phép đo hồi phục còn thiếu hoặc không xác nhận được sự kiện vẫn ghi lỗi riêng; không gán giá trị 0 để thay dữ liệu thiếu.'}</p>
<h2>4. File dữ liệu và khả năng tái lập</h2><p>Thư mục <code>{name}/crops</code> chứa PNG; <code>crop_manifest.json</code> và <code>crop_index.csv</code> liên kết ảnh với số đo. File HTML này nhúng toàn bộ crop nên vẫn xem được khi tách riêng. Gói ZIP đi kèm giữ cả PNG, manifest, CSV, JSON kết quả và báo cáo.</p>
<p>Video nguồn: <code>{esc(current["source"]["file"])}</code><br>SHA-256: <code>{current["source"]["sha256"]}</code></p>
<button type="button" id="download">Tải JSON kết quả + manifest crop</button><details><summary>Xem JSON đầy đủ</summary><pre id="json-view"></pre></details>
<script id="result-data" type="application/json">{raw}</script><script>const raw=document.getElementById('result-data').textContent;document.getElementById('json-view').textContent=raw;document.getElementById('download').addEventListener('click',()=>{{const u=URL.createObjectURL(new Blob([raw],{{type:'application/json'}}));const a=document.createElement('a');a.href=u;a.download='{name}_CROP_RESULT_V3.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}});</script>
<footer>Đã xử lý mọi khung nguồn; kiểm tra tọa độ crop nằm trong ảnh, giải mã tuần tự đúng frame/timestamp và PNG khớp từng pixel nguồn. Ba clip này dùng để phát hiện lỗi và kiểm tra hồi quy, chưa phải tập kiểm định độc lập. Đây là replay MediaPipe Python + code JavaScript; chưa đo trực tiếp hiệu năng iPhone/Safari hoặc độ chính xác lâm sàng. Ba file thực nhận đều ở 720×1280, khoảng 30 FPS.</footer></main></body></html>'''
        target = OUT / f"{name}_CROP_RESULT_V3.html"
        target.write_text(doc, encoding="utf-8")
        print(f"WROTE {target.name}: {manifest['export']['imageFiles']} PNGs, {valid}/3 cycles")
    archive = OUT / "EYE_CROPS_AND_RESULTS_V3.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as dest:
        for file in sorted(OUT.rglob("*")):
            if file.is_file() and file.suffix != ".zip":
                dest.write(file, file.relative_to(OUT))
    print(f"VERIFIED {total} lossless eye crops; ZIP {archive.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
