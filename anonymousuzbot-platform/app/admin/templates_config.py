from datetime import datetime
from pathlib import Path

from fastapi.templating import Jinja2Templates

from app.admin.permissions import Permission, has_permission, visible_menu
from app.models.enums import AdminRoleEnum

TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def format_dt(value: datetime | None) -> str:
    if value is None:
        return "—"
    return value.strftime("%Y-%m-%d %H:%M UTC")


def can(role: AdminRoleEnum, permission: Permission) -> bool:
    return has_permission(role, permission)


templates.env.filters["format_dt"] = format_dt
templates.env.globals["can"] = can
templates.env.globals["visible_menu"] = visible_menu
templates.env.globals["AdminRoleEnum"] = AdminRoleEnum
templates.env.globals["Permission"] = Permission
