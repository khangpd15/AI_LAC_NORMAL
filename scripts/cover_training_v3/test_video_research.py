import base64
import numpy as np
import pytest
from train_video_research import subject_folds, summarize, fit_model
from video_features import visible_patch, movement_summary


def test_all_three_iphone_clips_are_held_out_together():
    rows = [{'subjectId': 'iphone'}]*3 + [{'subjectId': 'other1'}, {'subjectId': 'other2'}]
    folds = list(subject_folds(rows))
    assert len(folds) == 3
    _, train, test = next(fold for fold in folds if fold[0] == 'iphone')
    assert test == [0, 1, 2] and train == [3, 4]
    for _, train, test in folds:
        assert not {rows[i]['subjectId'] for i in train} & {rows[i]['subjectId'] for i in test}


def test_abstained_subjects_remain_in_accuracy_denominator():
    result = summarize([{'truth': 'NORMAL', 'prediction': None},
                        {'truth': 'STRABISMUS', 'prediction': 'STRABISMUS'}])
    assert result['accuracy'] == .5 and result['coverage'] == .5
    assert result['sensitivity'] == 1. and result['specificity'] == 0.


def test_pixels_require_real_contrast_and_hog_remains_finite():
    pixels = np.full((24, 32, 4), 150, dtype=np.uint8)
    pixels[:, :, 3] = 255
    encode = lambda: {'rgba': base64.b64encode(pixels.tobytes()).decode()}
    assert visible_patch(encode()) is None
    pixels[6:18, 11:21, :3] = 25
    descriptor = visible_patch(encode())
    assert descriptor is not None and len(descriptor) == 192 and np.all(np.isfinite(descriptor))


def test_velocity_is_in_seconds_and_does_not_cross_a_tracking_gap():
    result = movement_summary([(0, [0., 0.]), (100, [.1, 0.]), (1000, [10., 0.])])
    assert result[-2] == pytest.approx(1.) and result[-1] == pytest.approx(1.)


def test_one_class_cannot_silently_train_a_binary_candidate():
    with pytest.raises(ValueError, match='NEEDS_BOTH_CLASSES'):
        fit_model({0: [1., 2.], 1: [2., 3.]},
                  [{'subjectId': 'a', 'researchLabel': 'NORMAL'},
                   {'subjectId': 'b', 'researchLabel': 'NORMAL'}], [0, 1])
