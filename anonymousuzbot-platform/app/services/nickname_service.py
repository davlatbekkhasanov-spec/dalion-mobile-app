import random

NICKNAMES = [
    "Qora Bo‘ri",
    "Oq Tulki",
    "Tungi Soya",
    "Kumush Burgut",
    "Sirli Niqob",
    "Neon Arslon",
]

PREMIUM_NICKNAMES = [
    "💎 Neon Sultan",
    "✨ Cyber Shahzoda",
    "🌟 Platinum Ninja",
    "🔮 Velvet Phantom",
    "⚡️ Golden Wolf",
    "👑 Diamond Shadow",
    "🛡 Royal Cipher",
    "🌙 Midnight Crown",
]


def generate_anonymous_nickname() -> str:
    return random.choice(NICKNAMES)


def generate_premium_nickname() -> str:
    return random.choice(PREMIUM_NICKNAMES)
