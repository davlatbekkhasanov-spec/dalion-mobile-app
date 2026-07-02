"""moderation signals schema

Revision ID: 20260702_0005
Revises: 20260702_0004
Create Date: 2026-07-02 14:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260702_0005"
down_revision = "20260702_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    signal_type_enum = sa.Enum(
        "spam", "scam", "threat", "mass_reports", "illegal_content", name="signal_type_enum"
    )
    signal_severity_enum = sa.Enum("low", "medium", "high", "critical", name="signal_severity_enum")
    signal_status_enum = sa.Enum("new", "reviewing", "resolved", "ignored", name="signal_status_enum")

    bind = op.get_bind()
    signal_type_enum.create(bind, checkfirst=True)
    signal_severity_enum.create(bind, checkfirst=True)
    signal_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "moderation_signals",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chat_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("signal_type", signal_type_enum, nullable=False),
        sa.Column("severity", signal_severity_enum, nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", signal_status_enum, nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["chat_id"], ["chat_sessions.id"]),
        sa.ForeignKeyConstraint(["message_id"], ["messages.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_moderation_signals_user_id", "moderation_signals", ["user_id"])
    op.create_index("ix_moderation_signals_chat_id", "moderation_signals", ["chat_id"])
    op.create_index("ix_moderation_signals_message_id", "moderation_signals", ["message_id"])
    op.create_index("ix_moderation_signals_signal_type", "moderation_signals", ["signal_type"])
    op.create_index("ix_moderation_signals_severity", "moderation_signals", ["severity"])
    op.create_index("ix_moderation_signals_status", "moderation_signals", ["status"])
    op.create_index("ix_moderation_signals_created_at", "moderation_signals", ["created_at"])
    op.create_index(
        "ix_moderation_signals_severity_status",
        "moderation_signals",
        ["severity", "status"],
    )
    op.create_index(
        "ix_moderation_signals_user_created_at",
        "moderation_signals",
        ["user_id", "created_at"],
    )

    default_settings = [
        ("ai_moderator.enabled", "true"),
        ("ai_moderator.spam.repeated_threshold", "3"),
        ("ai_moderator.spam.repeat_window_seconds", "60"),
        ("ai_moderator.spam.messages_per_minute", "15"),
        ("ai_moderator.spam.same_text_distinct_chats", "3"),
        ("ai_moderator.mass_reports.threshold", "5"),
        ("ai_moderator.mass_reports.window_minutes", "60"),
        ("ai_moderator.critical_notify", "true"),
        (
            "ai_moderator.scam.keywords",
            "karta,pul,bank,hisob,transfer,paypal,crypto,bitcoin,usdt,naqd,to'lov,tolov,raqam,password,parol,otp,sms kod,verification",
        ),
        (
            "ai_moderator.threat.keywords",
            "o'ldir,o'ldiraman,oldiraman,tahdid,qo'rqit,qorqit,uraman,zo'rlay,zorlay,qattiq jazo,shantaj,blackmail,kill,threat,violence",
        ),
        (
            "ai_moderator.illegal.keywords",
            "narkotik,geroin,kokain,qurol,terror,child,bolalar,18-,jinsiy aloqa",
        ),
    ]
    for key, value in default_settings:
        op.execute(
            sa.text("INSERT INTO settings (key, value) VALUES (:key, :value) ON CONFLICT (key) DO NOTHING").bindparams(
                key=key, value=value
            )
        )


def downgrade() -> None:
    op.drop_index("ix_moderation_signals_user_created_at", table_name="moderation_signals")
    op.drop_index("ix_moderation_signals_severity_status", table_name="moderation_signals")
    op.drop_index("ix_moderation_signals_created_at", table_name="moderation_signals")
    op.drop_index("ix_moderation_signals_status", table_name="moderation_signals")
    op.drop_index("ix_moderation_signals_severity", table_name="moderation_signals")
    op.drop_index("ix_moderation_signals_signal_type", table_name="moderation_signals")
    op.drop_index("ix_moderation_signals_message_id", table_name="moderation_signals")
    op.drop_index("ix_moderation_signals_chat_id", table_name="moderation_signals")
    op.drop_index("ix_moderation_signals_user_id", table_name="moderation_signals")
    op.drop_table("moderation_signals")

    sa.Enum(name="signal_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="signal_severity_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="signal_type_enum").drop(op.get_bind(), checkfirst=True)
