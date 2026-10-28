"""Explicitly weak-label, seven-subject research training. Never deploys a model."""
import argparse
from collections import Counter
import csv
import hashlib
import json
from pathlib import Path
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from evidence import wilson
from video_features import extract_video, FEATURE_VERSION


def subject_folds(rows):
    for subject in sorted({row['subjectId'] for row in rows}):
        train = [i for i, row in enumerate(rows) if row['subjectId'] != subject]
        test = [i for i, row in enumerate(rows) if row['subjectId'] == subject]
        yield subject, train, test


def fit_model(features, rows, indices):
    labels = np.array([int(rows[i]['researchLabel'] == 'STRABISMUS') for i in indices])
    if len(set(labels)) != 2:
        raise ValueError('TRAINING_FOLD_NEEDS_BOTH_CLASSES')
    per_subject = Counter(rows[i]['subjectId'] for i in indices)
    class_subjects = {label: {rows[i]['subjectId'] for i in indices if int(rows[i]['researchLabel'] == 'STRABISMUS') == label} for label in [0, 1]}
    weights = np.array([1/(per_subject[rows[i]['subjectId']] * len(class_subjects[int(rows[i]['researchLabel'] == 'STRABISMUS')])) for i in indices])
    weights *= len(weights)/weights.sum()
    model = make_pipeline(StandardScaler(), LogisticRegression(C=.01, max_iter=3000, random_state=42))
    model.fit(np.array([features[i] for i in indices]), labels, logisticregression__sample_weight=weights)
    return model


def summarize(predictions):
    truth = np.array([row['truth'] for row in predictions])
    predicted = np.array([row['prediction'] for row in predictions], dtype=object)
    normal = truth == 'NORMAL'
    positive = ~normal
    correct = predicted == truth
    sensitivity = float(np.sum(correct & positive)/positive.sum()) if positive.any() else None
    specificity = float(np.sum(correct & normal)/normal.sum()) if normal.any() else None
    return {'subjects': len(truth), 'normalSubjects': int(normal.sum()), 'strabismusSubjects': int(positive.sum()),
            'accuracy': float(correct.mean()), 'balancedAccuracy': (sensitivity+specificity)/2 if sensitivity is not None and specificity is not None else None,
            'sensitivity': sensitivity, 'specificity': specificity,
            'descriptiveAccuracy95CI': wilson(int(correct.sum()), len(truth)),
            'descriptiveSensitivity95CI': wilson(int(np.sum(correct & positive)), int(positive.sum())),
            'descriptiveSpecificity95CI': wilson(int(np.sum(correct & normal)), int(normal.sum())),
            'coverage': sum(row['prediction'] is not None for row in predictions)/len(predictions)}


