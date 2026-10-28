"""Decode local iPhone clips for offline replay of the JS Cover Test services.

Native MediaPipe and OpenCV bilinear patch sampling are explicit adapters, not
measurements of Safari/iPhone runtime performance. No frames are subsampled.
"""
import base64
import argparse
import gzip
import hashlib
import json
import time
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tracking-benchmark.local" / "iphone-cover"
NAMES = ["4K_30FPS", "4K_60FPS", "HD_30FPS"]


def patch(frame, cx, cy, width, height):
    h, w = frame.shape[:2]
    sx = max(0, min(w - width, cx - width / 2))
    sy = max(0, min(h - height, cy - height / 2))
    sw, sh = min(width, w - sx), min(height, h - sy)
    if sw <= 2 or sh <= 2:
        return None
    xx, yy = np.meshgrid(np.arange(32), np.arange(24))
    mx = (sx + (xx + 0.5) * sw / 32 - 0.5).astype(np.float32)
    my = (sy + (yy + 0.5) * sh / 24 - 0.5).astype(np.float32)
    cropped = cv2.remap(frame, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    rgba = cv2.cvtColor(cropped, cv2.COLOR_BGR2RGBA)
    return {"rect": [sx, sy, sw, sh], "rgba": base64.b64encode(rgba.tobytes()).decode()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--all', action='store_true', help='Audit every supplied clip, retaining folder labels as unverified only')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    sources = sorted((ROOT / 'video' / 'VIDEO_COVER_TEST').rglob('*.mp4')) if args.all else [
        ROOT / 'video' / 'VIDEO_COVER_TEST' / 'NORMAL' / f'{name}.mp4' for name in NAMES]
    if len({source.stem for source in sources}) != len(sources):
        raise ValueError('DUPLICATE_CLIP_NAMES')
    for source in sources:
        name = source.stem
        source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        target = OUT / f"{name}.jsonl.gz"
        complete = OUT / f"{name}.complete.json"
        cached = json.loads(complete.read_text(encoding="utf-8")) if complete.exists() else {}
        if target.exists() and cached.get("maxEdge") == 960 and cached.get("sha256") == source_hash:
            print(f"CACHED {name}", flush=True)
            continue
        cap = cv2.VideoCapture(str(source))
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open {source}")
        fps = cap.get(cv2.CAP_PROP_FPS)
        count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        scale = min(1, 960 / max(w, h))
        pw, ph = round(w * scale), round(h * scale)
        metadata = dict(file=str(source.relative_to(ROOT)), sha256=source_hash,
                        folderLabel=source.parent.name, labelStatus='folder_unverified', subjectId=None,
                        bytes=source.stat().st_size, fps=fps, expectedFrames=count, width=w, height=h,
                        processingWidth=pw, processingHeight=ph, engine=f"Python MediaPipe {mp.__version__}",
                        cv2Version=cv2.__version__, maxEdge=960, allDecodedFrames=True,
                        orientationDegrees=cap.get(cv2.CAP_PROP_ORIENTATION_META),
                        patchSampler="OpenCV bilinear remap at Canvas-style pixel centers")
        started = time.perf_counter()
        with gzip.open(target, "wt", encoding="utf-8", compresslevel=3) as dest, mp.solutions.face_mesh.FaceMesh(
            max_num_faces=1, refine_landmarks=True, min_detection_confidence=0.5, min_tracking_confidence=0.5,
        ) as mesh:
            dest.write(json.dumps(metadata) + "\n")
            index, last_pts = 0, -1
            while True:
                ok, raw = cap.read()
                if not ok:
                    break
                pts = cap.get(cv2.CAP_PROP_POS_MSEC)
                if pts <= last_pts:
                    raise RuntimeError(f"Non-monotonic timestamp {name}:{index}")
                last_pts = pts
                frame = cv2.resize(raw, (pw, ph), interpolation=cv2.INTER_LINEAR)
                tick = time.perf_counter()
                result = mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                inference_ms = (time.perf_counter() - tick) * 1000
                landmarks, patches = None, []
                if result.multi_face_landmarks:
                    points = result.multi_face_landmarks[0].landmark
                    landmarks = [[p.x, p.y, p.z] for p in points]
                    for inner, outer, iris in [(362, 263, 473), (133, 33, 468)]:
                        a, b, p = points[inner], points[outer], points[iris]
                        canthal = np.hypot((a.x - b.x) * pw, (a.y - b.y) * ph)
                        patches.append(patch(frame, p.x * pw, p.y * ph, canthal * 1.5, canthal * 1.05))
                        fallback_w = max(26, np.hypot(a.x - b.x, a.y - b.y) * pw * 1.5)
                        patches.append(patch(frame, p.x * pw, p.y * ph, fallback_w, max(20, fallback_w * 0.7)))
                dest.write(json.dumps(dict(index=index, ptsMs=pts, nativeInferenceMs=inference_ms,
                                           landmarks=landmarks, patches=patches), separators=(",", ":")) + "\n")
                index += 1
                if index % 300 == 0:
                    print(f"{name}: {index}/{count} frames ({time.perf_counter()-started:.1f}s)", flush=True)
        cap.release()
        completed = dict(metadata, decodedFrames=index, lastPtsMs=last_pts, elapsedSeconds=time.perf_counter()-started)
        (OUT / f"{name}.complete.json").write_text(json.dumps(completed, indent=2), encoding="utf-8")
        print(f"DONE {name}: {index} frames", flush=True)


if __name__ == "__main__":
    main()
