"""Focused tests for the authenticated resume builder workflow."""
import sys
from pathlib import Path

import fitz
import pytest
from httpx import ASGITransport, AsyncClient

backend_path = Path(__file__).resolve().parents[1] / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.main import app
from app import llm
from app.services.resume_builder import build_resume_pdf


@pytest.fixture
def content():
    return {
        "personal": {
            "full_name": "Asha José",
            "email": "asha@example.com",
            "phone": "+1 555 0100",
            "location": "Remote",
            "linkedin_url": "https://linkedin.com/in/asha",
            "github_url": "https://github.com/asha",
            "portfolio_url": "",
        },
        "target_role": "Business Analyst",
        "summary": "Evidence-based analyst.",
        "education": [],
        "skills": ["SQL", "Python"],
        "projects": [{
            "name": "Café Metrics",
            "description": "Built a dashboard",
            "technologies": ["SQL"],
            "contributions": ["Created reports"],
            "results": ["Reduced manual work"],
        }],
        "experience": [],
        "certifications": [],
        "achievements": [],
        "activities": [],
        "job_description": "",
    }


async def _client():
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    login = await client.post("/auth/login", json={"email": "demo@careermentor.local", "password": "demo123"})
    return client, {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.mark.anyio
async def test_resume_builder_save_generate_and_pdf(content, monkeypatch):
    monkeypatch.setattr(llm.settings, "gemini_api_key", None)
    client, headers = await _client()
    save = await client.put("/resume-builder/draft", json={"title": "Asha Resume", "template": "classic", "content": content}, headers=headers)
    assert save.status_code == 200
    assert save.json()["content"]["personal"]["full_name"] == "Asha José"

    loaded = await client.get("/resume-builder/draft", headers=headers)
    assert loaded.status_code == 200
    assert loaded.json()["title"] == "Asha Resume"

    generated = await client.post("/resume-builder/generate", json={"section": "project", "content": content["projects"][0], "target_role": "Business Analyst"}, headers=headers)
    assert generated.status_code == 200
    assert generated.json()["provider"] == "deterministic-demo"
    assert isinstance(generated.json()["content"], list)

    pdf = await client.post("/resume-builder/pdf", json={"title": "Asha Resume", "template": "classic", "content": content}, headers=headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")
    document = fitz.open(stream=pdf.content, filetype="pdf")
    text = "\n".join(page.get_text() for page in document)
    assert "Asha José" in text
    assert "Café Metrics" in text
    assert len(document) >= 1
    await client.aclose()


@pytest.mark.anyio
async def test_resume_builder_rejects_invalid_content():
    client, headers = await _client()
    response = await client.put("/resume-builder/draft", json={"title": "", "template": "classic", "content": {}}, headers=headers)
    assert response.status_code == 422
    await client.aclose()


def test_resume_generation_falls_back_when_provider_fails(monkeypatch):
    monkeypatch.setattr(llm.settings, "gemini_api_key", "configured-for-test")
    monkeypatch.setattr(llm, "_call_gemini_api", lambda prompt: (_ for _ in ()).throw(RuntimeError("provider unavailable")))
    result = llm.generate_resume_content("summary", {"personal": {"full_name": "Asha José"}, "skills": ["SQL"]}, "Business Analyst")
    assert result.provider == "deterministic-demo"
    assert result.demo is True


def test_resume_pdf_paginates_long_content():
    pdf = build_resume_pdf({
        "personal": {"full_name": "Long Resume"},
        "experience": [{"company": "Example", "title": "Analyst", "bullets": ["A detailed verified accomplishment that remains selectable in the exported document."] * 80}],
    })
    document = fitz.open(stream=pdf, filetype="pdf")
    assert len(document) >= 2
