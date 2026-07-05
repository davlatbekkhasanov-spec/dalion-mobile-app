from enum import Enum

from app.models.enums import AdminRoleEnum


class Permission(str, Enum):
    REPORTS_VIEW = "reports_view"
    REPORTS_MANAGE = "reports_manage"
    USERS_VIEW = "users_view"
    USERS_MANAGE = "users_manage"
    USERS_TELEGRAM_SEARCH = "users_telegram_search"
    BANS_VIEW = "bans_view"
    BANS_MANAGE = "bans_manage"
    PREMIUM_MANAGE = "premium_manage"
    STATS_VIEW = "statistics_view"
    CHATS_VIEW = "chats_view"
    CHATS_EXPORT = "chats_export"
    AUDIT_VIEW = "audit_view"
    SIGNALS_VIEW = "signals_view"
    SIGNALS_MANAGE = "signals_manage"
    SETTINGS_MANAGE = "settings_manage"
    ADMINS_MANAGE = "admins_manage"


ROLE_PERMISSIONS: dict[AdminRoleEnum, set[Permission]] = {
    AdminRoleEnum.moderator: {
        Permission.REPORTS_VIEW,
        Permission.REPORTS_MANAGE,
        Permission.SIGNALS_VIEW,
        Permission.SIGNALS_MANAGE,
    },
    AdminRoleEnum.admin: {
        Permission.REPORTS_VIEW,
        Permission.REPORTS_MANAGE,
        Permission.SIGNALS_VIEW,
        Permission.SIGNALS_MANAGE,
        Permission.USERS_VIEW,
        Permission.USERS_MANAGE,
        Permission.BANS_VIEW,
        Permission.BANS_MANAGE,
        Permission.PREMIUM_MANAGE,
        Permission.STATS_VIEW,
    },
    AdminRoleEnum.mega_admin: {
        Permission.REPORTS_VIEW,
        Permission.REPORTS_MANAGE,
        Permission.USERS_VIEW,
        Permission.USERS_MANAGE,
        Permission.USERS_TELEGRAM_SEARCH,
        Permission.BANS_VIEW,
        Permission.BANS_MANAGE,
        Permission.PREMIUM_MANAGE,
        Permission.STATS_VIEW,
        Permission.CHATS_VIEW,
        Permission.CHATS_EXPORT,
        Permission.AUDIT_VIEW,
        Permission.SIGNALS_VIEW,
        Permission.SIGNALS_MANAGE,
    },
    AdminRoleEnum.owner: set(Permission),
}


MENU_ITEMS: list[tuple[str, str, Permission]] = [
    ("👥 Users", "/admin/users", Permission.USERS_VIEW),
    ("💬 Chat Sessions", "/admin/chats", Permission.CHATS_VIEW),
    ("🚩 Reports", "/admin/reports", Permission.REPORTS_VIEW),
    ("🤖 AI Moderator", "/admin/signals", Permission.SIGNALS_VIEW),
    ("🚫 Bans", "/admin/bans", Permission.BANS_VIEW),
    ("⭐️ Premium", "/admin/premium", Permission.PREMIUM_MANAGE),
    ("📊 Statistics", "/admin/statistics", Permission.STATS_VIEW),
    ("🛡 Audit Logs", "/admin/audit", Permission.AUDIT_VIEW),
    ("⚙️ Settings", "/admin/settings", Permission.SETTINGS_MANAGE),
]


def has_permission(role: AdminRoleEnum, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())


def visible_menu(role: AdminRoleEnum) -> list[tuple[str, str]]:
    return [(label, path) for label, path, perm in MENU_ITEMS if has_permission(role, perm)]
