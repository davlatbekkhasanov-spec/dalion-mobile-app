"""initial schema

Revision ID: 20260702_0002
Revises:
Create Date: 2026-07-02 09:46:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260702_0002"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    gender_enum = sa.Enum("male", "female", name="gender_enum")
    chat_status_enum = sa.Enum("searching", "active", "ended", "reported", name="chat_status_enum")
    message_type_enum = sa.Enum(
        "text",
        "photo",
        "video",
        "voice",
        "sticker",
        "document",
        name="message_type_enum",
    )
    report_status_enum = sa.Enum("new", "reviewing", "resolved", "rejected", name="report_status_enum")
    ban_type_enum = sa.Enum("temporary", "permanent", name="ban_type_enum")

    bind = op.get_bind()
    gender_enum.create(bind, checkfirst=True)
    chat_status_enum.create(bind, checkfirst=True)
    message_type_enum.create(bind, checkfirst=True)
    report_status_enum.create(bind, checkfirst=True)
    ban_type_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("gender", gender_enum, nullable=False),
        sa.Column("age", sa.Integer(), nullable=False),
        sa.Column("anonymous_nick", sa.String(length=64), nullable=False),
        sa.Column("is_registered", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_banned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("premium_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("telegram_id"),
    )
    op.create_index("ix_users_telegram_id", "users", ["telegram_id"])
    op.create_index("ix_users_gender", "users", ["gender"])
    op.create_index("ix_users_anonymous_nick", "users", ["anonymous_nick"])
    op.create_index("ix_users_created_at", "users", ["created_at"])
    op.create_index("ix_users_last_seen_at", "users", ["last_seen_at"])

    op.create_table(
        "chat_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("male_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("female_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", chat_status_enum, nullable=False, server_default="searching"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["male_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["female_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_sessions_male_user_id", "chat_sessions", ["male_user_id"])
    op.create_index("ix_chat_sessions_female_user_id", "chat_sessions", ["female_user_id"])
    op.create_index("ix_chat_sessions_status", "chat_sessions", ["status"])
    op.create_index("ix_chat_sessions_created_at", "chat_sessions", ["created_at"])
    op.create_index(
        "ix_chat_sessions_status_created_at",
        "chat_sessions",
        ["status", "created_at"],
    )

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chat_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("message_type", message_type_enum, nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("telegram_file_id", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["chat_id"], ["chat_sessions.id"]),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_messages_chat_id", "messages", ["chat_id"])
    op.create_index("ix_messages_sender_id", "messages", ["sender_id"])
    op.create_index("ix_messages_message_type", "messages", ["message_type"])
    op.create_index("ix_messages_created_at", "messages", ["created_at"])
    op.create_index("ix_messages_chat_created_at", "messages", ["chat_id", "created_at"])

    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chat_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reported_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", report_status_enum, nullable=False, server_default="new"),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["chat_id"], ["chat_sessions.id"]),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reported_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reports_chat_id", "reports", ["chat_id"])
    op.create_index("ix_reports_reporter_id", "reports", ["reporter_id"])
    op.create_index("ix_reports_reported_user_id", "reports", ["reported_user_id"])
    op.create_index("ix_reports_status", "reports", ["status"])
    op.create_index("ix_reports_created_at", "reports", ["created_at"])
    op.create_index("ix_reports_status_created_at", "reports", ["status", "created_at"])

    op.create_table(
        "referrals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("inviter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invited_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reward_given", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["inviter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["invited_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invited_id"),
    )
    op.create_index("ix_referrals_inviter_id", "referrals", ["inviter_id"])
    op.create_index("ix_referrals_invited_id", "referrals", ["invited_id"])
    op.create_index("ix_referrals_created_at", "referrals", ["created_at"])

    op.create_table(
        "bans",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.Column("type", ban_type_enum, nullable=False),
        sa.Column("until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bans_user_id", "bans", ["user_id"])
    op.create_index("ix_bans_type", "bans", ["type"])
    op.create_index("ix_bans_created_at", "bans", ["created_at"])

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("admin_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_admin_id", "audit_logs", ["admin_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_target_type", "audit_logs", ["target_type"])
    op.create_index("ix_audit_logs_target_id", "audit_logs", ["target_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    op.create_table(
        "settings",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("settings")
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_target_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_target_type", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_admin_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_index("ix_bans_created_at", table_name="bans")
    op.drop_index("ix_bans_type", table_name="bans")
    op.drop_index("ix_bans_user_id", table_name="bans")
    op.drop_table("bans")

    op.drop_index("ix_referrals_created_at", table_name="referrals")
    op.drop_index("ix_referrals_invited_id", table_name="referrals")
    op.drop_index("ix_referrals_inviter_id", table_name="referrals")
    op.drop_table("referrals")

    op.drop_index("ix_reports_status_created_at", table_name="reports")
    op.drop_index("ix_reports_created_at", table_name="reports")
    op.drop_index("ix_reports_status", table_name="reports")
    op.drop_index("ix_reports_reported_user_id", table_name="reports")
    op.drop_index("ix_reports_reporter_id", table_name="reports")
    op.drop_index("ix_reports_chat_id", table_name="reports")
    op.drop_table("reports")

    op.drop_index("ix_messages_chat_created_at", table_name="messages")
    op.drop_index("ix_messages_created_at", table_name="messages")
    op.drop_index("ix_messages_message_type", table_name="messages")
    op.drop_index("ix_messages_sender_id", table_name="messages")
    op.drop_index("ix_messages_chat_id", table_name="messages")
    op.drop_table("messages")

    op.drop_index("ix_chat_sessions_status_created_at", table_name="chat_sessions")
    op.drop_index("ix_chat_sessions_created_at", table_name="chat_sessions")
    op.drop_index("ix_chat_sessions_status", table_name="chat_sessions")
    op.drop_index("ix_chat_sessions_female_user_id", table_name="chat_sessions")
    op.drop_index("ix_chat_sessions_male_user_id", table_name="chat_sessions")
    op.drop_table("chat_sessions")

    op.drop_index("ix_users_last_seen_at", table_name="users")
    op.drop_index("ix_users_created_at", table_name="users")
    op.drop_index("ix_users_anonymous_nick", table_name="users")
    op.drop_index("ix_users_gender", table_name="users")
    op.drop_index("ix_users_telegram_id", table_name="users")
    op.drop_table("users")

    sa.Enum(name="ban_type_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="report_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="message_type_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="chat_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="gender_enum").drop(op.get_bind(), checkfirst=True)
