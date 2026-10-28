"""Train a genuine paired-crop candidate with an immutable subject holdout.

Manifest rows: subjectId, subjectVerified, sessionId, sourceSha256, siteId,
deviceModel, label, labelStatus=clinician_confirmed, split=train|validation|test,
event (FE crop metadata), samples (source timestamps in ms), leftImage/rightImage.
Paths are relative to manifest. All images must be unmirrored source-eye crops.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import hashlib
import json
import os
from pathlib import Path
import sys

import joblib
import numpy as np
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix
from evidence import wilson, minimum_subjects, promotion_assessment

_stage = Path(__file__).resolve().parents[2] / "backend-upgrade.local"
sys.path.insert(0, os.getenv("COVER_BACKEND_ROOT", str(_stage if _stage.exists() else Path("D:/REMICARE-STRABISMUS-AI-COVER-TEST"))))
from app.services.cover_test.paired_crop_model import (CONTRACT, FEATURE_VERSION, PairedCropPredictor,
                              assess_timing, validate_source_event, paired_features)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def metrics(truth, predicted):
    matrix = confusion_matrix(truth, predicted, labels=[0, 1])
    tn, fp, fn, tp = matrix.ravel()
    return {"subjects": len(truth), "accuracy": float(accuracy_score(truth, predicted)),
            "balancedAccuracy": float(balanced_accuracy_score(truth, predicted)),
            "sensitivity": float(tp/(tp+fn)) if tp+fn else 0.,
            "specificity": float(tn/(tn+fp)) if tn+fp else 0.,
            "accuracy95CI": wilson(tp+tn, len(truth)),
            "sensitivity95CI": wilson(tp, tp+fn), "specificity95CI": wilson(tn, tn+fp),
            "confusionMatrix": matrix.tolist()}


def audit(rows, root):
    reasons, splits, sources, image_owners, identities = Counter(), {}, {}, {}, {}
    eligible = []
    for i, row in enumerate(rows):
        failures = []
        if row.get("labelStatus") != "clinician_confirmed" or row.get("label") not in {"NORMAL", "STRABISMUS"}:
            failures.append("MISSING_VERIFIED_CLINICAL_LABEL")
        if not row.get("subjectId") or row.get("subjectVerified") is not True:
            failures.append("MISSING_VERIFIED_SUBJECT_ID")
        if row.get("split") not in {"train", "validation", "test"}:
            failures.append("MISSING_FROZEN_SUBJECT_SPLIT")
        if not all(row.get(k) for k in ("sessionId", "sourceSha256", "siteId", "deviceModel")):
            failures.append("MISSING_SOURCE_OR_DEVICE_PROVENANCE")
        subject, split = row.get("subjectId"), row.get("split")
        if subject and split:
            if subject in splits and splits[subject] != split:
                raise ValueError("SUBJECT_LEAKAGE_ACROSS_SPLITS")
            splits[subject] = split
            if subject in identities and identities[subject] != row.get("label"):
                raise ValueError("INCONSISTENT_SUBJECT_LABEL")
            identities[subject] = row.get("label")
        source = row.get("sourceSha256")
        owner = (subject, split)
        if source:
            if source in sources and sources[source] != owner:
                raise ValueError("SOURCE_VIDEO_LEAKAGE")
            sources[source] = owner
        for key in ("leftImage", "rightImage"):
            path = (root / row.get(key, "MISSING")).resolve()
            if not path.is_file():
                failures.append("MISSING_CROP_IMAGE")
                continue
            sha = digest(path)
            if sha in image_owners and image_owners[sha] != owner:
                raise ValueError("DUPLICATE_IMAGE_LEAKAGE")
            image_owners[sha] = owner
        for reason in set(failures):
            reasons[reason] += 1
        if not failures:
            eligible.append((i, row))
    groups = defaultdict(set)
    for _, row in eligible:
        groups[(row["split"], row["label"])].add(row["subjectId"])
    counts = {f"{s}:{c}": len(groups[(s, c)]) for s in ("train", "validation", "test") for c in ("NORMAL", "STRABISMUS")}
    ready = all(counts[f"{s}:{c}"] >= minimum for s, minimum in (("train",5),("validation",3),("test",20)) for c in ("NORMAL", "STRABISMUS"))
    return eligible, {"rows": len(rows), "eligibleRows": len(eligible), "exclusionReasons": dict(reasons),
                      "subjectsBySplitAndClass": counts, "readyForTraining": ready}


def grouped_predictions(model, X, rows, selected):
    sessions = defaultdict(list)
    session_cycles = defaultdict(set)
    labels = {}
    for index in selected:
        row = rows[index]
        subject = row["subjectId"]
        labels[subject] = int(row["label"] == "STRABISMUS")
        session = (subject,row["sessionId"])
        sessions[session]  # also retain sessions with zero accepted events
        if index in X:
            p = model.predict_proba(X[index].reshape(1,-1))[0]
            sessions[session].append(float(p[list(model.classes_).index("STRABISMUS")]))
            session_cycles[session].add(row["event"]["cycle"])
    aggregate, failed = defaultdict(list), set()
    for (subject,session), probabilities in sessions.items():
        if len(probabilities)<4 or len(session_cycles[(subject,session)])<2:
            failed.add(subject)
        else:
            aggregate[subject].append(float(np.mean(probabilities)))
    truth, predicted, missing = [], [], 0
    for subject in sorted(labels):
        target = labels[subject]
        truth.append(target)
        if aggregate[subject] and subject not in failed:
            predicted.append(int(np.mean(aggregate[subject]) >= .5))
        else:
            # Count abstained attempts separately and as errors in all-attempt accuracy.
            predicted.append(1-target)
            missing += 1
    result = metrics(truth, predicted)
    result.update(abstainedSubjects=missing, coverage=(len(truth)-missing)/len(truth))
    return result


def run(manifest, output, train=False):
    output.mkdir(parents=True, exist_ok=True)
    document = json.loads(manifest.read_text(encoding="utf-8"))
    rows = document["rows"]
    eligible, report = audit(rows, manifest.parent)
    report.update(contract=CONTRACT, featureVersion=FEATURE_VERSION, manifestSha256=digest(manifest),
                  targetAccuracy=.90, accuracy=None, status="AUDIT_ONLY")
    report['confidencePolicy'] = {
        'targetLower95CI': .90, 'requiredMetrics': ['accuracy', 'sensitivity', 'specificity'],
        'evaluationUnit': 'verified_independent_subject',
        'perfectCaseMinimumTestSubjectsPerClass': minimum_subjects(.90, 1.),
        'planningAt95PercentCorrectPerClass': minimum_subjects(.90, .95),
        'note': 'Planning assumptions only; no sample count guarantees performance.'}
    if train and not report["readyForTraining"]:
        report["status"] = "NEEDS_VERIFIED_PAIRED_SUBJECTS"
    if train and report["readyForTraining"]:
        X, failures = {}, Counter()
        for i, row in eligible:
            try:
                if row.get("primaryOcclusionVerified") is not True or row.get("occlusionVerified") is not True:
                    raise ValueError("UNVERIFIED_COVER_UNCOVER_PROCEDURE")
                quality = assess_timing(row["samples"])
                if not quality["eligible30fps"]:
                    raise ValueError(quality["reason"])
                ts = validate_source_event(row["event"], row["samples"])
                images = [np.asarray(Image.open(manifest.parent / row[k]).convert("RGB")) for k in ("leftImage", "rightImage")]
                for side, image in zip(("left", "right"), images):
                    crop = row["event"]["crops"][side]
                    if image.shape[:2][::-1] != (crop["width"], crop["height"]):
                        raise ValueError("CROP_IMAGE_SIZE_MISMATCH")
                X[i] = paired_features(*images, row["samples"], ts)
            except (ValueError, KeyError) as exc:
                failures[str(exc)] += 1
        train_ids = [i for i, r in eligible if r["split"] == "train" and i in X]
        val_ids = [i for i, r in eligible if r["split"] == "validation"]
        test_ids = [i for i, r in eligible if r["split"] == "test"]
        y = np.asarray([rows[i]["label"] for i in train_ids])
        # Recheck minimum subjects AFTER exclusions, rather than count dirty rows.
        for label in ("NORMAL", "STRABISMUS"):
            if len({rows[i]["subjectId"] for i in train_ids if rows[i]["label"] == label}) < 5:
                raise ValueError("INSUFFICIENT_TRAIN_SUBJECTS_AFTER_QUALITY_FILTER")
        counts = Counter(rows[i]["subjectId"] for i in train_ids)
        weights = np.asarray([1/counts[rows[i]["subjectId"]] for i in train_ids])
        candidates = []
        for c in (.01, .1, 1.):
            model = make_pipeline(StandardScaler(), LogisticRegression(C=c, class_weight="balanced", max_iter=3000, random_state=42))
            model.fit(np.asarray([X[i] for i in train_ids]), y, logisticregression__sample_weight=weights)
            val = grouped_predictions(model, X, rows, val_ids)
            candidates.append((val["balancedAccuracy"], c, model, val))
        _, c, model, validation = max(candidates, key=lambda item:item[0])
        test = grouped_predictions(model, X, rows, test_ids)  # holdout used ONCE after selection
        promotion = promotion_assessment(test)
        promoted = promotion['promoted']
        evidence = {"promoted": promoted, "heldoutAccuracy":test["accuracy"], "heldout":test,
                    "evaluationUnit":"subject", "deviceModels":sorted({rows[i]["deviceModel"] for i in test_ids}),
                    "scope":"Only the tested device/site population; no universal device claim."}
        # Candidate stays fit on TRAIN only. Never refit on sealed holdout.
        artifact = {"contract":"cover-uncover-multimodal-v1", "pairedContract":CONTRACT,
                    "featureVersion":FEATURE_VERSION, "classes":["NORMAL","STRABISMUS"],
                    "version":CONTRACT, "name":CONTRACT, "validation":evidence,
                    "model":PairedCropPredictor(model, evidence), "manifestSha256":digest(manifest)}
        joblib.dump(artifact, output/"paired_candidate.joblib")
        report.update(status="PROMOTION_ELIGIBLE" if promoted else "RESEARCH_CANDIDATE_ONLY",
                      selectedC=c, validation=validation, heldout=test, accuracy=test["accuracy"],
                      qualityExclusions=dict(failures), promoted=promoted, promotionAssessment=promotion)
    (output/"training_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--train", action="store_true")
    args = parser.parse_args()
    print(json.dumps(run(args.manifest, args.output, args.train), indent=2))
