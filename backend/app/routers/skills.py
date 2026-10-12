"""Skills domain router: gap auditing, catalog mapping, and course recommendations."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..catalog import ROLES
from ..database import get_db
from ..models import AnalysisResult, CandidateProfile, User
from ..schemas import (
    CourseRecommendationsResponse,
    RoleRecommendationsResponse,
    SkillCatalogResponse,
    SkillGapsResponse,
)
from ..security import current_user
from ..services import detect_gaps
from ..services.skill_analysis import KNOWN_SKILLS

router = APIRouter(tags=["skills"])


def _latest_result(db: Session, user_id: int) -> AnalysisResult:
    result = db.scalar(
        select(AnalysisResult)
        .where(AnalysisResult.user_id == user_id)
        .order_by(AnalysisResult.created_at.desc())
    )
    if not result:
        raise HTTPException(status_code=404, detail="Run a resume analysis first to view skill recommendations.")
    return result


@router.get("/skills/catalog", response_model=SkillCatalogResponse)
def get_catalog() -> SkillCatalogResponse:
    """Return system role catalog and indexed industry skills."""
    return SkillCatalogResponse(roles=sorted(ROLES.keys()), known_skills=sorted(KNOWN_SKILLS))


@router.get("/skills/gaps", response_model=SkillGapsResponse)
@router.get("/skill-gaps", response_model=SkillGapsResponse)
def get_skill_gaps(
    role: str | None = Query(default=None, description="Target role name or 'all'"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> SkillGapsResponse:
    """Audit skill gaps against the latest profile or selected target role."""
    result = _latest_result(db, user.id)
    if not role or role == "all" or role == "latest":
        return SkillGapsResponse(target_role="latest", gaps=result.skill_gaps)

    profile = db.scalar(
        select(CandidateProfile)
        .where(CandidateProfile.user_id == user.id)
        .order_by(CandidateProfile.extracted_at.desc())
    )
    if not profile:
        return SkillGapsResponse(target_role=role, gaps=detect_gaps([], role))
    return SkillGapsResponse(target_role=role, gaps=detect_gaps(profile.skills, role))


@router.get("/skills/roles", response_model=RoleRecommendationsResponse)
@router.get("/roles/recommendations", response_model=RoleRecommendationsResponse)
def get_role_recommendations(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> RoleRecommendationsResponse:
    """Return top role matches based on candidate profile."""
    result = _latest_result(db, user.id)
    return RoleRecommendationsResponse(recommendations=result.role_scores)


@router.get("/skills/courses", response_model=CourseRecommendationsResponse)
@router.get("/courses/recommendations", response_model=CourseRecommendationsResponse)
def get_course_recommendations(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> CourseRecommendationsResponse:
    """Return targeted online course recommendations mapped to audited gaps."""
    result = _latest_result(db, user.id)
    return CourseRecommendationsResponse(recommendations=result.courses)
