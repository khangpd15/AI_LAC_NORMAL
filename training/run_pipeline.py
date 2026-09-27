"""
End-to-End Phase 2 Pipeline Runner
Executes the full pipeline in order:
1. Validate Dataset
2. Prepare Manifest
3. Patient-Level Split
4. Extract Features
5. Train Model
6. Evaluate Model & Generate Reports
7. Export ONNX & Verify Inference
"""

import sys
import subprocess

STEPS = [
    ("Step 1: Validate Dataset", ["python", "training/validate_dataset.py", "--dataset_dir", "dataset"]),
    ("Step 2: Prepare Dataset", ["python", "training/prepare_dataset.py", "--dataset_dir", "dataset"]),
    ("Step 3: Patient-Level Split", ["python", "training/split_dataset.py", "--manifest", "dataset/metadata.csv"]),
    ("Step 4: Extract Eye Features", ["python", "training/extract_features.py", "--splits_dir", "dataset/splits"]),
    ("Step 5: Train Model", ["python", "training/train.py"]),
    ("Step 6: Evaluate Model", ["python", "training/evaluate.py"]),
    ("Step 7: Export & Validate ONNX", ["python", "training/export_onnx.py"]),
]


def run_pipeline():
    print("\n=======================================================")
    print(" REMICARE AI - PHASE 2 FULL PIPELINE RUNNER")
    print("=======================================================\n")

    for title, cmd in STEPS:
        print(f"\n>>> Running {title}...")
        result = subprocess.run(cmd)
        if result.returncode != 0:
            print(f"[!] Pipeline halted on {title} with return code {result.returncode}")
            sys.exit(result.returncode)

    print("\n=======================================================")
    print(" [SUCCESS] REMICARE AI PHASE 2 PIPELINE COMPLETE!")
    print(" All models, metrics, and reports successfully generated.")
    print("=======================================================\n")


if __name__ == '__main__':
    run_pipeline()
