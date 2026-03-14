from __future__ import annotations

from app.models.workflow import (
    Workflow,
    WorkflowCompiledBlueprint,
    WorkflowPublishedEndpoint,
    WorkflowVersion,
)
from app.schemas.workflow_publish import (
    PublishedNativeRunResponse,
    PublishedProtocolAsyncRunResponse,
)
from app.services.run_views import serialize_run_detail


class PublishedGatewayResponseBuilder:
    def build_native_response_payload(
        self,
        *,
        binding: WorkflowPublishedEndpoint,
        workflow: Workflow,
        workflow_version: WorkflowVersion,
        blueprint_record: WorkflowCompiledBlueprint,
        artifacts,
    ) -> dict:
        response = PublishedNativeRunResponse(
            binding_id=binding.id,
            endpoint_id=binding.endpoint_id,
            endpoint_name=binding.endpoint_name,
            endpoint_alias=binding.endpoint_alias,
            route_path=binding.route_path,
            workflow_id=workflow.id,
            workflow_version=workflow_version.version,
            compiled_blueprint_id=blueprint_record.id,
            run=serialize_run_detail(artifacts),
        )
        return response.model_dump(mode="json")

    def build_native_response_preview(self, response_payload: dict) -> dict:
        run_payload = response_payload.get("run")
        if not isinstance(run_payload, dict):
            return {}
        output_payload = run_payload.get("output_payload")
        return output_payload if isinstance(output_payload, dict) else {}

    def build_passthrough_response_preview(self, response_payload: dict) -> dict:
        return response_payload

    def build_protocol_async_response_payload(
        self,
        *,
        binding: WorkflowPublishedEndpoint,
        workflow: Workflow,
        workflow_version: WorkflowVersion,
        blueprint_record: WorkflowCompiledBlueprint,
        artifacts,
        model: str,
        request_surface: str,
        protocol_response_builder,
    ) -> dict:
        run_detail = serialize_run_detail(artifacts)
        response_payload = None
        if artifacts.run.status == "succeeded":
            response_payload = protocol_response_builder(
                model=model,
                output_payload=artifacts.run.output_payload,
            )

        response = PublishedProtocolAsyncRunResponse(
            binding_id=binding.id,
            endpoint_id=binding.endpoint_id,
            endpoint_name=binding.endpoint_name,
            endpoint_alias=binding.endpoint_alias,
            route_path=binding.route_path,
            protocol=binding.protocol,
            request_surface=request_surface,
            model=model,
            workflow_id=workflow.id,
            workflow_version=workflow_version.version,
            compiled_blueprint_id=blueprint_record.id,
            run=run_detail,
            response_payload=response_payload,
        )
        return response.model_dump(mode="json", exclude_none=True)

    def extract_run_payload(self, response_payload: dict) -> dict | None:
        run_payload = response_payload.get("run")
        return run_payload if isinstance(run_payload, dict) else None
