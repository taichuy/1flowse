from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.workflow import (
    Workflow,
    WorkflowCompiledBlueprint,
    WorkflowPublishedEndpoint,
    WorkflowVersion,
)
from app.services.published_api_keys import PublishedEndpointApiKeyService
from app.services.published_cache import PublishedEndpointCacheService
from app.services.published_gateway_response_builders import (
    PublishedGatewayResponseBuilder,
)
from app.services.published_gateway_invocation_recorder import (
    PublishedGatewayInvocationContext,
    PublishedGatewayInvocationRecorder,
    PublishedGatewayInvocationSuccess,
)
from app.services.published_gateway_binding_resolver import (
    PublishedGatewayBindingResolver,
    PublishedGatewayBindingResolverError,
)
from app.services.published_gateway_cache_orchestrator import (
    PublishedGatewayCacheOrchestrator,
)
from app.services.published_gateway_protocol_surface import (
    PublishedGatewayProtocolSurfaceMixin,
)
from app.services.published_invocations import PublishedInvocationService
from app.services.run_views import serialize_run_detail
from app.services.runtime import RuntimeService
from app.services.workflow_publish import WorkflowPublishBindingService


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


class PublishedEndpointGatewayService(PublishedGatewayProtocolSurfaceMixin):
    def __init__(
        self,
        *,
        workflow_publish_service: WorkflowPublishBindingService | None = None,
        api_key_service: PublishedEndpointApiKeyService | None = None,
        invocation_service: PublishedInvocationService | None = None,
        cache_service: PublishedEndpointCacheService | None = None,
        runtime_service: RuntimeService | None = None,
        response_builder: PublishedGatewayResponseBuilder | None = None,
        invocation_recorder: PublishedGatewayInvocationRecorder | None = None,
        binding_resolver: PublishedGatewayBindingResolver | None = None,
        cache_orchestrator: PublishedGatewayCacheOrchestrator | None = None,
    ) -> None:
        self._workflow_publish_service = workflow_publish_service or WorkflowPublishBindingService()
        self._api_key_service = api_key_service or PublishedEndpointApiKeyService()
        self._invocation_service = invocation_service or PublishedInvocationService()
        self._cache_service = cache_service or PublishedEndpointCacheService()
        self._runtime_service = runtime_service or RuntimeService()
        self._response_builder = response_builder or PublishedGatewayResponseBuilder()
        self._invocation_recorder = invocation_recorder or PublishedGatewayInvocationRecorder(
            invocation_service=self._invocation_service
        )
        self._binding_resolver = binding_resolver or PublishedGatewayBindingResolver(
            api_key_service=self._api_key_service,
            invocation_service=self._invocation_service,
        )
        self._cache_orchestrator = cache_orchestrator or PublishedGatewayCacheOrchestrator(
            cache_service=self._cache_service,
        )

    def record_protocol_rejection_by_alias(
        self,
        db: Session,
        *,
        model: str,
        expected_protocol: str,
        request_payload: dict,
        error_detail: str,
        presented_api_key: str | None = None,
        request_surface_override: str | None = None,
    ) -> None:
        binding = self._workflow_publish_service.get_published_binding_by_alias(
            db,
            endpoint_alias=model,
        )
        if binding is None or binding.protocol != expected_protocol:
            return

        authenticated_key = None
        if binding.auth_mode == "api_key" and presented_api_key and presented_api_key.strip():
            authenticated_key = self._api_key_service.authenticate_key(
                db,
                workflow_id=binding.workflow_id,
                endpoint_id=binding.endpoint_id,
                secret_key=presented_api_key,
            )

        self._invocation_service.record_invocation(
            db,
            binding=binding,
            request_source="alias",
            input_payload=request_payload,
            status="rejected",
            cache_status="bypass",
            request_surface_override=request_surface_override,
            api_key_id=authenticated_key.id if authenticated_key is not None else None,
            error_message=error_detail,
        )

    def invoke_native_endpoint(
        self,
        db: Session,
        *,
        workflow_id: str,
        endpoint_id: str,
        input_payload: dict,
        presented_api_key: str | None = None,
        require_streaming_enabled: bool = False,
    ) -> PublishedGatewayInvokeResult:
        binding = self._workflow_publish_service.get_published_binding(
            db,
            workflow_id=workflow_id,
            endpoint_id=endpoint_id,
        )
        return self._invoke_binding(
            db,
            binding=binding,
            missing_detail="Published endpoint binding is not currently active.",
            expected_protocol="native",
            workflow_input_payload=input_payload,
            cache_input_payload=input_payload,
            request_preview_payload=input_payload,
            presented_api_key=presented_api_key,
            request_source="workflow",
            response_builder=self._response_builder.build_native_response_payload,
            response_preview_builder=self._response_builder.build_native_response_preview,
            require_streaming_enabled=require_streaming_enabled,
            request_surface_override="native.workflow",
        )

    def invoke_native_endpoint_async(
        self,
        db: Session,
        *,
        workflow_id: str,
        endpoint_id: str,
        input_payload: dict,
        presented_api_key: str | None = None,
    ) -> PublishedGatewayInvokeResult:
        binding = self._workflow_publish_service.get_published_binding(
            db,
            workflow_id=workflow_id,
            endpoint_id=endpoint_id,
        )
        return self._invoke_binding(
            db,
            binding=binding,
            missing_detail="Published endpoint binding is not currently active.",
            expected_protocol="native",
            workflow_input_payload=input_payload,
            cache_input_payload=input_payload,
            request_preview_payload=input_payload,
            presented_api_key=presented_api_key,
            request_source="workflow",
            response_builder=self._response_builder.build_native_response_payload,
            response_preview_builder=self._response_builder.build_native_response_preview,
            require_terminal_success=False,
            request_surface_override="native.workflow.async",
        )

    def invoke_native_endpoint_by_alias(
        self,
        db: Session,
        *,
        endpoint_alias: str,
        input_payload: dict,
        presented_api_key: str | None = None,
        require_streaming_enabled: bool = False,
    ) -> PublishedGatewayInvokeResult:
        binding = self._workflow_publish_service.get_published_binding_by_alias(
            db,
            endpoint_alias=endpoint_alias,
        )
        return self._invoke_binding(
            db,
            binding=binding,
            missing_detail="Published endpoint alias is not currently active.",
            expected_protocol="native",
            workflow_input_payload=input_payload,
            cache_input_payload=input_payload,
            request_preview_payload=input_payload,
            presented_api_key=presented_api_key,
            request_source="alias",
            response_builder=self._response_builder.build_native_response_payload,
            response_preview_builder=self._response_builder.build_native_response_preview,
            require_streaming_enabled=require_streaming_enabled,
            request_surface_override="native.alias",
        )

    def invoke_native_endpoint_by_alias_async(
        self,
        db: Session,
        *,
        endpoint_alias: str,
        input_payload: dict,
        presented_api_key: str | None = None,
    ) -> PublishedGatewayInvokeResult:
        binding = self._workflow_publish_service.get_published_binding_by_alias(
            db,
            endpoint_alias=endpoint_alias,
        )
        return self._invoke_binding(
            db,
            binding=binding,
            missing_detail="Published endpoint alias is not currently active.",
            expected_protocol="native",
            workflow_input_payload=input_payload,
            cache_input_payload=input_payload,
            request_preview_payload=input_payload,
            presented_api_key=presented_api_key,
            request_source="alias",
            response_builder=self._response_builder.build_native_response_payload,
            response_preview_builder=self._response_builder.build_native_response_preview,
            require_terminal_success=False,
            request_surface_override="native.alias.async",
        )

    def invoke_native_endpoint_by_path(
        self,
        db: Session,
        *,
        route_path: str,
        input_payload: dict,
        presented_api_key: str | None = None,
        require_streaming_enabled: bool = False,
    ) -> PublishedGatewayInvokeResult:
        binding = self._workflow_publish_service.get_published_binding_by_path(
            db,
            route_path=route_path,
        )
        return self._invoke_binding(
            db,
            binding=binding,
            missing_detail="Published endpoint path is not currently active.",
            expected_protocol="native",
            workflow_input_payload=input_payload,
            cache_input_payload=input_payload,
            request_preview_payload=input_payload,
            presented_api_key=presented_api_key,
            request_source="path",
            response_builder=self._response_builder.build_native_response_payload,
            response_preview_builder=self._response_builder.build_native_response_preview,
            require_streaming_enabled=require_streaming_enabled,
            request_surface_override="native.path",
        )

    def invoke_native_endpoint_by_path_async(
        self,
        db: Session,
        *,
        route_path: str,
        input_payload: dict,
        presented_api_key: str | None = None,
    ) -> PublishedGatewayInvokeResult:
        binding = self._workflow_publish_service.get_published_binding_by_path(
            db,
            route_path=route_path,
        )
        return self._invoke_binding(
            db,
            binding=binding,
            missing_detail="Published endpoint path is not currently active.",
            expected_protocol="native",
            workflow_input_payload=input_payload,
            cache_input_payload=input_payload,
            request_preview_payload=input_payload,
            presented_api_key=presented_api_key,
            request_source="path",
            response_builder=self._response_builder.build_native_response_payload,
            response_preview_builder=self._response_builder.build_native_response_preview,
            require_terminal_success=False,
            request_surface_override="native.path.async",
        )

    def _invoke_protocol_binding_by_alias(
        self,
        db: Session,
        *,
        model: str,
        expected_protocol: str,
        missing_detail: str,
        workflow_input_payload: dict,
        cache_input_payload: dict,
        request_preview_payload: dict,
        presented_api_key: str | None,
        response_builder,
        require_streaming_enabled: bool = False,
        require_terminal_success: bool = True,
        request_surface_override: str | None = None,
    ) -> PublishedGatewayInvokeResult:
        binding = self._workflow_publish_service.get_published_binding_by_alias(
            db,
            endpoint_alias=model,
        )
        return self._invoke_binding(
            db,
            binding=binding,
            missing_detail=missing_detail,
            expected_protocol=expected_protocol,
            workflow_input_payload=workflow_input_payload,
            cache_input_payload=cache_input_payload,
            request_preview_payload=request_preview_payload,
            presented_api_key=presented_api_key,
            request_source="alias",
            response_builder=response_builder,
            response_preview_builder=self._response_builder.build_passthrough_response_preview,
            require_streaming_enabled=require_streaming_enabled,
            require_terminal_success=require_terminal_success,
            request_surface_override=request_surface_override,
        )

    def _invoke_binding(
        self,
        db: Session,
        *,
        binding: WorkflowPublishedEndpoint | None,
        missing_detail: str,
        expected_protocol: str,
        workflow_input_payload: dict,
        cache_input_payload: dict,
        request_preview_payload: dict,
        presented_api_key: str | None,
        request_source: str,
        response_builder,
        response_preview_builder,
        require_streaming_enabled: bool = False,
        require_terminal_success: bool = True,
        request_surface_override: str | None = None,
    ) -> PublishedGatewayInvokeResult:
        if binding is None:
            raise PublishedEndpointGatewayError(missing_detail, status_code=404)

        started_at = datetime.now(UTC)
        authenticated_key = None
        invocation_error: PublishedEndpointGatewayError | None = None
        workflow = None
        workflow_version = None
        blueprint_record = None
        response_payload = None
        cache_status = "bypass"
        cache_key: str | None = None
        cache_entry_id: str | None = None
        response_preview_payload = None
        stream_run_payload: dict | None = None

        try:
            resolved_binding = self._binding_resolver.resolve(
                db,
                binding=binding,
                expected_protocol=expected_protocol,
                presented_api_key=presented_api_key,
                require_streaming_enabled=require_streaming_enabled,
            )
            workflow = resolved_binding.workflow
            workflow_version = resolved_binding.workflow_version
            blueprint_record = resolved_binding.blueprint_record
            authenticated_key = resolved_binding.authenticated_key
            self._enforce_rate_limit(db, binding=binding)

            cache_lookup = self._cache_orchestrator.lookup(
                db,
                binding=binding,
                input_payload=cache_input_payload,
                now=started_at,
            )
            cache_enabled = cache_lookup.cache_enabled
            cache_status = cache_lookup.cache_status

            executed_run_id: str | None = None
            executed_run_status: str | None = None
            executed_run_error: str | None = None

            if cache_lookup.hit:
                response_payload = cache_lookup.response_payload
                cache_key = cache_lookup.cache_key
                cache_entry_id = cache_lookup.cache_entry_id
                executed_run_status = "succeeded"
            else:
                artifacts = self._runtime_service.execute_compiled_workflow(
                    db,
                    workflow=workflow,
                    workflow_version=workflow_version,
                    blueprint_record=blueprint_record,
                    input_payload=workflow_input_payload,
                )
                if require_terminal_success:
                    self._ensure_sync_publish_run_succeeded(artifacts.run.status)
                executed_run_id = artifacts.run.id
                executed_run_status = artifacts.run.status
                executed_run_error = artifacts.run.error_message
                stream_run_payload = serialize_run_detail(artifacts).model_dump(mode="json")
                response_payload = response_builder(
                    binding=binding,
                    workflow=workflow,
                    workflow_version=workflow_version,
                    blueprint_record=blueprint_record,
                    artifacts=artifacts,
                )
                response_preview_payload = response_preview_builder(response_payload)
                if cache_enabled and self._should_store_cached_response(
                    response_payload=response_payload,
                ):
                    cache_store = self._cache_orchestrator.store(
                        db,
                        binding=binding,
                        input_payload=cache_input_payload,
                        response_payload=response_payload,
                    )
                    cache_key = cache_store.cache_key
                    cache_entry_id = cache_store.cache_entry_id
                elif cache_enabled and cache_status != "hit":
                    cache_status = "bypass"
        except PublishedGatewayBindingResolverError as exc:
            invocation_error = PublishedEndpointGatewayError(
                str(exc),
                status_code=exc.status_code,
            )
        except PublishedEndpointGatewayError as exc:
            invocation_error = exc
        except Exception as exc:  # pragma: no cover - defensive audit hook
            invocation_error = PublishedEndpointGatewayError(str(exc), status_code=500)

        finished_at = datetime.now(UTC)
        invocation_context = PublishedGatewayInvocationContext(
            binding=binding,
            request_source=request_source,
            request_preview_payload=request_preview_payload,
            cache_status=cache_status,
            cache_key=cache_key,
            cache_entry_id=cache_entry_id,
            request_surface_override=request_surface_override,
            authenticated_key=authenticated_key,
            started_at=started_at,
            finished_at=finished_at,
        )
        if invocation_error is not None:
            self._invocation_recorder.record_rejection(
                db,
                context=invocation_context,
                error_message=str(invocation_error),
                status_code=invocation_error.status_code,
            )
            raise invocation_error

        if (
            workflow is None
            or workflow_version is None
            or blueprint_record is None
            or not isinstance(response_payload, dict)
        ):
            raise PublishedEndpointGatewayError(
                "Published endpoint invocation did not produce a response payload.",
                status_code=500,
            )

        if response_preview_payload is None:
            response_preview_payload = response_preview_builder(response_payload)

        run_payload = self._response_builder.extract_run_payload(response_payload)
        recorded_run_id = run_payload.get("id") if run_payload is not None else executed_run_id
        recorded_run_status = (
            run_payload.get("status") if run_payload is not None else executed_run_status
        )
        recorded_error_message = (
            run_payload.get("error_message") if run_payload is not None else executed_run_error
        )

        self._invocation_recorder.record_success(
            db,
            context=invocation_context,
            result=PublishedGatewayInvocationSuccess(
                response_preview_payload=response_preview_payload,
                run_id=recorded_run_id,
                run_status=recorded_run_status,
                error_message=recorded_error_message,
            ),
        )
        return PublishedGatewayInvokeResult(
            response_payload=response_payload,
            cache_status=cache_status,
            run_id=recorded_run_id,
            run_status=recorded_run_status,
            run_payload=run_payload if run_payload is not None else stream_run_payload,
        )

    def _should_store_cached_response(
        self,
        *,
        response_payload: dict,
    ) -> bool:
        run_payload = self._response_builder.extract_run_payload(response_payload)
        if run_payload is None:
            return True
        return run_payload.get("status") == "succeeded"

    def _ensure_sync_publish_run_succeeded(self, run_status: str) -> None:
        if run_status == "succeeded":
            return
        if run_status == "waiting":
            raise PublishedEndpointGatewayError(
                "Published sync invocation entered waiting state. "
                "Waiting runs are not supported for sync published endpoints yet.",
                status_code=409,
            )
        raise PublishedEndpointGatewayError(
            f"Published sync invocation ended with unsupported run status '{run_status}'.",
            status_code=500,
        )

    def _enforce_rate_limit(
        self,
        db: Session,
        *,
        binding: WorkflowPublishedEndpoint,
    ) -> None:
        raw_policy = binding.rate_limit_policy
        if not isinstance(raw_policy, dict):
            return

        requests = raw_policy.get("requests")
        window_seconds = raw_policy.get("windowSeconds")
        if not isinstance(requests, int) or not isinstance(window_seconds, int):
            return
        if requests <= 0 or window_seconds <= 0:
            return

        window_start = datetime.now(UTC) - timedelta(seconds=window_seconds)
        recent_invocation_count = self._binding_resolver.count_recent_invocations(
            db,
            binding=binding,
            created_from=window_start,
        )
        if recent_invocation_count >= requests:
            raise PublishedEndpointGatewayError(
                "Published endpoint rate limit exceeded: "
                f"{requests} successful/failed invocations per {window_seconds} seconds.",
                status_code=429,
            )
