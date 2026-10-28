"""Research transfer baseline from reviewed Hirschberg source-pixel eye ROIs.

No trajectory is fabricated for static images. Reviewer subject IDs are reported,
not certified as independent identities. This candidate can NEVER auto-promote.
"""
from collections import Counter
import argparse
import hashlib
import json
from pathlib import Path
import sys

import cv2
import joblib
import numpy as np
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from train import metrics
from app.services.cover_test.paired_crop_model import crop_features


def run(root, output):
    manifest = root/"hirschberg_review_all_v1/reviewed_candidates.jsonl"
    rows = [json.loads(line) for line in manifest.read_text(encoding="utf-8").splitlines() if line.strip()]
    vectors, labels, groups, hashes = [], [], [], []
    rejected = Counter()
    for row in rows:
        if row.get("clinical_confirmed") is not True or row.get("group") not in {"normal", "eso", "exo"}:
            rejected["UNCONFIRMED_LABEL"] += 1
            continue
        if row.get("orientation") != "unmirrored" or not row.get("subject_id"):
            rejected["MISSING_ORIENTATION_OR_REPORTED_ID"] += 1
            continue
        paths = [root/path for path in row.get("source_paths", [])]
        # Review tool retains byte-identical copies after original paths move.
        # Accept only the exact source SHA below, never a resized preview.
        for folder in ("normal", "eso", "exo", "unknow"):
            paths.extend(sorted((root/"hirschberg_review_all_v1"/folder).glob(row["image_id"] + "__*")))
        path = next((p for p in paths if p.is_file()), None)
        if path is None:
            rejected["MISSING_SOURCE_IMAGE"] += 1
            continue
        sha = hashlib.sha256(path.read_bytes()).hexdigest()
        if sha != row.get("sha256"):
            rejected["SOURCE_HASH_MISMATCH"] += 1
            continue
        if sha in hashes:
            rejected["DUPLICATE_SOURCE"] += 1
            continue
        try:
            rgb = np.asarray(Image.open(path).convert("RGB"))
            crops = []
            # Anatomical LEFT appears on image RIGHT in unmirrored pixels.
            for side in ("image_right", "image_left"):
                bbox = row.get("eyes",{}).get(side,{}).get("bbox")
                if not isinstance(bbox, list) or len(bbox) != 4 or not all(isinstance(v, (int,float)) and np.isfinite(v) for v in bbox):
                    raise ValueError("INVALID_REVIEWED_BBOX")
                x1,y1,x2,y2 = map(int, bbox)
                if not (0<=x1<x2<=rgb.shape[1] and 0<=y1<y2<=rgb.shape[0]):
                    raise ValueError("BBOX_OUTSIDE_SOURCE")
                # Use pixels only; annotated pupil/reflex points are NOT features.
                crops.append(rgb[y1:y2,x1:x2])
            vector = np.r_[crop_features(crops[0]), crop_features(crops[1])]
        except (KeyError, ValueError, OSError) as exc:
            rejected[str(exc)] += 1
            continue
        vectors.append(vector)
        labels.append(int(row["group"] != "normal"))
        groups.append(row["subject_id"])
        hashes.append(sha)
    X, y, g = np.asarray(vectors), np.asarray(labels), np.asarray(groups)
    if len(set(y)) != 2 or min(Counter(y).values()) < 5:
        raise ValueError(f"INSUFFICIENT_STATIC_IMAGE_CLASSES counts={dict(Counter(labels))}; excluded={dict(rejected)}")
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=20261028)
    predictions = np.full(len(y), -1)
    folds = []
    for number, (train, test) in enumerate(splitter.split(X,y,g), 1):
        if set(g[train]) & set(g[test]):
            raise ValueError("GROUP_LEAKAGE")
        model = make_pipeline(StandardScaler(), LogisticRegression(C=.01, class_weight="balanced", max_iter=3000, random_state=42))
        model.fit(X[train], y[train])
        predictions[test] = model.predict(X[test])
        folds.append({"fold":number,"trainImages":len(train),"testImages":len(test),"groupsDisjoint":True})
    evaluation = metrics(y,predictions)
    evaluation["evaluationUnit"] = "image_with_reported_subject_grouping"
    evaluation.pop("subjects", None)
    final = make_pipeline(StandardScaler(), LogisticRegression(C=.01,class_weight="balanced",max_iter=3000,random_state=42))
    final.fit(X,y)
    output.mkdir(parents=True,exist_ok=True)
    report = {"status":"RESEARCH_STATIC_IMAGE_TRANSFER_ONLY","inputRows":len(rows),"trainedImages":len(y),
              "reportedSubjectIds":len(set(g)),"classCounts":{"NORMAL":int(sum(y==0)),"STRABISMUS":int(sum(y==1))},
              "exclusions":dict(rejected),"evaluation":evaluation,"folds":folds,"promoted":False,
              "coverTestAccuracy":None,"sourceManifestSha256":hashlib.sha256(manifest.read_bytes()).hexdigest(),
              "limitations":["All source candidates were marked pending identity QC; this research run does not certify patient independence.",
                             "Static Hirschberg image morphology; no paired Cover Test movements or timestamps.",
                             "Reviewed/exposed source images are not a sealed clinical holdout.",
                             "Do not use these OOF numbers as clinical or >=30fps Cover Test accuracy."]}
    joblib.dump({"contract":"hirschberg-paired-pixel-transfer-research-v1","pipeline":final,
                 "featureVersion":"hog64x32-rgb-source-rois-v1","classes":[0,1],"validation":report}, output/"static_image_transfer_candidate.joblib")
    (output/"image_transfer_report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps(report,indent=2))


if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root",type=Path,required=True)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    run(args.root,args.output)
