from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, CreatedAtMixin, UUIDPrimaryKeyMixin


class BlockedUser(UUIDPrimaryKeyMixin, CreatedAtMixin, Base):
    __tablename__ = "blocked_users"
    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_blocked_pair"),)

    blocker_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    blocked_id: Mapped[str] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
