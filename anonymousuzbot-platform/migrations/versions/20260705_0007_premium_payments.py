"""premium payments table

Revision ID: 20260705_0007
Revises: 20260702_0006
Create Date: 2026-07-05 15:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260705_0007"
down_revision = "20260702_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    payment_method_enum = postgresql.ENUM("stars", "ton", name="payment_method_enum")
    payment_method_enum.create(bind, checkfirst=True)
    payment_method_enum_no_create = postgresql.ENUM(
        "stars", "ton", name="payment_method_enum", create_type=False
    )

    payment_status_enum = postgresql.ENUM(
        "pending", "completed", "expired", "failed", name="payment_status_enum"
    )
    payment_status_enum.create(bind, checkfirst=True)
    payment_status_enum_no_create = postgresql.ENUM(
        "pending", "completed", "expired", "failed", name="payment_status_enum", create_type=False
    )

    op.create_table(
        "premium_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("method", payment_method_enum_no_create, nullable=False),
        sa.Column("status", payment_status_enum_no_create, nullable=False, server_default="pending"),
        sa.Column("days", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("payload", sa.String(length=64), nullable=False),
        sa.Column("telegram_charge_id", sa.String(length=256), nullable=True),
        sa.Column("tx_hash", sa.String(length=128), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_premium_payments_user_id", "premium_payments", ["user_id"])
    op.create_index("ix_premium_payments_payload", "premium_payments", ["payload"], unique=True)
    op.create_index("ix_premium_payments_tx_hash", "premium_payments", ["tx_hash"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_premium_payments_tx_hash", table_name="premium_payments")
    op.drop_index("ix_premium_payments_payload", table_name="premium_payments")
    op.drop_index("ix_premium_payments_user_id", table_name="premium_payments")
    op.drop_table("premium_payments")
    postgresql.ENUM(name="payment_status_enum").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="payment_method_enum").drop(op.get_bind(), checkfirst=True)
