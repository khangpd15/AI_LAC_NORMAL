"""Offline video research features. Not the live paired-event model contract."""
import base64
import gzip
import json
import cv2
import numpy as np

FEATURE_VERSION = 'offline-video-open-eye-opencv-hog-canthal-v1'
MIN_VISIBLE_FRAMES = 15
_HOG = cv2.HOGDescriptor((32, 24), (16, 16), (8, 8), (8, 8), 8)


def eye_frame(points, side, width, height):
    inner, outer, iris, top, bottom = (362, 263, 473, 386, 374) if side == 0 else (133, 33, 468, 159, 145)
    p = np.asarray(points, dtype=float)[:, :2] * [width, height]
    a, b, center = p[inner], p[outer], p[iris]
    length = np.linalg.norm(b-a)
    if not np.isfinite(length) or length < 6:
        return None
    aperture = np.linalg.norm(p[top]-p[bottom]) / length
    if not np.isfinite(aperture) or aperture < .14:
        return None
    axis = (b-a) / length * (1 if b[0] >= a[0] else -1)
    delta = center - (a+b)/2
    gaze = [.5+np.dot(delta, axis)/length, .5+np.dot(delta, [-axis[1], axis[0]])/length]
    return gaze if np.all(np.isfinite(gaze)) else None


def visible_patch(raw):
    if not raw:
        return None
    rgba = np.frombuffer(base64.b64decode(raw['rgba']), dtype=np.uint8).reshape(24, 32, 4)
    gray = rgba[:, :, :3].astype(float) @ np.array([.299, .587, .114])
    center = gray[6:18, 11:21].mean()
    contrast = max(gray[7:17, 2:10].mean(), gray[7:17, 22:30].mean()) - center
    if contrast < 11 or gray.min() >= 90 or np.ptp(gray) < 24 or gray.std() < 9:
        return None
    return _HOG.compute(np.ascontiguousarray(np.clip(gray, 0, 255).astype(np.uint8))).ravel()


def movement_summary(samples):
    values = np.asarray([row[1] for row in samples])
    gaze = np.concatenate([np.median(values, axis=0), np.std(values, axis=0),
                           np.quantile(values, .1, axis=0), np.quantile(values, .9, axis=0)])
    speed = []
    for (ta, a), (tb, b) in zip(samples, samples[1:]):
        if 0 < tb-ta <= 100:
            speed.append(np.linalg.norm(np.asarray(b)-a) / ((tb-ta)/1000))
    return np.concatenate([gaze, [np.median(speed) if speed else 0., np.quantile(speed, .9) if speed else 0.]])


def extract_video(path):
    eyes = [[], []]
    hogs = [[], []]
    pair_differences = []
    total = 0
    previous_time = None
    with gzip.open(path, 'rt', encoding='utf-8') as stream:
        metadata = json.loads(next(stream))
        width, height = metadata['processingWidth'], metadata['processingHeight']
        for line in stream:
            row = json.loads(line)
            total += 1
            timestamp = row['ptsMs']
            if previous_time is not None and timestamp <= previous_time:
                raise ValueError('NON_MONOTONIC_SOURCE_TIME')
            previous_time = timestamp
            points = row.get('landmarks')
            if not points or len(points) < 478:
                continue
            pair = []
            for side in [0, 1]:
                frame = eye_frame(points, side, width, height)
                patches = row.get('patches', [])
                raw = patches[side*2] if len(patches) > side*2 else None
                descriptor = visible_patch(raw) if frame is not None else None
                if descriptor is not None:
                    eyes[side].append((timestamp, frame))
                    hogs[side].append(descriptor)
                    pair.append(frame)
                else:
                    pair.append(None)
            if all(value is not None for value in pair):
                pair_differences.append(np.asarray(pair[0])-pair[1])
    quality = {'decodedFrames': total, 'visibleFrames': [len(eye) for eye in eyes],
               'bothVisibleFrames': len(pair_differences), 'sourceSha256': metadata['sha256']}
    if min(map(len, eyes)) < MIN_VISIBLE_FRAMES or len(pair_differences) < MIN_VISIBLE_FRAMES:
        return None, quality
    differences = np.asarray(pair_differences)
    features = np.concatenate([*(movement_summary(eye) for eye in eyes),
                               np.median(differences, axis=0), np.std(differences, axis=0),
                               *(np.mean(descriptors, axis=0) for descriptors in hogs)])
    if not np.all(np.isfinite(features)):
        raise ValueError('NON_FINITE_VIDEO_FEATURES')
    return features, quality
