"""
Model Evaluation Script
Evaluates trained Strabismus model on test dataset.
Computes:
- Accuracy
- Precision
- Recall / Sensitivity
- Specificity
- F1-score
- ROC-AUC
- Confusion Matrix
Generates reports/metrics.json, reports/confusion_matrix.png, reports/roc_curve.png.
Includes strict clinical non-diagnostic disclaimer.
"""

import os
import sys
import json
import joblib
import argparse
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    roc_curve,
    confusion_matrix
)

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


def evaluate_model(test_csv="dataset/features_test.csv",
                   model_path="models/trained_model.joblib",
                   scaler_path="models/scaler.joblib",
                   reports_dir="reports"):
    os.makedirs(reports_dir, exist_ok=True)

    print("\n=======================================================")
    print(" REMICARE AI - MODEL EVALUATION PROCEDURE")
    print(f" Test Dataset: {test_csv}")
    print(f" Model Path:   {model_path}")
    print(f" Reports Dir:  {reports_dir}")
    print("=======================================================\n")

    if not os.path.exists(test_csv):
        raise FileNotFoundError(f"Test CSV not found: {test_csv}")
    if not os.path.exists(model_path) or not os.path.exists(scaler_path):
        raise FileNotFoundError(f"Model or Scaler artifact missing in models/")

    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)

    test_df = pd.read_csv(test_csv)
    X_test = test_df[FEATURE_ORDER].values
    y_test = test_df["label"].values.astype(int)

    # Transform
    X_test_scaled = scaler.transform(X_test)

    # Predict
    preds = model.predict(X_test_scaled)
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X_test_scaled)[:, 1]
    else:
        probs = preds.astype(float)

    # 1. Compute Metrics
    acc = accuracy_score(y_test, preds)
    prec = precision_score(y_test, preds, zero_division=0)
    rec = recall_score(y_test, preds, zero_division=0) # Sensitivity
    f1 = f1_score(y_test, preds, zero_division=0)
    
    # Specificity = TN / (TN + FP)
    cm = confusion_matrix(y_test, preds)
    tn, fp, fn, tp = cm.ravel() if cm.shape == (2, 2) else (cm[0, 0], 0, 0, 0)
    spec = tn / max(1, (tn + fp))

    try:
        auc = roc_auc_score(y_test, probs)
    except Exception:
        auc = 0.50

    metrics_payload = {
        "dataset_name": "Test Split",
        "sample_count": len(y_test),
        "class_distribution": {
            "normal_0": int(sum(y_test == 0)),
            "strabismus_1": int(sum(y_test == 1))
        },
        "accuracy": float(round(acc, 4)),
        "precision": float(round(prec, 4)),
        "recall_sensitivity": float(round(rec, 4)),
        "specificity": float(round(spec, 4)),
        "f1_score": float(round(f1, 4)),
        "roc_auc": float(round(auc, 4)),
        "confusion_matrix": {
            "true_negatives": int(tn),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_positives": int(tp)
        },
        "disclaimer": "Model đạt các chỉ số trên tập kiểm tra (test dataset). Đây là kết quả đánh giá kỹ thuật thử nghiệm và không cấu thành tuyên bố chẩn đoán y khoa."
    }

    # 2. Save metrics.json
    metrics_json_path = os.path.join(reports_dir, "metrics.json")
    with open(metrics_json_path, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2, ensure_ascii=False)

    # 3. Plot Confusion Matrix
    cm_plot_path = os.path.join(reports_dir, "confusion_matrix.png")
    fig, ax = plt.subplots(figsize=(6, 5))
    cax = ax.matshow(cm, cmap=plt.cm.Blues, alpha=0.85)
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(x=j, y=i, s=cm[i, j], va='center', ha='center', size='xx-large', weight='bold')
    
    fig.colorbar(cax)
    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(['Normal (0)', 'Strabismus (1)'])
    ax.set_yticklabels(['Normal (0)', 'Strabismus (1)'])
    plt.xlabel('Predicted Label', fontsize=11, fontweight='bold')
    plt.ylabel('True Ground Truth', fontsize=11, fontweight='bold')
    plt.title(f'Confusion Matrix (Test Set N={len(y_test)})', fontsize=12, pad=15)
    plt.tight_layout()
    plt.savefig(cm_plot_path, dpi=200)
    plt.close()

    # 4. Plot ROC Curve
    roc_plot_path = os.path.join(reports_dir, "roc_curve.png")
    fpr, tpr, _ = roc_curve(y_test, probs)
    plt.figure(figsize=(6, 5))
    plt.plot(fpr, tpr, color='#0891b2', lw=2.5, label=f'ROC Curve (AUC = {auc:.3f})')
    plt.plot([0, 1], [0, 1], color='#94a3b8', lw=1.5, linestyle='--', label='Random Chance')
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('False Positive Rate (1 - Specificity)', fontsize=10)
    plt.ylabel('True Positive Rate (Sensitivity)', fontsize=10)
    plt.title('Receiver Operating Characteristic (ROC)', fontsize=12)
    plt.legend(loc="lower right")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(roc_plot_path, dpi=200)
    plt.close()

    # Output formatted report
    print("------------------ EVALUATION REPORT ------------------")
    print(f"Test Samples:       {len(y_test)}")
    print(f"Accuracy:           {acc * 100:.2f}%  (Model đạt {acc:.4f} trên test dataset)")
    print(f"Precision:          {prec * 100:.2f}%")
    print(f"Recall/Sensitivity: {rec * 100:.2f}%")
    print(f"Specificity:        {spec * 100:.2f}%")
    print(f"F1-Score:           {f1 * 100:.2f}%")
    print(f"ROC-AUC:            {auc:.4f}")
    print(f"Confusion Matrix:   TN={tn}, FP={fp}, FN={fn}, TP={tp}")
    print("-------------------------------------------------------")
    print(f"[+] Metrics saved to:          {metrics_json_path}")
    print(f"[+] Confusion matrix saved to: {cm_plot_path}")
    print(f"[+] ROC curve saved to:        {roc_plot_path}")
    print(f"\n[!] Clinical Statement: {metrics_payload['disclaimer']}\n")

    return metrics_payload


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Evaluate Strabismus Model")
    parser.add_argument("--test_csv", type=str, default="dataset/features_test.csv", help="Path to test features CSV")
    parser.add_argument("--model_path", type=str, default="models/trained_model.joblib", help="Path to trained model")
    parser.add_argument("--scaler_path", type=str, default="models/scaler.joblib", help="Path to scaler")
    parser.add_argument("--reports_dir", type=str, default="reports", help="Directory to save evaluation reports")
    args = parser.parse_args()

    evaluate_model(args.test_csv, args.model_path, args.scaler_path, args.reports_dir)
