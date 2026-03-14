from fastapi import APIRouter

from app.api.routes.published_gateway_anthropic_routes import router as anthropic_router
from app.api.routes.published_gateway_native_routes import router as native_router
from app.api.routes.published_gateway_openai_routes import router as openai_router
from app.api.routes.published_gateway_shared import published_gateway_service

router = APIRouter(prefix="/v1", tags=["published-gateway"])
router.include_router(native_router)
router.include_router(openai_router)
router.include_router(anthropic_router)

__all__ = ["router", "published_gateway_service"]
