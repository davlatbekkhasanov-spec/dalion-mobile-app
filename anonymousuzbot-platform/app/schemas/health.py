from pydantic import BaseModel


class HealthResponse(BaseModel):
    ok: bool
    service: str
    database: bool = False
    redis: bool = False
