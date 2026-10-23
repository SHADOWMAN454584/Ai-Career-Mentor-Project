"""Tests for resume-grounded mentor context and safer resume suggestions."""
import json
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

backend_path = Path(__file__).resolve().parents[1] / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app import llm
from app.database import Base
from app.models import AnalysisJob, AnalysisResult, CandidateProfile, Resume, ResumeDraft, User
from app.services import parse_resume
from app.services.mentor_context import build_mentor_context


@pytest.fixture
def db_session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        user = User(email="test@example.com", name="Test Student", password_hash="hash")
        session.add(user)
        session.commit()
        session.refresh(user)

        resume = Resume(
            user_id=user.id,
            filename="resume.pdf",
            file_path="uploads/resume.pdf",
            raw_text=(
                "Test Student\nemail: test@example.com | phone: +1 555 0100 | https://github.com/test\n"
                "SKILLS\nPython, SQL, Docker\n"
                "PROJECTS\nMindStep AI using Llama 3.1 for wellness support\n"
            ),
        )
        session.add(resume)
        session.commit()
        session.refresh(resume)

        profile = CandidateProfile(
            user_id=user.id,
            resume_id=resume.id,
            skills=["python", "sql", "docker"],
            education={"degree": "B.Tech Computer Science", "graduation_year": "2025", "cgpa": 8.1},
            experience={"years": 1.0},
            projects=["MindStep AI using Llama 3.1"],
            contacts={"email": "test@example.com", "phone": "+1 555 0100"},
        )
        job = AnalysisJob(
            user_id=user.id,
            resume_id=resume.id,
            target_role="DevOps Engineer",
            timeline_weeks=8,
            status="completed",
        )
        session.add_all([profile, job])
        session.commit()
        session.refresh(job)

        result = AnalysisResult(
            job_id=job.id,
            user_id=user.id,
            role_scores=[{"role_name": "DevOps Engineer", "match_score": 62.5, "contributing_skills": ["docker"]}],
            skill_gaps=[
                {"skill": "linux", "closest_match": "docker", "similarity": 0.3, "importance": 6, "explanation": "Core requirement."},
                {"skill": "kubernetes", "closest_match": "docker", "similarity": 0.4, "importance": 5, "explanation": "Core requirement."},
            ],
            courses=[],
            placement_probability=0.71,
            shap_factors=[{"feature": "skill_count", "impact": 0.1, "direction": "up"}],
            roadmap=[
                {
                    "week_number": 1,
                    "focus_skills": ["linux"],
                    "tasks": [{"task_id": "task-1", "title": "Practise Linux permissions", "completed": False}],
                }
            ],
            model_version="demo-readiness-v1",
        )
        draft = ResumeDraft(
            user_id=user.id,
            title="Draft",
            content={"summary": "Builder summary", "skills": ["python"], "projects": [{"name": "Draft Project"}]},
        )
        session.add_all([result, draft])
        session.commit()

        yield session


def test_mentor_context_includes_resume_profile_and_analysis(db_session):
    user = db_session.query(User).first()
    context = build_mentor_context(db_session, user, "DevOps Engineer")

    assert context.resume_used is True
    assert context.analysis_used is True
    assert "python" in context.text
    assert "linux" in context.text
    assert "Practise Linux permissions" in context.text
    assert "test@example.com" not in context.text
    assert "+1 555 0100" not in context.text
    assert "github.com/test" not in context.text


def test_mentor_context_without_resume_returns_clear_fallback():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        user = User(email="empty@example.com", name="Empty", password_hash="hash")
        session.add(user)
        session.commit()
        context = build_mentor_context(session, user, "Data Analyst")

    assert context.resume_used is False
    assert context.analysis_used is False
    assert "No resume profile" in context.text


def test_parser_keeps_project_decimals_and_filters_generic_skills(monkeypatch):
    monkeypatch.setattr(llm.settings, "gemini_api_key", None)
    profile = parse_resume(
        "Asha\nSKILLS\nPython, SQL, Projects, Internship\n"
        "PROJECTS\nMindStep AI using Llama 3.1 for wellness support\n"
        "Built a dashboard with 12 reports\n"
        "EDUCATION\nB.Tech Computer Science 2025\n"
    )
    joined_projects = " ".join(profile["projects"])
    assert "Llama 3.1" in joined_projects
    assert "12 reports" in joined_projects
    assert "projects" not in profile["skills"]
    assert "internship" not in profile["skills"]


