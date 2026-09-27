"""
Model Training Script
Trains a lightweight Multi-Layer Perceptron (Small MLP) on normalized eye features.
Ensures reproducible training with fixed seed (42), saves normalization parameters,
hyperparameters, feature order, and training statistics.
"""

import os
import sys
import json
import joblib
import argparse
import numpy as np
import pandas as pd

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from sklearn.preprocessing import StandardScaler
from sklearn.neural_network import MLPClassifier
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score

FEATURE_ORDER = [
    "leftHorizontalRatio",
    "rightHorizontalRatio",
    "leftVerticalRatio",
    "rightVerticalRatio",
    "interocularDistance",
    "horizontalRatioDiff",
    "verticalRatioDiff",
    "leftEyeWidth",
    "rightEyeWidth",
    "irisDistanceRatio"
]

RANDOM_SEED = 42


def train_model(train_csv="dataset/features_train.csv",
                val_csv="dataset/features_val.csv",
                output_dir="models",
                seed=RANDOM_SEED):
    np.random.seed(seed)
    os.makedirs(output_dir, exist_ok=True)

    print("\n=======================================================")
    print(" REMICARE AI - STRABISMUS MODEL TRAINING")
    print(f" Train Data:  {train_csv}")
    print(f" Val Data:    {val_csv}")
    print(f" Target Dir:  {output_dir}")
    print(f" Random Seed: {seed}")
    print("=======================================================\n")

    if not os.path.exists(train_csv) or not os.path.exists(val_csv):
        raise FileNotFoundError(f"Feature CSVs not found. Run extract_features.py first.")

    train_df = pd.read_csv(train_csv)
    val_df = pd.read_csv(val_csv)

    X_train = train_df[FEATURE_ORDER].values
    y_train = train_df["label"].values.astype(int)

    X_val = val_df[FEATURE_ORDER].values
    y_val = val_df["label"].values.astype(int)

    print(f"[*] Train set: {len(X_train)} samples (Class 0: {sum(y_train==0)}, Class 1: {sum(y_train==1)})")
    print(f"[*] Val set:   {len(X_val)} samples (Class 0: {sum(y_val==0)}, Class 1: {sum(y_val==1)})")

    # 1. Normalization (Fit on Train only!)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)

    normalization_params = {
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "var": scaler.var_.tolist()
    }

    # 2. Candidate Models (Prioritize Small MLP)
    candidates = {
        "Small_MLP_32_16": MLPClassifier(
            hidden_layer_sizes=(32, 16),
            activation='relu',
            solver='adam',
            alpha=0.01,
            max_iter=500,
            random_state=seed,
            early_stopping=True,
            validation_fraction=0.15,
            n_iter_no_change=20
        ),
        "Logistic_Regression": LogisticRegression(
            C=1.0,
            penalty='l2',
            solver='lbfgs',
            max_iter=300,
            random_state=seed
        ),
        "Gradient_Boosting": GradientBoostingClassifier(
            n_estimators=40,
            max_depth=3,
            learning_rate=0.08,
            random_state=seed
        )
    }

    best_name = None
    best_model = None
    best_val_f1 = -1.0
    model_comparisons = {}

    print("\n[*] Evaluating candidate architectures on validation set:")
    for name, clf in candidates.items():
        clf.fit(X_train_scaled, y_train)
        preds = clf.predict(X_val_scaled)
        probs = clf.predict_proba(X_val_scaled)[:, 1] if hasattr(clf, "predict_proba") else preds

        acc = accuracy_score(y_val, preds)
        f1 = f1_score(y_val, preds, zero_division=0)
        try:
            auc = roc_auc_score(y_val, probs)
        except Exception:
            auc = 0.5

        model_comparisons[name] = {"val_accuracy": acc, "val_f1": f1, "val_auc": auc}
        print(f"    - {name:<20} | Acc: {acc:.4f} | F1: {f1:.4f} | AUC: {auc:.4f}")

        # Favor Small_MLP if competitive, or highest F1
        score_metric = f1 + (0.01 if "MLP" in name else 0.0)
        if score_metric > best_val_f1:
            best_val_f1 = score_metric
            best_name = name
            best_model = clf

    print(f"\n[+] Selected Best Model: {best_name} (Validation F1: {model_comparisons[best_name]['val_f1']:.4f})")

    # 3. Save artifacts
    model_path = os.path.join(output_dir, "trained_model.joblib")
    scaler_path = os.path.join(output_dir, "scaler.joblib")
    summary_path = os.path.join(output_dir, "training_summary.json")

    joblib.dump(best_model, model_path)
    joblib.dump(scaler, scaler_path)

    summary = {
        "model_architecture": best_name,
        "seed": seed,
        "feature_order": FEATURE_ORDER,
        "feature_count": len(FEATURE_ORDER),
        "normalization": normalization_params,
        "dataset_statistics": {
            "train_samples": len(X_train),
            "train_normal": int(sum(y_train == 0)),
            "train_strabismus": int(sum(y_train == 1)),
            "val_samples": len(X_val),
            "val_normal": int(sum(y_val == 0)),
            "val_strabismus": int(sum(y_val == 1))
        },
        "validation_metrics": model_comparisons[best_name],
        "all_candidates": model_comparisons,
        "threshold": 0.50
    }

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"[+] Model saved to:   {model_path}")
    print(f"[+] Scaler saved to:  {scaler_path}")
    print(f"[+] Summary saved to: {summary_path}")
    return best_model, scaler, summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Train Strabismus AI Classifier")
    parser.add_argument("--train_csv", type=str, default="dataset/features_train.csv", help="Path to train features CSV")
    parser.add_argument("--val_csv", type=str, default="dataset/features_val.csv", help="Path to validation features CSV")
    parser.add_argument("--output_dir", type=str, default="models", help="Output directory for model artifacts")
    parser.add_argument("--seed", type=int, default=RANDOM_SEED, help="Random seed")
    args = parser.parse_args()

    train_model(args.train_csv, args.val_csv, args.output_dir, seed=args.seed)
