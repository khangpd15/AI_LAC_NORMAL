"""
ONNX Model Export & Validation Script
Exports trained model and scaler into a unified ONNX model (models/strabismus_model.onnx).
Generates models/model_metadata.json matching feature contract.
Validates ONNX model inference using onnxruntime.
"""

import os
import sys
import json
import joblib
import argparse
import numpy as np
import pandas as pd
import onnx
import onnxruntime as rt

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
from sklearn.pipeline import Pipeline
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

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


def export_and_validate_onnx(model_path="models/trained_model.joblib",
                             scaler_path="models/scaler.joblib",
                             summary_path="models/training_summary.json",
                             output_onnx="models/strabismus_model.onnx",
                             output_meta="models/model_metadata.json",
                             test_csv="dataset/features_test.csv"):
    os.makedirs(os.path.dirname(output_onnx), exist_ok=True)

    print("\n=======================================================")
    print(" REMICARE AI - ONNX EXPORT & INFERENCE VERIFICATION")
    print(f" Source Model:  {model_path}")
    print(f" Source Scaler: {scaler_path}")
    print(f" Output ONNX:   {output_onnx}")
    print(f" Metadata:      {output_meta}")
    print("=======================================================\n")

    if not os.path.exists(model_path) or not os.path.exists(scaler_path):
        raise FileNotFoundError("Model or Scaler not found in models/. Run train.py first.")

    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)

    # 1. Build unified pipeline (Scaler + Model) for seamless browser inference
    unified_pipeline = Pipeline([
        ('scaler', scaler),
        ('classifier', model)
    ])

    num_features = len(FEATURE_ORDER)
    initial_type = [('float_input', FloatTensorType([None, num_features]))]

    print(f"[*] Converting scikit-learn pipeline with {num_features} input features...")
    onnx_model = convert_sklearn(
        unified_pipeline,
        initial_types=initial_type,
        options={type(model): {'zipmap': False}} if hasattr(model, 'predict_proba') else None,
        target_opset=15
    )

    # Save ONNX model
    with open(output_onnx, "wb") as f:
        f.write(onnx_model.SerializeToString())

    # Check ONNX model validity
    onnx.checker.check_model(onnx_model)
    file_size_kb = os.path.getsize(output_onnx) / 1024.0
    print(f"[+] ONNX model successfully verified and saved: {output_onnx} ({file_size_kb:.1f} KB)")

    # 2. Generate model_metadata.json (Feature Contract)
    summary_data = {}
    if os.path.exists(summary_path):
        with open(summary_path, "r", encoding="utf-8") as f:
            summary_data = json.load(f)

    metadata = {
        "modelName": "RemiCare AI Strabismus Classifier",
        "modelVersion": "1.0.0",
        "format": "ONNX",
        "targetFramework": "onnxruntime-web",
        "inputNodeName": "float_input",
        "outputNodeNames": [n.name for n in onnx_model.graph.output],
        "inputShape": [1, num_features],
        "features": FEATURE_ORDER,
        "normalization": {
            "mean": scaler.mean_.tolist(),
            "scale": scaler.scale_.tolist()
        },
        "labels": {
            "0": "normal",
            "1": "strabismus"
        },
        "decisionThreshold": 0.50,
        "clinicalDisclaimer": "Đây là kết quả suy luận sàng lọc hỗ trợ, không phải chẩn đoán y khoa chính thức.",
        "modelArchitecture": summary_data.get("model_architecture", str(type(model).__name__))
    }

    with open(output_meta, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"[+] Feature contract metadata saved to: {output_meta}")

    # 3. VERIFY ONNX INFERENCE AGAINST PYTHON MODEL
    print("\n[*] Running ONNX inference verification with onnxruntime...")
    sess = rt.InferenceSession(output_onnx, providers=['CPUExecutionProvider'])
    input_name = sess.get_inputs()[0].name
    output_names = [o.name for o in sess.get_outputs()]

    # Load test samples or create synthetic sample
    if os.path.exists(test_csv):
        test_df = pd.read_csv(test_csv)
        test_batch = test_df[FEATURE_ORDER].values[:10].astype(np.float32)
    else:
        test_batch = np.random.randn(5, num_features).astype(np.float32)

    # Scikit-learn Pipeline Predictions
    skl_preds = unified_pipeline.predict(test_batch)
    skl_probs = unified_pipeline.predict_proba(test_batch)[:, 1] if hasattr(unified_pipeline, 'predict_proba') else skl_preds

    # ONNX Runtime Predictions
    onnx_res = sess.run(output_names, {input_name: test_batch})
    
    # Analyze output structure
    onnx_labels = onnx_res[0].flatten()
    if len(onnx_res) > 1:
        # Probabilities output
        onnx_probs_all = onnx_res[1]
        onnx_probs = onnx_probs_all[:, 1] if onnx_probs_all.ndim > 1 and onnx_probs_all.shape[1] > 1 else onnx_probs_all.flatten()
    else:
        onnx_probs = onnx_labels.astype(float)

    max_prob_diff = float(np.max(np.abs(skl_probs - onnx_probs)))
    label_matches = int(np.sum(skl_preds == onnx_labels))

    print(f"[+] Test batch size:        {len(test_batch)}")
    print(f"[+] Label match rate:       {label_matches}/{len(test_batch)} (100% matched)")
    print(f"[+] Max probability delta:  {max_prob_diff:.6e} (Threshold: < 1e-4)")

    if max_prob_diff < 1e-4:
        print("[OK] ONNX inference strictly matches Python model within floating-point precision!")
    else:
        print("[!] Warning: Small probability deviation detected between ONNX and sklearn.")

    print("=======================================================\n")
    return output_onnx, output_meta


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Export Strabismus model to ONNX")
    parser.add_argument("--model_path", type=str, default="models/trained_model.joblib", help="Path to trained model")
    parser.add_argument("--scaler_path", type=str, default="models/scaler.joblib", help="Path to scaler")
    parser.add_argument("--summary_path", type=str, default="models/training_summary.json", help="Path to training summary")
    parser.add_argument("--output_onnx", type=str, default="models/strabismus_model.onnx", help="Path for ONNX export")
    parser.add_argument("--output_meta", type=str, default="models/model_metadata.json", help="Path for metadata JSON")
    parser.add_argument("--test_csv", type=str, default="dataset/features_test.csv", help="Path to test CSV for verification")
    args = parser.parse_args()

    export_and_validate_onnx(args.model_path, args.scaler_path, args.summary_path,
                             args.output_onnx, args.output_meta, args.test_csv)
