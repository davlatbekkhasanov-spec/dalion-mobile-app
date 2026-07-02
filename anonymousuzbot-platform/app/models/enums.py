import enum


class Gender(str, enum.Enum):
    male = "male"
    female = "female"


class UserStatus(str, enum.Enum):
    active = "active"
    muted = "muted"
    temp_banned = "temp_banned"
    perm_banned = "perm_banned"


class ChatStatus(str, enum.Enum):
    searching = "searching"
    active = "active"
    ended = "ended"


class MessageType(str, enum.Enum):
    text = "text"
    photo = "photo"
    video = "video"
    voice = "voice"
    sticker = "sticker"
    document = "document"


class ReportStatus(str, enum.Enum):
    open = "open"
    in_review = "in_review"
    resolved = "resolved"
