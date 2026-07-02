from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder


def gender_keyboard(prefix: str = "reg") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="💙 Men yigitman", callback_data=f"{prefix}:gender:male")
    kb.button(text="🩷 Men qizman", callback_data=f"{prefix}:gender:female")
    kb.adjust(1)
    return kb.as_markup()


def age_keyboard(prefix: str = "reg") -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for age in [18, 19, 20, 21, 22, 23, 24]:
        kb.button(text=str(age), callback_data=f"{prefix}:age:{age}")
    kb.button(text="25+", callback_data=f"{prefix}:age:25")
    kb.adjust(4, 4)
    return kb.as_markup()


def main_menu_keyboard() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="🔎 Chat qidirish", callback_data="menu:find")
    kb.button(text="⭐️ Premium", callback_data="menu:premium")
    kb.button(text="⚙️ Sozlamalar", callback_data="menu:settings")
    kb.adjust(1)
    return kb.as_markup()


def settings_keyboard() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="👤 Mening profilim", callback_data="settings:profile")
    kb.button(text="🔁 Jinsni o‘zgartirish", callback_data="settings:gender")
    kb.button(text="🎂 Yoshni o‘zgartirish", callback_data="settings:age")
    kb.button(text="🚫 Bloklanganlar", callback_data="settings:blocked")
    kb.button(text="⬅️ Orqaga", callback_data="settings:back")
    kb.adjust(1)
    return kb.as_markup()
