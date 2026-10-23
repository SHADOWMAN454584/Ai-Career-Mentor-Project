"""Build a compact, resume-grounded context payload for mentor conversations."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AnalysisJob, AnalysisResult, CandidateProfile, Resume, ResumeDraft, User

MAX_CONTEXT_CHARS = 6500
MAX_RESUME_EXCERPT = 2600


@dataclass
class MentorContext:
    text: str
    resume_used: bool = False
    analysis_used: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


def _clean_lines(values: Any, limit: int = 12) -> list[str]:
    if not isinstance(values, list):
        return []
    cleaned: list[str] = []
    for value in values:
        text = " ".join(str(value).split()).strip(" -•\t")
        if text and text not in cleaned:
            cleaned.append(text)
        if len(cleaned) >= limit:
            break
    return cleaned


def _redact(text: str) -> str:
    redacted = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "[email redacted]", text)
    redacted = re.sub(r"https?://\S+", "[url redacted]", redacted)
    redacted = re.sub(r"www\.\S+", "[url redacted]", redacted)
    redacted = re.sub(
        r"(?<![\w])(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3}[\s.-]?\d{3,4}(?:[\s.-]?\d{4})?(?![\w])",
        "[phone redacted]",
        redacted,
    )
    return re.sub(r"[ \t]+", " ", redacted).strip()


def _latest_resume(db: Session, user_id: int) -> Resume | None:
    return db.scalar(
        select(Resume)
        .where(Resume.user_id == user_id)
        .order_by(Resume.uploaded_at.desc())
        .limit(1)
    )


def _profile_for_resume(db: Session, user_id: int, resume: Resume | None) -> CandidateProfile | None:
    if resume:
        profile = db.scalar(
            select(CandidateProfile)
            .where(CandidateProfile.user_id == user_id, CandidateProfile.resume_id == resume.id)
            .order_by(CandidateProfile.extracted_at.desc())
        )
        if profile:
            return profile
    return db.scalar(
        select(CandidateProfile)
        .where(CandidateProfile.user_id == user_id)
        .order_by(CandidateProfile.extracted_at.desc())
        .limit(1)
    )


def _latest_analysis(
    db: Session, user_id: int, target_role: str
) -> tuple[AnalysisResult, AnalysisJob] | None:
    matching = db.execute(
        select(AnalysisResult, AnalysisJob)
        .join(AnalysisJob, AnalysisResult.job_id == AnalysisJob.id)
        .where(AnalysisResult.user_id == user_id, AnalysisJob.target_role == target_role)
        .order_by(AnalysisResult.created_at.desc())
        .limit(1)
    ).first()
    if matching:
        return matching

    fallback = db.execute(
        select(AnalysisResult, AnalysisJob)
        .join(AnalysisJob, AnalysisResult.job_id == AnalysisJob.id)
        .where(AnalysisResult.user_id == user_id)
        .order_by(AnalysisResult.created_at.desc())
        .limit(1)
    ).first()
    return fallback


def _draft_for_user(db: Session, user_id: int) -> ResumeDraft | None:
    return db.scalar(select(ResumeDraft).where(ResumeDraft.user_id == user_id))


def _upcoming_tasks(roadmap: list[dict[str, Any]], limit: int = 6) -> list[dict[str, Any]]:
    tasks: list[dict[str, Any]] = []
    for week in roadmap or []:
        if not isinstance(week, dict):
            continue
        for task in week.get("tasks") or []:
            if not isinstance(task, dict) or task.get("completed"):
                continue
            tasks.append(
                {
                    "week_number": week.get("week_number"),
                    "title": task.get("title"),
                    "focus_skills": week.get("focus_skills", []),
                }
            )
            if len(tasks) >= limit:
                return tasks
    return tasks


def _gap_sort_key(gap: dict[str, Any]) -> tuple[float, float]:
    try:
        importance = float(gap.get("importance") or 0)
    except (TypeError, ValueError, AttributeError):
        importance = 0.0
    try:
        similarity = float(gap.get("similarity") or 0)
    except (TypeError, ValueError, AttributeError):
        similarity = 0.0
    return -importance, similarity


def build_mentor_context(
    db: Session,
    user: User,
    target_role: str,
    *,
    max_chars: int = MAX_CONTEXT_CHARS,
) -> MentorContext:
    """Collect the candidate's resume/profile/analysis facts for prompting.

    Only a redacted resume excerpt is included, contact fields are omitted, and the
    serialized context is capped so the mentor prompt stays bounded.
    """
    resume = _latest_resume(db, user.id)
    profile = _profile_for_resume(db, user.id, resume)
    analysis_row = _latest_analysis(db, user.id, target_role)
    draft = _draft_for_user(db, user.id)

    payload: dict[str, Any] = {
        "candidate_name": user.name,
        "target_role": target_role,
    }
    metadata: dict[str, Any] = {
        "resume_id": resume.id if resume else None,
        "resume_filename": resume.filename if resume else None,
        "profile_available": bool(profile),
        "analysis_available": bool(analysis_row),
    }

    if profile:
        payload["profile"] = {
            "skills": _clean_lines(profile.skills, 40),
            "education": profile.education or {},
            "experience": profile.experience or {},
            "projects": _clean_lines(profile.projects, 8),
        }

    if resume:
        resume_details: dict[str, Any] = {
            "filename": resume.filename,
            "uploaded_at": resume.uploaded_at.isoformat() if resume.uploaded_at else None,
        }
        if resume.raw_text:
            excerpt = _redact(resume.raw_text)
            resume_details["excerpt"] = excerpt[:MAX_RESUME_EXCERPT]
            metadata["resume_excerpt_used"] = True
        payload["resume"] = resume_details

    if draft and isinstance(draft.content, dict) and draft.content:
        draft_content = draft.content
        draft_projects = draft_content.get("projects") or []
        payload["builder_draft"] = {
            "target_role": draft_content.get("target_role"),
            "summary": _redact(str(draft_content.get("summary") or ""))[:2000],
            "skills": _clean_lines(draft_content.get("skills"), 40),
            "projects": _clean_lines(
                [item.get("name") for item in draft_projects if isinstance(item, dict)],
                8,
            ),
        }

    analysis = analysis_row[0] if analysis_row else None
    job = analysis_row[1] if analysis_row else None
    if analysis:
        gaps = sorted(
            [gap for gap in (analysis.skill_gaps or []) if isinstance(gap, dict)],
            key=_gap_sort_key,
        )
        payload["latest_analysis"] = {
            "target_role": job.target_role if job else None,
            "timeline_weeks": job.timeline_weeks if job else None,
            "placement_probability": analysis.placement_probability,
            "top_skill_gaps": [
                {
                    "skill": gap.get("skill"),
                    "importance": gap.get("importance"),
                    "closest_match": gap.get("closest_match"),
                    "explanation": gap.get("explanation"),
                }
                for gap in gaps[:6]
            ],
            "upcoming_tasks": _upcoming_tasks(analysis.roadmap or []),
        }
        metadata["analysis_target_role"] = job.target_role if job else None

    has_facts = bool(
        (profile and (profile.skills or profile.projects or profile.education or profile.experience))
        or (resume and resume.raw_text)
        or (draft and draft.content)
        or analysis
    )

    if not has_facts:
        return MentorContext(
            text="No resume profile or analysis is available for this candidate yet.",
            resume_used=False,
            analysis_used=False,
            metadata=metadata,
        )

    serialized = json.dumps(payload, ensure_ascii=True, separators=(",", ":"), default=str)
    if len(serialized) > max_chars:
        excerpt = payload.get("resume", {}).get("excerpt")
        if excerpt:
            overage = len(serialized) - max_chars
            keep = max(400, len(excerpt) - overage - 100)
            payload["resume"]["excerpt"] = excerpt[:keep]
            serialized = json.dumps(payload, ensure_ascii=True, separators=(",", ":"), default=str)
        if len(serialized) > max_chars:
            serialized = serialized[:max_chars]

    return MentorContext(
        text=serialized,
        resume_used=bool(profile or (resume and resume.raw_text) or (draft and draft.content)),
        analysis_used=bool(analysis),
        metadata=metadata,
    )
