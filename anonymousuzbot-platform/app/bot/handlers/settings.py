from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery

from app.bot.i18n import normalize_lang, t
from app.bot.keyboards.main import (
    age_keyboard,
    gender_keyboard,
    language_keyboard,
    main_menu_keyboard,
    settings_keyboard,
)
from app.bot.states.registration import SettingsStates
from app.bot.utils.messages import safe_edit_message
from app.database.session import SessionLocal
from app.models.enums import GenderEnum, LanguageEnum
from app.repositories.blocked_user_repository import BlockedUserRepository
from app.repositories.user_repository import UserRepository
from app.services.user_service import UserService

router = Router()


def _gender_label(gender: GenderEnum, lang: str) -> str:
    return t("male" if gender == GenderEnum.male else "female", lang)


@router.callback_query(F.data == "settings:profile")
async def my_profile(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_telegram_id(callback.from_user.id)

    if user is None:
        await callback.message.answer(t("press_start", lang))
        return

    lang = normalize_lang(user.language)
    emoji = "💙" if user.gender == GenderEnum.male else "🩷"
    premium_line = t("premium_active", lang) if user.is_premium else t("premium_inactive", lang)
    await safe_edit_message(
        callback.message,
        f"👤 {user.anonymous_nick}\n"
        f"{emoji} {_gender_label(user.gender, lang)}\n"
        f"🎂 {user.age}\n"
        f"{premium_line}",
        reply_markup=settings_keyboard(lang),
    )


@router.callback_query(F.data == "settings:gender")
async def change_gender(callback: CallbackQuery, state: FSMContext, lang: str = "uz") -> None:
    if callback.message is None:
        return
    await state.set_state(SettingsStates.changing_gender)
    await safe_edit_message(
        callback.message,
        t("choose_gender", lang),
        reply_markup=gender_keyboard(prefix="set", lang=lang),
    )


@router.callback_query(F.data == "settings:age")
async def change_age(callback: CallbackQuery, state: FSMContext, lang: str = "uz") -> None:
    if callback.message is None:
        return
    await state.set_state(SettingsStates.changing_age)
    await safe_edit_message(
        callback.message,
        t("choose_age", lang),
        reply_markup=age_keyboard(prefix="set"),
    )


@router.callback_query(F.data == "settings:language")
async def change_language(callback: CallbackQuery, state: FSMContext, lang: str = "uz") -> None:
    if callback.message is None:
        return
    await state.set_state(SettingsStates.changing_language)
    await safe_edit_message(
        callback.message,
        f"{t('choose_language', 'uz')}\n{t('choose_language', 'ru')}",
        reply_markup=language_keyboard(prefix="set"),
    )


@router.callback_query(F.data.startswith("set:gender:"))
async def set_gender(callback: CallbackQuery, state: FSMContext, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    gender = GenderEnum(callback.data.split(":")[-1])
    async with SessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return
        lang = normalize_lang(user.language)
        await UserService(session).update_gender(user, gender)

    await state.clear()
    await safe_edit_message(
        callback.message,
        t("gender_updated", lang),
        reply_markup=settings_keyboard(lang),
    )


@router.callback_query(F.data.startswith("set:age:"))
async def set_age(callback: CallbackQuery, state: FSMContext, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    age = int(callback.data.split(":")[-1])
    async with SessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return
        lang = normalize_lang(user.language)
        await UserService(session).update_age(user, age)

    await state.clear()
    await safe_edit_message(
        callback.message,
        t("age_updated", lang),
        reply_markup=settings_keyboard(lang),
    )


@router.callback_query(F.data.startswith("set:lang:"))
async def set_language(callback: CallbackQuery, state: FSMContext, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    selected = callback.data.split(":")[-1]
    if selected not in {"uz", "ru"}:
        return

    async with SessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return
        await UserService(session).update_language(user, LanguageEnum(selected))

    await state.clear()
    await safe_edit_message(
        callback.message,
        t("language_updated", selected),
        reply_markup=settings_keyboard(selected),
    )


@router.callback_query(F.data == "settings:blocked")
async def blocked_users(callback: CallbackQuery, lang: str = "uz") -> None:
    if callback.from_user is None or callback.message is None:
        return

    async with SessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("press_start", lang))
            return
        lang = normalize_lang(user.language)
        count = await BlockedUserRepository(session).count_for_blocker(user.id)

    await safe_edit_message(
        callback.message,
        t("blocked_count", lang, count=count),
        reply_markup=settings_keyboard(lang),
    )


@router.callback_query(F.data == "settings:back")
async def back_to_main(callback: CallbackQuery, state: FSMContext, lang: str = "uz") -> None:
    if callback.message is None:
        return
    await state.clear()
    await safe_edit_message(
        callback.message,
        t("main_menu", lang),
        reply_markup=main_menu_keyboard(lang),
    )
