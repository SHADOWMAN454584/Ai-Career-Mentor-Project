import json
import logging
from dataclasses import dataclass
from .config import settings

logger = logging.getLogger(__name__)


@dataclass
class GeneratedInterview:
    questions: list[dict]
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
    if not settings.openai_api_key:
        raise RuntimeError("OpenAI-compatible API key is not configured")
    from openai import OpenAI
    client = OpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url, timeout=25, max_retries=1)
    completion = client.chat.completions.create(
        model=settings.openai_model,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return _parse(completion.choices[0].message.content or "", "openai-compatible")


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

