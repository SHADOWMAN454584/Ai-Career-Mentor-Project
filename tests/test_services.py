import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))
from app.services import build_roadmap, detect_gaps, parse_resume, readiness, role_scores


def test_resume_parser_extracts_skills_and_fields():
    profile = parse_resume("Asha | asha@example.com | CGPA: 8.2\nB.Tech graduating 2027\nBuilt Python, SQL and FastAPI projects with 1 year experience.")
    assert "python" in profile["skills"]
    assert profile["education"]["cgpa"] == 8.2
    assert profile["contacts"]["email"] == "asha@example.com"


def test_analysis_outputs_ranked_gaps_and_roadmap():
    skills = ["python", "sql", "pandas"]
    gaps = detect_gaps(skills, "Machine Learning Engineer")
    assert gaps and gaps[0]["importance"] >= gaps[-1]["importance"]
    roadmap = build_roadmap(gaps, 8)
    assert all(week["tasks"] for week in roadmap)
    assert len(role_scores(skills)) == 5


def test_readiness_is_bounded():
    probability, factors = readiness({"skills": [], "projects": [], "experience": {"years": 0}, "education": {"cgpa": 0}})
    assert .18 <= probability <= .92
    assert len(factors) == 4
