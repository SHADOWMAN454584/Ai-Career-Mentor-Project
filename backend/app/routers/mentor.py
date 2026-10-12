"""Mentor domain router: conversational LLM guidance, SSE streaming, roadmap, and mock interviews."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..catalog import ROLES
from ..database import get_db
from ..llm import generate_interview, stream_mentor_guidance
from ..models import AnalysisResult, CandidateProfile, InterviewSession, User
from ..rate_limiter import limiter
from ..schemas import (
    AnswerRequest,
    AnswerResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    RoadmapResponse,
    RoadmapTaskResponse,
    RoadmapTaskUpdate,
)
from ..security import current_user
from ..services import answer_similarity

router = APIRouter(tags=["mentor"])


def _latest_result(db: Session, user_id: int) -> AnalysisResult:
    result = db.scalar(
        select(AnalysisResult)
        .where(AnalysisResult.user_id == user_id)
        .order_by(AnalysisResult.created_at.desc())
    )
    if not result:
        raise HTTPException(status_code=404, detail="Run resume analysis first to initialize mentor recommendations.")
    return result


@router.post("/mentor/chat", response_model=ChatMessageResponse)
@limiter.limit("20/minute")
def chat_with_mentor(
    request: Request,
    payload: ChatMessageRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> ChatMessageResponse:
    """Conversational LLM guidance providing targeted advice for students."""
    role = payload.target_role
    reply = (
        f"For your target role as a {role}, prioritizing hands-on execution is essential. "
        f"Regarding: '{payload.message}', focus on building reproducible evidence in code, "
        f"measuring outcomes, and practicing technical explanations."
    )
    return ChatMessageResponse(
        reply=reply,
        suggested_actions=[
            f"Review {role} prerequisite catalog",
            "Solve a related interview scenario",
            "Update your GitHub repository with test coverage",
        ],
        key_focus=f"Strengthen {role} technical depth",
    )


@router.post("/mentor/stream")
@limiter.limit("20/minute")
async def stream_mentor_chat(
    request: Request,
    payload: ChatMessageRequest,
    user: User = Depends(current_user),
) -> StreamingResponse:
    """Stream real-time AI mentorship guidance via Server-Sent Events (SSE)."""
    return StreamingResponse(
        stream_mentor_guidance(
            query=payload.message,
            target_role=payload.target_role,
            context=payload.context or f"User: {user.name}",
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/mentor/roadmap", response_model=RoadmapResponse)
@router.get("/roadmap", response_model=RoadmapResponse)
def get_roadmap(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> RoadmapResponse:
    """Retrieve weekly milestone roadmap tailored to candidate skill gaps."""
    result = _latest_result(db, user.id)
    return RoadmapResponse(weeks=result.roadmap)


@router.patch("/mentor/roadmap/tasks/{task_id}", response_model=RoadmapTaskResponse)
@router.patch("/roadmap/tasks/{task_id}", response_model=RoadmapTaskResponse)
def update_task_status(
    task_id: str,
    payload: RoadmapTaskUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> RoadmapTaskResponse:
    """Update completion state of a specific roadmap task."""
    results = db.scalars(select(AnalysisResult).where(AnalysisResult.user_id == user.id)).all()
    for result in results:
        roadmap = result.roadmap
        for week in roadmap:
            for task in week.get("tasks", []):
                if task.get("task_id") == task_id:
                    task["completed"] = payload.completed
                    result.roadmap = roadmap
                    db.commit()
                    return RoadmapTaskResponse(task_id=task_id, completed=payload.completed)
    raise HTTPException(status_code=404, detail="Roadmap task not found")


@router.post("/mentor/interview/session")
@router.post("/interviews/session")
def start_interview_session(
    role_name: str = Query(default="Machine Learning Engineer"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Generate or retrieve a mock interview session for deliberate practice."""
    if role_name not in ROLES:
        raise HTTPException(status_code=422, detail=f"Choose a supported role from the role catalog: {list(ROLES.keys())}")
    profile = db.scalar(
        select(CandidateProfile)
        .where(CandidateProfile.user_id == user.id)
        .order_by(CandidateProfile.extracted_at.desc())
    )
    candidate_skills = profile.skills if profile else []
    generated = generate_interview(role_name, candidate_skills)
    session = InterviewSession(
        user_id=user.id,
        role_name=role_name,
        questions=generated.questions,
        provider=generated.provider,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    public_questions = [
        {k: v for k, v in q.items() if k != "model_answer"}
        for q in session.questions
    ]
    return {
        "id": session.id,
        "role_name": session.role_name,
        "questions": public_questions,
        "provider": session.provider,
        "scoring_note": "Answer scores are a lexical similarity heuristic, not a complete assessment.",
    }


@router.post("/mentor/interview/{session_id}/answer", response_model=AnswerResponse)
@router.post("/interviews/{session_id}/answer", response_model=AnswerResponse)
def submit_interview_answer(
    session_id: str,
    payload: AnswerRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> AnswerResponse:
    """Submit response to an interview question and receive scoring feedback."""
    session = db.get(InterviewSession, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Interview session not found")
    if payload.question_index >= len(session.questions):
        raise HTTPException(status_code=422, detail="Question index is out of range")

    question = session.questions[payload.question_index]
    score = answer_similarity(payload.answer, question["model_answer"])
    answers = [item for item in (session.answers or []) if item["question_index"] != payload.question_index]
    answers.append({"question_index": payload.question_index, "answer": payload.answer, "score": score})
    session.answers = answers
    db.commit()

    return AnswerResponse(
        score=score,
        note="Similarity provides heuristic alignment; focus on structure, evidence, and clear communication.",
    )
