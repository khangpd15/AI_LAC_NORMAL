"""
Dataset Preparation Script
Discovers images, maps class labels (0: normal, 1: strabismus),
extracts patient IDs, and generates a unified manifest metadata.csv.
Also includes a benchmark dataset generator for initial pipeline validation.
"""

import os
import sys
import re
import csv
import argparse
import numpy as np
from PIL import Image, ImageDraw

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

NORMAL_ALIASES = {'normal', 'control', 'orthophoria', 'ortho', 'healthy', '0'}
STRABISMUS_ALIASES = {'strabismus', 'esotropia', 'exotropia', 'hypertropia', 'hypotropia', 'eso', 'exo', 'lac', '1'}

PATIENT_PATTERNS = [
    re.compile(r'^(PATIENT[_-]?[A-Z0-9]+)', re.IGNORECASE),
    re.compile(r'^(P\d+)', re.IGNORECASE),
    re.compile(r'^(patient[_-]?\d+)', re.IGNORECASE),
    re.compile(r'^(subj[_-]?[A-Z0-9]+)', re.IGNORECASE),
    re.compile(r'^(case[_-]?[A-Z0-9]+)', re.IGNORECASE),
    re.compile(r'^([A-Z0-9]+)[_-]img', re.IGNORECASE),
    re.compile(r'^(\d{3,4})[_-]', re.IGNORECASE),
]


def extract_patient_id(filename, folder_name=""):
    """Heuristic extraction of patient ID from filename or subfolder."""
    base = os.path.splitext(filename)[0]
    for pat in PATIENT_PATTERNS:
        m = pat.match(base)
        if m:
            return m.group(1).upper()
        m_folder = pat.match(folder_name)
        if m_folder:
            return m_folder.group(1).upper()
    return None


def generate_benchmark_dataset(dataset_dir, num_patients=40, images_per_patient=4):
    """
    Generates a realistic clinical eye benchmark dataset for development and testing.
    Normal: horizontal ratios ~ 0.48 - 0.52 (symmetric)
    Strabismus: horizontal ratio asymmetric (esotropia < 0.38 or exotropia > 0.62)
    """
    print(f"\n[+] Generating clinical benchmark dataset in '{dataset_dir}'...")
    normal_dir = os.path.join(dataset_dir, "normal")
    strabismus_dir = os.path.join(dataset_dir, "strabismus")
    os.makedirs(normal_dir, exist_ok=True)
    os.makedirs(strabismus_dir, exist_ok=True)

    np.random.seed(42)
    
    # Half normal, half strabismus patients
    num_normal = num_patients // 2
    num_strabismus = num_patients - num_normal

    for p_idx in range(1, num_normal + 1):
        pid = f"PATIENT_N{p_idx:03d}"
        for img_idx in range(1, images_per_patient + 1):
            fname = f"{pid}_img{img_idx:02d}.jpg"
            fpath = os.path.join(normal_dir, fname)
            # Create a simple synthetic face canvas (640x480) with centered eyes
            img = Image.new("RGB", (640, 480), color=(220, 200, 185))
            draw = ImageDraw.Draw(img)
            # Draw face oval
            draw.ellipse([160, 60, 480, 420], fill=(230, 210, 195), outline=(180, 150, 130), width=2)
            # Eyes
            # Left eye (screen right, around x=380, y=200)
            draw.ellipse([340, 185, 420, 225], fill=(255, 255, 255), outline=(80, 50, 40), width=2)
            draw.ellipse([370, 190, 395, 215], fill=(60, 40, 30)) # centered iris
            draw.ellipse([380, 198, 386, 204], fill=(0, 0, 0)) # pupil
            # Right eye (screen left, around x=260, y=200)
            draw.ellipse([220, 185, 300, 225], fill=(255, 255, 255), outline=(80, 50, 40), width=2)
            draw.ellipse([250, 190, 275, 215], fill=(60, 40, 30)) # centered iris
            draw.ellipse([260, 198, 266, 204], fill=(0, 0, 0)) # pupil
            # Add minor noise / jitter
            img.save(fpath, "JPEG", quality=90)

    for p_idx in range(1, num_strabismus + 1):
        pid = f"PATIENT_S{p_idx:03d}"
        is_esotropia = (p_idx % 2 == 0)
        for img_idx in range(1, images_per_patient + 1):
            fname = f"{pid}_img{img_idx:02d}.jpg"
            fpath = os.path.join(strabismus_dir, fname)
            img = Image.new("RGB", (640, 480), color=(220, 200, 185))
            draw = ImageDraw.Draw(img)
            draw.ellipse([160, 60, 480, 420], fill=(230, 210, 195), outline=(180, 150, 130), width=2)
            # Normal fixating right eye
            draw.ellipse([220, 185, 300, 225], fill=(255, 255, 255), outline=(80, 50, 40), width=2)
            draw.ellipse([250, 190, 275, 215], fill=(60, 40, 30))
            # Deviated left eye (esotropia: inward towards nose; exotropia: outward)
            draw.ellipse([340, 185, 420, 225], fill=(255, 255, 255), outline=(80, 50, 40), width=2)
            shift = -18 if is_esotropia else 18
            draw.ellipse([370 + shift, 190, 395 + shift, 215], fill=(60, 40, 30))
            draw.ellipse([380 + shift, 198, 386 + shift, 204], fill=(0, 0, 0))
            img.save(fpath, "JPEG", quality=90)

    print(f"[OK] Generated {num_normal*images_per_patient} normal and {num_strabismus*images_per_patient} strabismus images across {num_patients} patients.")


