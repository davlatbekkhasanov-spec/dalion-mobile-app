import random

NICKNAMES = [
    "Qora Bo‘ri",
    "Oq Tulki",
    "Tungi Soya",
    "Kumush Burgut",
    "Sirli Niqob",
    "Neon Arslon",
]


def generate_anonymous_nickname() -> str:
    return random.choice(NICKNAMES)
