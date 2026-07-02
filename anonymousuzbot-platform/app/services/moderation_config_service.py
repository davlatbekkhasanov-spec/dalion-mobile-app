import re
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.setting_repository import SettingRepository

CARD_PATTERN = re.compile(r"\b(?:\d[ \-]*?){13,19}\b")


@dataclass
class ModerationConfig:
    enabled: bool
    spam_repeated_threshold: int
    spam_repeat_window_seconds: int
    spam_messages_per_minute: int
    spam_same_text_distinct_chats: int
    mass_reports_threshold: int
    mass_reports_window_minutes: int
    critical_notify: bool
    scam_keywords: list[str]
    threat_keywords: list[str]
    illegal_keywords: list[str]


DEFAULTS: dict[str, str] = {
    "ai_moderator.enabled": "true",
    "ai_moderator.spam.repeated_threshold": "3",
    "ai_moderator.spam.repeat_window_seconds": "60",
    "ai_moderator.spam.messages_per_minute": "15",
    "ai_moderator.spam.same_text_distinct_chats": "3",
    "ai_moderator.mass_reports.threshold": "5",
    "ai_moderator.mass_reports.window_minutes": "60",
    "ai_moderator.critical_notify": "true",
    "ai_moderator.scam.keywords": (
        "karta,pul,bank,hisob,transfer,paypal,crypto,bitcoin,usdt,naqd,tolov,to'lov,raqam,password,parol,otp,sms kod"
    ),
    "ai_moderator.threat.keywords": (
        "o'ldir,oldiraman,tahdid,qo'rqit,qorqit,uraman,zo'rlay,zorlay,shantaj,blackmail,kill,threat,violence"
    ),
    "ai_moderator.illegal.keywords": "narkotik,geroin,kokain,qurol,terror,child,bolalar,jinsiy",
}


class ModerationConfigService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = SettingRepository(session)

    async def ensure_defaults(self) -> None:
        for key, value in DEFAULTS.items():
            if await self.repo.get(key) is None:
                await self.repo.upsert(key, value)

    async def get_config(self) -> ModerationConfig:
        await self.ensure_defaults()
        return ModerationConfig(
            enabled=await self._bool("ai_moderator.enabled", True),
            spam_repeated_threshold=await self._int("ai_moderator.spam.repeated_threshold", 3),
            spam_repeat_window_seconds=await self._int("ai_moderator.spam.repeat_window_seconds", 60),
            spam_messages_per_minute=await self._int("ai_moderator.spam.messages_per_minute", 15),
            spam_same_text_distinct_chats=await self._int("ai_moderator.spam.same_text_distinct_chats", 3),
            mass_reports_threshold=await self._int("ai_moderator.mass_reports.threshold", 5),
            mass_reports_window_minutes=await self._int("ai_moderator.mass_reports.window_minutes", 60),
            critical_notify=await self._bool("ai_moderator.critical_notify", True),
            scam_keywords=await self._keywords("ai_moderator.scam.keywords"),
            threat_keywords=await self._keywords("ai_moderator.threat.keywords"),
            illegal_keywords=await self._keywords("ai_moderator.illegal.keywords"),
        )

    async def _get(self, key: str, default: str) -> str:
        setting = await self.repo.get(key)
        return setting.value if setting else default

    async def _bool(self, key: str, default: bool) -> bool:
        raw = (await self._get(key, str(default).lower())).strip().lower()
        return raw in {"1", "true", "yes", "on"}

    async def _int(self, key: str, default: int) -> int:
        try:
            return int(await self._get(key, str(default)))
        except ValueError:
            return default

    async def _keywords(self, key: str) -> list[str]:
        raw = await self._get(key, DEFAULTS.get(key, ""))
        return [part.strip().lower() for part in raw.split(",") if part.strip()]

    @staticmethod
    def match_keywords(text: str, keywords: list[str]) -> list[str]:
        lowered = text.lower()
        return [kw for kw in keywords if kw in lowered]

    @staticmethod
    def looks_like_card_number(text: str) -> bool:
        for match in CARD_PATTERN.finditer(text):
            digits = re.sub(r"\D", "", match.group())
            if 13 <= len(digits) <= 19:
                return True
        return False
