"""user language column

Revision ID: 20260702_0006
Revises: 20260702_0005
Create Date: 2026-07-02 16:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260702_0006"
down_revision = "20260702_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    language_enum = postgresql.ENUM("uz", "ru", name="language_enum")
    language_enum.create(bind, checkfirst=True)
    language_enum_no_create = postgresql.ENUM("uz", "ru", name="language_enum", create_type=False)

    op.add_column(
        "users",
        sa.Column("language", language_enum_no_create, nullable=False, server_default="uz"),
    )


def downgrade() -> None:
    op.drop_column("users", "language")
    postgresql.ENUM(name="language_enum").drop(op.get_bind(), checkfirst=True)
