"""Inventory supplied videos without upgrading folder names to clinical labels."""
import argparse
import csv
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
from evidence import wilson, minimum_subjects


def audit_dataset(root, output):
    root = root.resolve()
    cache = root / 'tracking-benchmark.local' / 'iphone-cover'
    review_path = output.parent / 'subject-label-review.csv'
    reviews = {}
    if review_path.exists():
        with review_path.open(encoding='utf-8-sig', newline='') as stream:
            for item in csv.DictReader(stream):
                key = item['file'].replace('\\', '/')
                if key in reviews:
                    raise ValueError('DUPLICATE_REVIEW_FILE')
                reviews[key] = item
    rows = []
    for source in sorted((root / 'video' / 'VIDEO_COVER_TEST').rglob('*.mp4')):
        complete = cache / f'{source.stem}.complete.json'
        metadata = json.loads(complete.read_text(encoding='utf-8')) if complete.exists() else {}
        sha = hashlib.sha256(source.read_bytes()).hexdigest()
        row = {'file': str(source.relative_to(root)), 'sourceSha256': sha,
               'folderLabel': source.parent.name, 'labelStatus': 'folder_unverified',
               'clinicalLabel': None, 'subjectId': None, 'subjectVerified': False,
               'split': None, 'offlineExtractionReady': False}
        review = reviews.get(row['file'].replace('\\', '/'))
        if review:
            if review.get('sourceSha256') != sha:
                raise ValueError(f'REVIEW_SOURCE_HASH_MISMATCH:{source.name}')
            row.update(subjectId=review.get('subjectId') or None,
                       subjectVerified=review.get('subjectVerified', '').lower() == 'true',
                       clinicalLabel=review.get('clinicalLabel') or None,
                       labelStatus=review.get('labelStatus') or 'folder_unverified',
                       labelVerificationSource=review.get('labelVerificationSource') or None,
                       identityVerificationSource=review.get('identityVerificationSource') or None,
                       reviewer=review.get('reviewer') or None, split=review.get('split') or None)
        data_path = cache / f'{source.stem}.jsonl.gz'
        if metadata.get('sha256') == sha and data_path.exists():
            timestamps, faces, count = [], 0, 0
            with gzip.open(data_path, 'rt', encoding='utf-8') as stream:
                next(stream)
                for line in stream:
                    item = json.loads(line)
                    count += 1
                    faces += bool(item.get('landmarks'))
                    timestamps.append(item['ptsMs'])
            row.update(decodedFrames=count, faceDetectedFrames=faces,
                       faceDetectionRate=faces/count if count else None,
                       sourceFps=metadata.get('fps'),
                       offlineExtractionReady=count == metadata.get('expectedFrames'),
                       sourceTimestampsMonotonic=all(b > a for a, b in zip(timestamps, timestamps[1:])))
        rows.append(row)
    groups = Counter(row['folderLabel'] for row in rows)
    sha_counts = Counter(row['sourceSha256'] for row in rows)
    known_subjects = {row['subjectId'] for row in rows if row['subjectVerified'] and row['subjectId']}
    confirmed_rows = [row for row in rows if row['labelStatus'] == 'clinician_confirmed' and row['clinicalLabel']]
    maximum_subjects = len(known_subjects) + sum(not row['subjectVerified'] or not row['subjectId'] for row in rows)
    result = {
        'status': 'NEEDS_VERIFIED_SUBJECTS_AND_LABELS', 'videos': len(rows),
        'folderCounts': dict(groups), 'verifiedSubjects': len(known_subjects), 'verifiedClinicalLabels': len(confirmed_rows),
        'confirmedLabelSubjects': len({row['subjectId'] for row in confirmed_rows if row['subjectVerified'] and row['subjectId']}),
        'duplicateSourceHashes': [sha for sha, count in sha_counts.items() if count > 1],
        'clinicalAccuracy': None, 'clinical95CI': None,
        'confidencePolicy': {'method': 'Wilson two-sided 95%', 'unit': 'verified independent subject',
                             'targetLowerBound': .90,
                             'perfectMinimumTestSubjectsPerClass': minimum_subjects(.90, 1.),
                             'planningAt95PercentCorrectPerClass': minimum_subjects(.90, .95)},
        'optimisticPlanningBoundOnly': {
            'assumption': 'Known shared subjects grouped; each unidentified video is at most one additional subject; all hypothetical predictions correct. NOT observed performance.',
            'maximumPossibleSubjectsGivenKnownGroups': maximum_subjects,
            'allCorrectMaximumSubjects95CI': wilson(maximum_subjects, maximum_subjects)},
        'requiredMetadata': ['verified subjectId', 'clinician-confirmed label and provenance',
                             'frozen subject-separated train/validation/test split',
                             'annotated cover/uncover side and source timestamps', 'camera mirroring, device and site'],
        'rows': rows}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = audit_dataset(args.root, args.output)
    print(json.dumps({k: v for k, v in report.items() if k != 'rows'}, indent=2))
