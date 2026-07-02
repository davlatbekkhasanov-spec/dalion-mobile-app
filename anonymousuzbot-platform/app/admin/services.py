from datetime import UTC, datetime, timedelta
from uuid import UUID

from passlib.context import CryptContext
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin_user import AdminUser
from app.models.ban import Ban
from app.models.enums import AdminRoleEnum, BanTypeEnum, ChatStatusEnum, GenderEnum, ReportStatusEnum
from app.models.referral import Referral
from app.models.report import Report
from app.models.user import User
from app.repositories.admin_user_repository import AdminUserRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.ban_repository import BanRepository
from app.repositories.chat_session_repository import ChatSessionRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.report_repository import ReportRepository
from app.repositories.setting_repository import SettingRepository
from app.repositories.user_repository import UserRepository
from app.core.config import settings
from app.database.redis import redis_client

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AdminAuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = AdminUserRepository(session)

    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(password: str, password_hash: str) -> bool:
        return pwd_context.verify(password, password_hash)

    async def authenticate(self, username: str, password: str) -> AdminUser | None:
        admin = await self.repo.get_by_username(username)
        if admin is None or not admin.is_active:
            return None
        if not self.verify_password(password, admin.password_hash):
            return None
        return admin

    async def bootstrap_owner_if_needed(self) -> None:
        if not settings.admin_bootstrap_username or not settings.admin_bootstrap_password:
            return
        if await self.repo.count() > 0:
            return
        try:
            role = AdminRoleEnum(settings.admin_bootstrap_role)
        except ValueError:
            role = AdminRoleEnum.owner
        await self.repo.create(
            username=settings.admin_bootstrap_username,
            password_hash=self.hash_password(settings.admin_bootstrap_password),
            role=role,
            is_active=True,
        )


class AuditService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = AuditLogRepository(session)

    async def log(
        self,
        *,
        admin_id: UUID | None,
        action: str,
        target_type: str,
        target_id: UUID | None = None,
        ip_address: str | None = None,
    ) -> None:
        await self.repo.create(
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            ip_address=ip_address,
        )


class AdminUserService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = AdminUserRepository(session)

    async def list_admins(self) -> list[AdminUser]:
        return await self.repo.list_all()

    async def create_admin(self, username: str, password: str, role: AdminRoleEnum) -> AdminUser:
        return await self.repo.create(
            username=username,
            password_hash=AdminAuthService.hash_password(password),
            role=role,
            is_active=True,
        )

    async def toggle_active(self, admin_id: UUID) -> AdminUser | None:
        admin = await self.repo.get_by_id(admin_id)
        if admin is None:
            return None
        return await self.repo.update(admin, is_active=not admin.is_active)


class AdminUserQueryService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def search_users(
        self,
        *,
        uuid_query: str | None = None,
        telegram_id: int | None = None,
        limit: int = 50,
    ) -> list[dict]:
        reports_count = func.count(Report.id).label("reports_count")
        stmt = (
            select(User, reports_count)
            .outerjoin(Report, Report.reported_user_id == User.id)
            .group_by(User.id)
            .order_by(User.created_at.desc())
            .limit(limit)
        )
        if uuid_query:
            try:
                user_uuid = UUID(uuid_query.strip())
            except ValueError:
                return []
            stmt = stmt.where(User.id == user_uuid)
        if telegram_id is not None:
            stmt = stmt.where(User.telegram_id == telegram_id)

        result = await self.session.execute(stmt)
        rows = []
        now = datetime.now(UTC)
        for user, count in result.all():
            rows.append(
                {
                    "user": user,
                    "reports_count": count,
                    "is_premium": user.premium_until is not None and user.premium_until > now,
                }
            )
        return rows

    async def get_user_detail(self, user_id: UUID) -> dict | None:
        user_repo = UserRepository(self.session)
        user = await user_repo.get_by_id(user_id)
        if user is None:
            return None
        result = await self.session.execute(
            select(func.count(Report.id)).where(Report.reported_user_id == user_id)
        )
        reports_count = result.scalar_one()
        now = datetime.now(UTC)
        return {
            "user": user,
            "reports_count": reports_count,
            "is_premium": user.premium_until is not None and user.premium_until > now,
        }


class ModerationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.user_repo = UserRepository(session)
        self.ban_repo = BanRepository(session)
        self.report_repo = ReportRepository(session)

    async def warn_user(self, user_id: UUID) -> User | None:
        return await self.user_repo.get_by_id(user_id)

    async def mute_user(self, user_id: UUID) -> User | None:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            return None
        return await self.user_repo.update(user, is_muted=True)

    async def unmute_user(self, user_id: UUID) -> User | None:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            return None
        return await self.user_repo.update(user, is_muted=False)

    async def temp_ban_user(self, user_id: UUID, reason: str, days: int = 7) -> Ban | None:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            return None
        until = datetime.now(UTC) + timedelta(days=days)
        ban = await self.ban_repo.create(
            user_id=user_id,
            reason=reason,
            type=BanTypeEnum.temporary,
            until=until,
        )
        await self.user_repo.update(user, is_banned=True)
        return ban

    async def permanent_ban_user(self, user_id: UUID, reason: str) -> Ban | None:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            return None
        ban = await self.ban_repo.create(
            user_id=user_id,
            reason=reason,
            type=BanTypeEnum.permanent,
            until=None,
        )
        await self.user_repo.update(user, is_banned=True)
        return ban

    async def unban_user(self, user_id: UUID) -> User | None:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            return None
        return await self.user_repo.update(user, is_banned=False, is_muted=False)

    async def give_premium(self, user_id: UUID, days: int = 30) -> User | None:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            return None
        now = datetime.now(UTC)
        base = user.premium_until if user.premium_until and user.premium_until > now else now
        return await self.user_repo.update(user, premium_until=base + timedelta(days=days))

    async def remove_premium(self, user_id: UUID) -> User | None:
        user = await self.user_repo.get_by_id(user_id)
        if user is None:
            return None
        return await self.user_repo.update(user, premium_until=None)

    async def list_premium_users(self, limit: int = 100) -> list[User]:
        now = datetime.now(UTC)
        result = await self.session.execute(
            select(User)
            .where(User.premium_until.is_not(None), User.premium_until > now)
            .order_by(User.premium_until.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def approve_report(self, report_id: UUID) -> Report | None:
        report = await self.report_repo.get_by_id(report_id)
        if report is None:
            return None
        return await self.report_repo.update_status(report, ReportStatusEnum.resolved)

    async def reject_report(self, report_id: UUID) -> Report | None:
        report = await self.report_repo.get_by_id(report_id)
        if report is None:
            return None
        return await self.report_repo.update_status(report, ReportStatusEnum.rejected)

    async def set_report_reviewing(self, report_id: UUID) -> Report | None:
        report = await self.report_repo.get_by_id(report_id)
        if report is None:
            return None
        return await self.report_repo.update_status(report, ReportStatusEnum.reviewing)


class AdminChatService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.chat_repo = ChatSessionRepository(session)
        self.message_repo = MessageRepository(session)

    async def search_chats(
        self,
        *,
        chat_id: UUID | None = None,
        status: ChatStatusEnum | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        limit: int = 50,
    ) -> list:
        from app.models.chat_session import ChatSession

        stmt = select(ChatSession).order_by(ChatSession.created_at.desc()).limit(limit)
        if chat_id:
            stmt = stmt.where(ChatSession.id == chat_id)
        if status:
            stmt = stmt.where(ChatSession.status == status)
        if date_from:
            stmt = stmt.where(ChatSession.created_at >= date_from)
        if date_to:
            stmt = stmt.where(ChatSession.created_at <= date_to)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_chat_detail(self, chat_id: UUID) -> dict | None:
        chat = await self.chat_repo.get_by_id(chat_id)
        if chat is None:
            return None
        messages = await self.message_repo.list_by_chat(chat_id, limit=500)
        messages.reverse()
        return {"chat": chat, "messages": messages}

    async def export_chat_json(self, chat_id: UUID) -> list[dict] | None:
        detail = await self.get_chat_detail(chat_id)
        if detail is None:
            return None
        chat = detail["chat"]
        return [
            {
                "chat_id": str(chat.id),
                "status": chat.status.value,
                "male_user_id": str(chat.male_user_id),
                "female_user_id": str(chat.female_user_id),
                "started_at": chat.started_at.isoformat() if chat.started_at else None,
                "ended_at": chat.ended_at.isoformat() if chat.ended_at else None,
                "messages": [
                    {
                        "id": str(m.id),
                        "sender_id": str(m.sender_id),
                        "type": m.message_type.value,
                        "text": m.text,
                        "telegram_file_id": m.telegram_file_id,
                        "created_at": m.created_at.isoformat(),
                    }
                    for m in detail["messages"]
                ],
            }
        ]


class AdminReportService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.report_repo = ReportRepository(session)
        self.chat_service = AdminChatService(session)

    async def list_reports(self, status: ReportStatusEnum | None = None, limit: int = 100) -> list[Report]:
        if status:
            return await self.report_repo.list_by_status(status)
        result = await self.session.execute(
            select(Report).order_by(Report.created_at.desc()).limit(limit)
        )
        return list(result.scalars().all())

    async def get_report_detail(self, report_id: UUID) -> dict | None:
        report = await self.report_repo.get_by_id(report_id)
        if report is None:
            return None
        chat_detail = await self.chat_service.get_chat_detail(report.chat_id)
        return {"report": report, "chat_detail": chat_detail}


class AdminStatsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_dashboard_stats(self) -> dict:
        now = datetime.now(UTC)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        total_users = await self._scalar(select(func.count(User.id)))
        male_count = await self._scalar(select(func.count(User.id)).where(User.gender == GenderEnum.male))
        female_count = await self._scalar(select(func.count(User.id)).where(User.gender == GenderEnum.female))

        from app.models.chat_session import ChatSession
        from app.models.ban import Ban

        active_chats = await self._scalar(
            select(func.count(ChatSession.id)).where(ChatSession.status == ChatStatusEnum.active)
        )
        today_chats = await self._scalar(
            select(func.count(ChatSession.id)).where(ChatSession.created_at >= today_start)
        )
        today_reports = await self._scalar(
            select(func.count(Report.id)).where(Report.created_at >= today_start)
        )
        bans_today = await self._scalar(
            select(func.count(Ban.id)).where(Ban.created_at >= today_start)
        )
        referrals_today = await self._scalar(
            select(func.count(Referral.id)).where(Referral.created_at >= today_start)
        )

        online_users = await self._count_online_users()

        return {
            "total_users": total_users,
            "online_users": online_users,
            "male_count": male_count,
            "female_count": female_count,
            "active_chats": active_chats,
            "today_chats": today_chats,
            "today_reports": today_reports,
            "bans_today": bans_today,
            "referrals_today": referrals_today,
        }

    async def _scalar(self, stmt) -> int:
        result = await self.session.execute(stmt)
        return int(result.scalar_one() or 0)

    async def _count_online_users(self) -> int:
        count = 0
        async for _key in redis_client.scan_iter(match="online:user:*", count=100):
            count += 1
        return count


class AdminSettingService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = SettingRepository(session)

    async def list_settings(self) -> list:
        return await self.repo.list_all()

    async def update_setting(self, key: str, value: str):
        return await self.repo.upsert(key, value)
