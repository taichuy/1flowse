from __future__ import annotations

from copy import deepcopy
from typing import Callable

from app.models.workflow import Workflow
from app.models.workspace_starter import WorkspaceStarterTemplateRecord
from app.schemas.workspace_starter import (
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

    rebase_fields: list[str] = []
    if (
        record.created_from_workflow_version != workflow.version
        or template_definition != source_definition
    ):
        rebase_fields.extend(["definition", "created_from_workflow_version"])
    if record.default_workflow_name != workflow.name:
        rebase_fields.append("default_workflow_name")

    return WorkspaceStarterSourceDiff(
        template_id=record.id,
        workspace_id=record.workspace_id,
        source_workflow_id=workflow.id,
        source_workflow_name=workflow.name,
        template_version=record.created_from_workflow_version,
        source_version=workflow.version,
        template_default_workflow_name=record.default_workflow_name,
        source_default_workflow_name=workflow.name,
        workflow_name_changed=record.default_workflow_name != workflow.name,
        changed=bool(node_entries or edge_entries or rebase_fields),
        rebase_fields=rebase_fields,
        node_summary=_build_diff_summary(
            template_items=template_definition.get("nodes"),
            source_items=source_definition.get("nodes"),
            entries=node_entries,
        ),
        edge_summary=_build_diff_summary(
            template_items=template_definition.get("edges"),
            source_items=source_definition.get("edges"),
            entries=edge_entries,
        ),
        node_entries=node_entries,
        edge_entries=edge_entries,
    )


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
