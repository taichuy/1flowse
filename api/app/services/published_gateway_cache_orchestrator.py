from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.workflow import WorkflowPublishedEndpoint
from app.services.published_cache import PublishedEndpointCacheService


@dataclass(frozen=True)
class PublishedGatewayCacheLookupResult:
    cache_enabled: bool
    cache_status: str
    response_payload: dict | None = None
    cache_key: str | None = None
    cache_entry_id: str | None = None

    @property
    def hit(self) -> bool:
        return self.response_payload is not None


@dataclass(frozen=True)
class PublishedGatewayCacheStoreResult:
    cache_key: str | None = None
    cache_entry_id: str | None = None


class PublishedGatewayCacheOrchestrator:
    def __init__(
        self,
        *,
        cache_service: PublishedEndpointCacheService | None = None,
    ) -> None:
        self._cache_service = cache_service or PublishedEndpointCacheService()

    def lookup(
        self,
        db: Session,
        *,
        binding: WorkflowPublishedEndpoint,
        input_payload: dict,
        now: datetime,
    ) -> PublishedGatewayCacheLookupResult:
        if not self._cache_service.is_enabled(binding):
            return PublishedGatewayCacheLookupResult(
                cache_enabled=False,
                cache_status="bypass",
            )

        cache_hit = self._cache_service.get_hit(
            db,
            binding=binding,
            input_payload=input_payload,
            now=now,
        )
        if cache_hit is None:
            return PublishedGatewayCacheLookupResult(
                cache_enabled=True,
                cache_status="miss",
            )

        return PublishedGatewayCacheLookupResult(
            cache_enabled=True,
            cache_status="hit",
            response_payload=cache_hit.response_payload,
            cache_key=cache_hit.cache_key,
            cache_entry_id=cache_hit.entry_id,
        )

    def store(
        self,
        db: Session,
        *,
        binding: WorkflowPublishedEndpoint,
        input_payload: dict,
        response_payload: dict,
    ) -> PublishedGatewayCacheStoreResult:
        cache_entry = self._cache_service.store_response(
            db,
            binding=binding,
            input_payload=input_payload,
            response_payload=response_payload,
        )
        return PublishedGatewayCacheStoreResult(
            cache_key=cache_entry.cache_key,
            cache_entry_id=cache_entry.id,
        )
