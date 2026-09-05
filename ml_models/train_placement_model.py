"""Reproducible placement-model comparison entry point.

Usage: python ml_models/train_placement_model.py path/to/placement.csv
The CSV must include `placed` and the feature columns listed below. Save the resulting
metrics in the project report; do not replace them with demo-application scores.
"""
import json
import sys
from pathlib import Path
import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.model_selection import train_test_split

FEATURES = ["cgpa", "skill_count", "internship_count", "project_count", "certification_count", "branch"]

def score(model, x_test, y_test):
    prediction = model.predict(x_test); probability = model.predict_proba(x_test)[:, 1]
    return {"accuracy": round(accuracy_score(y_test, prediction), 3), "precision": round(precision_score(y_test, prediction, zero_division=0), 3), "recall": round(recall_score(y_test, prediction, zero_division=0), 3), "f1": round(f1_score(y_test, prediction, zero_division=0), 3), "roc_auc": round(roc_auc_score(y_test, probability), 3)}

def main(csv_path: str):
    frame = pd.read_csv(csv_path).dropna(subset=["placed"])
    missing = set(FEATURES + ["placed"]) - set(frame.columns)
    if missing: raise ValueError(f"Dataset is missing columns: {sorted(missing)}")
    x_train, x_test, y_train, y_test = train_test_split(frame[FEATURES], frame["placed"], test_size=.2, random_state=42, stratify=frame["placed"])
    numeric, categorical = FEATURES[:-1], ["branch"]
    preprocessing = ColumnTransformer([("number", Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), numeric), ("category", Pipeline([("impute", SimpleImputer(strategy="most_frequent")), ("encode", OneHotEncoder(handle_unknown="ignore"))]), categorical)])
    candidates = {"logistic_regression": LogisticRegression(max_iter=1000, class_weight="balanced"), "random_forest": RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42)}
    outcomes, best_name, best_model = {}, None, None
    for name, classifier in candidates.items():
        model = Pipeline([("features", preprocessing), ("classifier", classifier)]); model.fit(x_train, y_train); outcomes[name] = score(model, x_test, y_test)
        if best_name is None or outcomes[name]["roc_auc"] > outcomes[best_name]["roc_auc"]: best_name, best_model = name, model
    output = Path(__file__).parent; joblib.dump(best_model, output / "placement_model.joblib"); (output / "placement_metrics.json").write_text(json.dumps({"best_model": best_name, "metrics": outcomes}, indent=2)); print(json.dumps(outcomes, indent=2))

if __name__ == "__main__":
    main(sys.argv[1])

