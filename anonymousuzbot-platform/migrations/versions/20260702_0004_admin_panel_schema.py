"""admin panel schema

Revision ID: 20260702_0004
Revises: 20260702_0003
Create Date: 2026-07-02 12:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260702_0004"
down_revision = "20260702_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    admin_role_enum = postgresql.ENUM("owner", "mega_admin", "admin", "moderator", name="admin_role_enum")
    admin_role_enum.create(bind, checkfirst=True)
    admin_role_enum = postgresql.ENUM(
        "owner", "mega_admin", "admin", "moderator", name="admin_role_enum", create_type=False
    )

    op.add_column(
        "users",
        sa.Column("is_muted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.add_column(
        "audit_logs",
        sa.Column("ip_address", sa.String(length=64), nullable=True),
    )

    op.create_table(
        "admin_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", admin_role_enum, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_admin_users_username", "admin_users", ["username"])
    op.create_index("ix_admin_users_role", "admin_users", ["role"])
    op.create_index("ix_admin_users_created_at", "admin_users", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_admin_users_created_at", table_name="admin_users")
    op.drop_index("ix_admin_users_role", table_name="admin_users")
    op.drop_index("ix_admin_users_username", table_name="admin_users")
    op.drop_table("admin_users")

    op.drop_column("audit_logs", "ip_address")
    op.drop_column("users", "is_muted")

    sa.Enum(name="admin_role_enum").drop(op.get_bind(), checkfirst=True)
