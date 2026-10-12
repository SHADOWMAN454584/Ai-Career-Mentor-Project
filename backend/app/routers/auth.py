"""Authentication router with slowapi rate limiting and explicit schemas."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User
from ..rate_limiter import limiter
from ..schemas import LoginRequest, TokenResponse
from ..security import create_token, hash_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower().strip()))
    if not user or user.password_hash != hash_password(payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return TokenResponse(access_token=create_token(user))


@router.get("/demo-credentials")
def demo_credentials() -> dict[str, str]:
    return {"email": settings.demo_email, "password": settings.demo_password}
