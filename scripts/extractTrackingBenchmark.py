"""Offline shared-input benchmark. Native FaceMesh is not a mobile FPS test."""
import json
import time
from pathlib import Path
import cv2
import mediapipe as mp

root = Path(__file__).resolve().parents[1]
output = root / "tracking-benchmark.local"
output.mkdir(exist_ok=True)
for path in sorted((root / "video" / "VIDEO_COVER_TEST").rglob("*.mp4")):
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    metadata = dict(file=str(path.relative_to(root)), fps=fps, expectedFrames=count,
                    width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                    height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                    engine=f"Python MediaPipe {mp.__version__} FaceMesh refine_landmarks",
                    maxEdge=640)
    start = time.perf_counter()
    with (output / f"{path.stem}.jsonl").open("w") as dest, mp.solutions.face_mesh.FaceMesh(
        max_num_faces=1, refine_landmarks=True,
        min_detection_confidence=0.5, min_tracking_confidence=0.5,
    ) as mesh:
        dest.write(json.dumps(metadata) + "\n")
        index = 0
        last_pts = -1
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            pts = cap.get(cv2.CAP_PROP_POS_MSEC)
            if pts <= last_pts:
                raise RuntimeError(f"Non-monotonic decoded timestamp: {path}:{index}: {pts}")
            last_pts = pts
            h, w = frame.shape[:2]
            scale = min(1, 640 / max(w, h))
            frame = cv2.resize(frame, (round(w * scale), round(h * scale)))
            tick = time.perf_counter()
            result = mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            latency = (time.perf_counter() - tick) * 1000
            lm = None
            if result.multi_face_landmarks:
                lm = [[round(p.x, 7), round(p.y, 7), round(p.z, 7)]
                      for p in result.multi_face_landmarks[0].landmark]
            dest.write(json.dumps(dict(index=index, ptsMs=pts, nativeInferenceMs=latency, landmarks=lm),
                                  separators=(",", ":")) + "\n")
            index += 1
            if index % 600 == 0:
                print(f"{path.stem}: {index}/{count}", flush=True)
    cap.release()
    print(f"DONE {path.stem}: {index} frames in {time.perf_counter()-start:.1f}s", flush=True)
