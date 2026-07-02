import enum


class GenderEnum(str, enum.Enum):
    male = "male"
    female = "female"


class ChatStatusEnum(str, enum.Enum):
    searching = "searching"
    active = "active"
    ended = "ended"
    reported = "reported"


class MessageTypeEnum(str, enum.Enum):
    text = "text"
    photo = "photo"
    video = "video"
    voice = "voice"
    sticker = "sticker"
    document = "document"


class ReportStatusEnum(str, enum.Enum):
    new = "new"
    reviewing = "reviewing"
    resolved = "resolved"
    rejected = "rejected"


class BanTypeEnum(str, enum.Enum):
    temporary = "temporary"
    permanent = "permanent"
