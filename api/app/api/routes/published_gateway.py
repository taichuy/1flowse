from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.workflow_publish import PublishedNativeRunRequest, PublishedNativeRunResponse
from app.services.published_gateway import (
    PublishedEndpointGatewayError,
    PublishedEndpointGatewayService,
)
from app.services.run_views import serialize_run_detail

router = APIRouter(prefix="/v1/workflows", tags=["published-gateway"])
published_gateway_service = PublishedEndpointGatewayService()


def _extract_presented_api_key(request: Request) -> str | None:
    header_api_key = request.headers.get("x-api-key")
    if header_api_key and header_api_key.strip():
        return header_api_key.strip()

    authorization = request.headers.get("authorization")
    if authorization:
        scheme, _, credentials = authorization.partition(" ")
        if scheme.strip().lower() == "bearer" and credentials.strip():
            return credentials.strip()
    return None


@router.post(
    "/{workflow_id}/published-endpoints/{endpoint_id}/run",
    response_model=PublishedNativeRunResponse,
)
def invoke_published_native_endpoint(
    workflow_id: str,
    endpoint_id: str,
    payload: PublishedNativeRunRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> PublishedNativeRunResponse:
    try:
        result = published_gateway_service.invoke_native_endpoint(
            db,
            workflow_id=workflow_id,
            endpoint_id=endpoint_id,
            input_payload=payload.input_payload,
            presented_api_key=_extract_presented_api_key(request),
        )
    except PublishedEndpointGatewayError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    return PublishedNativeRunResponse(
        binding_id=result.binding_id,
        endpoint_id=result.endpoint_id,
        endpoint_name=result.endpoint_name,
        workflow_id=result.workflow.id,
        workflow_version=result.workflow_version.version,
        compiled_blueprint_id=result.blueprint_record.id,
        run=serialize_run_detail(result.artifacts),
    )
