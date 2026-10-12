"""Reproducible placement-model comparison and serialization entry point.

Usage: python ml_models/train_placement_model.py [path/to/placement.csv]
If no CSV is provided, a stratified campus dataset is synthesized.
Saves:
  - ml_models/placement_model.joblib (Trained pipeline with ColumnTransformer + Classifier)
  - ml_models/placement_metrics.json (Evaluation metrics for model comparison)
"""
import json
import sys
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

FEATURES = ["cgpa", "skill_count", "internship_count", "project_count", "certification_count", "branch"]


def score(model, x_test, y_test):
    prediction = model.predict(x_test)
    probability = model.predict_proba(x_test)[:, 1]
    return {
        "accuracy": round(float(accuracy_score(y_test, prediction)), 3),
        "precision": round(float(precision_score(y_test, prediction, zero_division=0)), 3),
        "recall": round(float(recall_score(y_test, prediction, zero_division=0)), 3),
        "f1": round(float(f1_score(y_test, prediction, zero_division=0)), 3),
        "roc_auc": round(float(roc_auc_score(y_test, probability)), 3),
    }


def generate_synthetic_dataset(n: int = 600, random_state: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(random_state)
    branches = ["Computer Science", "Information Technology", "Electronics", "Mechanical", "Civil"]
    branch = rng.choice(branches, size=n, p=[0.35, 0.25, 0.20, 0.10, 0.10])
    cgpa = np.clip(rng.normal(loc=7.4, scale=1.1, size=n), 5.0, 10.0)
    skill_count = np.clip(rng.poisson(lam=5, size=n), 1, 15)
    internship_count = rng.binomial(n=3, p=0.4, size=n)
    project_count = np.clip(rng.poisson(lam=3, size=n), 0, 10)
    certification_count = rng.binomial(n=4, p=0.3, size=n)

    # Log-odds of placement
    branch_bonus = np.array([0.5 if b in ["Computer Science", "Information Technology"] else (0.2 if b == "Electronics" else 0.0) for b in branch])
    logits = -3.5 + 0.65 * (cgpa - 6.0) + 0.30 * skill_count + 0.55 * internship_count + 0.40 * project_count + 0.25 * certification_count + branch_bonus
    probs = 1 / (1 + np.exp(-logits))
    placed = (rng.uniform(size=n) < probs).astype(int)

    return pd.DataFrame({
        "cgpa": np.round(cgpa, 2),
        "skill_count": skill_count,
        "internship_count": internship_count,
        "project_count": project_count,
        "certification_count": certification_count,
        "branch": branch,
        "placed": placed,
    })


def main(csv_path: str | None = None):
    output_dir = Path(__file__).parent
    output_dir.mkdir(parents=True, exist_ok=True)

    if csv_path and Path(csv_path).exists():
        print(f"Loading dataset from {csv_path}...")
        frame = pd.read_csv(csv_path).dropna(subset=["placed"])
    else:
        print("No CSV provided or file not found. Generating realistic campus placement dataset...")
        frame = generate_synthetic_dataset()

    missing = set(FEATURES + ["placed"]) - set(frame.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {sorted(missing)}")

    x_train, x_test, y_train, y_test = train_test_split(
        frame[FEATURES], frame["placed"], test_size=0.2, random_state=42, stratify=frame["placed"]
    )

    numeric = ["cgpa", "skill_count", "internship_count", "project_count", "certification_count"]
    categorical = ["branch"]

    preprocessing = ColumnTransformer([
        ("number", Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]), numeric),
        ("category", Pipeline([
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("encode", OneHotEncoder(handle_unknown="ignore")),
        ]), categorical),
    ])

    candidates = {
        "logistic_regression": LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42),
        "random_forest": RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42),
    }

    outcomes = {}
    best_name = None
    best_model = None

    for name, classifier in candidates.items():
        pipeline = Pipeline([
            ("features", preprocessing),
            ("classifier", classifier),
        ])
        pipeline.fit(x_train, y_train)
        eval_scores = score(pipeline, x_test, y_test)
        outcomes[name] = eval_scores
        if best_name is None or eval_scores["roc_auc"] > outcomes[best_name]["roc_auc"]:
            best_name = name
            best_model = pipeline

    model_payload = {
        "pipeline": best_model,
        "features": FEATURES,
        "numeric_features": numeric,
        "categorical_features": categorical,
        "best_model_name": best_name,
    }

    model_file = output_dir / "placement_model.joblib"
    metrics_file = output_dir / "placement_metrics.json"

    joblib.dump(model_payload, model_file)
    metrics_file.write_text(json.dumps({"best_model": best_name, "metrics": outcomes}, indent=2))

    print(f"Serialized trained model to: {model_file}")
    print(f"Metrics saved to: {metrics_file}")
    print(json.dumps(outcomes, indent=2))


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else None
    main(path)
