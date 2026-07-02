from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import ModerationCase


class ReportService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_case(self, chat_id, reporter_id, reported_id, reason: str, evidence_json: str | None):
        case = ModerationCase(
            chat_id=chat_id,
            reporter_id=reporter_id,
            reported_id=reported_id,
            reason=reason,
            evidence_json=evidence_json,
        )
        self.session.add(case)
        await self.session.commit()
        return case
