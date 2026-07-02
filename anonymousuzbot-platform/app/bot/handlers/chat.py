from aiogram import F, Router
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError
from aiogram.types import CallbackQuery, Message

from app.bot.keyboards.main import (
    chat_control_keyboard,
    main_menu_keyboard,
    report_reasons_keyboard,
    search_wait_keyboard,
)
from app.database.session import SessionLocal
from app.models.enums import ChatStatusEnum, MessageTypeEnum
from app.repositories.user_repository import UserRepository
from app.services.block_service import BlockService
from app.services.chat_control_service import ChatControlService
from app.services.like_service import LikeService
from app.services.matchmaking_service import MatchmakingService
from app.services.message_service import MessageService
from app.services.report_service import ReportService

router = Router()

REASON_MAP = {
    "nomaqbul": "Nomaqbul xatti-harakat",
    "firibgarlik": "Firibgarlik",
    "haqorat": "Haqorat",
    "tahdid": "Tahdid",
    "spam": "Spam",
    "boshqa": "Boshqa",
}


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

        if chat.status != ChatStatusEnum.active:
            await message.answer("Suhbat yakunlangan.")
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
            await message.bot.send_photo(chat_id=partner.telegram_id, photo=file_id, caption=text, reply_markup=kb)
        elif message_type == MessageTypeEnum.video:
            await message.bot.send_video(chat_id=partner.telegram_id, video=file_id, caption=text, reply_markup=kb)
        elif message_type == MessageTypeEnum.voice:
            await message.bot.send_voice(chat_id=partner.telegram_id, voice=file_id, caption=text, reply_markup=kb)
        elif message_type == MessageTypeEnum.sticker:
            await message.bot.send_sticker(chat_id=partner.telegram_id, sticker=file_id, reply_markup=kb)
        elif message_type == MessageTypeEnum.document:
            await message.bot.send_document(chat_id=partner.telegram_id, document=file_id, caption=text, reply_markup=kb)
    except TelegramForbiddenError:
        await message.answer("Suhbatdosh botni bloklagan.")
    except TelegramBadRequest:
        await message.answer("Xabar yuborilmadi. Media fayl yaroqsiz.")


@router.callback_query(F.data == "chat:end")
async def end_chat(callback: CallbackQuery) -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.answer("/start bosing", show_alert=True)
            return

        control = ChatControlService(session, bot=callback.bot)
        chat, partner = await control.end_chat(user)

    if chat is None:
        await callback.answer("Faol chat yo‘q", show_alert=False)
        return

    await callback.message.edit_text("Suhbat tugatildi.", reply_markup=main_menu_keyboard())
    if partner is not None:
        await callback.bot.send_message(partner.telegram_id, "Suhbat tugatildi.", reply_markup=main_menu_keyboard())
    await callback.answer()


@router.callback_query(F.data == "chat:next")
async def next_chat(callback: CallbackQuery) -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.answer("/start bosing", show_alert=True)
            return

        control = ChatControlService(session, bot=callback.bot)
        chat, partner = await control.end_chat(user)
        if chat is None:
            await callback.answer("Faol chat yo‘q", show_alert=False)
            return

        if partner is not None:
            await callback.bot.send_message(
                partner.telegram_id,
                "Suhbatdosh boshqa chatga o'tdi.",
                reply_markup=main_menu_keyboard(),
            )

        matchmaking = MatchmakingService(session, bot=callback.bot)
        result = await matchmaking.start_search(user)

    if result is None:
        await callback.message.edit_text("⚡️ Mos suhbatdosh qidirilmoqda...", reply_markup=search_wait_keyboard())
    else:
        await callback.message.edit_text(
            "🔔 PING!\n\n🎭 Match topildi\n\n💙 Yigit  ⚡️  🩷 Qiz\n\nSuhbat boshlandi...",
            reply_markup=chat_control_keyboard(),
        )
    await callback.answer()


@router.callback_query(F.data == "chat:like")
async def like_chat(callback: CallbackQuery) -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.answer("/start bosing", show_alert=True)
            return

        msg_service = MessageService(session)
        chat = await msg_service.get_active_chat(user.id)
        if chat is None:
            await callback.answer("Faol chat yo‘q", show_alert=False)
            return

        is_mutual, error = await LikeService(session).add_like(chat, user)
        partner = await msg_service.get_partner(chat, user.id)

    if error:
        await callback.answer(error, show_alert=True)
        return

    if not is_mutual:
        await callback.answer("❤️ Yoqtirildi", show_alert=False)
        return

    await callback.bot.send_message(user.telegram_id, "💖 Sizlar bir-biringizni yoqtirdingiz!", reply_markup=chat_control_keyboard())
    if partner is not None:
        await callback.bot.send_message(partner.telegram_id, "💖 Sizlar bir-biringizni yoqtirdingiz!", reply_markup=chat_control_keyboard())
    await callback.answer()


@router.callback_query(F.data == "chat:block")
async def block_user(callback: CallbackQuery) -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.answer("/start bosing", show_alert=True)
            return

        msg_service = MessageService(session)
        chat = await msg_service.get_active_chat(user.id)
        if chat is None:
            await callback.answer("Faol chat yo‘q", show_alert=False)
            return

        partner = await msg_service.get_partner(chat, user.id)
        if partner is None:
            await callback.answer("Faol chat yo‘q", show_alert=False)
            return

        await BlockService(session).block_user(user.id, partner.id)
        await ChatControlService(session, bot=callback.bot).end_chat(user)

    await callback.message.edit_text("🚫 Foydalanuvchi bloklandi.", reply_markup=main_menu_keyboard())
    await callback.bot.send_message(partner.telegram_id, "Suhbat tugatildi.", reply_markup=main_menu_keyboard())
    await callback.answer()


@router.callback_query(F.data == "chat:report")
async def report_chat(callback: CallbackQuery) -> None:
    if callback.message is None:
        return
    await callback.message.edit_text("Shikoyat sababini tanlang:", reply_markup=report_reasons_keyboard())
    await callback.answer()


@router.callback_query(F.data.startswith("report:reason:"))
async def report_reason_selected(callback: CallbackQuery) -> None:
    if callback.from_user is None or callback.message is None:
        return

    reason_key = callback.data.split(":")[-1]
    reason = REASON_MAP.get(reason_key)
    if reason is None:
        await callback.answer("Noto‘g‘ri sabab", show_alert=True)
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.answer("/start bosing", show_alert=True)
            return

        msg_service = MessageService(session)
        chat = await msg_service.get_active_chat(user.id)
        if chat is None:
            await callback.answer("Faol chat yo‘q", show_alert=False)
            return

        partner = await msg_service.get_partner(chat, user.id)
        if partner is None:
            await callback.answer("Faol chat yo‘q", show_alert=False)
            return

        await ReportService(session).create_report(chat.id, user.id, partner.id, reason)
        await ChatControlService(session, bot=callback.bot).end_chat(user)

    await callback.message.edit_text("🚩 Shikoyat yuborildi.", reply_markup=main_menu_keyboard())
    await callback.bot.send_message(partner.telegram_id, "Suhbat tugatildi.", reply_markup=main_menu_keyboard())
    await callback.answer()
