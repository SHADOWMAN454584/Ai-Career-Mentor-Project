"""Authenticated resume builder: drafts, factual AI assistance, and PDF export."""
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..llm import generate_resume_content
from ..models import ResumeDraft, User
from ..schemas import ResumeDraftResponse, ResumeDraftSaveRequest, ResumeGenerationRequest, ResumeGenerationResponse
from ..security import current_user
from ..services.resume_builder import build_resume_pdf

router = APIRouter(prefix="/resume-builder", tags=["resume-builder"])


def _response(draft: ResumeDraft) -> ResumeDraftResponse:
    return ResumeDraftResponse(id=draft.id, title=draft.title, template=draft.template, content=draft.content, created_at=draft.created_at, updated_at=draft.updated_at)


@router.get("/draft", response_model=ResumeDraftResponse)
def get_draft(user: User = Depends(current_user), db: Session = Depends(get_db)) -> ResumeDraftResponse:
    draft = db.scalar(select(ResumeDraft).where(ResumeDraft.user_id == user.id))
    if not draft:
        raise HTTPException(status_code=404, detail="No resume draft found.")
    return _response(draft)


@router.put("/draft", response_model=ResumeDraftResponse)
def save_draft(payload: ResumeDraftSaveRequest, user: User = Depends(current_user), db: Session = Depends(get_db)) -> ResumeDraftResponse:
    draft = db.scalar(select(ResumeDraft).where(ResumeDraft.user_id == user.id))
    data = payload.content.model_dump()
    if draft:
        draft.title, draft.template, draft.content, draft.updated_at = payload.title, payload.template, data, datetime.utcnow()
    else:
        draft = ResumeDraft(user_id=user.id, title=payload.title, template=payload.template, content=data)
        db.add(draft)
    db.commit()
    db.refresh(draft)
    return _response(draft)


@router.post("/generate", response_model=ResumeGenerationResponse)
def generate_section(payload: ResumeGenerationRequest, user: User = Depends(current_user)) -> ResumeGenerationResponse:
    generated = generate_resume_content(payload.section, payload.content, payload.target_role, payload.job_description)
    return ResumeGenerationResponse(section=payload.section, content=generated.content, provider=generated.provider, demo=generated.demo)


@router.post("/pdf")
def export_pdf(payload: ResumeDraftSaveRequest, user: User = Depends(current_user)) -> StreamingResponse:
    pdf = build_resume_pdf(payload.content.model_dump(), payload.template)
    filename = f"{payload.content.personal.full_name or 'resume'}-resume.pdf".replace(" ", "-")
    return StreamingResponse(BytesIO(pdf), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})