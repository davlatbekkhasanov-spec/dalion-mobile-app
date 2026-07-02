from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder


def gender_keyboard() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="💙 Male", callback_data="reg:gender:male")
    kb.button(text="🩷 Female", callback_data="reg:gender:female")
    kb.adjust(2)
    return kb.as_markup()


def age_keyboard() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    for age in range(18, 31):
        title = "18+" if age == 18 else str(age)
        kb.button(text=title, callback_data=f"reg:age:{age}")
    kb.adjust(4)
    return kb.as_markup()


def main_menu_keyboard() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="🔎 Find Chat", callback_data="menu:find")
    kb.button(text="⭐️ Premium", callback_data="menu:premium")
    kb.button(text="⚙️ Settings", callback_data="menu:settings")
    kb.adjust(1)
    return kb.as_markup()


def chat_keyboard() -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()
    kb.button(text="⏭️ Next", callback_data="chat:next")
    kb.button(text="❤️ Like", callback_data="chat:like")
    kb.button(text="🚩 Report", callback_data="chat:report")
    kb.button(text="🚫 Block", callback_data="chat:block")
    kb.button(text="❌ End Chat", callback_data="chat:end")
    kb.adjust(2, 2, 1)
    return kb.as_markup()
