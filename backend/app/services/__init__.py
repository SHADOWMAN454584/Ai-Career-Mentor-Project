import re
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..catalog import ROLES
from ..llm import reason_about_profile
from ..models import AnalysisJob, AnalysisResult, CandidateProfile, Resume
from .skill_analysis import (
    build_roadmap,
    detect_gaps,
    normalize_skill,
    readiness,
    recommend_courses,
    role_scores,
    similarity,
)

__all__ = [
    "answer_similarity",
    "build_roadmap",
    "detect_gaps",
    "normalize_skill",
    "parse_resume",
    "readiness",
    "recommend_courses",
    "role_scores",
    "run_analysis",
    "similarity",
]


def extract_text(path: str) -> str:
    source = Path(path)
    try:
        if source.suffix.lower() == ".pdf":
            import fitz
            with fitz.open(source) as pdf:
                return "\n".join(page.get_text() for page in pdf)
        if source.suffix.lower() == ".docx":
            from docx import Document
            return "\n".join(paragraph.text for paragraph in Document(source).paragraphs)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not read resume: {exc}") from exc
    raise HTTPException(status_code=415, detail="Only PDF and DOCX resumes are supported")


def parse_resume(raw_text: str) -> dict[str, Any]:
    text = re.sub(r"[\t ]+", " ", raw_text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    lower = text.lower()
    from .skill_analysis import KNOWN_SKILLS

    skills = sorted({normalize_skill(skill) for skill in KNOWN_SKILLS if re.search(rf"(?<!\w){re.escape(skill)}(?!\w)", lower)})
    email = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    phone = re.search(r"(?:\+?\d{1,3}[-. ]?)?(?:\(?\d{3}\)?[-. ]?){2}\d{4}", text)
    cgpa = re.search(r"(?:cgpa|gpa)\s*[:=-]?\s*(\d(?:\.\d{1,2})?)", lower)
    year = re.search(r"(?:graduat(?:ion|ing)|batch)\s*(?:year)?\s*[:=-]?\s*(20\d{2})", lower)
    experience_years = re.search(r"(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:of\s+)?experience", lower)
    projects = re.findall(r"(?:project|built|developed)\s*[:\-]?\s*([^\n.]{4,100})", text, flags=re.I)
    degree_match = re.search(r"\b(B\.?Tech|M\.?Tech|BCA|MCA|B\.?Sc|M\.?Sc|Bachelor[^\n,]*|Master[^\n,]*)", text, flags=re.I)
    return {
        "skills": skills,
        "education": {"degree": degree_match.group(0) if degree_match else None, "graduation_year": year.group(1) if year else None, "cgpa": float(cgpa.group(1)) if cgpa else None},
        "experience": {"years": float(experience_years.group(1)) if experience_years else 0.0},
        "projects": projects[:8],
        "contacts": {"email": email.group(0) if email else None, "phone": phone.group(0) if phone else None},
    }


def save_profile(db: Session, resume: Resume, parsed: dict[str, Any]) -> CandidateProfile:
    profile = db.scalar(select(CandidateProfile).where(CandidateProfile.resume_id == resume.id))
    if not profile:
        profile = CandidateProfile(user_id=resume.user_id, resume_id=resume.id)
        db.add(profile)
    profile.skills = parsed["skills"]
    profile.education = parsed["education"]
    profile.experience = parsed["experience"]
    profile.projects = parsed["projects"]
    profile.contacts = parsed["contacts"]
    profile.extracted_at = datetime.utcnow()
    return profile


def run_analysis(db: Session, job: AnalysisJob) -> AnalysisResult:
    job.status, job.started_at = "running", datetime.utcnow()
    db.commit()
    resume = db.get(Resume, job.resume_id)
    try:
        resume.raw_text = extract_text(resume.file_path)
        parsed = parse_resume(resume.raw_text)
        save_profile(db, resume, parsed)
        reasoning = reason_about_profile(parsed, job.target_role, ROLES[job.target_role], job.timeline_weeks)
        if reasoning:
            gaps = reasoning.skill_gaps
            probability, factors, roadmap = reasoning.placement_probability, reasoning.shap_factors, reasoning.roadmap
            model_version = f"llm-{reasoning.provider}"
            for week in roadmap:
                for task in week["tasks"]:
                    task["task_id"] = str(uuid4())
        else:
            gaps = detect_gaps(parsed["skills"], job.target_role)
            probability, factors = readiness(parsed)
            roadmap = build_roadmap(gaps, job.timeline_weeks)
            model_version = "demo-readiness-v1"
        result = AnalysisResult(job_id=job.id, user_id=job.user_id, role_scores=role_scores(parsed["skills"]), skill_gaps=gaps, courses=recommend_courses(gaps), placement_probability=probability, shap_factors=factors, roadmap=roadmap, model_version=model_version)
        db.add(result)
        job.status, job.completed_at = "completed", datetime.utcnow()
        db.commit()
        db.refresh(result)
        return result
    except Exception as exc:
        job.status, job.error, job.completed_at = "failed", str(exc), datetime.utcnow()
        db.commit()
        raise


def answer_similarity(answer: str, model_answer: str) -> float:
    answer_words = set(re.findall(r"\w+", answer.lower()))
    model_words = set(re.findall(r"\w+", model_answer.lower()))
    return round(100 * len(answer_words & model_words) / max(1, len(answer_words | model_words)), 1)
