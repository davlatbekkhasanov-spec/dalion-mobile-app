from fastapi import APIRouter

from app.schemas.health import HealthResponse
from app.utils.constants import SERVICE_NAME

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(ok=True, service=SERVICE_NAME)
