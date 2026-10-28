"""Subject-level confidence gates; frame count is never independent sample size."""
import math


def wilson(correct, total):
    if total < 0 or correct < 0 or correct > total:
        raise ValueError('INVALID_BINOMIAL_COUNTS')
    if not total:
        return [0., 1.]
    z = 1.959963984540054
    p, d = correct / total, 1 + z*z/total
    center = (p + z*z/(2*total))/d
    radius = z*math.sqrt(p*(1-p)/total + z*z/(4*total*total))/d
    return [max(0., center-radius), min(1., center+radius)]


def minimum_subjects(target_lower=.90, assumed_accuracy=1.):
    if not 0 < target_lower < assumed_accuracy <= 1:
        raise ValueError('INVALID_PLANNING_ASSUMPTION')
    for n in range(1, 100001):
        if wilson(math.floor(n*assumed_accuracy), n)[0] > target_lower:
            return n
    return None


def promotion_assessment(heldout, target=.90):
    reasons = []
    for metric in ('accuracy', 'balancedAccuracy', 'sensitivity', 'specificity'):
        value = heldout.get(metric)
        if not isinstance(value, (int, float)) or not math.isfinite(value) or value <= target:
            reasons.append(f'{metric}:POINT_ESTIMATE_BELOW_TARGET')
    for metric in ('accuracy95CI', 'sensitivity95CI', 'specificity95CI'):
        interval = heldout.get(metric)
        if not isinstance(interval, (list, tuple)) or len(interval) != 2 or not all(
                isinstance(v, (int, float)) and math.isfinite(v) for v in interval) or not (
                0 <= interval[0] <= interval[1] <= 1) or interval[0] <= target:
            reasons.append(f'{metric}:LOWER_BOUND_NOT_PROVEN')
    if heldout.get('coverage') != 1 or heldout.get('abstainedSubjects', 0) != 0:
        reasons.append('INCOMPLETE_ATTEMPT_COVERAGE')
    return {'promoted': not reasons, 'reasons': reasons, 'targetLower95CI': target,
            'evaluationUnit': 'verified_independent_subject', 'ciMethod': 'Wilson two-sided 95%'}
