"""Render offline evidence; neither lane applies a strabismus image warp."""
import json
from pathlib import Path
import cv2
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

root = Path(__file__).resolve().parents[1]
out = root / "docs" / "tracking-benchmark"
traces = json.loads((root / "tracking-benchmark.local" / "overlay-traces.json").read_text())
contours = [[362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
            [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]]
colors = [(180, 180, 180), (100, 220, 40), (40, 160, 255)]
methods = ["raw", "sim", "cover"]
titles = ["FaceMesh raw", "Simulation / mobile filter", "Cover test / One Euro"]
writer = cv2.VideoWriter(str(out / "comparison.webm"), cv2.VideoWriter_fourcc(*"VP80"), 30, (960, 600))
if not writer.isOpened():
    raise RuntimeError("Video writer unavailable")
montage = []
fig, axes = plt.subplots(6, 1, figsize=(13, 14), constrained_layout=True)

def letterbox(image, w, h):
    ih, iw = image.shape[:2]
    scale = min(w / iw, h / ih)
    image = cv2.resize(image, (max(1, round(iw * scale)), max(1, round(ih * scale))))
    result = np.full((h, w, 3), 18, dtype=np.uint8)
    x, y = (w - image.shape[1]) // 2, (h - image.shape[0]) // 2
    result[y:y+image.shape[0], x:x+image.shape[1]] = image
    return result

for clip, ax in zip(traces, axes):
    cap = cv2.VideoCapture(str(root / clip["file"]))
    start = round(2 * clip["fps"])
    end = min(len(clip["frames"]), start + 240)
    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    for index in range(start, end):
        ok, image = cap.read()
        if not ok:
            raise RuntimeError("Preview decode failure")
        row = clip["frames"][index]
        h, w = image.shape[:2]
        crop_box = None
        if row["raw"]:
            points = np.array(list(row["raw"].values())) * [w, h]
            x0, y0 = points.min(axis=0)
            x1, y1 = points.max(axis=0)
            padding = max(12, (x1-x0)*0.12)
            crop_box = (max(0, int(x0-padding)), max(0, int(y0-padding)),
                        min(w, int(x1+padding)), min(h, int(y1+padding)))
        panels = []
        for method, title, color in zip(methods, titles, colors):
            annotated = image.copy()
            lm = row[method]
            if lm:
                for contour in contours:
                    pts = np.array([[lm[str(i)][0]*w, lm[str(i)][1]*h] for i in contour], dtype=np.int32)
                    cv2.polylines(annotated, [pts], True, color, max(1, w//450), cv2.LINE_AA)
                for iris in [468, 473]:
                    point = tuple(int(a*b) for a, b in zip(lm[str(iris)], [w, h]))
                    cv2.drawMarker(annotated, point, color, cv2.MARKER_CROSS, max(6, w//70), 1)
            panel = np.full((600, 320, 3), 18, dtype=np.uint8)
            cv2.putText(panel, title, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, .49, color, 1, cv2.LINE_AA)
            cv2.putText(panel, f'{Path(clip["file"]).stem} | {row["ptsMs"]/1000:.3f}s', (8, 47), cv2.FONT_HERSHEY_SIMPLEX, .42, (230,230,230), 1, cv2.LINE_AA)
            panel[60:440] = letterbox(annotated, 320, 380)
            if crop_box:
                x0, y0, x1, y1 = crop_box
                panel[450:580] = letterbox(annotated[y0:y1, x0:x1], 320, 130)
            else:
                cv2.putText(panel, "NO FACE LANDMARKS", (40, 510), cv2.FONT_HERSHEY_SIMPLEX, .5, (100,100,255), 1)
            panels.append(panel)
        combined = np.hstack(panels)
        writer.write(combined)
        if index == start + 30:
            montage.append(combined)
    cap.release()
    # Eye position relative to corners, to remove simple head translation.
    for method, color in zip(methods, ["#777777", "#168039", "#df7400"]):
        x, y = [], []
        for row in clip["frames"]:
            x.append(row["ptsMs"]/1000)
            lm = row[method]
            if not lm:
                y.append(np.nan)
                continue
            inner, outer, iris = [np.array(lm[str(i)]) for i in [362, 263, 473]]
            axis = inner-outer
            y.append(np.dot(iris-outer, axis)/max(1e-8, np.dot(axis, axis)))
        ax.plot(x, y, color=color, linewidth=.8, label=method)
    ax.set_title(Path(clip["file"]).stem, loc="left", fontsize=11)
    ax.set_ylabel("Relative iris X")
    ax.grid(alpha=.2)
axes[0].legend(loc="upper right", ncol=3)
axes[-1].set_xlabel("Source video timestamp (seconds)")
fig.suptitle("Same decoded frames, same FaceMesh input; different temporal filters\nRaw reference is not human-annotated ground truth", fontsize=14)
fig.savefig(out / "gaze-traces.png", dpi=130)
writer.release()
cv2.imwrite(str(out / "preview.jpg"), np.vstack(montage))
check = cv2.VideoCapture(str(out / "comparison.webm"))
print("Preview video:", check.get(cv2.CAP_PROP_FRAME_COUNT), "frames;", check.get(cv2.CAP_PROP_FPS), "FPS")
check.release()
