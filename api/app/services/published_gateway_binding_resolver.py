from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.workflow import (
    Workflow,
    WorkflowCompiledBlueprint,
    WorkflowPublishedApiKey,
    WorkflowPublishedEndpoint,
    WorkflowVersion,
)
from app.services.published_api_keys import PublishedEndpointApiKeyService
from app.services.published_invocations import PublishedInvocationService


class PublishedGatewayBindingResolverError(ValueError):
    def __init__(
        self,
        detail: str,
        *,
        status_code: int = 422,
        authenticated_key: WorkflowPublishedApiKey | None = None,
    ) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.authenticated_key = authenticated_key


@dataclass(frozen=True)
class PublishedGatewayResolvedBinding:
    binding: WorkflowPublishedEndpoint
    workflow: Workflow
    workflow_version: WorkflowVersion
    blueprint_record: WorkflowCompiledBlueprint
    authenticated_key: WorkflowPublishedApiKey | None


class PublishedGatewayBindingResolver:
    def __init__(
        self,
        *,
        api_key_service: PublishedEndpointApiKeyService | None = None,
        invocation_service: PublishedInvocationService | None = None,
    ) -> None:
        self._api_key_service = api_key_service or PublishedEndpointApiKeyService()
        self._invocation_service = invocation_service or PublishedInvocationService()

    def resolve(
        self,
        db: Session,
        *,
        binding: WorkflowPublishedEndpoint,
        expected_protocol: str,
        presented_api_key: str | None,
        require_streaming_enabled: bool = False,
    ) -> PublishedGatewayResolvedBinding:
        if binding.protocol != expected_protocol:
            raise PublishedGatewayBindingResolverError(
                f"Published endpoint '{binding.endpoint_id}' uses protocol "
                f"'{binding.protocol}', not '{expected_protocol}'."
            )

        workflow = db.get(Workflow, binding.workflow_id)
        if workflow is None:
            raise PublishedGatewayBindingResolverError(
                "Workflow not found.",
                status_code=404,
            )

        authenticated_key = self._authenticate_key(
            db,
            binding=binding,
            workflow=workflow,
            presented_api_key=presented_api_key,
        )

        if require_streaming_enabled and not binding.streaming:
            raise PublishedGatewayBindingResolverError(
                "Streaming is not supported for this published endpoint.",
                authenticated_key=authenticated_key,
            )

        workflow_version = db.get(WorkflowVersion, binding.target_workflow_version_id)
        if workflow_version is None:
            raise PublishedGatewayBindingResolverError(
                "Published endpoint target workflow version is missing."
            )

        blueprint_record = db.get(WorkflowCompiledBlueprint, binding.compiled_blueprint_id)
        if blueprint_record is None:
            raise PublishedGatewayBindingResolverError(
                "Published endpoint compiled blueprint is missing."
            )

        return PublishedGatewayResolvedBinding(
            binding=binding,
            workflow=workflow,
            workflow_version=workflow_version,
            blueprint_record=blueprint_record,
            authenticated_key=authenticated_key,
        )

    def count_recent_invocations(
        self,
        db: Session,
        *,
        binding: WorkflowPublishedEndpoint,
        created_from,
    ) -> int:
        return self._invocation_service.count_recent_for_binding(
            db,
            workflow_id=binding.workflow_id,
            binding_id=binding.id,
            created_from=created_from,
        )

    def _authenticate_key(
        self,
        db: Session,
        *,
        binding: WorkflowPublishedEndpoint,
        workflow: Workflow,
        presented_api_key: str | None,
    ) -> WorkflowPublishedApiKey | None:
        if binding.auth_mode == "api_key":
            if presented_api_key is None or not presented_api_key.strip():
                raise PublishedGatewayBindingResolverError(
                    "Published endpoint API key is required.",
                    status_code=401,
                )
            authenticated_key = self._api_key_service.authenticate_key(
                db,
                workflow_id=workflow.id,
                endpoint_id=binding.endpoint_id,
                secret_key=presented_api_key,
            )
            if authenticated_key is None:
                raise PublishedGatewayBindingResolverError(
                    "Published endpoint API key is invalid.",
                    status_code=401,
                )
            return authenticated_key

        if binding.auth_mode != "internal":
            raise PublishedGatewayBindingResolverError(
                "Published endpoint auth mode "
                f"'{binding.auth_mode}' is not supported yet."
            )

        return None
