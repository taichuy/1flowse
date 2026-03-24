from __future__ import annotations

from copy import deepcopy
from typing import Any, Callable

from app.models.workflow import Workflow
from app.models.workspace_starter import WorkspaceStarterTemplateRecord
from app.schemas.workspace_starter import (
    WorkspaceStarterSourceActionDecision,
    WorkspaceStarterSourceDiff,
    WorkspaceStarterSourceDiffEntry,
    WorkspaceStarterSourceDiffSummary,
)
from app.services.workflow_definitions import validate_workflow_definition


def build_workspace_starter_source_diff(
    record: WorkspaceStarterTemplateRecord,
    workflow: Workflow,
) -> WorkspaceStarterSourceDiff:
    template_definition = deepcopy(record.definition or {})
    source_definition = validate_workflow_definition(workflow.definition)

    node_entries = _build_diff_entries(
        template_items=template_definition.get("nodes"),
        source_items=source_definition.get("nodes"),
        label_builder=_build_node_label,
    )
    edge_entries = _build_diff_entries(
        template_items=template_definition.get("edges"),
        source_items=source_definition.get("edges"),
        label_builder=_build_edge_label,
    )
    sandbox_dependency_entries = _build_sandbox_dependency_entries(
        template_items=template_definition.get("nodes"),
        source_items=source_definition.get("nodes"),
    )

    rebase_fields: list[str] = []
    if (
        record.created_from_workflow_version != workflow.version
        or template_definition != source_definition
    ):
        rebase_fields.extend(["definition", "created_from_workflow_version"])
    if record.default_workflow_name != workflow.name:
        rebase_fields.append("default_workflow_name")

    node_summary = _build_diff_summary(
        template_items=template_definition.get("nodes"),
        source_items=source_definition.get("nodes"),
        entries=node_entries,
    )
    edge_summary = _build_diff_summary(
        template_items=template_definition.get("edges"),
        source_items=source_definition.get("edges"),
        entries=edge_entries,
    )
    sandbox_dependency_summary = _build_sandbox_dependency_summary(
        template_items=template_definition.get("nodes"),
        source_items=source_definition.get("nodes"),
        entries=sandbox_dependency_entries,
    )
    workflow_name_changed = record.default_workflow_name != workflow.name
    changed = bool(
        node_entries
        or edge_entries
        or sandbox_dependency_entries
        or rebase_fields
    )
    action_decision = _build_source_action_decision(
        template_version=record.created_from_workflow_version,
        source_version=workflow.version,
        workflow_name_changed=workflow_name_changed,
        changed=changed,
        rebase_fields=rebase_fields,
        node_summary=node_summary,
        edge_summary=edge_summary,
        sandbox_dependency_summary=sandbox_dependency_summary,
    )

    return WorkspaceStarterSourceDiff(
        template_id=record.id,
        workspace_id=record.workspace_id,
        source_workflow_id=workflow.id,
        source_workflow_name=workflow.name,
        template_version=record.created_from_workflow_version,
        source_version=workflow.version,
        template_default_workflow_name=record.default_workflow_name,
        source_default_workflow_name=workflow.name,
        workflow_name_changed=workflow_name_changed,
        changed=changed,
        rebase_fields=rebase_fields,
        node_summary=node_summary,
        edge_summary=edge_summary,
        sandbox_dependency_summary=sandbox_dependency_summary,
        node_entries=node_entries,
        edge_entries=edge_entries,
        sandbox_dependency_entries=sandbox_dependency_entries,
        action_decision=action_decision,
    )


