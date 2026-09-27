"""
Dataset Validation Script
Checks dataset for:
- Corrupt/unreadable images
- Duplicate images (via SHA256 hashing)
- Missing/inaccessible files
- Class distribution and imbalance
- Image dimensions (width, height, channels, aspect ratio)
"""

import os
import sys
import glob
import hashlib
import json
import argparse
from collections import defaultdict
from PIL import Image

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}


def hash_file(filepath, chunk_size=65536):
    """Computes SHA-256 hash of a file to detect exact duplicate images."""
    hasher = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(chunk_size):
            hasher.update(chunk)
    return hasher.hexdigest()


def validate_dataset(dataset_dir):
    print(f"\n=======================================================")
    print(f" REMICARE AI - DATASET VALIDATION REPORT")
    print(f" Target Directory: {os.path.abspath(dataset_dir)}")
    print(f"=======================================================\n")

    if not os.path.exists(dataset_dir):
        print(f"[ERROR] Directory does not exist: {dataset_dir}")
        return False, {"error": "Directory does not exist"}

    # Discover classes from subdirectories
    subdirs = [d for d in os.listdir(dataset_dir) if os.path.isdir(os.path.join(dataset_dir, d))]
    
    if not subdirs:
        # Check if images exist directly in root
        root_images = [f for f in os.listdir(dataset_dir) if os.path.splitext(f.lower())[1] in SUPPORTED_EXTENSIONS]
        if root_images:
            subdirs = ['root']
        else:
            print(f"[WARNING] No subdirectories or supported images found in {dataset_dir}")
            return False, {"error": "Empty dataset directory"}

    stats = {
        "classes": {},
        "total_files": 0,
        "valid_images": 0,
        "corrupt_files": [],
        "duplicate_files": [],
        "dimension_stats": {
            "min_width": float('inf'),
            "max_width": 0,
            "min_height": float('inf'),
            "max_height": 0,
            "channels": set()
        }
    }

    seen_hashes = {}
    
    for cls in subdirs:
        cls_dir = dataset_dir if cls == 'root' else os.path.join(dataset_dir, cls)
        image_paths = []
        for ext in SUPPORTED_EXTENSIONS:
            image_paths.extend(glob.glob(os.path.join(cls_dir, f"*{ext}")))
            image_paths.extend(glob.glob(os.path.join(cls_dir, f"*{ext.upper()}")))

        image_paths = sorted(list(set(image_paths)))
        stats["classes"][cls] = len(image_paths)
        stats["total_files"] += len(image_paths)

        print(f"[*] Scanning class '{cls}': {len(image_paths)} images found.")

        for img_path in image_paths:
            # 1. Check duplicate
            try:
                file_hash = hash_file(img_path)
                if file_hash in seen_hashes:
                    stats["duplicate_files"].append({
                        "file": img_path,
                        "duplicate_of": seen_hashes[file_hash]
                    })
                else:
                    seen_hashes[file_hash] = img_path
            except Exception as e:
                stats["corrupt_files"].append({"file": img_path, "reason": f"Cannot read: {e}"})
                continue

            # 2. Check corrupt image & dimensions
            try:
                with Image.open(img_path) as img:
                    img.verify()  # Verify integrity
                
                # Reopen to get size and mode after verify
                with Image.open(img_path) as img:
                    w, h = img.size
                    mode = img.mode
                    stats["valid_images"] += 1
                    stats["dimension_stats"]["min_width"] = min(stats["dimension_stats"]["min_width"], w)
                    stats["dimension_stats"]["max_width"] = max(stats["dimension_stats"]["max_width"], w)
                    stats["dimension_stats"]["min_height"] = min(stats["dimension_stats"]["min_height"], h)
                    stats["dimension_stats"]["max_height"] = max(stats["dimension_stats"]["max_height"], h)
                    stats["dimension_stats"]["channels"].add(mode)
            except Exception as e:
                stats["corrupt_files"].append({"file": img_path, "reason": f"Corrupt image: {e}"})

    # Summary analysis
    stats["dimension_stats"]["channels"] = list(stats["dimension_stats"]["channels"])
    if stats["dimension_stats"]["min_width"] == float('inf'):
        stats["dimension_stats"]["min_width"] = 0
        stats["dimension_stats"]["min_height"] = 0

    print("\n----------------- SUMMARY RESULTS -----------------")
    print(f"Total Files Scanned: {stats['total_files']}")
    print(f"Valid Images:        {stats['valid_images']}")
    print(f"Corrupt Images:      {len(stats['corrupt_files'])}")
    print(f"Duplicate Images:    {len(stats['duplicate_files'])}")
    
    # Class imbalance check
    class_counts = stats["classes"]
    if len(class_counts) > 1:
        max_c = max(class_counts.values()) if class_counts else 0
        min_c = min(class_counts.values()) if class_counts else 0
        imbalance_ratio = (max_c / max(1, min_c))
        print(f"Class Distribution:  {dict(class_counts)}")
        print(f"Imbalance Ratio:     {imbalance_ratio:.2f}")
        if imbalance_ratio > 2.0:
            print(f"[!] WARNING: High class imbalance detected (ratio > 2.0).")
            print(f"    Consider class-weighted loss or stratified resampling.")
        else:
            print(f"[OK] Class distribution is reasonably balanced.")

    print(f"Image Dimensions:    Min {stats['dimension_stats']['min_width']}x{stats['dimension_stats']['min_height']} | "
          f"Max {stats['dimension_stats']['max_width']}x{stats['dimension_stats']['max_height']}")
    print(f"Color Channels:      {stats['dimension_stats']['channels']}")

    is_healthy = (stats["total_files"] > 0 and len(stats["corrupt_files"]) == 0)
    print("---------------------------------------------------")
    print(f"Validation Status:   {'PASSED' if is_healthy else 'FAILED/EMPTY'}\n")

    return is_healthy, stats


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Validate dataset for Strabismus AI")
    parser.add_argument("--dataset_dir", type=str, default="dataset", help="Path to dataset root folder")
    parser.add_argument("--output_json", type=str, default="reports/dataset_validation.json", help="Path to save report")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output_json), exist_ok=True)
    success, report = validate_dataset(args.dataset_dir)
    
    with open(args.output_json, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"[+] Validation report saved to: {args.output_json}")
