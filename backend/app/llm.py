import json
import logging
from dataclasses import dataclass
from typing import Any
from .config import settings

logger = logging.getLogger(__name__)


@dataclass
class GeneratedInterview:
    questions: list[dict]
    provider: str


@dataclass
class AnalysisReasoning:
    skill_gaps: list[dict]
    placement_probability: float
    shap_factors: list[dict]
    roadmap: list[dict]
    provider: str


def _demo_questions(role: str, skills: list[str]) -> GeneratedInterview:
    focus = ", ".join(skills[:3]) or "your strongest technical skills"
    return GeneratedInterview([
        {"category": "technical", "question": f"Explain a project where you used {focus} for a {role}-relevant problem.", "model_answer": "Describe the problem, your technical decisions, measurable outcome, and what you would improve."},
        {"category": "scenario", "question": f"How would you break down an unfamiliar {role} task with limited information?", "model_answer": "Clarify success criteria, inspect available data, propose a small experiment, communicate risks, and iterate using evidence."},
        {"category": "behavioral", "question": "Tell me about a time you received critical feedback and changed your approach.", "model_answer": "Use STAR: state the situation, explain your response to feedback, show the action you took, and quantify the result."},
    ], "deterministic-demo")


def _prompt(role: str, skills: list[str]) -> str:
    return f'''Create exactly three interview questions for a junior {role} candidate with skills {skills}. Include one technical, one scenario, and one behavioral question. Return JSON only: {{"questions":[{{"category":"...","question":"...","model_answer":"..."}}]}}. Model answers must be concise coaching examples, not claims of fact.'''


def _analysis_prompt(profile: dict[str, Any], role: str, required_skills: list[str], weeks: int) -> str:
    return f'''You are an evidence-based career mentor. Reason about this candidate for the target role.

Candidate profile:
{json.dumps(profile, ensure_ascii=True)}

Target role: {role}
Required skills: {json.dumps(required_skills)}
Preparation timeline: {weeks} weeks

Return JSON only in this exact shape:
{{"skill_gaps":[{{"skill":"required skill","closest_match":"candidate skill or null","similarity":0.0,"importance":1,"explanation":"specific evidence-based explanation"}}],"placement_probability":0.0,"shap_factors":[{{"feature":"skill or evidence","impact":0.0,"direction":"up or down"}}],"roadmap":[{{"week_number":1,"focus_skills":["skill"],"tasks":[{{"title":"specific practice task"}}]}}]}}

Rules: include only missing or weak skills from the required-skills list in skill_gaps; similarity and placement_probability must be between 0 and 1; use the candidate profile as evidence; do not invent employers, credentials, or experience; use at most {weeks} roadmap weeks; provide practical tasks and no markdown.'''


def _parse(content: str, provider: str) -> GeneratedInterview:
    start, end = content.find("{"), content.rfind("}") + 1
    payload = json.loads(content[start:end])
    questions = payload["questions"]
    if not isinstance(questions, list) or len(questions) < 3:
        raise ValueError("Provider response did not contain three questions")
    for question in questions:
        if not all(isinstance(question.get(key), str) and question[key] for key in ("category", "question", "model_answer")):
            raise ValueError("Provider response does not match interview schema")
    return GeneratedInterview(questions[:3], provider)


def _gemini(prompt: str) -> GeneratedInterview:
    if not settings.gemini_api_key:
        raise RuntimeError("Gemini API key is not configured")
    from google import genai
    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_content(model=settings.gemini_model, contents=prompt)
    return _parse(response.text, "gemini")


def _openai_compatible(prompt: str) -> GeneratedInterview:
    api_key = settings.openai_api_key or settings.api_key
    if not api_key:
        raise RuntimeError("OpenAI-compatible API key is not configured")
    from openai import OpenAI
    client = OpenAI(api_key=api_key, base_url=settings.openai_base_url, timeout=25, max_retries=1)
    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return _parse(completion.choices[0].message.content or "", "openai-compatible")


def _openai_json(prompt: str) -> dict[str, Any]:
    api_key = settings.openai_api_key or settings.api_key
    if not api_key:
        raise RuntimeError("OpenAI-compatible API key is not configured")
    from openai import OpenAI
    client = OpenAI(api_key=api_key, base_url=settings.openai_base_url, timeout=45, max_retries=1)
    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return json.loads(completion.choices[0].message.content or "{}")