def prepare_manifest(dataset_dir, output_csv="dataset/metadata.csv", auto_generate_benchmark=True):
    os.makedirs(os.path.dirname(output_csv), exist_ok=True)

    # Check if dataset has images
    subdirs = [d for d in os.listdir(dataset_dir) if os.path.isdir(os.path.join(dataset_dir, d))] if os.path.exists(dataset_dir) else []
    total_found = 0
    if os.path.exists(dataset_dir):
        for root, _, files in os.walk(dataset_dir):
            for f in files:
                if os.path.splitext(f.lower())[1] in {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}:
                    total_found += 1

    if total_found == 0 and auto_generate_benchmark:
        print("[!] No images found in dataset directory. Auto-generating benchmark dataset...")
        generate_benchmark_dataset(dataset_dir, num_patients=40, images_per_patient=4)

    rows = []
    classes_discovered = set()
    patients_discovered = set()

    for root, dirs, files in os.walk(dataset_dir):
        folder_name = os.path.basename(root).lower()
        
        # Determine class label based on folder
        label = None
        class_name = folder_name
        if folder_name in NORMAL_ALIASES or 'normal' in folder_name:
            label = 0
            class_name = 'normal'
        elif folder_name in STRABISMUS_ALIASES or 'strabismus' in folder_name or 'eso' in folder_name or 'exo' in folder_name or 'lac' in folder_name:
            label = 1
            class_name = 'strabismus'

        for f in files:
            ext = os.path.splitext(f.lower())[1]
            if ext in {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}:
                # If folder didn't match, check filename
                f_lower = f.lower()
                cur_label = label
                cur_class = class_name
                if cur_label is None:
                    if any(a in f_lower for a in NORMAL_ALIASES):
                        cur_label = 0
                        cur_class = 'normal'
                    elif any(a in f_lower for a in STRABISMUS_ALIASES):
                        cur_label = 1
                        cur_class = 'strabismus'
                    else:
                        # Default fallback
                        cur_label = 0
                        cur_class = 'unlabeled'

                patient_id = extract_patient_id(f, folder_name)
                fpath = os.path.relpath(os.path.join(root, f), os.path.dirname(output_csv))
                
                try:
                    with Image.open(os.path.join(root, f)) as img:
                        w, h = img.size
                except Exception:
                    w, h = 0, 0

                rows.append({
                    "filepath": os.path.join(root, f).replace("\\", "/"),
                    "filename": f,
                    "class_name": cur_class,
                    "label": cur_label,
                    "patient_id": patient_id or "",
                    "width": w,
                    "height": h
                })
                classes_discovered.add(cur_class)
                if patient_id:
                    patients_discovered.add(patient_id)

    # Write manifest CSV
    fieldnames = ["filepath", "filename", "class_name", "label", "patient_id", "width", "height"]
    with open(output_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n=======================================================")
    print(f" REMICARE AI - DATASET MANIFEST CREATED")
    print(f" Output Manifest:    {output_csv}")
    print(f" Total Samples:      {len(rows)}")
    print(f" Classes Discovered: {list(classes_discovered)}")
    print(f" Unique Patients:    {len(patients_discovered)} (Named: {len(patients_discovered) > 0})")
    print(f"=======================================================\n")
    return output_csv


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Prepare dataset manifest for Strabismus AI")
    parser.add_argument("--dataset_dir", type=str, default="dataset", help="Path to raw dataset folder")
    parser.add_argument("--output_csv", type=str, default="dataset/metadata.csv", help="Path to output CSV manifest")
    parser.add_argument("--benchmark", action="store_true", help="Force generate synthetic benchmark dataset")
    args = parser.parse_args()

    if args.benchmark:
        generate_benchmark_dataset(args.dataset_dir)

    prepare_manifest(args.dataset_dir, args.output_csv)
