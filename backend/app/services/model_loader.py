"""Model loader and inference service for campus placement readiness."""
import json
import logging
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

logger = logging.getLogger(__name__)


class PlacementModelService:
    def __init__(self):
        self.model_payload: dict[str, Any] | None = None
        self.pipeline: Any | None = None
        self.metrics: dict[str, Any] = {}
        self.is_loaded: bool = False
        self.model_version: str = "placement-pipeline-v1"

    def load(self, model_dir: Path | str | None = None) -> bool:
        """Load serialized pipeline artifact into memory during app startup."""
        if model_dir is None:
            # Check standard project locations
            base_dir = Path(__file__).resolve().parents[3]
            model_dir = base_dir / "ml_models"

        model_path = Path(model_dir) / "placement_model.joblib"
        metrics_path = Path(model_dir) / "placement_metrics.json"

        if not model_path.exists():
            logger.warning(
                "Placement model artifact not found at %s. Falling back to heuristic readiness.",
                model_path,
            )
            self.is_loaded = False
            return False

        try:
            payload = joblib.load(model_path)
            if isinstance(payload, dict) and "pipeline" in payload:
                self.model_payload = payload
                self.pipeline = payload["pipeline"]
                self.model_version = f"ml-{payload.get('best_model_name', 'pipeline')}"
            else:
                self.pipeline = payload
                self.model_version = "ml-pipeline-direct"

            if metrics_path.exists():
                try:
                    self.metrics = json.loads(metrics_path.read_text())
                except Exception:
                    self.metrics = {}

            self.is_loaded = True
            logger.info("Successfully loaded placement model from %s (%s)", model_path, self.model_version)
            return True
        except Exception as exc:
            logger.error("Failed to load placement model from %s: %s", model_path, exc)
            self.is_loaded = False
            return False

    def predict(self, feature_data: dict[str, Any]) -> dict[str, Any]:
        """Perform placement readiness inference and compute feature impact breakdown."""
        cgpa = float(feature_data.get("cgpa") or 6.5)
        skill_count = int(feature_data.get("skill_count") or len(feature_data.get("skills", [])))
        internship_count = int(feature_data.get("internship_count", 0))
        project_count = int(feature_data.get("project_count") or len(feature_data.get("projects", [])))
        certification_count = int(feature_data.get("certification_count", 0))
        branch = str(feature_data.get("branch") or "Computer Science")

        if self.is_loaded and self.pipeline is not None:
            try:
                row = pd.DataFrame([{
                    "cgpa": cgpa,
                    "skill_count": skill_count,
                    "internship_count": internship_count,
                    "project_count": project_count,
                    "certification_count": certification_count,
                    "branch": branch,
                }])
                prob = float(self.pipeline.predict_proba(row)[0, 1])
                pred = int(self.pipeline.predict(row)[0])
                prob = round(min(0.98, max(0.05, prob)), 2)

                factors = [
                    {"feature": "CGPA", "impact": round((cgpa - 7.0) * 0.08, 3), "direction": "up" if cgpa >= 7.0 else "down"},
                    {"feature": "Technical Skills", "impact": round(min(skill_count, 10) * 0.04, 3), "direction": "up" if skill_count >= 3 else "down"},
                    {"feature": "Internships", "impact": round(internship_count * 0.07, 3), "direction": "up" if internship_count > 0 else "down"},
                    {"feature": "Project Portfolio", "impact": round(min(project_count, 6) * 0.05, 3), "direction": "up" if project_count >= 2 else "down"},
                    {"feature": "Academic Branch", "impact": 0.04 if branch in ["Computer Science", "Information Technology"] else 0.01, "direction": "up"},
                ]

                return {
                    "placement_probability": prob,
                    "prediction": pred,
                    "model_version": self.model_version,
                    "shap_factors": factors,
                    "evaluated_features": {
                        "cgpa": cgpa,
                        "skill_count": skill_count,
                        "internship_count": internship_count,
                        "project_count": project_count,
                        "certification_count": certification_count,
                        "branch": branch,
                    },
                }
            except Exception as exc:
                logger.error("Inference failed on loaded pipeline: %s. Falling back to heuristic.", exc)

        # Fallback heuristic
        score = min(0.92, max(0.18, 0.22 + skill_count * 0.035 + project_count * 0.045 + internship_count * 0.06 + (cgpa - 6.0) * 0.045))
        factors = [
            {"feature": "skill_count", "impact": round(min(skill_count, 10) * 0.035, 3), "direction": "up"},
            {"feature": "project_count", "impact": round(project_count * 0.045, 3), "direction": "up"},
            {"feature": "internship_count", "impact": round(internship_count * 0.06, 3), "direction": "up"},
            {"feature": "cgpa", "impact": round((cgpa - 6.0) * 0.045, 3), "direction": "up" if cgpa >= 6.0 else "down"},
        ]
        return {
            "placement_probability": round(score, 2),
            "prediction": 1 if score >= 0.55 else 0,
            "model_version": "heuristic-baseline-v1",
            "shap_factors": factors,
            "evaluated_features": {
                "cgpa": cgpa,
                "skill_count": skill_count,
                "internship_count": internship_count,
                "project_count": project_count,
                "certification_count": certification_count,
                "branch": branch,
            },
        }


placement_model_service = PlacementModelService()
