from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import SignalSeverityEnum, SignalStatusEnum, SignalTypeEnum
from app.models.message import Message
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.moderation_signal_repository import DetectedSignal, ModerationSignalRepository
from app.repositories.report_repository import ReportRepository
from app.services.moderation_config_service import ModerationConfig, ModerationConfigService


class AIModeratorService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.config_service = ModerationConfigService(session)
        self.signal_repo = ModerationSignalRepository(session)
        self.message_repo = MessageRepository(session)
        self.report_repo = ReportRepository(session)
        self.audit_repo = AuditLogRepository(session)

    async def analyze_saved_message(self, message: Message) -> list:
        config = await self.config_service.get_config()
        if not config.enabled:
            return []

        detected: list[DetectedSignal] = []
        detected.extend(await self._detect_spam(message, config))
        if message.text:
            detected.extend(self._detect_scam(message, config))
            detected.extend(self._detect_threats(message, config))
            detected.extend(self._detect_illegal_content(message, config))

        return await self._persist(detected, config)

    async def analyze_mass_reports(self, reported_user_id: UUID) -> list:
        config = await self.config_service.get_config()
        if not config.enabled:
            return []

        since = datetime.now(UTC) - timedelta(minutes=config.mass_reports_window_minutes)
        count = await self.report_repo.count_recent_for_reported_user(reported_user_id, since)
        if count < config.mass_reports_threshold:
            return []

        severity = (
            SignalSeverityEnum.critical
            if count >= config.mass_reports_threshold * 2
            else SignalSeverityEnum.high
        )
        detected = [
            DetectedSignal(
                user_id=reported_user_id,
                chat_id=None,
                message_id=None,
                signal_type=SignalTypeEnum.mass_reports,
                severity=severity,
                reason=f"User received {count} reports in {config.mass_reports_window_minutes} minutes",
            )
        ]
        return await self._persist(detected, config)

    async def _detect_spam(self, message: Message, config: ModerationConfig) -> list[DetectedSignal]:
        signals: list[DetectedSignal] = []
        window = timedelta(seconds=config.spam_repeat_window_seconds)
        since = datetime.now(UTC) - window

        per_minute_since = datetime.now(UTC) - timedelta(minutes=1)
        msg_count = await self.message_repo.count_recent_by_sender(message.sender_id, per_minute_since)
        if msg_count >= config.spam_messages_per_minute:
            signals.append(
                DetectedSignal(
                    user_id=message.sender_id,
                    chat_id=message.chat_id,
                    message_id=message.id,
                    signal_type=SignalTypeEnum.spam,
                    severity=SignalSeverityEnum.medium,
                    reason=f"High message rate: {msg_count} messages in the last minute",
                )
            )

        if message.text:
            normalized = " ".join(message.text.lower().split())
            if normalized:
                repeat_count = await self.message_repo.count_same_text_recent(
                    message.sender_id, normalized, since
                )
                if repeat_count >= config.spam_repeated_threshold:
                    signals.append(
                        DetectedSignal(
                            user_id=message.sender_id,
                            chat_id=message.chat_id,
                            message_id=message.id,
                            signal_type=SignalTypeEnum.spam,
                            severity=SignalSeverityEnum.low,
                            reason=(
                                f"Repeated message {repeat_count} times "
                                f"in {config.spam_repeat_window_seconds}s"
                            ),
                        )
                    )

                distinct_chats = await self.message_repo.count_distinct_chats_same_text(
                    message.sender_id,
                    normalized,
                    since=datetime.now(UTC) - timedelta(hours=1),
                )
                if distinct_chats >= config.spam_same_text_distinct_chats:
                    signals.append(
                        DetectedSignal(
                            user_id=message.sender_id,
                            chat_id=message.chat_id,
                            message_id=message.id,
                            signal_type=SignalTypeEnum.spam,
                            severity=SignalSeverityEnum.high,
                            reason=f"Same text sent across {distinct_chats} chats within 1 hour",
                        )
                    )

        return signals

    def _detect_scam(self, message: Message, config: ModerationConfig) -> list[DetectedSignal]:
        signals: list[DetectedSignal] = []
        text = message.text or ""
        matches = ModerationConfigService.match_keywords(text, config.scam_keywords)
        if matches:
            severity = SignalSeverityEnum.high if len(matches) >= 2 else SignalSeverityEnum.medium
            signals.append(
                DetectedSignal(
                    user_id=message.sender_id,
                    chat_id=message.chat_id,
                    message_id=message.id,
                    signal_type=SignalTypeEnum.scam,
                    severity=severity,
                    reason=f"Suspicious payment/scam keywords: {', '.join(matches[:5])}",
                )
            )

        if ModerationConfigService.looks_like_card_number(text):
            signals.append(
                DetectedSignal(
                    user_id=message.sender_id,
                    chat_id=message.chat_id,
                    message_id=message.id,
                    signal_type=SignalTypeEnum.scam,
                    severity=SignalSeverityEnum.critical,
                    reason="Possible bank card number pattern detected",
                )
            )
        return signals

    def _detect_threats(self, message: Message, config: ModerationConfig) -> list[DetectedSignal]:
        text = message.text or ""
        matches = ModerationConfigService.match_keywords(text, config.threat_keywords)
        if not matches:
            return []
        severity = SignalSeverityEnum.critical if len(matches) >= 2 else SignalSeverityEnum.high
        return [
            DetectedSignal(
                user_id=message.sender_id,
                chat_id=message.chat_id,
                message_id=message.id,
                signal_type=SignalTypeEnum.threat,
                severity=severity,
                reason=f"Threat/intimidation keywords: {', '.join(matches[:5])}",
            )
        ]

    def _detect_illegal_content(self, message: Message, config: ModerationConfig) -> list[DetectedSignal]:
        text = message.text or ""
        matches = ModerationConfigService.match_keywords(text, config.illegal_keywords)
        if not matches:
            return []
        return [
            DetectedSignal(
                user_id=message.sender_id,
                chat_id=message.chat_id,
                message_id=message.id,
                signal_type=SignalTypeEnum.illegal_content,
                severity=SignalSeverityEnum.high,
                reason=f"Illegal content indicators: {', '.join(matches[:5])}",
            )
        ]

    async def _persist(self, detected: list[DetectedSignal], config: ModerationConfig) -> list:
        saved = []
        for item in detected:
            if await self.signal_repo.has_recent_duplicate(
                user_id=item.user_id,
                signal_type=item.signal_type,
                message_id=item.message_id,
            ):
                continue
            signal = await self.signal_repo.create(
                user_id=item.user_id,
                chat_id=item.chat_id,
                message_id=item.message_id,
                signal_type=item.signal_type,
                severity=item.severity,
                reason=item.reason,
                status=SignalStatusEnum.new,
            )
            saved.append(signal)
            if config.critical_notify and item.severity == SignalSeverityEnum.critical:
                await self.audit_repo.create(
                    admin_id=None,
                    action="ai_moderator_critical_signal",
                    target_type="moderation_signal",
                    target_id=signal.id,
                    ip_address=None,
                )
        return saved
