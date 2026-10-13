"""add authenticated resume builder drafts

Revision ID: 0002_resume_builder
Revises: 0001_initial_schema
"""
from alembic import op
from app.database import Base
import app.models  # noqa: F401

revision = "0002_resume_builder"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade():
    Base.metadata.tables["resume_drafts"].create(bind=op.get_bind(), checkfirst=True)


def downgrade():
    Base.metadata.tables["resume_drafts"].drop(bind=op.get_bind(), checkfirst=True)