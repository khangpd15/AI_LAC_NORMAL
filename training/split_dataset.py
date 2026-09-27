"""
Patient-Level Dataset Splitting Script
Splits dataset into 70% Train / 15% Validation / 15% Test.
Ensures zero data leakage across patients when patient ID is present.
Issues prominent warning if no patient ID is found.
"""

import os
import sys
import csv
import json
import random
import argparse
from collections import defaultdict
import numpy as np

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def split_dataset(manifest_csv="dataset/metadata.csv", output_dir="dataset/splits",
                  train_ratio=0.70, val_ratio=0.15, test_ratio=0.15, seed=42):
    random.seed(seed)
    np.random.seed(seed)
    os.makedirs(output_dir, exist_ok=True)

    if not os.path.exists(manifest_csv):
        raise FileNotFoundError(f"Manifest CSV not found: {manifest_csv}. Run prepare_dataset.py first.")

    rows = []
    with open(manifest_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)

    if not rows:
        raise ValueError(f"No samples found in {manifest_csv}")

    # Check patient ID availability
    patients = defaultdict(list)
    has_patient_ids = False
    valid_pids = 0

    for r in rows:
        pid = r.get("patient_id", "").strip()
        if pid:
            patients[pid].append(r)
            valid_pids += 1
        else:
            # Fallback unique pseudo-id
            pseudo_pid = f"ANON_{r['filename']}"
            patients[pseudo_pid].append(r)

    # If at least 60% of samples have patient ID, consider it patient-level
    if valid_pids >= 0.6 * len(rows) and len(patients) > 3:
        has_patient_ids = True

    print("\n=======================================================")
    print(" REMICARE AI - DATASET SPLIT PROCEDURE")
    print(f" Total Samples: {len(rows)} across {len(patients)} patient groups")
    print(f" Target Ratios: Train={train_ratio*100:.0f}%, Val={val_ratio*100:.0f}%, Test={test_ratio*100:.0f}%")
    print("=======================================================\n")

    train_rows = []
    val_rows = []
    test_rows = []
    warning_message = None

    if has_patient_ids:
        print("[+] SUCCESS: Patient IDs detected. Executing strict Patient-Level Split.")
        # Group patients by their primary class to maintain class balance across splits
        patient_by_class = defaultdict(list)
        for pid, p_rows in patients.items():
            primary_label = p_rows[0].get("label", "0")
            patient_by_class[primary_label].append(pid)

        train_pids = set()
        val_pids = set()
        test_pids = set()

        for lbl, pids in patient_by_class.items():
            random.shuffle(pids)
            n = len(pids)
            n_train = int(round(n * train_ratio))
            n_val = int(round(n * val_ratio))
            # Ensure at least 1 in val and test if possible
            if n >= 3:
                n_train = max(1, min(n - 2, n_train))
                n_val = max(1, min(n - n_train - 1, n_val))
            
            c_train = pids[:n_train]
            c_val = pids[n_train:n_train + n_val]
            c_test = pids[n_train + n_val:]

            train_pids.update(c_train)
            val_pids.update(c_val)
            test_pids.update(c_test)

        # Populate rows
        for pid, p_rows in patients.items():
            if pid in train_pids:
                train_rows.extend(p_rows)
            elif pid in val_pids:
                val_rows.extend(p_rows)
            else:
                test_rows.extend(p_rows)

        # Strict Verification: No patient in multiple splits
        assert len(train_pids.intersection(val_pids)) == 0, "Patient leakage in train-val!"
        assert len(train_pids.intersection(test_pids)) == 0, "Patient leakage in train-test!"
        assert len(val_pids.intersection(test_pids)) == 0, "Patient leakage in val-test!"
        print(f"[OK] Patient isolation verified. Train: {len(train_pids)} pts, Val: {len(val_pids)} pts, Test: {len(test_pids)} pts.")

    else:
        warning_message = (
            "CẢNH BÁO LÂM SÀNG: Dataset KHÔNG chứa Patient ID rõ ràng.\n"
            "Phép chia được thực hiện ở cấp độ hình ảnh (image-level stratified random split).\n"
            "Cảnh báo: Nếu có nhiều ảnh thuộc cùng một bệnh nhân, có khả năng xảy ra data leakage "
            "giữa các tập Train / Val / Test. Kết quả đánh giá có thể lạc quan hơn thực tế lâm sàng."
        )
        print("\n" + "!" * 65)
        print(warning_message)
        print("!" * 65 + "\n")

        # Stratified image-level split
        by_class = defaultdict(list)
        for r in rows:
            by_class[r.get("label", "0")].append(r)

        for lbl, items in by_class.items():
            random.shuffle(items)
            n = len(items)
            n_train = int(round(n * train_ratio))
            n_val = int(round(n * val_ratio))
            train_rows.extend(items[:n_train])
            val_rows.extend(items[n_train:n_train + n_val])
            test_rows.extend(items[n_train + n_val:])

    # Save CSV files
    fieldnames = list(rows[0].keys())
    
    def save_split(path, split_rows):
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(split_rows)

    train_path = os.path.join(output_dir, "train.csv")
    val_path = os.path.join(output_dir, "val.csv")
    test_path = os.path.join(output_dir, "test.csv")

    save_split(train_path, train_rows)
    save_split(val_path, val_rows)
    save_split(test_path, test_rows)

    summary = {
        "has_patient_ids": has_patient_ids,
        "warning": warning_message,
        "total_samples": len(rows),
        "train_samples": len(train_rows),
        "val_samples": len(val_rows),
        "test_samples": len(test_rows),
        "train_ratio": len(train_rows) / len(rows),
        "val_ratio": len(val_rows) / len(rows),
        "test_ratio": len(test_rows) / len(rows),
        "train_path": train_path.replace("\\", "/"),
        "val_path": val_path.replace("\\", "/"),
        "test_path": test_path.replace("\\", "/")
    }

    with open(os.path.join(output_dir, "split_summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\n[+] Splits saved to '{output_dir}':")
    print(f"    Train: {len(train_rows)} samples ({len(train_rows)/len(rows)*100:.1f}%)")
    print(f"    Val:   {len(val_rows)} samples ({len(val_rows)/len(rows)*100:.1f}%)")
    print(f"    Test:  {len(test_rows)} samples ({len(test_rows)/len(rows)*100:.1f}%)\n")

    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Split dataset into Train/Val/Test")
    parser.add_argument("--manifest", type=str, default="dataset/metadata.csv", help="Path to metadata.csv")
    parser.add_argument("--output_dir", type=str, default="dataset/splits", help="Folder to save split CSVs")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    split_dataset(args.manifest, args.output_dir, seed=args.seed)
