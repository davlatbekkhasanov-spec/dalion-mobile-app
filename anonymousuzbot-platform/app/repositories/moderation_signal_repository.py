from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SignalSeverityEnum, SignalStatusEnum, SignalTypeEnum
from app.models.moderation_signal import ModerationSignal


@dataclass
class DetectedSignal:
    user_id: UUID
    chat_id: UUID | None
    message_id: UUID | None
    signal_type: SignalTypeEnum
    severity: SignalSeverityEnum
    reason: str


class ModerationSignalRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, **kwargs) -> ModerationSignal:
        signal = ModerationSignal(**kwargs)
        self.session.add(signal)
        await self.session.commit()
        await self.session.refresh(signal)
        return signal

    async def get_by_id(self, signal_id: UUID) -> ModerationSignal | None:
        result = await self.session.execute(
            select(ModerationSignal).where(ModerationSignal.id == signal_id)
        )
        return result.scalar_one_or_none()

    async def list_signals(
        self,
        *,
        severity: SignalSeverityEnum | None = None,
        status: SignalStatusEnum | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ModerationSignal]:
        severity_rank = case(
            (ModerationSignal.severity == SignalSeverityEnum.critical, 0),
            (ModerationSignal.severity == SignalSeverityEnum.high, 1),
            (ModerationSignal.severity == SignalSeverityEnum.medium, 2),
            else_=3,
        )
        stmt = select(ModerationSignal).order_by(
            severity_rank,
            ModerationSignal.created_at.desc(),
        )
        if severity:
            stmt = stmt.where(ModerationSignal.severity == severity)
        if status:
            stmt = stmt.where(ModerationSignal.status == status)
        stmt = stmt.offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_status_severity(
        self,
        *,
        status: SignalStatusEnum,
        severity: SignalSeverityEnum | None = None,
    ) -> int:
        stmt = select(func.count(ModerationSignal.id)).where(ModerationSignal.status == status)
        if severity:
            stmt = stmt.where(ModerationSignal.severity == severity)
        result = await self.session.execute(stmt)
        return int(result.scalar_one() or 0)

    async def has_recent_duplicate(
        self,
        *,
        user_id: UUID,
        signal_type: SignalTypeEnum,
        message_id: UUID | None,
        within_minutes: int = 60,
    ) -> bool:
        from datetime import UTC, datetime, timedelta

        since = datetime.now(UTC) - timedelta(minutes=within_minutes)
        conditions = [
            ModerationSignal.user_id == user_id,
            ModerationSignal.signal_type == signal_type,
            ModerationSignal.created_at >= since,
            ModerationSignal.status.in_([SignalStatusEnum.new, SignalStatusEnum.reviewing]),
        ]
        if message_id:
            conditions.append(ModerationSignal.message_id == message_id)
        result = await self.session.execute(select(ModerationSignal.id).where(and_(*conditions)).limit(1))
        return result.scalar_one_or_none() is not None

    async def update_status(self, signal: ModerationSignal, status: SignalStatusEnum) -> ModerationSignal:
        signal.status = status
        await self.session.commit()
        await self.session.refresh(signal)
        return signal
