from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any

_LEGACY_NODE_TYPE_RENAMES = {
    "trigger": "startNode",
    "output": "endNode",
}

_LEGACY_NODE_ID_RENAMES = {
    "trigger": "startNode",
    "output": "endNode",
}

_LEGACY_EDGE_ID_RENAMES = {
    "edge_trigger_output": "edge_startNode_endNode",
}

_LEGACY_NODE_NAME_RENAMES = {
    ("trigger", "Trigger"): "startNode",
    ("trigger", "trigger"): "startNode",
    ("output", "Output"): "endNode",
    ("output", "output"): "endNode",
}


@dataclass(frozen=True)
class WorkflowPayloadRepairResult:
    payload: dict[str, Any] | None
    changed: bool


def repair_workflow_definition_payload(
    payload: dict[str, Any] | None,
) -> WorkflowPayloadRepairResult:
    if not isinstance(payload, dict):
        return WorkflowPayloadRepairResult(payload=None, changed=False)

    normalized = deepcopy(payload)
    changed = False
    node_id_renames: dict[str, str] = {}

    nodes = normalized.get("nodes")
    if isinstance(nodes, list):
        for node in nodes:
            if not isinstance(node, dict):
                continue
            changed |= _repair_definition_node(node, node_id_renames)

    if node_id_renames:
        changed |= _repair_definition_node_references(normalized, node_id_renames)

    return WorkflowPayloadRepairResult(payload=normalized, changed=changed)


def repair_compiled_blueprint_payload(
    payload: dict[str, Any] | None,
) -> WorkflowPayloadRepairResult:
    if not isinstance(payload, dict):
        return WorkflowPayloadRepairResult(payload=None, changed=False)

    normalized = deepcopy(payload)
    changed = False
    node_id_renames: dict[str, str] = {}

    ordered_nodes = normalized.get("ordered_nodes")
    if isinstance(ordered_nodes, list):
        for node in ordered_nodes:
            if not isinstance(node, dict):
                continue
            changed |= _repair_compiled_node(node, node_id_renames)

    if node_id_renames:
        trigger_node_id = normalized.get("trigger_node_id")
        next_trigger_node_id = node_id_renames.get(trigger_node_id)
        if isinstance(next_trigger_node_id, str):
            normalized["trigger_node_id"] = next_trigger_node_id
            changed = True

        output_node_ids = normalized.get("output_node_ids")
        if isinstance(output_node_ids, list):
            next_output_node_ids = []
            for node_id in output_node_ids:
                next_output_node_ids.append(node_id_renames.get(node_id, node_id))
            if next_output_node_ids != output_node_ids:
                normalized["output_node_ids"] = next_output_node_ids
                changed = True

        incoming_nodes = normalized.get("incoming_nodes")
        if isinstance(incoming_nodes, dict):
            next_incoming_nodes: dict[str, list[str]] = {}
            for node_id, source_ids in incoming_nodes.items():
                next_node_id = node_id_renames.get(node_id, node_id)
                next_source_ids = [
                    node_id_renames.get(source_id, source_id)
                    for source_id in (source_ids if isinstance(source_ids, list) else [])
                ]
                next_incoming_nodes[next_node_id] = next_source_ids
            if next_incoming_nodes != incoming_nodes:
                normalized["incoming_nodes"] = next_incoming_nodes
                changed = True

        outgoing_edges = normalized.get("outgoing_edges")
        if isinstance(outgoing_edges, dict):
            next_outgoing_edges: dict[str, list[dict[str, Any]]] = {}
            for node_id, edges in outgoing_edges.items():
                next_node_id = node_id_renames.get(node_id, node_id)
                next_edges: list[dict[str, Any]] = []
                for edge in edges if isinstance(edges, list) else []:
                    if not isinstance(edge, dict):
                        continue
                    next_edge = dict(edge)
                    changed |= _replace_mapping_string(
                        next_edge,
                        "source_node_id",
                        node_id_renames,
                    )
                    changed |= _replace_mapping_string(
                        next_edge,
                        "target_node_id",
                        node_id_renames,
                    )
                    changed |= _replace_mapping_string(
                        next_edge,
                        "id",
                        _LEGACY_EDGE_ID_RENAMES,
                    )
                    next_edges.append(next_edge)
                next_outgoing_edges[next_node_id] = next_edges
            if next_outgoing_edges != outgoing_edges:
                normalized["outgoing_edges"] = next_outgoing_edges
                changed = True

    return WorkflowPayloadRepairResult(payload=normalized, changed=changed)


