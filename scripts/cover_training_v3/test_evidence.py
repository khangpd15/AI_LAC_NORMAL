import math
import pytest
from evidence import wilson, minimum_subjects, promotion_assessment


def test_perfect_tiny_sample_cannot_prove_high_reliability():
    assert wilson(3, 3)[0] == pytest.approx(.4385029682)
    assert minimum_subjects(.90, 1.) == 35
    assert wilson(34, 34)[0] <= .90 < wilson(35, 35)[0]


def test_common_accuracy_does_not_hide_uncertain_normal_class():
    heldout = dict(accuracy=.98, balancedAccuracy=.98, sensitivity=.98, specificity=1.,
                   accuracy95CI=wilson(98, 100), sensitivity95CI=wilson(78, 80),
                   specificity95CI=wilson(20, 20), coverage=1, abstainedSubjects=0)
    result = promotion_assessment(heldout)
    assert not result['promoted']
    assert 'specificity95CI:LOWER_BOUND_NOT_PROVEN' in result['reasons']


def test_both_classes_and_all_attempts_must_meet_confidence_gate():
    heldout = dict(accuracy=1., balancedAccuracy=1., sensitivity=1., specificity=1.,
                   accuracy95CI=wilson(80, 80), sensitivity95CI=wilson(40, 40),
                   specificity95CI=wilson(40, 40), coverage=1., abstainedSubjects=0)
    assert promotion_assessment(heldout)['promoted']
    assert not promotion_assessment({**heldout, 'coverage': .99})['promoted']
    assert not promotion_assessment({**heldout, 'specificity95CI': [math.nan, 1.]})['promoted']


def test_invalid_counts_and_plans_are_rejected():
    with pytest.raises(ValueError): wilson(5, 4)
    with pytest.raises(ValueError): minimum_subjects(.90, .80)