def _build_source_action_decision(
    *,
    template_version: str | None,
    source_version: str,
    workflow_name_changed: bool,
    changed: bool,
    rebase_fields: list[str],
    node_summary: WorkspaceStarterSourceDiffSummary,
    edge_summary: WorkspaceStarterSourceDiffSummary,
    sandbox_dependency_summary: WorkspaceStarterSourceDiffSummary,
) -> WorkspaceStarterSourceActionDecision:
    fact_chips = _build_source_action_fact_chips(
        template_version=template_version,
        source_version=source_version,
        workflow_name_changed=workflow_name_changed,
        rebase_fields=rebase_fields,
        node_summary=node_summary,
        edge_summary=edge_summary,
        sandbox_dependency_summary=sandbox_dependency_summary,
    )

    if not changed:
        return WorkspaceStarterSourceActionDecision(
            recommended_action="none",
            status_label="已对齐",
            summary="当前模板快照和来源 workflow 已对齐，无需 refresh 或 rebase。",
            can_refresh=False,
            can_rebase=False,
            fact_chips=fact_chips,
        )

    structure_drift_count = _count_summary_changes(node_summary) + _count_summary_changes(
        edge_summary
    )
    sandbox_drift_count = _count_summary_changes(sandbox_dependency_summary)
    has_snapshot_drift = (
        structure_drift_count > 0
        or sandbox_drift_count > 0
        or "definition" in rebase_fields
        or "created_from_workflow_version" in rebase_fields
    )
    name_drift_only = workflow_name_changed and not has_snapshot_drift

    if name_drift_only:
        return WorkspaceStarterSourceActionDecision(
            recommended_action="rebase",
            status_label="建议 rebase",
            summary=(
                "当前只漂移默认 workflow 名称；refresh 不会改名，如需让 starter 命名"
                "跟随来源，请执行 rebase。"
            ),
            can_refresh=False,
            can_rebase=True,
            fact_chips=fact_chips,
        )

    if workflow_name_changed:
        return WorkspaceStarterSourceActionDecision(
            recommended_action="rebase",
            status_label="建议 rebase",
            summary=(
                (
                    "当前 drift 同时影响 starter 快照、sandbox 依赖治理和默认 workflow 名称。"
                    "若希望模板命名与来源一起对齐，优先执行 rebase；如果只想先同步 "
                    "definition / version 并保留当前模板名称，可先 refresh。"
                )
                if sandbox_drift_count > 0
                else (
                    "当前 drift 同时影响 starter 快照和默认 workflow 名称。若希望"
                    "模板命名与来源一起对齐，优先执行 rebase；如果只想先同步 "
                    "definition / version 并保留当前模板名称，可先 refresh。"
                )
            ),
            can_refresh=has_snapshot_drift,
            can_rebase=True,
            fact_chips=fact_chips,
        )

    if sandbox_drift_count > 0:
        return WorkspaceStarterSourceActionDecision(
            recommended_action="refresh",
            status_label="建议 refresh",
            summary=(
                (
                    "当前 drift 已落在 starter 快照本身，并涉及 sandbox 依赖治理。"
                    "优先 refresh 同步最新 definition / version；若后续还要让默认 "
                    "workflow 名称跟随来源，再执行 rebase。"
                )
                if structure_drift_count > 0
                else (
                    "当前主要是 sandbox 依赖治理漂移。优先 refresh 同步最新 "
                    "definition / version，并重点复核 dependencyMode、"
                    "builtinPackageSet、dependencyRef 与 backendExtensions。"
                )
            ),
            can_refresh=True,
            can_rebase=True,
            fact_chips=fact_chips,
        )

    if has_snapshot_drift:
        return WorkspaceStarterSourceActionDecision(
            recommended_action="refresh",
            status_label="建议 refresh",
            summary=(
                "当前主要是来源快照漂移。优先 refresh 同步最新 definition / version；"
                "rebase 只在需要连默认 workflow 名称一起对齐时才有额外价值。"
            ),
            can_refresh=True,
            can_rebase=True,
            fact_chips=fact_chips,
        )

    return WorkspaceStarterSourceActionDecision(
        recommended_action="rebase",
        status_label="建议 rebase",
        summary="当前存在来源漂移，建议先检查变更字段；若需要让模板命名跟随来源，请执行 rebase。",
        can_refresh=False,
        can_rebase=True,
        fact_chips=fact_chips,
    )


def _build_source_action_fact_chips(
    *,
    template_version: str | None,
    source_version: str,
    workflow_name_changed: bool,
    rebase_fields: list[str],
    node_summary: WorkspaceStarterSourceDiffSummary,
    edge_summary: WorkspaceStarterSourceDiffSummary,
    sandbox_dependency_summary: WorkspaceStarterSourceDiffSummary,
) -> list[str]:
    chips: list[str] = []
    structure_drift_count = _count_summary_changes(node_summary) + _count_summary_changes(
        edge_summary
    )
    sandbox_drift_count = _count_summary_changes(sandbox_dependency_summary)

    if template_version:
        chips.append(f"template {template_version}")
    chips.append(f"source {source_version}")
    if structure_drift_count > 0:
        chips.append(f"structure drift {structure_drift_count}")
    if sandbox_drift_count > 0:
        chips.append(f"sandbox drift {sandbox_drift_count}")
    if workflow_name_changed:
        chips.append("name drift")
    if rebase_fields:
        chips.append(f"rebase {len(rebase_fields)}")

    return chips


