from __future__ import annotations

from app.services.plugin_runtime_registry import PluginRegistry
from app.services.plugin_runtime_types import (
    CompatibilityAdapterRegistration,
    PluginCallRequest,
    PluginExecutionDispatchPlan,
)
from app.services.runtime_execution_policy import default_execution_class_for_tool_ecosystem


class PluginExecutionDispatchPlanner:
    def __init__(self, registry: PluginRegistry) -> None:
        self._registry = registry

    def describe(
        self,
        request: PluginCallRequest,
        *,
        adapter: CompatibilityAdapterRegistration | None = None,
    ) -> PluginExecutionDispatchPlan:
        requested_execution = dict(request.execution or {})
        default_execution_class = default_execution_class_for_tool_ecosystem(request.ecosystem)
        requested_execution_class = str(
            requested_execution.get("class") or default_execution_class
        ).strip().lower() or default_execution_class
        execution_source = str(requested_execution.get("source") or "default").strip() or "default"
        requested_execution_profile = self._normalize_optional_string(
            requested_execution.get("profile")
        )
        requested_execution_timeout_ms = requested_execution.get("timeoutMs")
        requested_network_policy = self._normalize_optional_string(
            requested_execution.get("networkPolicy")
        )
        requested_filesystem_policy = self._normalize_optional_string(
            requested_execution.get("filesystemPolicy")
        )

        if request.ecosystem == "native":
            effective_execution_class = "inline"
            fallback_reason = None
            if requested_execution_class != effective_execution_class:
                fallback_reason = "native_tools_currently_inline_only"
            return PluginExecutionDispatchPlan(
                requested_execution_class=requested_execution_class,
                effective_execution_class=effective_execution_class,
                execution_source=execution_source,
                requested_execution_profile=requested_execution_profile,
                requested_execution_timeout_ms=(
                    requested_execution_timeout_ms
                    if isinstance(requested_execution_timeout_ms, int)
                    else None
                ),
                requested_network_policy=requested_network_policy,
                requested_filesystem_policy=requested_filesystem_policy,
                executor_ref="tool:native-inline",
                effective_execution=self._build_effective_execution_payload(
                    requested_execution=requested_execution,
                    effective_execution_class=effective_execution_class,
                    execution_source=execution_source,
                ),
                fallback_reason=fallback_reason,
            )

        resolved_adapter = adapter or self._registry.resolve_adapter(
            ecosystem=request.ecosystem,
            adapter_id=request.adapter_id,
        )
        supported_execution_classes = resolved_adapter.supported_execution_classes or (
            "subprocess",
        )
        effective_execution_class = (
            requested_execution_class
            if requested_execution_class in supported_execution_classes
            else supported_execution_classes[0]
        )
        fallback_reason = None
        if requested_execution_class != effective_execution_class:
            fallback_reason = "compat_adapter_execution_class_not_supported"
        return PluginExecutionDispatchPlan(
            requested_execution_class=requested_execution_class,
            effective_execution_class=effective_execution_class,
            execution_source=execution_source,
            requested_execution_profile=requested_execution_profile,
            requested_execution_timeout_ms=(
                requested_execution_timeout_ms
                if isinstance(requested_execution_timeout_ms, int)
                else None
            ),
            requested_network_policy=requested_network_policy,
            requested_filesystem_policy=requested_filesystem_policy,
            executor_ref=f"tool:compat-adapter:{resolved_adapter.id}",
            effective_execution=self._build_effective_execution_payload(
                requested_execution=requested_execution,
                effective_execution_class=effective_execution_class,
                execution_source=execution_source,
            ),
            fallback_reason=fallback_reason,
        )

    @staticmethod
    def _normalize_optional_string(value: object) -> str | None:
        if isinstance(value, str):
            return str(value)
        return None

    @staticmethod
    def _build_effective_execution_payload(
        *,
        requested_execution: dict[str, object],
        effective_execution_class: str,
        execution_source: str,
    ) -> dict[str, object]:
        if not requested_execution:
            return {}

        effective_execution = dict(requested_execution)
        effective_execution["class"] = effective_execution_class
        effective_execution["source"] = execution_source
        return effective_execution
