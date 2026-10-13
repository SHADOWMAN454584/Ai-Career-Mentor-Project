# Campus2Career

**From academic learning to career readiness.**

Campus2Career is a student-focused career development platform that transforms resumes and academic profiles into actionable career insights. It helps students identify skill gaps, explore relevant career paths, assess placement readiness, practice interviews, and build structured learning roadmaps.

The platform combines resume analysis, personalized recommendations, and AI-assisted career guidance in a single workspace designed to make career preparation more structured, measurable, and accessible.

## Overview

Preparing for placements requires more than a strong resume. Students need to understand industry expectations, identify missing skills, select relevant learning resources, and practice communicating their technical knowledge.

Campus2Career addresses these needs through a structured workflow that connects a student's existing skills with their career goals and provides practical next steps for improvement.

### Key Features

- **Resume Analysis** — Extract and organize relevant information from student resumes into structured profiles.
- **Skill Gap Analysis** — Compare existing skills against the requirements of selected career roles and identify areas for improvement.
- **Placement Readiness** — Generate an indicative readiness assessment based on available profile information and defined evaluation criteria.
- **Career Recommendations** — Explore suitable job roles and career paths based on skills, interests, and experience.
- **Course Recommendations** — Discover learning resources relevant to identified skill gaps and career objectives.
- **Mock Interview Practice** — Practice interview questions and receive structured feedback to improve preparation.
- **Personalized Learning Roadmaps** — Follow weekly learning plans with practical milestones and recommended topics.
- **AI-Assisted Guidance** — Use configurable language model providers for career insights, explanations, and personalized recommendations.

## How It Works

Campus2Career organizes career preparation into a practical, repeatable workflow:

1. **Build your profile** — Upload a resume and provide relevant academic, technical, and career information.
2. **Understand your current skills** — Review the extracted profile and identify existing strengths.
3. **Identify skill gaps** — Compare your profile with the expectations of your target role.
4. **Explore opportunities** — Review relevant roles, courses, and areas for professional development.
5. **Practice and improve** — Use mock interviews and targeted learning activities to strengthen your preparation.
6. **Track your progress** — Follow a weekly roadmap and revisit your readiness assessment as your skills develop.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | JavaScript/TypeScript-based web application |
| Backend API | Python, FastAPI |
| Database | SQLAlchemy-compatible database |
| Database Migrations | Alembic |
| Authentication | JWT-based authentication |
| Language Model Integration | Gemini and OpenAI-compatible APIs |
| API Documentation | OpenAPI / Swagger UI |
| Deployment | Vercel or Netlify for the frontend; Render or Railway for the backend |
| Production Database | PostgreSQL through Supabase or Neon |

The exact frontend framework and supporting libraries depend on the implementation in the repository.

## Architecture

The application separates the user interface, API services, persistence layer, and language model integration.

```text
Campus2Career
|
|-- Frontend
|   |-- Resume and profile management
|   |-- Career insights and recommendations
|   |-- Interview practice
|   `-- Learning roadmaps
|
|-- Backend API (FastAPI)
|   |-- Authentication
|   |-- Resume processing
|   |-- Skill gap analysis
|   |-- Career and course recommendations
|   |-- Interview services
|   `-- Learning roadmap generation
|
|-- Data Layer
|   |-- Database models
|   |-- SQLAlchemy
|   `-- Alembic migrations
|
`-- LLM Integration
    |-- Gemini provider
    |-- OpenAI-compatible provider
    `-- Deterministic demo fallback
```

This architecture keeps the frontend independent of the backend implementation and allows language model providers to be configured without redesigning the application.

## Getting Started

Follow these instructions to run Campus2Career locally.

### Prerequisites

Install the following tools before proceeding:

- Python 3.10 or a compatible version supported by `backend/requirements.txt`
- Node.js and npm
- Git
- A configured language model API key, if you want to use an external LLM provider

You will also need the repository source code on your machine.

### 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd Campus2Career
```

Replace `<YOUR_REPOSITORY_URL>` with the URL of your repository.

### 2. Configure Environment Variables

Create a local environment file from the provided example.

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

**Linux / macOS**

```bash
cp .env.example .env
```

Open `.env` and configure the required values, especially `JWT_SECRET`.

Keep API keys and other secrets private. Never commit your `.env` file to version control.

### 3. Create a Python Virtual Environment

From the project root, run:

```bash
python -m venv .venv
```

Activate the environment.

**Windows PowerShell**

```powershell
.\.venv\Scripts\Activate.ps1
```

**Windows Command Prompt**

```bat
.venv\Scripts\activate.bat
```

**Linux / macOS**

```bash
source .venv/bin/activate
```

### 4. Install Backend Dependencies

```bash
pip install -r backend/requirements.txt
```

