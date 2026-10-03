import logging
import shutil
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session
from .catalog import ROLES
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .llm import generate_interview
from .models import AnalysisJob, AnalysisResult, CandidateProfile, InterviewSession, Resume, User
from .schemas import AnalysisRequest, AnswerRequest, JobStatusResponse, LoginRequest, RoadmapTaskUpdate, TokenResponse
from .security import create_token, current_user, hash_password
from .services import answer_similarity, detect_gaps, role_scores, run_analysis

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
app = FastAPI(title="AI Career Mentor API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=[item.strip() for item in settings.cors_origins.split(",")], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    with SessionLocal() as db:
        if not db.scalar(select(User).where(User.email == settings.demo_email)):
            db.add(User(email=settings.demo_email, name="Demo Student", password_hash=hash_password(settings.demo_password)))
            db.commit()


def run_job_in_background(job_id: str) -> None:
    with SessionLocal() as db:
        job = db.get(AnalysisJob, job_id)
        if job and job.status == "queued":
            run_analysis(db, job)


def latest_result(db: Session, user_id: int) -> AnalysisResult:
    result = db.scalar(select(AnalysisResult).where(AnalysisResult.user_id == user_id).order_by(AnalysisResult.created_at.desc()))
    if not result: raise HTTPException(status_code=404, detail="Run a resume analysis first")
    return result


@app.get("/health")
def health(): return {"status": "ok", "service": "ai-career-mentor"}


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower().strip()))
    if not user or user.password_hash != hash_password(payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return TokenResponse(access_token=create_token(user))


@app.get("/auth/demo-credentials")
def demo_credentials(): return {"email": settings.demo_email, "password": settings.demo_password}


@app.post("/resumes/upload")
def upload_resume(file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".pdf", ".docx"}: raise HTTPException(status_code=415, detail="Upload a PDF or DOCX resume")
    content = file.file.read()
    if not content: raise HTTPException(status_code=422, detail="Uploaded file is empty")
    if len(content) > settings.max_upload_mb * 1024 * 1024: raise HTTPException(status_code=413, detail=f"Maximum upload is {settings.max_upload_mb} MB")
    safe_name = f"{uuid4()}{suffix}"
    target = settings.upload_path / safe_name
    target.write_bytes(content)
    resume = Resume(user_id=user.id, filename=file.filename or safe_name, file_path=str(target))
    db.add(resume); db.commit(); db.refresh(resume)
    return {"id": resume.id, "filename": resume.filename, "uploaded_at": resume.uploaded_at}


@app.get("/profiles/me")
def profile_me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    profile = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == user.id).order_by(CandidateProfile.extracted_at.desc()))
    if not profile: raise HTTPException(status_code=404, detail="No profile found. Upload and analyse a resume.")
    return {"skills": profile.skills, "education": profile.education, "experience": profile.experience, "projects": profile.projects, "contacts": profile.contacts, "extracted_at": profile.extracted_at}


