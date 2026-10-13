"""Campus2Career FastAPI Application.
Modularized architecture with decoupled domain routers, defensive exception handling,
lifespan startup model loading, and slowapi rate limiting.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy import select

from .config import settings
from .database import Base, SessionLocal, engine
from .models import User
from .rate_limiter import limiter
from .routers.auth import router as auth_router
from .routers.mentor import router as mentor_router
from .routers.placement import router as placement_router
from .routers.resume_builder import router as resume_builder_router
from .routers.resumes import router as resumes_router
from .routers.skills import router as skills_router
from .security import hash_password
from .services.model_loader import placement_model_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("campus2career")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager: bootstrap database and load ML model artifacts into memory."""
    logger.info("Initializing Campus2Career database and directories...")
    Base.metadata.create_all(bind=engine)
    settings.upload_path.mkdir(parents=True, exist_ok=True)

    with SessionLocal() as db:
        if not db.scalar(select(User).where(User.email == settings.demo_email)):
            logger.info("Seeding default demo student credentials (%s)...", settings.demo_email)
            db.add(User(email=settings.demo_email, name="Demo Student", password_hash=hash_password(settings.demo_password)))
            db.commit()

    logger.info("Loading placement prediction pipeline into memory...")
    placement_model_service.load()

    yield
    logger.info("Campus2Career application shutdown.")


app = FastAPI(
    title="Campus2Career API",
    description="Evidence-based AI Career Mentorship and Placement Readiness Platform",
    version="2.0.0",
    lifespan=lifespan,
)

# Attach rate limiter state
app.state.limiter = limiter

# Configure CORS Middleware
allowed_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Centralized Defensive Exception Handlers
# ---------------------------------------------------------

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    logger.warning("Rate limit exceeded for client %s on %s", request.client.host if request.client else "unknown", request.url.path)
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"detail": "Too many requests. Please slow down and try again shortly."},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_messages = [f"{err['loc'][-1]}: {err['msg']}" for err in exc.errors()]
    logger.info("Validation error on %s: %s", request.url.path, error_messages)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Invalid request schema.", "errors": exc.errors()},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=exc.headers,
    )


@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server exception processing %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "The service encountered an unexpected error. Please try again shortly."},
    )


# ---------------------------------------------------------
# Mount Domain Routers with Explicit Tags and Prefixes
# ---------------------------------------------------------

app.include_router(auth_router)
app.include_router(resumes_router)
app.include_router(skills_router)
app.include_router(mentor_router)
app.include_router(placement_router)
app.include_router(resume_builder_router)


@app.get("/health", tags=["system"])
def health():
    return {
        "status": "ok",
        "service": "campus2career",
        "model_loaded": placement_model_service.is_loaded,
        "model_version": placement_model_service.model_version,
    }
