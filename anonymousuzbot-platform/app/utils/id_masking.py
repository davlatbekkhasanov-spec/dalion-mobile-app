def mask_internal_id(value: str) -> str:
    if len(value) <= 8:
        return "********"
    return f"{value[:4]}...{value[-4:]}"