@app.post("/analysis/run", status_code=202)
def start_analysis(payload: AnalysisRequest, background_tasks: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if payload.target_role not in ROLES: raise HTTPException(status_code=422, detail="Unknown target role")
    resume = db.scalar(select(Resume).where(Resume.user_id == user.id).order_by(Resume.uploaded_at.desc()))
    if not resume: raise HTTPException(status_code=404, detail="Upload a resume before running analysis")
    existing = db.scalar(select(AnalysisJob).where(AnalysisJob.resume_id == resume.id, AnalysisJob.target_role == payload.target_role, AnalysisJob.status.in_(["queued", "running"])))
    if existing: return {"id": existing.id, "status": existing.status, "reused": True}
    job = AnalysisJob(user_id=user.id, resume_id=resume.id, target_role=payload.target_role, timeline_weeks=payload.timeline_weeks)
    db.add(job); db.commit(); db.refresh(job)
    background_tasks.add_task(run_job_in_background, job.id)
    return {"id": job.id, "status": job.status, "reused": False}


@app.get("/analysis/{job_id}/status")
def analysis_status(job_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    job = db.get(AnalysisJob, job_id)
    if not job or job.user_id != user.id: raise HTTPException(status_code=404, detail="Analysis not found")
    body = JobStatusResponse.model_validate(job, from_attributes=True).model_dump()
    result = db.scalar(select(AnalysisResult).where(AnalysisResult.job_id == job.id))
    if result:
        body["result"] = serialize_result(result)
    return body


def serialize_result(result: AnalysisResult):
    return {"role_scores": result.role_scores, "skill_gaps": result.skill_gaps, "courses": result.courses, "placement_probability": result.placement_probability, "shap_factors": result.shap_factors, "roadmap": result.roadmap, "model_version": result.model_version, "disclaimer": "This is a readiness estimate, not a placement guarantee."}


@app.get("/skill-gaps")
def skill_gaps(role: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    result = latest_result(db, user.id)
    if not role or role == "all": return {"target_role": "latest", "gaps": result.skill_gaps}
    profile = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == user.id).order_by(CandidateProfile.extracted_at.desc()))
    return {"target_role": role, "gaps": detect_gaps(profile.skills, role)}


@app.get("/roles/recommendations")
def roles(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"recommendations": latest_result(db, user.id).role_scores}


@app.get("/courses/recommendations")
def courses(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"recommendations": latest_result(db, user.id).courses}


@app.post("/interviews/session")
def interview_session(role_name: str = "Machine Learning Engineer", user: User = Depends(current_user), db: Session = Depends(get_db)):
    if role_name not in ROLES:
        raise HTTPException(status_code=422, detail="Choose a supported role from the role catalog")
    profile = db.scalar(select(CandidateProfile).where(CandidateProfile.user_id == user.id).order_by(CandidateProfile.extracted_at.desc()))
    if not profile: raise HTTPException(status_code=404, detail="Run analysis first")
    generated = generate_interview(role_name, profile.skills)
    session = InterviewSession(user_id=user.id, role_name=role_name, questions=generated.questions, provider=generated.provider)
    db.add(session); db.commit(); db.refresh(session)
    public_questions = [{key: value for key, value in question.items() if key != "model_answer"} for question in session.questions]
    return {"id": session.id, "role_name": session.role_name, "questions": public_questions, "provider": session.provider, "scoring_note": "Answer scores are a lexical similarity heuristic, not a complete assessment."}


@app.post("/interviews/{session_id}/answer")
def submit_answer(session_id: str, payload: AnswerRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = db.get(InterviewSession, session_id)
    if not session or session.user_id != user.id: raise HTTPException(status_code=404, detail="Interview session not found")
    if payload.question_index >= len(session.questions): raise HTTPException(status_code=422, detail="Question index is out of range")
    question = session.questions[payload.question_index]
    score = answer_similarity(payload.answer, question["model_answer"])
    answers = list(session.answers or [])
    answers = [item for item in answers if item["question_index"] != payload.question_index]
    answers.append({"question_index": payload.question_index, "answer": payload.answer, "score": score})
    session.answers = answers; db.commit()
    return {"score": score, "note": "Similarity is a rough proxy; review clarity and correctness separately."}


@app.get("/roadmap")
def roadmap(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"weeks": latest_result(db, user.id).roadmap}


@app.patch("/roadmap/tasks/{task_id}")
def update_task(task_id: str, payload: RoadmapTaskUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    results = db.scalars(select(AnalysisResult).where(AnalysisResult.user_id == user.id)).all()
    for result in results:
        roadmap = result.roadmap
        for week in roadmap:
            for task in week["tasks"]:
                if task["task_id"] == task_id:
                    task["completed"] = payload.completed
                    result.roadmap = roadmap; db.commit()
                    return {"task_id": task_id, "completed": payload.completed}
    raise HTTPException(status_code=404, detail="Roadmap task not found")


@app.get("/dashboard/progress")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    result = latest_result(db, user.id)
    task_list = [task for week in result.roadmap for task in week["tasks"]]
    complete = sum(1 for task in task_list if task["completed"])
    return {"placement_probability": result.placement_probability, "role_scores": result.role_scores, "skill_radar": [{"skill": item["skill"], "value": round((1 - item["similarity"]) * 100, 1)} for item in result.skill_gaps], "roadmap_completion": round(100 * complete / max(1, len(task_list)), 1), "history": [{"date": result.created_at.date().isoformat(), "placement_probability": result.placement_probability}]}
