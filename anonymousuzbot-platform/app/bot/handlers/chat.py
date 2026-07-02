from aiogram import F, Router
from aiogram.types import CallbackQuery, Message
from sqlalchemy import or_, select

from app.database.session import SessionLocal
from app.models.chat import ChatSession
from app.models.enums import ChatStatus, MessageType
from app.repository.user_repository import UserRepository
from app.services.chat_service import ChatService
from app.services.report_service import ReportService

router = Router(name="chat")


@router.message(F.content_type.in_({"text", "photo", "video", "voice", "sticker", "document"}))
async def relay_message(message: Message) -> None:
    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        sender = await user_repo.get_by_telegram_id(message.from_user.id)
        if sender is None:
            return

        chat = (
            await session.execute(
                select(ChatSession).where(
                    ChatSession.status == ChatStatus.active,
                    or_(ChatSession.user_a_id == sender.id, ChatSession.user_b_id == sender.id),
                )
            )
        ).scalar_one_or_none()
        if chat is None:
            return

        mt = MessageType.text
        file_id = None
        text = message.text
        if message.photo:
            mt = MessageType.photo
            file_id = message.photo[-1].file_id
        elif message.video:
            mt = MessageType.video
            file_id = message.video.file_id
        elif message.voice:
            mt = MessageType.voice
            file_id = message.voice.file_id
        elif message.sticker:
            mt = MessageType.sticker
            file_id = message.sticker.file_id
        elif message.document:
            mt = MessageType.document
            file_id = message.document.file_id

        await ChatService(session).save_message(chat.id, sender.id, mt, text, file_id)

    # NOTE: Production relay should use event bus + bot worker routing cache.
    await message.answer("Message logged and anonymized relay accepted.")


@router.callback_query(F.data == "chat:report")
async def report_current_peer(callback: CallbackQuery) -> None:
    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        reporter = await user_repo.get_by_telegram_id(callback.from_user.id)
        if reporter is None:
            return

        chat = (
            await session.execute(
                select(ChatSession).where(
                    ChatSession.status == ChatStatus.active,
                    or_(ChatSession.user_a_id == reporter.id, ChatSession.user_b_id == reporter.id),
                )
            )
        ).scalar_one_or_none()
        if chat is None:
            await callback.answer("No active chat")
            return

        reported_id = chat.user_b_id if chat.user_a_id == reporter.id else chat.user_a_id
        await ReportService(session).create_case(chat.id, reporter.id, reported_id, "user_report", None)

    await callback.answer("Report submitted")
