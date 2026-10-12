"""Explicit Pydantic request and response schemas for Campus2Career."""
from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------
# Authentication Schemas
# ---------------------------------------------------------

class LoginRequest(BaseModel):
    email: str = Field(description="User email address")
    password: str = Field(min_length=4, description="User password")


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------
# Resume & Profile Schemas
# ---------------------------------------------------------

class ResumeUploadResponse(BaseModel):
    id: str
    filename: str
    uploaded_at: datetime


class CandidateProfileResponse(BaseModel):
    skills: list[str] = Field(default_factory=list)
    education: dict[str, Any] = Field(default_factory=dict)
    experience: dict[str, Any] = Field(default_factory=dict)
    projects: list[str] = Field(default_factory=list)
    contacts: dict[str, Any] = Field(default_factory=dict)
    extracted_at: datetime


# ---------------------------------------------------------
# Skills Domain Schemas
# ---------------------------------------------------------

class SkillGapItemSchema(BaseModel):
    skill: str
    closest_match: str | None = None
    similarity: float
    importance: int
    explanation: str


class SkillGapsResponse(BaseModel):
    target_role: str
    gaps: list[SkillGapItemSchema]


class RoleRecommendationItem(BaseModel):
    role_name: str
    match_score: float
    contributing_skills: list[str]


class RoleRecommendationsResponse(BaseModel):
    recommendations: list[RoleRecommendationItem]


class CourseRecommendationItem(BaseModel):
    name: str
    platform: str
    link: str
    relevance_score: float | None = None


class CourseGroupSchema(BaseModel):
    skill_gap: str
    recommendations: list[CourseRecommendationItem]


class CourseRecommendationsResponse(BaseModel):
    recommendations: list[CourseGroupSchema]


class SkillCatalogResponse(BaseModel):
    roles: list[str]
    known_skills: list[str]


# ---------------------------------------------------------
# Placement Domain Schemas
# ---------------------------------------------------------

class PlacementPredictRequest(BaseModel):
    cgpa: float = Field(default=7.5, ge=0.0, le=10.0, description="Cumulative GPA on 10.0 scale")
    skill_count: int = Field(default=5, ge=0, le=50, description="Total identified technical skills")
    internship_count: int = Field(default=1, ge=0, le=10, description="Number of internships completed")
    project_count: int = Field(default=3, ge=0, le=20, description="Number of portfolio projects")
    certification_count: int = Field(default=0, ge=0, le=10, description="Number of professional certifications")
    branch: str = Field(default="Computer Science", description="Academic engineering or science branch")


class ShapFactorSchema(BaseModel):
    feature: str
    impact: float
    direction: Literal["up", "down"]


class PlacementPredictResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    placement_probability: float
    prediction: int
    model_version: str
    shap_factors: list[ShapFactorSchema]
    evaluated_features: dict[str, Any]


class AnalysisRequest(BaseModel):
    target_role: str = Field(default="Machine Learning Engineer")
    timeline_weeks: int = Field(default=12, ge=1, le=52)


class JobStatusResponse(BaseModel):
    id: str
    status: str
    target_role: str
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    result: dict[str, Any] | None = None

    model_config = ConfigDict(from_attributes=True)


class DashboardProgressResponse(BaseModel):
    placement_probability: float
    role_scores: list[dict[str, Any]]
    skill_radar: list[dict[str, Any]]
    roadmap_completion: float
    history: list[dict[str, Any]]
    result: dict[str, Any] | None = None


# ---------------------------------------------------------
# Mentor & Chat Domain Schemas
# ---------------------------------------------------------

class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000, description="Student inquiry for AI mentor")
    target_role: str = Field(default="Software Development Engineer")
    context: str | None = Field(default=None, max_length=1000)


class ChatMessageResponse(BaseModel):
    reply: str
    suggested_actions: list[str] = Field(default_factory=list)
    key_focus: str | None = None


class AnswerRequest(BaseModel):
    question_index: int = Field(ge=0)
    answer: str = Field(min_length=1, max_length=5000)


class AnswerResponse(BaseModel):
    score: float
    note: str


class RoadmapTaskUpdate(BaseModel):
    completed: bool


class RoadmapTaskResponse(BaseModel):
    task_id: str
    completed: bool


class RoadmapResponse(BaseModel):
    weeks: list[dict[str, Any]]