def _count_summary_changes(summary: WorkspaceStarterSourceDiffSummary) -> int:
    return summary.added_count + summary.removed_count + summary.changed_count


def _build_diff_entries(
    *,
    template_items: object,
    source_items: object,
    label_builder: Callable[[dict], str],
) -> list[WorkspaceStarterSourceDiffEntry]:
    template_map = _index_items(template_items)
    source_map = _index_items(source_items)

    entries: list[WorkspaceStarterSourceDiffEntry] = []
    item_ids = sorted(set(template_map) | set(source_map))
    for item_id in item_ids:
        if item_id not in template_map:
            entries.append(
                WorkspaceStarterSourceDiffEntry(
                    id=item_id,
                    label=label_builder(source_map[item_id]),
                    status="added",
                )
            )
            continue

        if item_id not in source_map:
            entries.append(
                WorkspaceStarterSourceDiffEntry(
                    id=item_id,
                    label=label_builder(template_map[item_id]),
                    status="removed",
                )
            )
            continue

        if template_map[item_id] != source_map[item_id]:
            entries.append(
                WorkspaceStarterSourceDiffEntry(
                    id=item_id,
                    label=label_builder(source_map[item_id]),
                    status="changed",
                    changed_fields=_collect_changed_fields(
                        template_map[item_id],
                        source_map[item_id],
                    ),
                )
            )

    return entries


def _build_diff_summary(
    *,
    template_items: object,
    source_items: object,
    entries: list[WorkspaceStarterSourceDiffEntry],
) -> WorkspaceStarterSourceDiffSummary:
    return WorkspaceStarterSourceDiffSummary(
        template_count=len(_index_items(template_items)),
        source_count=len(_index_items(source_items)),
        added_count=sum(1 for entry in entries if entry.status == "added"),
        removed_count=sum(1 for entry in entries if entry.status == "removed"),
        changed_count=sum(1 for entry in entries if entry.status == "changed"),
    )


def _build_sandbox_dependency_entries(
    *,
    template_items: object,
    source_items: object,
) -> list[WorkspaceStarterSourceDiffEntry]:
    template_map = _index_sandbox_nodes(template_items)
    source_map = _index_sandbox_nodes(source_items)

    entries: list[WorkspaceStarterSourceDiffEntry] = []
    item_ids = sorted(set(template_map) | set(source_map))
    for item_id in item_ids:
        template_node = template_map.get(item_id)
        source_node = source_map.get(item_id)
        if template_node is None and source_node is not None:
            entries.append(
                WorkspaceStarterSourceDiffEntry(
                    id=item_id,
                    label=source_node["label"],
                    status="added",
                    source_facts=_build_sandbox_fact_chips(source_node),
                )
            )
            continue

        if source_node is None and template_node is not None:
            entries.append(
                WorkspaceStarterSourceDiffEntry(
                    id=item_id,
                    label=template_node["label"],
                    status="removed",
                    template_facts=_build_sandbox_fact_chips(template_node),
                )
            )
            continue

        if template_node is None or source_node is None:
            continue

        template_payload = template_node["comparison_payload"]
        source_payload = source_node["comparison_payload"]
        if template_payload != source_payload:
            entries.append(
                WorkspaceStarterSourceDiffEntry(
                    id=item_id,
                    label=source_node["label"],
                    status="changed",
                    changed_fields=_collect_changed_fields(template_payload, source_payload),
                    template_facts=_build_sandbox_fact_chips(template_node),
                    source_facts=_build_sandbox_fact_chips(source_node),
                )
            )

    return entries


def _build_sandbox_dependency_summary(
    *,
    template_items: object,
    source_items: object,
    entries: list[WorkspaceStarterSourceDiffEntry],
) -> WorkspaceStarterSourceDiffSummary:
    template_count = len(_index_sandbox_nodes(template_items))
    source_count = len(_index_sandbox_nodes(source_items))
    return WorkspaceStarterSourceDiffSummary(
        template_count=template_count,
        source_count=source_count,
        added_count=sum(1 for entry in entries if entry.status == "added"),
        removed_count=sum(1 for entry in entries if entry.status == "removed"),
        changed_count=sum(1 for entry in entries if entry.status == "changed"),
    )


def _index_items(value: object) -> dict[str, dict]:
    if not isinstance(value, list):
        return {}

    indexed: dict[str, dict] = {}
    for item in value:
        if not isinstance(item, dict):
            continue
        item_id = item.get("id")
        if isinstance(item_id, str) and item_id.strip():
            indexed[item_id] = deepcopy(item)
    return indexed


