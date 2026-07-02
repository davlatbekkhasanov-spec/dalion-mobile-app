from aiogram import F, Router
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError
from aiogram.types import Message

from app.bot.keyboards.main import chat_control_keyboard
from app.database.session import SessionLocal
from app.models.enums import MessageTypeEnum
from app.repositories.user_repository import UserRepository
from app.services.message_service import MessageService

router = Router()


def _extract_message_payload(message: Message) -> tuple[MessageTypeEnum, str | None, str | None] | None:
    if message.text:
        return MessageTypeEnum.text, message.text, None
    if message.photo:
        return MessageTypeEnum.photo, message.caption, message.photo[-1].file_id
    if message.video:
        return MessageTypeEnum.video, message.caption, message.video.file_id
    if message.voice:
        return MessageTypeEnum.voice, message.caption, message.voice.file_id
    if message.sticker:
        return MessageTypeEnum.sticker, None, message.sticker.file_id
    if message.document:
        return MessageTypeEnum.document, message.caption, message.document.file_id
    return None


@router.message(F.content_type.in_({"text", "photo", "video", "voice", "sticker", "document"}))
async def relay_chat_message(message: Message) -> None:
    if message.from_user is None:
        return

    payload = _extract_message_payload(message)
    if payload is None:
        return

    message_type, text, file_id = payload

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        sender = await user_repo.get_by_telegram_id(message.from_user.id)
        if sender is None or sender.is_banned:
            await message.answer("Sizga yozish ruxsat etilmagan.")
            return

        service = MessageService(session)
        chat = await service.get_active_chat(sender.id)
        if chat is None:
            await message.answer("🔎 Suhbatdosh topilmadi. Chat qidirishni boshlang.")
            return

        partner = await service.relay_message(
            chat=chat,
            sender=sender,
            message_type=message_type,
            text=text,
            telegram_file_id=file_id,
        )

    if partner is None or partner.is_banned:
        await message.answer("Suhbat yakunlangan.")
        return

    kb = chat_control_keyboard()

    try:
        if message_type == MessageTypeEnum.text:
            await message.bot.send_message(chat_id=partner.telegram_id, text=text or "", reply_markup=kb)
        elif message_type == MessageTypeEnum.photo:
            await message.bot.send_photo(
                chat_id=partner.telegram_id,
                photo=file_id,
                caption=text,
                reply_markup=kb,
            )
        elif message_type == MessageTypeEnum.video:
            await message.bot.send_video(
                chat_id=partner.telegram_id,
                video=file_id,
                caption=text,
                reply_markup=kb,
            )
        elif message_type == MessageTypeEnum.voice:
            await message.bot.send_voice(
                chat_id=partner.telegram_id,
                voice=file_id,
                caption=text,
                reply_markup=kb,
            )
        elif message_type == MessageTypeEnum.sticker:
            await message.bot.send_sticker(
                chat_id=partner.telegram_id,
                sticker=file_id,
                reply_markup=kb,
            )
        elif message_type == MessageTypeEnum.document:
            await message.bot.send_document(
                chat_id=partner.telegram_id,
                document=file_id,
                caption=text,
                reply_markup=kb,
            )
    except TelegramForbiddenError:
        await message.answer("Suhbatdosh botni bloklagan.")
    except TelegramBadRequest:
        await message.answer("Xabar yuborilmadi. Media fayl yaroqsiz.")
