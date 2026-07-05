from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

from app.bot.i18n import t


def language_keyboard(prefix: str = "reg") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text=t("btn_uzbek", "uz"), callback_data=f"{prefix}:lang:uz")
    kb.button(text=t("btn_russian", "ru"), callback_data=f"{prefix}:lang:ru")
    kb.adjust(1)
    return kb.as_markup()


def gender_keyboard(prefix: str = "reg", lang: str = "uz") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text=t("btn_male", lang), callback_data=f"{prefix}:gender:male")
    kb.button(text=t("btn_female", lang), callback_data=f"{prefix}:gender:female")
    kb.adjust(1)
    return kb.as_markup()


def age_keyboard(prefix: str = "reg") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for age in [18, 19, 20, 21, 22, 23, 24]:
        kb.button(text=str(age), callback_data=f"{prefix}:age:{age}")
    kb.button(text="25+", callback_data=f"{prefix}:age:25")
    kb.adjust(4, 4)
    return kb.as_markup()


def main_menu_keyboard(lang: str = "uz") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text=t("btn_find_chat", lang), callback_data="menu:find")
    kb.button(text=t("btn_premium", lang), callback_data="menu:premium")
    kb.button(text=t("btn_settings", lang), callback_data="menu:settings")
    kb.adjust(1)
    return kb.as_markup()


def premium_keyboard(lang: str = "uz", *, show_buy: bool = True, ton_enabled: bool = True) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    if show_buy:
        kb.button(text=t("btn_pay_stars_7", lang), callback_data="pay:stars:7")
        kb.button(text=t("btn_pay_stars_30", lang), callback_data="pay:stars:30")
        if ton_enabled:
            kb.button(text=t("btn_pay_ton_7", lang), callback_data="pay:ton:7")
            kb.button(text=t("btn_pay_ton_30", lang), callback_data="pay:ton:30")
    kb.button(text=t("btn_back", lang), callback_data="settings:back")
    kb.adjust(1)
    return kb.as_markup()


def settings_keyboard(lang: str = "uz") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text=t("btn_profile", lang), callback_data="settings:profile")
    kb.button(text=t("btn_change_gender", lang), callback_data="settings:gender")
    kb.button(text=t("btn_change_age", lang), callback_data="settings:age")
    kb.button(text=t("btn_change_language", lang), callback_data="settings:language")
    kb.button(text=t("btn_blocked", lang), callback_data="settings:blocked")
    kb.button(text=t("btn_back", lang), callback_data="settings:back")
    kb.adjust(1)
    return kb.as_markup()


def search_wait_keyboard(lang: str = "uz") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text=t("btn_cancel_search", lang), callback_data="menu:cancel_search")
    return kb.as_markup()


def chat_control_keyboard(lang: str = "uz") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text=t("btn_next", lang), callback_data="chat:next")
    kb.button(text=t("btn_like", lang), callback_data="chat:like")
    kb.button(text=t("btn_report", lang), callback_data="chat:report")
    kb.button(text=t("btn_block", lang), callback_data="chat:block")
    kb.button(text=t("btn_end", lang), callback_data="chat:end")
    kb.adjust(2, 2, 1)
    return kb.as_markup()


def report_reasons_keyboard(lang: str = "uz") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text=t("report_nomaqbul", lang), callback_data="report:reason:nomaqbul")
    kb.button(text=t("report_firibgarlik", lang), callback_data="report:reason:firibgarlik")
    kb.button(text=t("report_haqorat", lang), callback_data="report:reason:haqorat")
    kb.button(text=t("report_tahdid", lang), callback_data="report:reason:tahdid")
    kb.button(text=t("report_spam", lang), callback_data="report:reason:spam")
    kb.button(text=t("report_boshqa", lang), callback_data="report:reason:boshqa")
    kb.adjust(1)
    return kb.as_markup()
