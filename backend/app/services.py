import json
import re
from collections import defaultdict
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from .catalog import ALIASES, COURSES, PREREQUISITES, ROLES
from .config import settings
from .models import AnalysisJob, AnalysisResult, CandidateProfile, Resume

KNOWN_SKILLS = sorted({skill for role in ROLES.values() for skill in role} | set(ALIASES) | {"java", "c++", "tensorflow", "numpy", "communication", "projects", "internship"})


def normalize_skill(skill: str) -> str:
    value = re.sub(r"\s+", " ", skill.lower().strip())
    return ALIASES.get(value, value)


def extract_text(path: str) -> str:
    source = Path(path)
    try:
        if source.suffix.lower() == ".pdf":
            import fitz
            with fitz.open(source) as pdf:
                return "\n".join(page.get_text() for page in pdf)
        if source.suffix.lower() == ".docx":
            from docx import Document
            return "\n".join(p.text for p in Document(source).paragraphs)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not read resume: {exc}") from exc
    raise HTTPException(status_code=415, detail="Only PDF and DOCX resumes are supported")


def parse_resume(raw_text: str) -> dict[str, Any]:
    text = re.sub(r"[\t ]+", " ", raw_text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    lower = text.lower()
    skills = sorted({normalize_skill(s) for s in KNOWN_SKILLS if re.search(rf"(?<!\w){re.escape(s)}(?!\w)", lower)})
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


def similarity(a: str, b: str) -> float:
    a, b = normalize_skill(a), normalize_skill(b)
    if a == b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def role_scores(skills: list[str]) -> list[dict[str, Any]]:
    results = []
    for role, required in ROLES.items():
        matches = [max((similarity(req, s) for s in skills), default=0.0) for req in required]
        score = round(100 * sum(matches) / len(required), 1)
        contributors = [required[i] for i, match in enumerate(matches) if match >= 0.72]
        results.append({"role_name": role, "match_score": score, "contributing_skills": contributors})
    return sorted(results, key=lambda item: item["match_score"], reverse=True)[:5]


def detect_gaps(skills: list[str], role: str) -> list[dict[str, Any]]:
    required = ROLES.get(role)
    if not required:
        raise HTTPException(status_code=422, detail=f"Unknown target role. Choose one of: {', '.join(ROLES)}")
    gaps = []
    for index, required_skill in enumerate(required):
        best = max(skills, key=lambda s: similarity(required_skill, s), default=None)
        score = similarity(required_skill, best) if best else 0.0
        if score < 0.72:
            gaps.append({"skill": required_skill, "closest_match": best, "similarity": round(score, 2), "importance": len(required) - index, "explanation": f"{required_skill.title()} is a core requirement for {role}."})
    return sorted(gaps, key=lambda item: (-item["importance"], item["similarity"]))


def recommend_courses(gaps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    output = []
    for gap in gaps:
        candidates = sorted(COURSES, key=lambda course: similarity(gap["skill"], course["skill"]), reverse=True)[:3]
        output.append({"skill_gap": gap["skill"], "recommendations": [{**course, "relevance_score": round(similarity(gap["skill"], course["skill"]) * 100, 1)} for course in candidates]})
    return output


def readiness(profile: dict[str, Any]) -> tuple[float, list[dict[str, Any]]]:
    skill_count = len(profile["skills"])
    projects = len(profile["projects"])
    exp = profile["experience"].get("years", 0)
    cgpa = profile["education"].get("cgpa") or 6.5
    score = min(0.92, max(0.18, 0.22 + skill_count * 0.035 + projects * 0.045 + exp * 0.05 + (cgpa - 6) * 0.045))
    factors = [
        {"feature": "skill_count", "impact": round(min(skill_count, 10) * 0.035, 3), "direction": "up"},
        {"feature": "project_count", "impact": round(projects * 0.045, 3), "direction": "up"},
        {"feature": "experience_years", "impact": round(exp * 0.05, 3), "direction": "up"},
        {"feature": "cgpa", "impact": round((cgpa - 6) * 0.045, 3), "direction": "up" if cgpa >= 6 else "down"},
    ]
    return round(score, 2), factors


def build_roadmap(gaps: list[dict[str, Any]], weeks: int) -> list[dict[str, Any]]:
    missing = {gap["skill"] for gap in gaps}
    ordered, visiting, visited = [], set(), set()
    def visit(skill: str):
        if skill in visited: return
        if skill in visiting: raise ValueError(f"Prerequisite cycle detected at {skill}")
        visiting.add(skill)
        for prerequisite in PREREQUISITES.get(skill, []):
            if prerequisite in missing: visit(prerequisite)
        visiting.remove(skill); visited.add(skill); ordered.append(skill)
    for skill in missing: visit(skill)
    buckets: dict[int, list[str]] = defaultdict(list)
    for index, skill in enumerate(ordered): buckets[min(weeks, index * weeks // max(1, len(ordered)) + 1)].append(skill)
    roadmap = []
    for week in range(1, weeks + 1):
        skills = buckets[week]
        tasks = [{"task_id": str(uuid4()), "title": f"Learn and practise {skill.title()}", "completed": False} for skill in skills]
        if skills: roadmap.append({"week_number": week, "focus_skills": skills, "tasks": tasks})
    return roadmap


def save_profile(db: Session, resume: Resume, parsed: dict[str, Any]) -> CandidateProfile:
    profile = db.scalar(select(CandidateProfile).where(CandidateProfile.resume_id == resume.id))
    if not profile:
        profile = CandidateProfile(user_id=resume.user_id, resume_id=resume.id)
        db.add(profile)
    profile.skills, profile.education, profile.experience = parsed["skills"], parsed["education"], parsed["experience"]
    profile.projects, profile.contacts, profile.extracted_at = parsed["projects"], parsed["contacts"], datetime.utcnow()
    return profile


def run_analysis(db: Session, job: AnalysisJob) -> AnalysisResult:
    job.status, job.started_at = "running", datetime.utcnow(); db.commit()
    resume = db.get(Resume, job.resume_id)
    try:
        resume.raw_text = extract_text(resume.file_path)
        parsed = parse_resume(resume.raw_text)
        save_profile(db, resume, parsed)
        gaps = detect_gaps(parsed["skills"], job.target_role)
        probability, factors = readiness(parsed)
        result = AnalysisResult(job_id=job.id, user_id=job.user_id, role_scores=role_scores(parsed["skills"]), skill_gaps=gaps, courses=recommend_courses(gaps), placement_probability=probability, shap_factors=factors, roadmap=build_roadmap(gaps, job.timeline_weeks))
        db.add(result)
        job.status, job.completed_at = "completed", datetime.utcnow()
        db.commit(); db.refresh(result)
        return result
    except Exception as exc:
        job.status, job.error, job.completed_at = "failed", str(exc), datetime.utcnow(); db.commit()
        raise


def answer_similarity(answer: str, model_answer: str) -> float:
    a, b = set(re.findall(r"\w+", answer.lower())), set(re.findall(r"\w+", model_answer.lower()))
    return round(100 * len(a & b) / max(1, len(a | b)), 1)