### 5. Initialize the Database

Run the database migrations from the project root:

```bash
cd backend
alembic upgrade head
cd ..
```

The development server also supports bootstrapping an empty database. Applying migrations explicitly is recommended to keep the database schema consistent with the application.

### 6. Start the Backend API

From the project root:

```bash
uvicorn app.main:app --reload --app-dir backend
```

The backend API should now be available at:

- **API base URL:** http://localhost:8000
- **Interactive API documentation:** http://localhost:8000/docs
- **Alternative API documentation:** http://localhost:8000/redoc

Keep this terminal running while using the application.

### 7. Start the Frontend

Open a second terminal and run:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by the frontend development server.

### 8. Sign In

Use the following demo credentials if the demo account is enabled and the credentials have not been changed in your environment configuration.

| Field | Value |
|---|---|
| Email | `demo@careermentor.local` |
| Password | `demo123` |

Use these credentials only for local development. Change or disable demo credentials before deploying the application publicly.

## Resume Builder

After signing in, open **Resume Builder** from the Workspace navigation or visit `http://localhost:5173/resume-builder`.

The builder supports:

- Personal details, target role, summary, skills, education, projects, experience, certifications, achievements, and activities
- Add, remove, and reorder repeatable education, project, experience, and certification entries
- Factual AI-assisted summary, project, experience, and skill wording through the configured Gemini provider
- Deterministic demo wording when no AI credential is configured; demo output is labeled in the interface
- Authenticated draft save and restore
- Live ATS-friendly Classic and Modern previews
- Searchable multi-page PDF export from the current edited content