def _repair_definition_node(node: dict[str, Any], node_id_renames: dict[str, str]) -> bool:
    changed = False
    raw_type = node.get("type")
    raw_id = node.get("id")

    if isinstance(raw_type, str):
        next_type = _LEGACY_NODE_TYPE_RENAMES.get(raw_type)
        if isinstance(next_type, str) and next_type != raw_type:
            node["type"] = next_type
            changed = True

    if isinstance(raw_id, str):
        next_id = _LEGACY_NODE_ID_RENAMES.get(raw_id)
        if isinstance(next_id, str) and next_id != raw_id:
            node["id"] = next_id
            node_id_renames[raw_id] = next_id
            changed = True

    raw_name = node.get("name")
    if isinstance(raw_type, str) and isinstance(raw_name, str):
        next_name = _LEGACY_NODE_NAME_RENAMES.get((raw_type, raw_name))
        if isinstance(next_name, str) and next_name != raw_name:
            node["name"] = next_name
            changed = True

    return changed


def _repair_compiled_node(node: dict[str, Any], node_id_renames: dict[str, str]) -> bool:
    changed = False
    raw_type = node.get("type")
    raw_id = node.get("id")

    if isinstance(raw_type, str):
        next_type = _LEGACY_NODE_TYPE_RENAMES.get(raw_type)
        if isinstance(next_type, str) and next_type != raw_type:
            node["type"] = next_type
            changed = True

    if isinstance(raw_id, str):
        next_id = _LEGACY_NODE_ID_RENAMES.get(raw_id)
        if isinstance(next_id, str) and next_id != raw_id:
            node["id"] = next_id
            node_id_renames[raw_id] = next_id
            changed = True

    raw_name = node.get("name")
    if isinstance(raw_type, str) and isinstance(raw_name, str):
        next_name = _LEGACY_NODE_NAME_RENAMES.get((raw_type, raw_name))
        if isinstance(next_name, str) and next_name != raw_name:
            node["name"] = next_name
            changed = True

    return changed


def _repair_definition_node_references(
    payload: dict[str, Any],
    node_id_renames: dict[str, str],
) -> bool:
    changed = False

    edges = payload.get("edges")
    if isinstance(edges, list):
        for edge in edges:
            if not isinstance(edge, dict):
                continue
            changed |= _replace_mapping_string(edge, "sourceNodeId", node_id_renames)
            changed |= _replace_mapping_string(edge, "targetNodeId", node_id_renames)
            changed |= _replace_mapping_string(edge, "id", _LEGACY_EDGE_ID_RENAMES)

    nodes = payload.get("nodes")
    if isinstance(nodes, list):
        for node in nodes:
            if not isinstance(node, dict):
                continue
            config = node.get("config")
            if isinstance(config, dict):
                changed |= _repair_node_config_references(config, node_id_renames)
            runtime_policy = node.get("runtimePolicy")
            if isinstance(runtime_policy, dict):
                changed |= _repair_runtime_policy_references(runtime_policy, node_id_renames)

    return changed


def _repair_node_config_references(
    config: dict[str, Any],
    node_id_renames: dict[str, str],
) -> bool:
    changed = False

    context_access = config.get("contextAccess")
    if isinstance(context_access, dict):
        readable_node_ids = context_access.get("readableNodeIds")
        if isinstance(readable_node_ids, list):
            next_readable_node_ids = [
                node_id_renames.get(node_id, node_id) for node_id in readable_node_ids
            ]
            if next_readable_node_ids != readable_node_ids:
                context_access["readableNodeIds"] = next_readable_node_ids
                changed = True

        readable_artifacts = context_access.get("readableArtifacts")
        if isinstance(readable_artifacts, list):
            for artifact in readable_artifacts:
                if not isinstance(artifact, dict):
                    continue
                changed |= _replace_mapping_string(artifact, "nodeId", node_id_renames)

    reference = config.get("reference")
    if isinstance(reference, dict):
        changed |= _replace_mapping_string(reference, "sourceNodeId", node_id_renames)

    query = config.get("query")
    if isinstance(query, dict):
        source_node_ids = query.get("sourceNodeIds")
        if isinstance(source_node_ids, list):
            next_source_node_ids = [
                node_id_renames.get(node_id, node_id) for node_id in source_node_ids
            ]
            if next_source_node_ids != source_node_ids:
                query["sourceNodeIds"] = next_source_node_ids
                changed = True

    return changed


def _repair_runtime_policy_references(
    runtime_policy: dict[str, Any],
    node_id_renames: dict[str, str],
) -> bool:
    join = runtime_policy.get("join")
    if not isinstance(join, dict):
        return False

    required_node_ids = join.get("requiredNodeIds")
    if not isinstance(required_node_ids, list):
        return False

    next_required_node_ids = [
        node_id_renames.get(node_id, node_id) for node_id in required_node_ids
    ]
    if next_required_node_ids == required_node_ids:
        return False

    join["requiredNodeIds"] = next_required_node_ids
    return True


def _replace_mapping_string(
    payload: dict[str, Any],
    key: str,
    replacements: dict[str, str],
) -> bool:
    value = payload.get(key)
    if not isinstance(value, str):
        return False

    next_value = replacements.get(value)
    if not isinstance(next_value, str) or next_value == value:
        return False

    payload[key] = next_value
    return True
