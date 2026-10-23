"""Asynchronous integration tests for Campus2Career API using httpx.AsyncClient."""
import pytest
from httpx import ASGITransport, AsyncClient
import sys
from pathlib import Path

# Ensure backend directory is in path
backend_path = Path(__file__).resolve().parents[1] / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app import llm
from app.main import app
from app.services.model_loader import placement_model_service


@pytest.fixture(autouse=True)
def ensure_model_loaded():
    """Ensure placement ML model is loaded before tests execute."""
    placement_model_service.load()


@pytest.mark.anyio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "campus2career"
        assert "model_loaded" in data


@pytest.mark.anyio
async def test_auth_login_success_and_invalid():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Invalid credentials
        bad_resp = await client.post("/auth/login", json={"email": "wrong@test.com", "password": "wrong"})
        assert bad_resp.status_code == 401
        assert "Invalid email or password" in bad_resp.json()["detail"]

        # Valid demo credentials
        good_resp = await client.post("/auth/login", json={"email": "demo@careermentor.local", "password": "demo123"})
        assert good_resp.status_code == 200
        body = good_resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"


@pytest.mark.anyio
async def test_skills_catalog_and_mapping():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/skills/catalog")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["roles"], list)
        assert len(data["roles"]) > 0
        assert "Machine Learning Engineer" in data["roles"]
        assert isinstance(data["known_skills"], list)


@pytest.mark.anyio
async def test_placement_predict_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Obtain auth token
        login = await client.post("/auth/login", json={"email": "demo@careermentor.local", "password": "demo123"})
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        payload = {
            "cgpa": 8.5,
            "skill_count": 6,
            "internship_count": 2,
            "project_count": 4,
            "certification_count": 1,
            "branch": "Computer Science",
        }

        response = await client.post("/placement/predict", json=payload, headers=headers)
        assert response.status_code == 200
        result = response.json()
        assert 0.0 <= result["placement_probability"] <= 1.0
        assert result["prediction"] in [0, 1]
        assert "shap_factors" in result
        assert len(result["shap_factors"]) > 0
        assert any(f["direction"] in ["up", "down"] for f in result["shap_factors"])


@pytest.mark.anyio
async def test_mentor_chat_and_stream(monkeypatch):
    monkeypatch.setattr(llm.settings, "gemini_api_key", None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post("/auth/login", json={"email": "demo@careermentor.local", "password": "demo123"})
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Conversational chat
        chat_resp = await client.post(
            "/mentor/chat",
            json={"message": "How do I prepare for System Design?", "target_role": "Backend Developer"},
            headers=headers,
        )
        assert chat_resp.status_code == 200
        chat_data = chat_resp.json()
        assert "reply" in chat_data
        assert isinstance(chat_data["suggested_actions"], list)

        # SSE Streaming
        stream_resp = await client.post(
            "/mentor/stream",
            json={"message": "Give me quick tips for campus interviews", "target_role": "Software Development Engineer"},
            headers=headers,
        )
        assert stream_resp.status_code == 200
        assert "text/event-stream" in stream_resp.headers["content-type"]
        assert "data: " in stream_resp.text
        assert "[DONE]" in stream_resp.text


@pytest.mark.anyio
async def test_pdf_resume_upload_and_pipeline():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post("/auth/login", json={"email": "demo@careermentor.local", "password": "demo123"})
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text(
            (50, 72),
            "Sam Sample\nEmail: sam@example.com\nSkills: Python, Machine Learning, Docker, SQL\nEducation: B.Tech Computer Science 2024 CGPA: 8.8\nExperience: 1 year of experience at TechLab\nProjects: AI Predictive Analytics",
        )
        pdf_bytes = doc.write()
        doc.close()

        files = {"file": ("sample_resume.pdf", pdf_bytes, "application/pdf")}
        upload_resp = await client.post("/resumes/upload", files=files, headers=headers)
        assert upload_resp.status_code == 200
        upload_data = upload_resp.json()
        assert "id" in upload_data
        assert upload_data["filename"] == "sample_resume.pdf"

        # Trigger career analysis on uploaded PDF
        run_resp = await client.post(
            "/analysis/run",
            json={"target_role": "Machine Learning Engineer", "timeline_weeks": 8},
            headers=headers,
        )
        assert run_resp.status_code == 202
        job_id = run_resp.json()["id"]

        # Check job status
        status_resp = await client.get(f"/analysis/{job_id}/status", headers=headers)
        assert status_resp.status_code == 200
        job_data = status_resp.json()
        assert job_data["status"] in ["queued", "running", "completed"]