The resume builder API is authenticated and is available under `/resume-builder`:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/resume-builder/draft` | Load the current user's saved draft |
| `PUT` | `/resume-builder/draft` | Create or update the current user's draft |
| `POST` | `/resume-builder/generate` | Generate or improve one resume section |
| `POST` | `/resume-builder/pdf` | Export the submitted current content as a PDF |

Run `alembic upgrade head` after installing backend dependencies to create the `resume_drafts` table.

## Language Model Configuration

Campus2Career supports configurable language model providers. The application can use an external provider for generated career insights or fall back to deterministic demo content when no API key is configured.

### Option 1: Google Gemini

Configure the following environment variables:

```dotenv
LLM_PRIMARY=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_supported_gemini_model
```

Obtain an API key through [Google AI Studio](https://aistudio.google.com/).

Set `GEMINI_MODEL` to a model supported by your configured API and application integration.

### Option 2: OpenAI-Compatible Providers

The application can connect to OpenAI-compatible endpoints, including supported OpenRouter, Together, and local gateway configurations.

```dotenv
LLM_PRIMARY=openai_compatible
API_KEY=your_provider_api_key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=your_supported_model
```

The values above illustrate the configuration format. Select a model available through your chosen provider and compatible with the application's request format.

Use `OPENAI_API_KEY` instead of `API_KEY` if that is the environment variable expected by your configuration.

### Provider Fallback

When `LLM_FALLBACK_ENABLED=true`, the application can attempt to use the other configured provider if the primary provider fails, subject to the implemented provider configuration.

When no API key is configured, the application uses deterministic demo content and identifies it as demo output. This allows development and interface testing without depending on a live language model service.

**Important:** Deterministic demo responses are not evidence of actual model inference or validated career prediction.

## Environment Variables

The following table describes the configuration options documented by the project. Confirm the exact defaults and validation rules in the application's environment configuration.

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Secret used for JWT-related authentication operations |
| `LLM_PRIMARY` | Selects the primary language model provider |
| `GEMINI_API_KEY` | API key for the Gemini provider |
| `GEMINI_MODEL` | Gemini model identifier |
| `API_KEY` | Generic API key for an OpenAI-compatible provider |
| `OPENAI_API_KEY` | Alternative API key variable, where supported |
| `OPENAI_BASE_URL` | Base URL for an OpenAI-compatible API |
| `OPENAI_MODEL` | Model identifier for that provider |
| `LLM_FALLBACK_ENABLED` | Controls whether provider fallback is enabled |
| `DATABASE_URL` | Database connection string, particularly for deployment |

Do not publish real credentials, production connection strings, or authentication secrets in documentation, issue reports, or commits.

## API Documentation

Campus2Career uses FastAPI to expose its backend functionality.

Once the backend is running, visit:

- [Swagger UI](http://localhost:8000/docs) — Explore endpoints and make development requests.
- [ReDoc](http://localhost:8000/redoc) — Browse the generated API reference.

These interfaces are generated from the backend's OpenAPI schema and reflect the endpoints implemented in the current application.

## Deployment

The application can be deployed using separate frontend and backend services.

### Frontend

Suitable hosting options include:

- [Vercel](https://vercel.com/)
- [Netlify](https://www.netlify.com/)

Configure the frontend's API base URL using the environment variable supported by the frontend implementation.

### Backend

Suitable hosting options include:

- [Render](https://render.com/)
- [Railway](https://railway.com/)

Configure the backend service with the required Python dependencies, environment variables, database connection, and appropriate startup command.

### Database

For production, PostgreSQL can be hosted using:

- [Supabase](https://supabase.com/)
- [Neon](https://neon.com/)

Set `DATABASE_URL` to the appropriate connection string and apply database migrations during deployment.

### Production Checklist

Before making the application publicly accessible:

- [ ] Replace development secrets with strong, unique production secrets.
- [ ] Disable or secure demo accounts.
- [ ] Configure production CORS rules and authentication settings.
- [ ] Use managed PostgreSQL or another supported persistent database.
- [ ] Store resume uploads in persistent object storage rather than temporary local storage.
- [ ] Validate file types, file sizes, and uploaded content.
- [ ] Protect API keys and avoid logging sensitive user information.
- [ ] Configure rate limiting and appropriate API error handling.
- [ ] Apply database migrations as part of the release process.
- [ ] Test authentication, authorization, and failure scenarios.
- [ ] Review privacy requirements for resumes and other personal information.

Local filesystem uploads are intended for development and should not be treated as durable production storage.

## Privacy and Security

Resumes may contain personal information, education history, contact details, and employment records. Applications handling this information should follow data-minimization and secure-storage practices.

Recommended practices include:

- Collect only information required for the requested functionality.
- Restrict access to user profiles and uploaded resumes.
- Avoid exposing personal information in application logs.
- Use HTTPS in production.
- Provide a clear policy for data retention and deletion.
- Never use real API keys or private user data in public examples.

JWT-based authentication alone does not guarantee complete application security. Authorization checks, input validation, secure secret management, and deployment configuration are also necessary.

## Evaluation and Limitations

Campus2Career is intended to support career preparation rather than replace professional hiring decisions.

- **Placement readiness:** Scores are indicative estimates, not guarantees of selection, employment, or placement outcomes.
- **Recommendations:** Suggested roles and courses depend on the quality and completeness of the available profile and recommendation logic.
- **Interview feedback:** Generated feedback may be incomplete or inaccurate and should be reviewed critically.
- **Language model output:** Responses may contain errors, unsupported claims, or outdated information.
- **Machine learning evaluation:** Demo fixtures must not be presented as validated model performance.

Before reporting final ML metrics or making claims about predictive accuracy, replace demonstration data with documented datasets and appropriately annotated examples. Evaluate the relevant components using suitable metrics, reproducible experiments, and clearly stated limitations.

For example, a readiness estimator should be evaluated separately from a resume parser or recommendation engine. Its output should not be described as a scientifically validated probability of placement unless that interpretation is supported by appropriate evidence.

## Roadmap

Potential areas for future development include:

- [ ] Improved resume parsing and structured skill extraction.
- [ ] Job-description analysis and role-specific skill matching.
- [ ] Transparent explanations for readiness assessments.
- [ ] Progress tracking across learning milestones.
- [ ] Customizable interview question banks.
- [ ] Integration with verified learning resources.
- [ ] Dataset-backed evaluation of ML components.
- [ ] Accessibility and multilingual support.
- [ ] Improved privacy controls and data deletion workflows.
- [ ] Automated tests and continuous integration.

The roadmap represents potential improvements and should not be interpreted as a list of features already implemented.

## Contributing

Contributions, bug reports, documentation improvements, and feature suggestions are welcome.

To contribute:

1. Fork the repository.
2. Create a feature branch.
3. Make a focused change.
4. Test your changes locally.
5. Commit your work with a descriptive message.
6. Open a pull request explaining the change and its motivation.

Example:

```bash
git checkout -b feature/improve-skill-analysis
git add .
git commit -m "Improve skill gap analysis"
git push origin feature/improve-skill-analysis
```

For larger changes, open an issue first to discuss the proposed implementation.

When submitting a bug report, include the relevant environment details, steps to reproduce the issue, expected behavior, and actual behavior. Remove secrets and personal information from logs and screenshots.

## License

Add a `LICENSE` file to the repository before distributing the project under an open-source license.

If the project is intended to be openly developed and reused, choose a license that matches your goals, such as the MIT License or Apache License 2.0. Do not claim a license until it has been selected and included in the repository.

## Acknowledgements

Campus2Career builds on the broader open-source ecosystem for web development, data processing, and language model integration. Refer to the licenses and attribution requirements of the libraries and services used by the project.

---

**Campus2Career — helping students turn their skills into a structured career plan.**
