from __future__ import annotations

from dataclasses import dataclass


class PublishedEndpointGatewayError(ValueError):
    def __init__(self, detail: str, *, status_code: int = 422) -> None:
        super().__init__(detail)
        self.status_code = status_code


@dataclass
class PublishedGatewayInvokeResult:
    response_payload: dict
    cache_status: str
    run_id: str | None = None
    run_status: str | None = None
    run_payload: dict | None = None
