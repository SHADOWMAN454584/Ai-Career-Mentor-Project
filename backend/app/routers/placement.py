"""Placement domain router: ML readiness prediction, background analysis jobs, and dashboard progress."""
from datetime import datetime
from typing import Any
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..catalog import ROLES
from ..database import SessionLocal, get_db
from ..models import AnalysisJob, AnalysisResult, CandidateProfile, Resume, User
from ..schemas import (
    AnalysisRequest,
    DashboardProgressResponse,
    JobStatusResponse,
    PlacementPredictRequest,
    PlacementPredictResponse,
)
from ..security import current_user
from ..services import run_analysis
from ..services.model_loader import placement_model_service

router = APIRouter(tags=["placement"])


def _serialize_result(result: AnalysisResult) -> dict[str, Any]:
    return {
        "role_scores": result.role_scores,
        "skill_gaps": result.skill_gaps,
        "courses": result.courses,
        "placement_probability": result.placement_probability,
        "shap_factors": result.shap_factors,
        "roadmap": result.roadmap,
        "model_version": result.model_version,
        "disclaimer": "This is a readiness estimate, not a placement guarantee.",
    }


def _run_job_in_background(job_id: str) -> None:
    with SessionLocal() as db:
        job = db.get(AnalysisJob, job_id)
        if job and job.status == "queued":
            run_analysis(db, job)


@router.post("/placement/predict", response_model=PlacementPredictResponse)
def predict_placement_readiness(
    payload: PlacementPredictRequest,
    user: User = Depends(current_user),
) -> PlacementPredictResponse:
    """Predict placement probability using serialized ML model pipeline and return SHAP impact factors."""
    evaluation = placement_model_service.predict(payload.model_dump())
    return PlacementPredictResponse(**evaluation)


@router.get("/placement/readiness")
def get_latest_readiness(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Retrieve placement readiness signal and contributing factors from latest analysis."""
    result = db.scalar(
        select(AnalysisResult)
        .where(AnalysisResult.user_id == user.id)
        .order_by(AnalysisResult.created_at.desc())
    )
    if not result:
        # Evaluate profile if exists
        profile = db.scalar(
            select(CandidateProfile)
            .where(CandidateProfile.user_id == user.id)
            .order_by(CandidateProfile.extracted_at.desc())
        )
        if profile:
            eval_dict = {
                "cgpa": profile.education.get("cgpa", 7.5),
                "skill_count": len(profile.skills),
                "project_count": len(profile.projects),
                "internship_count": 1 if profile.experience.get("years", 0) > 0 else 0,
            }
            return placement_model_service.predict(eval_dict)
        raise HTTPException(status_code=404, detail="Upload a resume to calculate readiness.")

    return {
        "placement_probability": result.placement_probability,
        "shap_factors": result.shap_factors,
        "model_version": result.model_version,
        "role_scores": result.role_scores,
    }


@router.post("/analysis/run", status_code=status.HTTP_202_ACCEPTED)
@router.post("/placement/analysis/run", status_code=status.HTTP_202_ACCEPTED)
def start_analysis_job(
    payload: AnalysisRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Trigger background resume parsing and comprehensive career analysis."""
    if payload.target_role not in ROLES:
        raise HTTPException(status_code=422, detail="Unknown target role. Select from registered catalog.")

    resume = db.scalar(
        select(Resume)
        .where(Resume.user_id == user.id)
        .order_by(Resume.uploaded_at.desc())
    )
    if not resume:
        raise HTTPException(status_code=404, detail="Upload a resume before requesting an analysis.")

    existing = db.scalar(
        select(AnalysisJob).where(
            AnalysisJob.resume_id == resume.id,
            AnalysisJob.target_role == payload.target_role,
            AnalysisJob.status.in_(["queued", "running"]),
        )
    )
    if existing:
        return {"id": existing.id, "status": existing.status, "reused": True}

    job = AnalysisJob(
        user_id=user.id,
        resume_id=resume.id,
        target_role=payload.target_role,
        timeline_weeks=payload.timeline_weeks,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_job_in_background, job.id)
    return {"id": job.id, "status": job.status, "reused": False}


@router.get("/analysis/{job_id}/status", response_model=JobStatusResponse)
@router.get("/placement/analysis/{job_id}/status", response_model=JobStatusResponse)
def get_analysis_status(
    job_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> JobStatusResponse:
    """Poll status of an asynchronous career analysis job."""
    job = db.get(AnalysisJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Analysis job not found.")

    response_data = JobStatusResponse.model_validate(job)
    result = db.scalar(select(AnalysisResult).where(AnalysisResult.job_id == job.id))
    if result:
        response_data.result = _serialize_result(result)
    return response_data


@router.get("/dashboard/progress", response_model=DashboardProgressResponse)
@router.get("/placement/progress", response_model=DashboardProgressResponse)
def get_dashboard_progress(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> DashboardProgressResponse:
    """Retrieve full dashboard progress metrics including radar charts and history."""
    result = db.scalar(
        select(AnalysisResult)
        .where(AnalysisResult.user_id == user.id)
        .order_by(AnalysisResult.created_at.desc())
    )
    if not result:
        raise HTTPException(status_code=404, detail="Run resume analysis first to view dashboard metrics.")

    job = db.get(AnalysisJob, result.job_id)
    task_list = [task for week in result.roadmap for task in week.get("tasks", [])]
    complete = sum(1 for task in task_list if task.get("completed"))

    radar = [
        {"skill": item["skill"], "value": round((1 - item.get("similarity", 0)) * 100, 1)}
        for item in result.skill_gaps
    ]

    return DashboardProgressResponse(
        placement_probability=result.placement_probability,
        role_scores=result.role_scores,
        skill_radar=radar,
        roadmap_completion=round(100 * complete / max(1, len(task_list)), 1),
        history=[{"date": result.created_at.date().isoformat(), "placement_probability": result.placement_probability}],
        result={
            **_serialize_result(result),
            "target_role": job.target_role if job else None,
        },
    )
