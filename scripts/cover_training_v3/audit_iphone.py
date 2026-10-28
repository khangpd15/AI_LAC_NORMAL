"""Audit actual iPhone source PTS/crops without creating clinical labels."""
import json
from pathlib import Path
import hashlib
from collections import Counter
from train import assess_timing, validate_source_event, paired_features
from PIL import Image
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
OUTPUT=ROOT/"docs/reports/backend-cover-v3"
OUTPUT.mkdir(parents=True,exist_ok=True)
rows, summaries=[],[]
for clip in ("4K_30FPS","4K_60FPS","HD_30FPS"):
    folder=ROOT/"docs/reports/iphone-cover-test-2026-10-28-v3"/clip
    manifest=json.loads((folder/"crop_manifest.json").read_text(encoding="utf-8"))
    replay=json.loads((ROOT/f"tracking-benchmark.local/iphone-cover/{clip}.v3.result.json").read_text(encoding="utf-8"))
    trace=json.loads((ROOT/f"tracking-benchmark.local/iphone-cover/{clip}.v3.trace.json").read_text(encoding="utf-8"))
    samples=[]
    for frame in trace:
        row={"frameId":frame["frameId"],"timestampMs":frame["timestampMs"],
             "coordinateSpace":"CANTHAL_LOCAL_V1","headPose":{"isValid":frame["headPoseValid"]}}
        for side in ("left","right"):
            coord=frame["coordinates"].get(side) or {}
            valid=bool(frame["validSamples"][side] and frame["qualityValid"] and frame["headPoseValid"])
            row[side+"Valid"]=valid
            row[side+"EyeLocal"]={"x":coord.get("normalizedX"),"y":coord.get("normalizedY"),"valid":valid}
        samples.append(row)
    quality=assess_timing(samples)
    events={e["sourceFrameId"]:e for e in replay["captureEligibleEvents"]}
    entries=[]
    for snap in manifest["snapshots"]:
        if snap["kind"]!="uncover" or not snap.get("eyes"):
            continue
        entry={"snapshotId":snap["snapshotId"],"frameId":snap["sourceFrameId"],"timestampMs":snap["timestampMs"],
               "sourceTimeOffsetMs":snap["timeOffsetMs"],"clinicalLabel":None}
        if snap["sourceFrameId"] not in events:
            entry["status"]="NOT_ELIGIBLE_SOURCE_EVENT"
            entries.append(entry)
            continue
        source=events[snap["sourceFrameId"]]
        event={"cycle":snap["cycle"],"frameId":snap["sourceFrameId"],"timestampMs":snap["timestampMs"],
               "confirmedAtMs":source["confirmedAtMs"],"onsetIntervalMs":source["onsetIntervalMs"],
               "timingUncertaintyMs":source["onsetIntervalMs"][1]-source["onsetIntervalMs"][0],
               "cropGeometryVersion":"source-eye-contour-v1","mirrored":None,
               "sourceWidth":manifest["source"]["width"],"sourceHeight":manifest["source"]["height"],
               "crops":{side:{k:snap["eyes"][side][k] for k in ("width","height","cropRegion")} for side in ("left","right")}}
        window=[s for s in samples if event["timestampMs"]-500<=s["timestampMs"]<=event["timestampMs"]+1500]
        try:
            validate_source_event(event,window)
            entry["status"]="ELIGIBLE"
        except ValueError as exc:
            entry["status"]=str(exc)
        # Run feature extraction separately to check motion/occlusion/coverage.
        try:
            imgs=[np.asarray(Image.open(folder/snap["eyes"][side]["file"]).convert("RGB")) for side in ("left","right")]
            vector=paired_features(*imgs,window,event["timestampMs"])
            entry["featureExtraction"]={"status":"OK","dimensions":len(vector),"finite":bool(np.all(np.isfinite(vector)))}
        except ValueError as exc:
            entry["featureExtraction"]={"status":str(exc)}
        entries.append(entry)
        rows.append({"subjectId":None,"subjectVerified":False,"split":None,"label":None,"labelStatus":"unverified",
                     "weakFolderLabel":"NORMAL","siteId":None,"deviceModel":"iPhone_unspecified",
                     "sessionId":clip,"sourceSha256":manifest["source"]["sha256"],"event":event,"samples":window,
                     **{side+"Image":str(folder/snap["eyes"][side]["file"]) for side in ("left","right")}})
    summary={"clip":clip,"sourceSha256":manifest["source"]["sha256"],"timing":quality,
             "cropFiles":sum(len(s.get("eyes") or {}) for s in manifest["snapshots"]),
             "sourceOrientation":manifest["sourceMirroring"],"events":entries,"accuracy":None,
             "notice":"All source frames assessed offline; this is not a live iPhone FE throughput benchmark."}
    (OUTPUT/f"{clip}_backend_audit.json").write_text(json.dumps(summary,indent=2),encoding="utf-8")
    summaries.append({"clip":clip,"timing":quality,"events":len(entries),"cropFiles":summary["cropFiles"]})
(OUTPUT/"iphone_training_manifest.json").write_text(json.dumps({"schema":"cover-paired-training-v3","rows":rows},indent=2),encoding="utf-8")
print(json.dumps(summaries,indent=2))