def run(root, review, output):
    output.mkdir(parents=True, exist_ok=True)
    with review.open(encoding='utf-8-sig', newline='') as stream:
        rows = list(csv.DictReader(stream))
    features, details = {}, []
    seen_sources, subject_labels = {}, {}
    for i, row in enumerate(rows):
        if not row.get('subjectId') or row.get('subjectVerified', '').lower() != 'true':
            raise ValueError('SUBJECT_GROUP_REQUIRED')
        folder = row['folderLabel']
        if folder not in {'NORMAL', 'ESOTROPIA', 'EXOTROPIA'}:
            raise ValueError('UNSUPPORTED_RESEARCH_FOLDER_LABEL')
        row['researchLabel'] = 'NORMAL' if folder == 'NORMAL' else 'STRABISMUS'
        subject, label = row['subjectId'], row['researchLabel']
        if subject in subject_labels and subject_labels[subject] != label:
            raise ValueError('INCONSISTENT_SUBJECT_LABEL')
        subject_labels[subject] = label
        source = root / row['file'].replace('\\', '/')
        sha = hashlib.sha256(source.read_bytes()).hexdigest()
        if sha != row['sourceSha256']:
            raise ValueError('SOURCE_REVIEW_HASH_MISMATCH')
        if sha in seen_sources and seen_sources[sha] != subject:
            raise ValueError('DUPLICATE_SOURCE_ACROSS_SUBJECTS')
        seen_sources[sha] = subject
        value, quality = extract_video(root / 'tracking-benchmark.local' / 'iphone-cover' / f'{source.stem}.jsonl.gz')
        if quality['sourceSha256'] != sha:
            raise ValueError('STALE_EXTRACTED_FEATURES')
        if value is not None:
            features[i] = value
        details.append({'file': row['file'], 'subjectId': subject, 'researchLabel': label,
                        'labelStatus': row['labelStatus'], 'sourceSha256': sha, 'quality': quality,
                        'featureEligible': value is not None})
        print(f"FEATURES {source.name}: {quality['visibleFrames']} visible eye frames; eligible={value is not None}", flush=True)
    predictions = []
    for subject, all_train_indices, test_indices in subject_folds(rows):
        train_indices = [i for i in all_train_indices if i in features]
        assert not {rows[i]['subjectId'] for i in train_indices} & {rows[i]['subjectId'] for i in test_indices}
        prediction, probability, failure = None, None, None
        try:
            model = fit_model(features, rows, train_indices)
            if not all(i in features for i in test_indices):
                raise ValueError('SUBJECT_HAS_REJECTED_VIDEO')
            probability = float(np.mean(model.predict_proba(np.array([features[i] for i in test_indices]))[:, list(model.classes_).index(1)]))
            prediction = 'STRABISMUS' if probability >= .5 else 'NORMAL'
        except ValueError as error:
            failure = str(error)
        predictions.append({'subjectId': subject, 'truth': subject_labels[subject], 'prediction': prediction,
                            'probabilityStrabismus': probability, 'abstentionReason': failure,
                            'trainSubjects': sorted({rows[i]['subjectId'] for i in train_indices}),
                            'heldoutFiles': [rows[i]['file'] for i in test_indices]})
    report = {'status': 'WEAK_LABEL_RESEARCH_CANDIDATE', 'clinicalValidation': False, 'promoted': False,
              'featureVersion': FEATURE_VERSION, 'videos': len(rows), 'independentSubjectGroups': len(subject_labels),
              'evaluation': 'leave-one-subject-out; three iPhone clips always held out together',
              'fixedHyperparameters': {'C': .01, 'randomState': 42, 'threshold': .5},
              'selectionPolicy': 'No tuning against the reported heldout predictions',
              'labelPolicy': 'Six distinct subjects user-confirmed; their folder labels remain weak/unverified. iPhone clinical label reported by user.',
              'ciScope': 'Descriptive Wilson intervals over seven out-of-fold subject predictions, NOT an independent external or clinical holdout CI; overlapping training folds and weak labels limit inference.',
              'summary': summarize(predictions), 'predictions': predictions, 'inputs': details,
              'reviewSha256': hashlib.sha256(review.read_bytes()).hexdigest()}
    report['majorityLabelReference'] = summarize([{**row, 'prediction': 'STRABISMUS'} for row in predictions])
    report['featureCount'] = len(next(iter(features.values()))) if features else 0
    report['sourceCodeHashes'] = {name: hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest()
                                 for name in ['train_video_research.py', 'video_features.py', 'evidence.py']}
    if len({rows[i]['researchLabel'] for i in features}) == 2:
        model = fit_model(features, rows, list(features))
        artifact = {'model': model, 'featureVersion': FEATURE_VERSION, 'inputContract': 'offline whole-video features, NOT live paired-event crops',
                    'classes': ['NORMAL', 'STRABISMUS'], 'promoted': False, 'clinicalValidation': False,
                    'reviewSha256': report['reviewSha256'], 'evaluation': report['summary']}
        joblib.dump(artifact, output/'video_research_candidate.joblib')
        # Serialization must preserve the actual fitted candidate's predictions.
        restored = joblib.load(output/'video_research_candidate.joblib')
        values = np.array([features[i] for i in features])
        np.testing.assert_allclose(model.predict_proba(values), restored['model'].predict_proba(values))
    (output/'training_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report['summary'], indent=2), flush=True)
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--review', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    run(args.root.resolve(), args.review, args.output)
