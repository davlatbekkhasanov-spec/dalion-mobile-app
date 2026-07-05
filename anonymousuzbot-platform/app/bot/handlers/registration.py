from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery

from app.bot.i18n import normalize_lang, t
from app.bot.keyboards.main import age_keyboard, gender_keyboard, main_menu_keyboard
from app.bot.states.registration import RegistrationStates
from app.bot.utils.messages import safe_edit_message
from app.database.session import SessionLocal
from app.models.enums import GenderEnum, LanguageEnum
from app.repositories.user_repository import UserRepository
from app.services.referral_service import ReferralService
from app.services.user_service import UserService

router = Router()


@router.callback_query(F.data.startswith("reg:lang:"))
async def choose_language(callback: CallbackQuery, state: FSMContext) -> None:
    if callback.from_user is None or callback.message is None:
        return

    lang = callback.data.split(":")[-1]
    if lang not in {"uz", "ru"}:
        return

    async with SessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_telegram_id(callback.from_user.id)
        if user is not None:
            await UserService(session).update_language(user, LanguageEnum(lang))

    await state.update_data(language=lang)
    await state.set_state(RegistrationStates.choosing_gender)
    await safe_edit_message(
        callback.message,
        t("choose_gender", lang),
        reply_markup=gender_keyboard(prefix="reg", lang=lang),
    )


@router.callback_query(F.data.startswith("reg:gender:"))
async def choose_gender(callback: CallbackQuery, state: FSMContext) -> None:
    if callback.from_user is None or callback.message is None:
        return

    data = await state.get_data()
    lang = normalize_lang(data.get("language"))
    gender = callback.data.split(":")[-1]
    await state.update_data(gender=gender)
    await state.set_state(RegistrationStates.choosing_age)
    await safe_edit_message(
        callback.message,
        t("choose_age", lang),
        reply_markup=age_keyboard(prefix="reg"),
    )


@router.callback_query(F.data.startswith("reg:age:"))
async def choose_age(callback: CallbackQuery, state: FSMContext) -> None:
    if callback.from_user is None or callback.message is None:
        return

    age = int(callback.data.split(":")[-1])
    data = await state.get_data()
    lang = normalize_lang(data.get("language"))
    gender_value = data.get("gender")
    if gender_value not in {"male", "female"}:
        await callback.message.answer(t("choose_gender_first", lang))
        return

    inviter_telegram_id = None
    reward_days = None

    async with SessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_telegram_id(callback.from_user.id)
        if user is None:
            await callback.message.answer(t("restart_start", lang))
            return

        service = UserService(session)
        user = await service.complete_registration(
            user,
            GenderEnum(gender_value),
            age,
            LanguageEnum(lang),
        )

        referrer_id = data.get("referrer_id")
        if referrer_id:
            reward_result = await ReferralService(session).process_new_registration(user, referrer_id)
            if reward_result:
                inviter = await repo.get_by_id(reward_result["inviter_id"])
                if inviter:
                    inviter_telegram_id = inviter.telegram_id
                    reward_days = reward_result["days"]

    await state.clear()
    gender_emoji = "💙" if user.gender == GenderEnum.male else "🩷"
    gender_label = t("male" if user.gender == GenderEnum.male else "female", lang)
    text = (
        f"{t('ready', lang)}\n"
        f"👤 {user.anonymous_nick}\n"
        f"{gender_emoji} {gender_label}\n"
        f"🎂 {user.age}"
    )
    await safe_edit_message(callback.message, text, reply_markup=main_menu_keyboard(lang))

    if inviter_telegram_id and reward_days:
        inviter_lang = lang
        await callback.bot.send_message(
            inviter_telegram_id,
            t("referral_reward", inviter_lang, days=reward_days),
        )
