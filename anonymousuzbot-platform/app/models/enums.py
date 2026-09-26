import enum


class GenderEnum(str, enum.Enum):
    male = "male"
    female = "female"


class LanguageEnum(str, enum.Enum):
    uz = "uz"
    ru = "ru"


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


class AdminRoleEnum(str, enum.Enum):
    owner = "owner"
    mega_admin = "mega_admin"
    admin = "admin"
    moderator = "moderator"


class SignalTypeEnum(str, enum.Enum):
    spam = "spam"
    scam = "scam"
    threat = "threat"
    mass_reports = "mass_reports"
    illegal_content = "illegal_content"


class SignalSeverityEnum(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class SignalStatusEnum(str, enum.Enum):
    new = "new"
    reviewing = "reviewing"
    resolved = "resolved"
    ignored = "ignored"


class PaymentMethodEnum(str, enum.Enum):
    stars = "stars"
    ton = "ton"


class PaymentStatusEnum(str, enum.Enum):
    pending = "pending"
    completed = "completed"
    expired = "expired"
    failed = "failed"