def _build_node_label(item: dict) -> str:
    item_id = str(item.get("id", "unknown"))
    node_name = str(item.get("name", item_id))
    node_type = str(item.get("type", "node"))
    return f"{node_name} ({node_type})"


def _build_edge_label(item: dict) -> str:
    source_node_id = str(item.get("sourceNodeId", "?"))
    target_node_id = str(item.get("targetNodeId", "?"))
    condition = item.get("condition")
    if isinstance(condition, str) and condition.strip():
        return f"{source_node_id} -> {target_node_id} [{condition.strip()}]"
    return f"{source_node_id} -> {target_node_id}"


def _index_sandbox_nodes(value: object) -> dict[str, dict[str, Any]]:
    if not isinstance(value, list):
        return {}

    indexed: dict[str, dict[str, Any]] = {}
    for item in value:
        if not isinstance(item, dict) or item.get("type") != "sandbox_code":
            continue
        item_id = _normalize_text(item.get("id"))
        if item_id is None:
            continue

        label = _normalize_text(item.get("name")) or item_id
        runtime_policy = item.get("runtimePolicy") if isinstance(item.get("runtimePolicy"), dict) else {}
        execution = runtime_policy.get("execution") if isinstance(runtime_policy.get("execution"), dict) else {}
        dependency_mode = _normalize_text(execution.get("dependencyMode"))

        comparison_payload = {
            "executionClass": _normalize_text(execution.get("class")) or "sandbox",
            "dependencyMode": dependency_mode,
            "builtinPackageSet": (
                _normalize_text(execution.get("builtinPackageSet"))
                if dependency_mode == "builtin"
                else None
            ),
            "dependencyRef": (
                _normalize_text(execution.get("dependencyRef"))
                if dependency_mode == "dependency_ref"
                else None
            ),
            "backendExtensions": _normalize_backend_extension_keys(
                execution.get("backendExtensions")
            ),
        }
        indexed[item_id] = {
            "id": item_id,
            "label": f"{label} (sandbox_code)",
            "comparison_payload": comparison_payload,
        }

    return indexed


def _build_sandbox_fact_chips(item: dict[str, Any]) -> list[str]:
    payload = item["comparison_payload"]
    facts = [f"execution = {payload['executionClass']}"]
    if payload["dependencyMode"] is not None:
        facts.append(f"dependencyMode = {payload['dependencyMode']}")
    if payload["builtinPackageSet"] is not None:
        facts.append(f"builtinPackageSet = {payload['builtinPackageSet']}")
    if payload["dependencyRef"] is not None:
        facts.append(f"dependencyRef = {payload['dependencyRef']}")
    if payload["backendExtensions"]:
        facts.append(
            "backendExtensions = " + ", ".join(payload["backendExtensions"])
        )
    return facts


def _normalize_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_backend_extension_keys(value: object) -> list[str]:
    if not isinstance(value, dict):
        return []
    return sorted(
        key.strip() for key in value if isinstance(key, str) and key.strip()
    )


def _collect_changed_fields(
    template_item: object,
    source_item: object,
) -> list[str]:
    changed_fields: list[str] = []
    _append_changed_fields(
        changed_fields,
        path="",
        template_value=template_item,
        source_value=source_item,
    )
    return changed_fields


def _append_changed_fields(
    changed_fields: list[str],
    *,
    path: str,
    template_value: object,
    source_value: object,
) -> None:
    if template_value == source_value:
        return

    if isinstance(template_value, dict) and isinstance(source_value, dict):
        keys = sorted(set(template_value) | set(source_value))
        for key in keys:
            next_path = f"{path}.{key}" if path else str(key)
            if key not in template_value or key not in source_value:
                changed_fields.append(next_path)
                continue
            _append_changed_fields(
                changed_fields,
                path=next_path,
                template_value=template_value[key],
                source_value=source_value[key],
            )
        return

    if isinstance(template_value, list) and isinstance(source_value, list):
        if len(template_value) != len(source_value):
            changed_fields.append(path or "items")
            return

        for index, (template_item, source_item) in enumerate(
            zip(template_value, source_value, strict=False)
        ):
            _append_changed_fields(
                changed_fields,
                path=f"{path}[{index}]" if path else f"[{index}]",
                template_value=template_item,
                source_value=source_item,
            )
        return

    changed_fields.append(path or "value")
