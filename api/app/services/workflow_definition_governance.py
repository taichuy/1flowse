from __future__ import annotations

from collections.abc import Mapping

from app.schemas.plugin import PluginToolItem
from app.schemas.workflow import WorkflowToolGovernanceSummary

STRONG_ISOLATION_EXECUTION_CLASSES = {"sandbox", "microvm"}


def count_workflow_nodes(definition: dict | None) -> int:
    if not isinstance(definition, dict):
        return 0
    nodes = definition.get("nodes")
    return len(nodes) if isinstance(nodes, list) else 0


def summarize_workflow_definition_tool_governance(
    definition: dict | None,
    *,
    tool_index: Mapping[str, PluginToolItem],
) -> WorkflowToolGovernanceSummary:
    referenced_tool_ids = collect_workflow_definition_tool_ids(definition)
    if not referenced_tool_ids:
        return WorkflowToolGovernanceSummary()

    referenced_tools = [
        tool_index[tool_id] for tool_id in referenced_tool_ids if tool_id in tool_index
    ]
    missing_tool_ids = [tool_id for tool_id in referenced_tool_ids if tool_id not in tool_index]

    return WorkflowToolGovernanceSummary(
        referenced_tool_ids=referenced_tool_ids,
        missing_tool_ids=missing_tool_ids,
        governed_tool_count=sum(1 for tool in referenced_tools if _governed_by_sensitivity(tool)),
        strong_isolation_tool_count=sum(
            1 for tool in referenced_tools if _requires_strong_isolation(tool)
        ),
    )


def collect_workflow_definition_tool_ids(definition: dict | None) -> list[str]:
    if not isinstance(definition, dict):
        return []

    nodes = definition.get("nodes")
    if not isinstance(nodes, list):
        return []

    referenced_tool_ids: list[str] = []
    seen: set[str] = set()

    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_config = node.get("config") if isinstance(node.get("config"), dict) else {}
        tool_config = node_config.get("tool") if isinstance(node_config.get("tool"), dict) else None
        direct_tool_id = (
            tool_config.get("toolId")
            if isinstance(tool_config, dict) and isinstance(tool_config.get("toolId"), str)
            else node_config.get("toolId")
        )
        _push_tool_id(direct_tool_id, referenced_tool_ids, seen)

        tool_policy = (
            node_config.get("toolPolicy")
            if isinstance(node_config.get("toolPolicy"), dict)
            else None
        )
        allowed_tool_ids = (
            tool_policy.get("allowedToolIds")
            if isinstance(tool_policy, dict) and isinstance(tool_policy.get("allowedToolIds"), list)
            else []
        )
        for candidate in allowed_tool_ids:
            _push_tool_id(candidate, referenced_tool_ids, seen)

    return referenced_tool_ids


def _push_tool_id(value: object, referenced_tool_ids: list[str], seen: set[str]) -> None:
    if not isinstance(value, str):
        return
    normalized = value.strip()
    if not normalized or normalized in seen:
        return
    seen.add(normalized)
    referenced_tool_ids.append(normalized)


def _normalize_sensitivity_level(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().upper()
    return normalized if normalized in {"L0", "L1", "L2", "L3"} else None


def _normalize_execution_class(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    return normalized if normalized in {"inline", "subprocess", "sandbox", "microvm"} else None


def _governed_by_sensitivity(tool: PluginToolItem) -> bool:
    sensitivity_level = _normalize_sensitivity_level(tool.sensitivity_level)
    default_execution_class = _normalize_execution_class(tool.default_execution_class)
    return (sensitivity_level == "L2" and default_execution_class == "sandbox") or (
        sensitivity_level == "L3" and default_execution_class == "microvm"
    )


def _requires_strong_isolation(tool: PluginToolItem) -> bool:
    return (
        _normalize_execution_class(tool.default_execution_class)
        in STRONG_ISOLATION_EXECUTION_CLASSES
    )
