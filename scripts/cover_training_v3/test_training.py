import copy
import hashlib
from pathlib import Path
import sys

import pytest
from train import audit, wilson


def row(tmp_path, subject="A", split="train", source="source"):
    for side in ("left", "right"):
        (tmp_path/(side+".png")).write_bytes(side.encode())
    return {"subjectId":subject,"subjectVerified":True,"label":"NORMAL","labelStatus":"clinician_confirmed",
            "split":split,"sessionId":"session","sourceSha256":source,"siteId":"site","deviceModel":"device",
            "leftImage":"left.png","rightImage":"right.png"}


def test_subject_cannot_cross_train_test(tmp_path):
    a=row(tmp_path);b={**a,"split":"test","sourceSha256":"other"}
    with pytest.raises(ValueError,match="SUBJECT_LEAKAGE"): audit([a,b],tmp_path)


def test_source_cannot_be_assigned_different_subject(tmp_path):
    a=row(tmp_path);b={**a,"subjectId":"B"}
    with pytest.raises(ValueError,match="SOURCE_VIDEO_LEAKAGE"): audit([a,b],tmp_path)


def test_duplicate_pixels_cannot_cross_groups(tmp_path):
    a=row(tmp_path);b={**a,"subjectId":"B","sourceSha256":"other"}
    with pytest.raises(ValueError,match="DUPLICATE_IMAGE_LEAKAGE"): audit([a,b],tmp_path)


def test_folder_label_never_becomes_clinical_label(tmp_path):
    a=row(tmp_path);a["labelStatus"]="folder_name"
    eligible, report=audit([a],tmp_path)
    assert eligible==[] and report["readyForTraining"] is False
    assert report["exclusionReasons"]["MISSING_VERIFIED_CLINICAL_LABEL"]==1


def test_three_perfect_cases_do_not_prove_90_percent():
    assert wilson(3,3)[0] < .9
    assert wilson(40,40)[0] > .9
