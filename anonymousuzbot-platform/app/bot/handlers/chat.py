from aiogram import F, Router
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError
from aiogram.types import CallbackQuery, Message

from app.bot.i18n import normalize_lang, t
from app.bot.keyboards.main import (
    chat_control_keyboard,
    main_menu_keyboard,
    report_reasons_keyboard,
    search_wait_keyboard,
)
from app.bot.utils.messages import safe_edit_message
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
async def relay_chat_message(message: Message, lang: str = "uz") -> None:
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
            await message.answer(t("not_allowed", lang))
            return

        lang = normalize_lang(sender.language)
        service = MessageService(session)
        chat = await service.get_active_chat(sender.id)
        if chat is None:
            await message.answer(t("no_partner", lang))
            return

        if chat.status != ChatStatusEnum.active:
            await message.answer(t("chat_finished", lang))
            return

        partner = await service.relay_message(
            chat=chat,
            sender=sender,
            message_type=message_type,
            text=text,
            telegram_file_id=file_id,
        )

    if partner is None or partner.is_banned:
        await message.answer(t("chat_finished", lang))
        return

    partner_lang = normalize_lang(partner.language)
    kb = chat_control_keyboard(partner_lang)

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
        await message.answer(t("partner_blocked_bot", lang))
    except TelegramBadRequest:
        await message.answer(t("message_failed", lang))


@router.callback_query(F.data == "chat:end")
async def end_chat(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return

        lang = normalize_lang(user.language)
        control = ChatControlService(session, bot=callback.bot)
        chat, partner = await control.end_chat(user)

    if chat is None:
        await callback.message.answer(t("no_active_chat", lang))
        return

    await safe_edit_message(callback.message, t("chat_ended", lang), reply_markup=main_menu_keyboard(lang))
    if partner is not None:
        partner_lang = normalize_lang(partner.language)
        await callback.bot.send_message(
            partner.telegram_id,
            t("chat_ended", partner_lang),
            reply_markup=main_menu_keyboard(partner_lang),
        )


@router.callback_query(F.data == "chat:next")
async def next_chat(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return

        lang = normalize_lang(user.language)
        control = ChatControlService(session, bot=callback.bot)
        chat, partner = await control.end_chat(user)
        if chat is None:
            await callback.message.answer(t("no_active_chat", lang))
            return

        if partner is not None:
            partner_lang = normalize_lang(partner.language)
            await callback.bot.send_message(
                partner.telegram_id,
                t("partner_left", partner_lang),
                reply_markup=main_menu_keyboard(partner_lang),
            )

        matchmaking = MatchmakingService(session, bot=callback.bot)
        result = await matchmaking.start_search(user, lang)

    if result is None:
        await safe_edit_message(
            callback.message,
            t("searching", lang),
            reply_markup=search_wait_keyboard(lang),
        )
    else:
        await safe_edit_message(
            callback.message,
            t("match_found", lang),
            reply_markup=chat_control_keyboard(lang),
        )


@router.callback_query(F.data == "chat:like")
async def like_chat(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return

        lang = normalize_lang(user.language)
        msg_service = MessageService(session)
        chat = await msg_service.get_active_chat(user.id)
        if chat is None:
            await callback.message.answer(t("no_active_chat", lang))
            return

        is_mutual, error = await LikeService(session).add_like(chat, user)
        partner = await msg_service.get_partner(chat, user.id)

    if error:
        await callback.message.answer(error)
        return

    if not is_mutual:
        await callback.message.answer(t("liked", lang))
        return

    await callback.bot.send_message(
        user.telegram_id,
        t("mutual_like", lang),
        reply_markup=chat_control_keyboard(lang),
    )
    if partner is not None:
        partner_lang = normalize_lang(partner.language)
        await callback.bot.send_message(
            partner.telegram_id,
            t("mutual_like", partner_lang),
            reply_markup=chat_control_keyboard(partner_lang),
        )


@router.callback_query(F.data == "chat:block")
async def block_user(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return

        lang = normalize_lang(user.language)
        msg_service = MessageService(session)
        chat = await msg_service.get_active_chat(user.id)
        if chat is None:
            await callback.message.answer(t("no_active_chat", lang))
            return

        partner = await msg_service.get_partner(chat, user.id)
        if partner is None:
            await callback.message.answer(t("no_active_chat", lang))
            return

        await BlockService(session).block_user(user.id, partner.id)
        await ChatControlService(session, bot=callback.bot).end_chat(user)

    partner_lang = normalize_lang(partner.language)
    await safe_edit_message(callback.message, t("user_blocked", lang), reply_markup=main_menu_keyboard(lang))
    await callback.bot.send_message(
        partner.telegram_id,
        t("chat_ended", partner_lang),
        reply_markup=main_menu_keyboard(partner_lang),
    )


@router.callback_query(F.data == "chat:report")
async def report_chat(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.message is None:
        return
    await safe_edit_message(
        callback.message,
        t("choose_report_reason", lang),
        reply_markup=report_reasons_keyboard(lang),
    )


@router.callback_query(F.data.startswith("report:reason:"))
async def report_reason_selected(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    reason_key = callback.data.split(":")[-1]
    reason = REASON_MAP.get(reason_key)
    if reason is None:
        await callback.message.answer(t("invalid_reason", lang))
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return

        lang = normalize_lang(user.language)
        msg_service = MessageService(session)
        chat = await msg_service.get_active_chat(user.id)
        if chat is None:
            await callback.message.answer(t("no_active_chat", lang))
            return

        partner = await msg_service.get_partner(chat, user.id)
        if partner is None:
            await callback.message.answer(t("no_active_chat", lang))
            return

        await ReportService(session).create_report(chat.id, user.id, partner.id, reason)
        await ChatControlService(session, bot=callback.bot).end_chat(user)

    partner_lang = normalize_lang(partner.language)
    await safe_edit_message(callback.message, t("report_sent", lang), reply_markup=main_menu_keyboard(lang))
    await callback.bot.send_message(
        partner.telegram_id,
        t("chat_ended", partner_lang),
        reply_markup=main_menu_keyboard(partner_lang),
    )