def test_resume_generation_project_keeps_results_separate(monkeypatch):
    monkeypatch.setattr(llm.settings, "gemini_api_key", "configured-for-test")
    monkeypatch.setattr(
        llm,
        "_call_gemini_api",
        lambda prompt, **kwargs: json.dumps(
            {
                "contributions": ["Built a dashboard from 500 cleaned rows"],
                "results": ["Reduced reporting time by 20%"],
            }
        ),
    )
    result = llm.generate_resume_content(
        "project",
        {
            "name": "Metrics Dashboard",
            "description": "Built a dashboard",
            "technologies": ["SQL"],
            "contributions": ["Cleaned 500 rows"],
            "results": ["Reduced reporting time by 20%"],
        },
        "Data Analyst",
    )
    assert result.provider == "gemini"
    assert result.project_results == ["Reduced reporting time by 20%"]
    assert result.content == ["Built a dashboard from 500 cleaned rows"]


def test_resume_skill_cleaning_never_adds_unknown_skills(monkeypatch):
    monkeypatch.setattr(llm.settings, "gemini_api_key", "configured-for-test")
    monkeypatch.setattr(
        llm,
        "_call_gemini_api",
        lambda prompt, **kwargs: json.dumps({"bullets": ["Python", "Kubernetes", "SQL"]}),
    )
    result = llm.generate_resume_content("skills", {"skills": ["Python", "SQL", "Docker"]})
    assert result.provider == "gemini"
    assert result.content == ["Python", "SQL", "Docker"]
    assert "Kubernetes" not in result.content


def test_resume_evidence_warning_flags_invented_numbers(monkeypatch):
    monkeypatch.setattr(llm.settings, "gemini_api_key", "configured-for-test")
    monkeypatch.setattr(
        llm,
        "_call_gemini_api",
        lambda prompt, **kwargs: json.dumps(
            {"contributions": ["Built a dashboard in 2025"], "results": []}
        ),
    )
    result = llm.generate_resume_content(
        "project",
        {"description": "Built a dashboard", "contributions": [], "results": []},
    )
    assert result.provider == "gemini"
    assert any("2025" in warning for warning in result.warnings)


def test_resume_generation_rejects_wrong_section_shape(monkeypatch):
    monkeypatch.setattr(llm.settings, "gemini_api_key", "configured-for-test")
    monkeypatch.setattr(
        llm,
        "_call_gemini_api",
        lambda prompt, **kwargs: json.dumps({"content": ["wrong", "shape"]}),
    )
    result = llm.generate_resume_content(
        "summary",
        {"skills": ["Python"], "summary": "Existing summary"},
    )
    assert result.provider == "deterministic-demo"
    assert result.demo is True


def test_resume_generation_rejects_empty_suggestion(monkeypatch):
    monkeypatch.setattr(llm.settings, "gemini_api_key", "configured-for-test")
    monkeypatch.setattr(llm, "_call_gemini_api", lambda prompt, **kwargs: json.dumps({"content": "   "}))
    result = llm.generate_resume_content(
        "summary",
        {"skills": ["Python"], "summary": "Existing summary"},
    )
    assert result.provider == "deterministic-demo"
    assert result.demo is True


def test_skill_suggestions_fall_back_to_catalog(monkeypatch):
    monkeypatch.setattr(llm.settings, "gemini_api_key", None)
    result = llm.generate_skill_suggestions("DevOps Engineer", ["docker"])
    skills = [item["skill"] for item in result.suggestions]
    assert "linux" in skills
    assert "docker" not in skills
    assert result.demo is True


def test_mentor_fallback_mentions_resume_gaps(monkeypatch):
    monkeypatch.setattr(llm.settings, "gemini_api_key", None)
    context = json.dumps({"latest_analysis": {"top_skill_gaps": [{"skill": "linux"}, {"skill": "kubernetes"}]}})
    reply = llm.generate_mentor_reply("What should I learn?", "DevOps Engineer", context)
    assert reply.provider == "deterministic-demo"
    assert "linux" in reply.reply.lower()
    assert "kubernetes" in reply.reply.lower()