def _validate_analysis(payload: dict[str, Any], required_skills: list[str], weeks: int, provider: str) -> AnalysisReasoning:
    required = set(required_skills)
    gaps = payload["skill_gaps"]
    probability = float(payload["placement_probability"])
    factors = payload["shap_factors"]
    roadmap = payload["roadmap"]
    if not isinstance(gaps, list) or not isinstance(factors, list) or not isinstance(roadmap, list):
        raise ValueError("Analysis response contains invalid collections")
    if not 0 <= probability <= 1:
        raise ValueError("Placement probability must be between 0 and 1")
    normalized_gaps = []
    for gap in gaps:
        if gap.get("skill") not in required:
            raise ValueError("Analysis response contains an unknown skill gap")
        similarity = float(gap.get("similarity", 0))
        if not 0 <= similarity <= 1 or not gap.get("explanation"):
            raise ValueError("Analysis response contains an invalid skill gap")
        normalized_gaps.append({
            "skill": gap["skill"],
            "closest_match": gap.get("closest_match"),
            "similarity": round(similarity, 2),
            "importance": int(gap.get("importance", 1)),
            "explanation": gap["explanation"],
        })
    normalized_factors = []
    for factor in factors:
        if factor.get("direction") not in {"up", "down"} or not factor.get("feature"):
            raise ValueError("Analysis response contains an invalid readiness factor")
        normalized_factors.append({
            "feature": factor["feature"],
            "impact": round(float(factor.get("impact", 0)), 3),
            "direction": factor["direction"],
        })
    normalized_roadmap = []
    for week in roadmap:
        week_number = int(week["week_number"])
        tasks = week["tasks"]
        if not 1 <= week_number <= weeks or not isinstance(tasks, list) or not tasks:
            raise ValueError("Analysis response contains an invalid roadmap week")
        normalized_roadmap.append({
            "week_number": week_number,
            "focus_skills": [str(skill) for skill in week.get("focus_skills", [])],
            "tasks": [{"title": str(task["title"]), "completed": False} for task in tasks if task.get("title")],
        })
    if not normalized_roadmap or any(not week["tasks"] for week in normalized_roadmap):
        raise ValueError("Analysis response contains no usable roadmap tasks")
    return AnalysisReasoning(normalized_gaps, round(probability, 2), normalized_factors, normalized_roadmap, provider)


def reason_about_profile(profile: dict[str, Any], role: str, required_skills: list[str], weeks: int) -> AnalysisReasoning | None:
    prompt = _analysis_prompt(profile, role, required_skills, weeks)
    providers = [settings.llm_primary]
    if settings.llm_fallback_enabled:
        providers.append("openai_compatible" if settings.llm_primary == "gemini" else "gemini")
    for provider in providers:
        try:
            if provider == "openai_compatible":
                payload = _openai_json(prompt)
            elif provider == "gemini":
                if not settings.gemini_api_key:
                    raise RuntimeError("Gemini API key is not configured")
                from google import genai
                client = genai.Client(api_key=settings.gemini_api_key)
                response = client.models.generate_content(model=settings.gemini_model, contents=prompt)
                start, end = response.text.find("{"), response.text.rfind("}") + 1
                payload = json.loads(response.text[start:end])
            else:
                raise RuntimeError(f"Unsupported LLM provider: {provider}")
            return _validate_analysis(payload, required_skills, weeks, provider)
        except Exception as exc:
            logger.warning("LLM analysis provider %s unavailable: %s", provider, exc)
    return None


def generate_interview(role: str, skills: list[str]) -> GeneratedInterview:
    prompt = _prompt(role, skills)
    providers = [settings.llm_primary]
    if settings.llm_fallback_enabled:
        providers.append("openai_compatible" if settings.llm_primary == "gemini" else "gemini")
    for provider in providers:
        try:
            if provider == "gemini": return _gemini(prompt)
            if provider == "openai_compatible": return _openai_compatible(prompt)
            raise RuntimeError(f"Unsupported LLM provider: {provider}")
        except Exception as exc:
            logger.warning("LLM provider %s unavailable: %s", provider, exc)
    return _demo_questions(role, skills)

