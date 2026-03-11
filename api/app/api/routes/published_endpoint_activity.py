from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.workflow import Workflow, WorkflowPublishedEndpoint
from app.schemas.workflow_publish import (
    PublishedEndpointInvocationApiKeyUsageItem,
    PublishedEndpointInvocationFacetItem,
    PublishedEndpointInvocationFacets,
    PublishedEndpointInvocationFailureReasonItem,
    PublishedEndpointInvocationFilters,
    PublishedEndpointInvocationItem,
    PublishedEndpointInvocationListResponse,
    PublishedEndpointInvocationRequestSource,
    PublishedEndpointInvocationStatus,
    PublishedEndpointInvocationSummary,
)
from app.services.published_invocations import PublishedInvocationService

router = APIRouter(prefix="/workflows", tags=["published-endpoint-activity"])
published_invocation_service = PublishedInvocationService()


def _serialize_published_invocation_summary(summary) -> PublishedEndpointInvocationSummary:
    return PublishedEndpointInvocationSummary(
        total_count=summary.total_count,
        succeeded_count=summary.succeeded_count,
        failed_count=summary.failed_count,
        rejected_count=summary.rejected_count,
        last_invoked_at=summary.last_invoked_at,
        last_status=summary.last_status,
        last_run_id=summary.last_run_id,
        last_run_status=summary.last_run_status,
    )


def _serialize_published_invocation_item(
    record,
    *,
    api_key_lookup: dict[str, PublishedEndpointInvocationApiKeyUsageItem] | None = None,
) -> PublishedEndpointInvocationItem:
    api_key_metadata = api_key_lookup.get(record.api_key_id) if api_key_lookup else None
    return PublishedEndpointInvocationItem(
        id=record.id,
        workflow_id=record.workflow_id,
        binding_id=record.binding_id,
        endpoint_id=record.endpoint_id,
        endpoint_alias=record.endpoint_alias,
        route_path=record.route_path,
        protocol=record.protocol,
        auth_mode=record.auth_mode,
        request_source=record.request_source,
        status=record.status,
        api_key_id=record.api_key_id,
        api_key_name=api_key_metadata.name if api_key_metadata else None,
        api_key_prefix=api_key_metadata.key_prefix if api_key_metadata else None,
        api_key_status=api_key_metadata.status if api_key_metadata else None,
        run_id=record.run_id,
        run_status=record.run_status,
        error_message=record.error_message,
        request_preview=record.request_preview or {},
        response_preview=record.response_preview,
        duration_ms=record.duration_ms,
        created_at=record.created_at,
        finished_at=record.finished_at,
    )


def _serialize_facet_item(item) -> PublishedEndpointInvocationFacetItem:
    return PublishedEndpointInvocationFacetItem(
        value=item.value,
        count=item.count,
        last_invoked_at=item.last_invoked_at,
        last_status=item.last_status,
    )


def _serialize_api_key_usage_item(item) -> PublishedEndpointInvocationApiKeyUsageItem:
    return PublishedEndpointInvocationApiKeyUsageItem(
        api_key_id=item.api_key_id,
        name=item.name,
        key_prefix=item.key_prefix,
        status=item.status,
        invocation_count=item.invocation_count,
        last_invoked_at=item.last_invoked_at,
        last_status=item.last_status,
    )


def _serialize_failure_reason_item(item) -> PublishedEndpointInvocationFailureReasonItem:
    return PublishedEndpointInvocationFailureReasonItem(
        message=item.message,
        count=item.count,
        last_invoked_at=item.last_invoked_at,
    )


@router.get(
    "/{workflow_id}/published-endpoints/{binding_id}/invocations",
    response_model=PublishedEndpointInvocationListResponse,
)
def list_published_endpoint_invocations(
    workflow_id: str,
    binding_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    invocation_status: PublishedEndpointInvocationStatus | None = Query(
        default=None,
        alias="status",
    ),
    request_source: PublishedEndpointInvocationRequestSource | None = Query(default=None),
    api_key_id: str | None = Query(default=None, min_length=1, max_length=36),
    db: Session = Depends(get_db),
) -> PublishedEndpointInvocationListResponse:
    workflow = db.get(Workflow, workflow_id)
    if workflow is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found.")

    binding = db.get(WorkflowPublishedEndpoint, binding_id)
    if binding is None or binding.workflow_id != workflow_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Published endpoint binding not found.",
        )

    records = published_invocation_service.list_for_binding(
        db,
        workflow_id=workflow_id,
        binding_id=binding_id,
        status=invocation_status,
        request_source=request_source,
        api_key_id=api_key_id,
        limit=limit,
    )
    audit = published_invocation_service.build_binding_audit(
        db,
        workflow_id=workflow_id,
        binding_id=binding_id,
        status=invocation_status,
        request_source=request_source,
        api_key_id=api_key_id,
    )
    api_key_usage_items = [
        _serialize_api_key_usage_item(item) for item in audit.api_key_usage
    ]
    api_key_lookup = {item.api_key_id: item for item in api_key_usage_items}

    return PublishedEndpointInvocationListResponse(
        filters=PublishedEndpointInvocationFilters(
            status=invocation_status,
            request_source=request_source,
            api_key_id=api_key_id,
        ),
        summary=_serialize_published_invocation_summary(audit.summary),
        facets=PublishedEndpointInvocationFacets(
            status_counts=[_serialize_facet_item(item) for item in audit.status_counts],
            request_source_counts=[
                _serialize_facet_item(item) for item in audit.request_source_counts
            ],
            api_key_usage=api_key_usage_items,
            recent_failure_reasons=[
                _serialize_failure_reason_item(item) for item in audit.recent_failure_reasons
            ],
        ),
        items=[
            _serialize_published_invocation_item(record, api_key_lookup=api_key_lookup)
            for record in records
        ],
    )
