"""Resumes and profiles domain router."""
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import CandidateProfile, Resume, User
from ..schemas import CandidateProfileResponse, ResumeUploadResponse
from ..security import current_user

router = APIRouter(tags=["resumes"])


@router.post("/resumes/upload", response_model=ResumeUploadResponse)
def upload_resume(
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ResumeUploadResponse:
    """Upload and persist a PDF or DOCX resume document."""
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".pdf", ".docx"}:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Upload a valid PDF or DOCX resume document.",
        )
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Uploaded file is empty.")
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Maximum allowed upload size is {settings.max_upload_mb} MB.",
        )

    safe_name = f"{uuid4()}{suffix}"
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    target = settings.upload_path / safe_name
    target.write_bytes(content)

    resume = Resume(user_id=user.id, filename=file.filename or safe_name, file_path=str(target))
    db.add(resume)
    db.commit()
    db.refresh(resume)

    return ResumeUploadResponse(id=resume.id, filename=resume.filename, uploaded_at=resume.uploaded_at)


@router.get("/profiles/me", response_model=CandidateProfileResponse)
def get_my_profile(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> CandidateProfileResponse:
    """Retrieve structured candidate profile extracted from latest resume."""
    profile = db.scalar(
        select(CandidateProfile)
        .where(CandidateProfile.user_id == user.id)
        .order_by(CandidateProfile.extracted_at.desc())
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No candidate profile found. Please upload and analyze a resume first.",
        )
    return CandidateProfileResponse(
        skills=profile.skills or [],
        education=profile.education or {},
        experience=profile.experience or {},
        projects=profile.projects or [],
        contacts=profile.contacts or {},
        extracted_at=profile.extracted_at,
    )
