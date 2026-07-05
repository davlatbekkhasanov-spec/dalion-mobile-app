"""chat controls schema extensions

Revision ID: 20260702_0003
Revises: 20260702_0002
Create Date: 2026-07-02 10:08:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260702_0003"
down_revision = "20260702_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_sessions",
        sa.Column("male_liked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "chat_sessions",
        sa.Column("female_liked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    op.create_table(
        "secret_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chat_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user1_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user2_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["chat_id"], ["chat_sessions.id"]),
        sa.ForeignKeyConstraint(["user1_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["user2_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chat_id", name="uq_secret_match_chat"),
    )
    op.create_index("ix_secret_matches_chat_id", "secret_matches", ["chat_id"])
    op.create_index("ix_secret_matches_user1_id", "secret_matches", ["user1_id"])
    op.create_index("ix_secret_matches_user2_id", "secret_matches", ["user2_id"])
    op.create_index("ix_secret_matches_created_at", "secret_matches", ["created_at"])

    op.create_table(
        "blocked_users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocker_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocked_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["blocker_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["blocked_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_blocked_pair"),
    )
    op.create_index("ix_blocked_users_blocker_id", "blocked_users", ["blocker_id"])
    op.create_index("ix_blocked_users_blocked_id", "blocked_users", ["blocked_id"])
    op.create_index("ix_blocked_users_created_at", "blocked_users", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_blocked_users_created_at", table_name="blocked_users")
    op.drop_index("ix_blocked_users_blocked_id", table_name="blocked_users")
    op.drop_index("ix_blocked_users_blocker_id", table_name="blocked_users")
    op.drop_table("blocked_users")

    op.drop_index("ix_secret_matches_created_at", table_name="secret_matches")
    op.drop_index("ix_secret_matches_user2_id", table_name="secret_matches")
    op.drop_index("ix_secret_matches_user1_id", table_name="secret_matches")
    op.drop_index("ix_secret_matches_chat_id", table_name="secret_matches")
    op.drop_table("secret_matches")

    op.drop_column("chat_sessions", "female_liked")
    op.drop_column("chat_sessions", "male_liked")
