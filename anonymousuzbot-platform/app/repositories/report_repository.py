from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ReportStatusEnum
from app.models.report import Report


class ReportRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, **kwargs) -> Report:
        report = Report(**kwargs)
        self.session.add(report)
        await self.session.commit()
        await self.session.refresh(report)
        return report

    async def get_by_id(self, report_id: UUID) -> Report | None:
        result = await self.session.execute(select(Report).where(Report.id == report_id))
        return result.scalar_one_or_none()

    async def list_by_status(self, status: ReportStatusEnum) -> list[Report]:
        result = await self.session.execute(select(Report).where(Report.status == status))
        return list(result.scalars().all())

    async def has_open_report_for_chat(self, chat_id, reporter_id) -> bool:
        result = await self.session.execute(
            select(Report.id).where(
                and_(
                    Report.chat_id == chat_id,
                    Report.reporter_id == reporter_id,
                    Report.status.in_([ReportStatusEnum.new, ReportStatusEnum.reviewing]),
                )
            )
        )
        return result.scalar_one_or_none() is not None

    async def update_status(self, report: Report, status: ReportStatusEnum) -> Report:
        report.status = status
        if status in {ReportStatusEnum.resolved, ReportStatusEnum.rejected}:
            report.resolved_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(report)
        return report

    async def count_recent_for_reported_user(self, reported_user_id, since: datetime) -> int:
        result = await self.session.execute(
            select(func.count(Report.id)).where(
                Report.reported_user_id == reported_user_id,
                Report.created_at >= since,
            )
        )
        return int(result.scalar_one() or 0)
