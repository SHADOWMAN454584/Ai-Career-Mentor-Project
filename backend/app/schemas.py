from datetime import datetime
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AnalysisRequest(BaseModel):
    target_role: str = Field(default="Machine Learning Engineer")
    timeline_weeks: int = Field(default=12, ge=1, le=52)


class AnswerRequest(BaseModel):
    question_index: int = Field(ge=0)
    answer: str = Field(min_length=1, max_length=5000)


class RoadmapTaskUpdate(BaseModel):
    completed: bool


class JobStatusResponse(BaseModel):
    id: str
    status: str
    target_role: str
    error: str | None
    started_at: datetime | None
    completed_at: datetime | None
