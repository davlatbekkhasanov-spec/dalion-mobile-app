from __future__ import annotations

from app.models.enums import LanguageEnum

DEFAULT_LANG = "uz"

TRANSLATIONS: dict[str, dict[str, str]] = {
    "main_menu": {
        "uz": "Asosiy menyu",
        "ru": "Главное меню",
    },
    "choose_language": {
        "uz": "Tilni tanlang",
        "ru": "Выберите язык",
    },
    "choose_gender": {
        "uz": "Jinsni tanlang",
        "ru": "Выберите пол",
    },
    "choose_age": {
        "uz": "Yoshni tanlang",
        "ru": "Выберите возраст",
    },
    "male": {
        "uz": "Yigit",
        "ru": "Парень",
    },
    "female": {
        "uz": "Qiz",
        "ru": "Девушка",
    },
    "ready": {
        "uz": "✅ Tayyor",
        "ru": "✅ Готово",
    },
    "press_start": {
        "uz": "/start bosing",
        "ru": "Нажмите /start",
    },
    "choose_gender_first": {
        "uz": "Avval jinsni tanlang",
        "ru": "Сначала выберите пол",
    },
    "restart_start": {
        "uz": "Qaytadan /start bosing",
        "ru": "Снова нажмите /start",
    },
    "btn_find_chat": {
        "uz": "🔎 Chat qidirish",
        "ru": "🔎 Найти чат",
    },
    "btn_premium": {
        "uz": "⭐️ Premium",
        "ru": "⭐️ Premium",
    },
    "btn_settings": {
        "uz": "⚙️ Sozlamalar",
        "ru": "⚙️ Настройки",
    },
    "btn_back": {
        "uz": "⬅️ Orqaga",
        "ru": "⬅️ Назад",
    },
    "btn_male": {
        "uz": "💙 Men yigitman",
        "ru": "💙 Я парень",
    },
    "btn_female": {
        "uz": "🩷 Men qizman",
        "ru": "🩷 Я девушка",
    },
    "btn_uzbek": {
        "uz": "🇺🇿 O'zbekcha",
        "ru": "🇺🇿 Узбекский",
    },
    "btn_russian": {
        "uz": "🇷🇺 Ruscha",
        "ru": "🇷🇺 Русский",
    },
    "btn_cancel_search": {
        "uz": "❌ Qidiruvni bekor qilish",
        "ru": "❌ Отменить поиск",
    },
    "btn_next": {
        "uz": "⏭️ Keyingisi",
        "ru": "⏭️ Следующий",
    },
    "btn_like": {
        "uz": "❤️ Yoqdi",
        "ru": "❤️ Нравится",
    },
    "btn_report": {
        "uz": "🚩 Shikoyat",
        "ru": "🚩 Жалоба",
    },
    "btn_block": {
        "uz": "🚫 Bloklash",
        "ru": "🚫 Заблокировать",
    },
    "btn_end": {
        "uz": "❌ Tugatish",
        "ru": "❌ Завершить",
    },
    "btn_profile": {
        "uz": "👤 Mening profilim",
        "ru": "👤 Мой профиль",
    },
    "btn_change_gender": {
        "uz": "🔁 Jinsni o'zgartirish",
        "ru": "🔁 Сменить пол",
    },
    "btn_change_age": {
        "uz": "🎂 Yoshni o'zgartirish",
        "ru": "🎂 Сменить возраст",
    },
    "btn_change_language": {
        "uz": "🌐 Tilni o'zgartirish",
        "ru": "🌐 Сменить язык",
    },
    "btn_blocked": {
        "uz": "🚫 Bloklanganlar",
        "ru": "🚫 Заблокированные",
    },
    "settings_title": {
        "uz": "⚙️ Sozlamalar",
        "ru": "⚙️ Настройки",
    },
    "searching": {
        "uz": "⚡️ Mos suhbatdosh qidirilmoqda...",
        "ru": "⚡️ Ищем подходящего собеседника...",
    },
    "search_cancelled": {
        "uz": "Qidiruv bekor qilindi",
        "ru": "Поиск отменён",
    },
    "match_found": {
        "uz": "🔔 PING!\n\n🎭 Match topildi\n\n💙 Yigit  ⚡️  🩷 Qiz\n\nSuhbat boshlandi...",
        "ru": "🔔 PING!\n\n🎭 Совпадение найдено\n\n💙 Парень  ⚡️  🩷 Девушка\n\nЧат начался...",
    },
    "premium_match_found": {
        "uz": "✨💎 PREMIUM MATCH ✨\n\n🔔 PING!\n\n🎭 Match topildi\n\n💙 Yigit  ⚡️  🩷 Qiz\n\nSuhbat boshlandi...",
        "ru": "✨💎 PREMIUM MATCH ✨\n\n🔔 PING!\n\n🎭 Совпадение найдено\n\n💙 Парень  ⚡️  🩷 Девушка\n\nЧат начался...",
    },
    "premium_active": {
        "uz": "💎 Premium faol",
        "ru": "💎 Premium активен",
    },
    "premium_inactive": {
        "uz": "⭐️ Premium yo'q",
        "ru": "⭐️ Premium нет",
    },
    "premium_valid_until": {
        "uz": "⏳ Amal qiladi: {date}",
        "ru": "⏳ Действует до: {date}",
    },
    "premium_features": {
        "uz": "✨ Ustuvor matchmaking\n🎭 Eksklyuziv nicklar\n❤️ Ko'proq like\n✨ Maxsus match effektlari",
        "ru": "✨ Приоритетный поиск\n🎭 Эксклюзивные ники\n❤️ Больше лайков\n✨ Спецэффекты матча",
    },
    "premium_benefits_title": {
        "uz": "Premium imkoniyatlari:",
        "ru": "Возможности Premium:",
    },
    "referral_title": {
        "uz": "🎁 3 ta do'st taklif qiling\n💎 7 kun Premium oling",
        "ru": "🎁 Пригласите 3 друзей\n💎 Получите 7 дней Premium",
    },
    "referral_progress": {
        "uz": "📊 Jarayon: {progress}/{required}",
        "ru": "📊 Прогресс: {progress}/{required}",
    },
    "referral_total": {
        "uz": "👥 Jami takliflar: {total}",
        "ru": "👥 Всего приглашений: {total}",
    },
    "referral_link": {
        "uz": "🔗 Sizning havolangiz:\n{link}",
        "ru": "🔗 Ваша ссылка:\n{link}",
    },
    "referral_reward": {
        "uz": "🎁 Tabriklaymiz! {days} kun Premium mukofoti faollashtirildi.",
        "ru": "🎁 Поздравляем! Награда Premium на {days} дней активирована.",
    },
    "gender_updated": {
        "uz": "✅ Jins yangilandi",
        "ru": "✅ Пол обновлён",
    },
    "age_updated": {
        "uz": "✅ Yosh yangilandi",
        "ru": "✅ Возраст обновлён",
    },
    "language_updated": {
        "uz": "✅ Til yangilandi",
        "ru": "✅ Язык обновлён",
    },
    "blocked_count": {
        "uz": "🚫 Bloklanganlar: {count}",
        "ru": "🚫 Заблокированные: {count}",
    },
    "chat_ended": {
        "uz": "Suhbat tugatildi.",
        "ru": "Чат завершён.",
    },
    "no_active_chat": {
        "uz": "Faol chat yo'q",
        "ru": "Нет активного чата",
    },
    "partner_left": {
        "uz": "Suhbatdosh boshqa chatga o'tdi.",
        "ru": "Собеседник перешёл в другой чат.",
    },
    "liked": {
        "uz": "❤️ Yoqtirildi",
        "ru": "❤️ Понравилось",
    },
    "mutual_like": {
        "uz": "💖 Sizlar bir-biringizni yoqtirdingiz!",
        "ru": "💖 Вы понравились друг другу!",
    },
    "user_blocked": {
        "uz": "🚫 Foydalanuvchi bloklandi.",
        "ru": "🚫 Пользователь заблокирован.",
    },
    "choose_report_reason": {
        "uz": "Shikoyat sababini tanlang:",
        "ru": "Выберите причину жалобы:",
    },
    "report_sent": {
        "uz": "🚩 Shikoyat yuborildi.",
        "ru": "🚩 Жалоба отправлена.",
    },
    "invalid_reason": {
        "uz": "Noto'g'ri sabab",
        "ru": "Неверная причина",
    },
    "register_first": {
        "uz": "Avval ro'yxatdan o'ting",
        "ru": "Сначала пройдите регистрацию",
    },
    "you_are_banned": {
        "uz": "Siz bloklangansiz",
        "ru": "Вы заблокированы",
    },
    "already_in_chat": {
        "uz": "Siz allaqachon suhbatdasiz",
        "ru": "Вы уже в чате",
    },
    "not_allowed": {
        "uz": "Sizga yozish ruxsat etilmagan.",
        "ru": "Вам запрещено писать.",
    },
    "no_partner": {
        "uz": "🔎 Suhbatdosh topilmadi. Chat qidirishni boshlang.",
        "ru": "🔎 Собеседник не найден. Начните поиск чата.",
    },
    "chat_finished": {
        "uz": "Suhbat yakunlangan.",
        "ru": "Чат завершён.",
    },
    "partner_blocked_bot": {
        "uz": "Suhbatdosh botni bloklagan.",
        "ru": "Собеседник заблокировал бота.",
    },
    "message_failed": {
        "uz": "Xabar yuborilmadi. Media fayl yaroqsiz.",
        "ru": "Сообщение не отправлено. Недопустимый медиафайл.",
    },
    "report_nomaqbul": {
        "uz": "🔞 Nomaqbul xatti-harakat",
        "ru": "🔞 Неприемлемое поведение",
    },
    "report_firibgarlik": {
        "uz": "💰 Firibgarlik",
        "ru": "💰 Мошенничество",
    },
    "report_haqorat": {
        "uz": "😡 Haqorat",
        "ru": "😡 Оскорбление",
    },
    "report_tahdid": {
        "uz": "⚠️ Tahdid",
        "ru": "⚠️ Угроза",
    },
    "report_spam": {
        "uz": "📛 Spam",
        "ru": "📛 Спам",
    },
    "report_boshqa": {
        "uz": "📝 Boshqa",
        "ru": "📝 Другое",
    },
}


def normalize_lang(language: LanguageEnum | str | None) -> str:
    if language is None:
        return DEFAULT_LANG
    if isinstance(language, LanguageEnum):
        return language.value
    if language in {"uz", "ru"}:
        return language
    return DEFAULT_LANG


def t(key: str, lang: str | LanguageEnum | None = DEFAULT_LANG, **kwargs: object) -> str:
    resolved = normalize_lang(lang)
    template = TRANSLATIONS.get(key, {}).get(resolved) or TRANSLATIONS.get(key, {}).get(DEFAULT_LANG, key)
    if kwargs:
        return template.format(**kwargs)
    return template
