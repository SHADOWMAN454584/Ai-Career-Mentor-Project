# AI Career Mentor

AI Career Mentor turns a student's resume into a structured profile, skill-gap analysis, placement-readiness estimate, role and course recommendations, mock interview practice, and a weekly learning roadmap.

## Quick start

1. Copy `.env.example` to `.env` and change `JWT_SECRET`.
2. Create and activate a Python virtual environment.
3. Run `pip install -r backend/requirements.txt`.
4. Run `cd backend; alembic upgrade head; cd ..` to create the database schema (the development server also bootstraps an empty database).
5. Start the API with `uvicorn app.main:app --reload --app-dir backend`.
6. In another terminal run `cd frontend`, `npm install`, then `npm run dev`.
7. Log in with `demo@careermentor.local` / `demo123`, unless changed in `.env`.

The API documentation is at `http://localhost:8000/docs`.

## LLM provider options

- **Gemini:** set `LLM_PRIMARY=gemini`, `GEMINI_API_KEY`, and optionally `GEMINI_MODEL`.
- **Any OpenAI-compatible provider:** set `LLM_PRIMARY=openai_compatible`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL`. This supports OpenRouter, Together, and compatible local gateways.

When `LLM_FALLBACK_ENABLED=true`, the other configured provider is used after a provider failure. If no key is configured, the app uses deterministic demo content and labels it as such.

## Deployment

Use Vercel/Netlify for `frontend`, Render/Railway for `backend`, and Supabase/Neon PostgreSQL through `DATABASE_URL`. Local filesystem uploads are for development only; production should use persistent object storage.

## Safety and limitations

Placement and interview scores are decision-support estimates, not hiring guarantees or comprehensive assessments. Before reporting final ML metrics, replace the included demo fixtures with documented public datasets and annotated resumes.
