from app.models.enums import ReportStatusEnum
from app.repositories.report_repository import ReportRepository


class ReportService:
    def __init__(self, session) -> None:
        self.session = session
        self.report_repo = ReportRepository(session)

    async def create_report(self, chat_id, reporter_id, reported_user_id, reason: str):
        if await self.report_repo.has_open_report_for_chat(chat_id, reporter_id):
            return None

        return await self.report_repo.create(
            chat_id=chat_id,
            reporter_id=reporter_id,
            reported_user_id=reported_user_id,
            reason=reason,
            status=ReportStatusEnum.new,
        )
