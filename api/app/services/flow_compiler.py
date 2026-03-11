from __future__ import annotations

from collections import defaultdict, deque
from typing import Any

from app.models.workflow import Workflow, WorkflowVersion
from app.schemas.workflow import WorkflowDefinitionDocument
from app.services.runtime_types import CompiledEdge, CompiledNode, CompiledWorkflowBlueprint


class FlowCompiler:
    def compile_workflow(self, workflow: Workflow) -> CompiledWorkflowBlueprint:
        return self.compile_definition(
            workflow_id=workflow.id,
            workflow_version=workflow.version,
            definition=workflow.definition or {},
        )

    def compile_workflow_version(
        self,
        workflow_version: WorkflowVersion,
    ) -> CompiledWorkflowBlueprint:
        return self.compile_definition(
            workflow_id=workflow_version.workflow_id,
            workflow_version=workflow_version.version,
            definition=workflow_version.definition or {},
        )

    def compile_definition(
        self,
        *,
        workflow_id: str,
        workflow_version: str,
        definition: dict[str, Any],
    ) -> CompiledWorkflowBlueprint:
        document = WorkflowDefinitionDocument.model_validate(definition)
        normalized = document.model_dump(mode="python", exclude_none=True)
        ordered_nodes = self._topological_nodes(
            normalized.get("nodes", []),
            normalized.get("edges", []),
        )
        node_lookup = {
            node["id"]: CompiledNode(
                id=node["id"],
                type=node["type"],
                name=node["name"],
                config=dict(node.get("config") or {}),
                runtime_policy=dict(node.get("runtimePolicy") or {}),
                input_schema=(
                    dict(node["inputSchema"])
                    if isinstance(node.get("inputSchema"), dict)
                    else None
                ),
                output_schema=(
                    dict(node["outputSchema"])
                    if isinstance(node.get("outputSchema"), dict)
                    else None
                ),
            )
            for node in ordered_nodes
        }

        compiled_edges = [
            CompiledEdge(
                id=edge["id"],
                source_node_id=edge["sourceNodeId"],
                target_node_id=edge["targetNodeId"],
                channel=edge.get("channel", "control"),
                condition=edge.get("condition"),
                condition_expression=edge.get("conditionExpression"),
                mapping=tuple(dict(item) for item in (edge.get("mapping") or [])),
            )
            for edge in normalized.get("edges", [])
        ]
        incoming_nodes: dict[str, tuple[str, ...]] = defaultdict(tuple)
        outgoing_edges: dict[str, list[CompiledEdge]] = defaultdict(list)
        incoming_builder: dict[str, list[str]] = defaultdict(list)
        for edge in compiled_edges:
            incoming_builder[edge.target_node_id].append(edge.source_node_id)
            outgoing_edges[edge.source_node_id].append(edge)

        for node_id, source_ids in incoming_builder.items():
            incoming_nodes[node_id] = tuple(source_ids)

        workflow_variables = {
            str(variable["name"]): variable.get("default")
            for variable in normalized.get("variables", [])
            if str(variable.get("name", "")).strip()
        }
        trigger_node_id = next(
            node_id for node_id, node in node_lookup.items() if node.type == "trigger"
        )
        output_node_ids = tuple(
            node_id for node_id, node in node_lookup.items() if node.type == "output"
        )

        return CompiledWorkflowBlueprint(
            workflow_id=workflow_id,
            workflow_version=workflow_version,
            trigger_node_id=trigger_node_id,
            output_node_ids=output_node_ids,
            workflow_variables=workflow_variables,
            ordered_nodes=tuple(node_lookup[node["id"]] for node in ordered_nodes),
            node_lookup=node_lookup,
            incoming_nodes=dict(incoming_nodes),
            outgoing_edges={
                node_id: tuple(edges)
                for node_id, edges in outgoing_edges.items()
            },
        )

    def dump_blueprint(self, blueprint: CompiledWorkflowBlueprint) -> dict[str, Any]:
        return {
            "workflow_id": blueprint.workflow_id,
            "workflow_version": blueprint.workflow_version,
            "trigger_node_id": blueprint.trigger_node_id,
            "output_node_ids": list(blueprint.output_node_ids),
            "workflow_variables": dict(blueprint.workflow_variables),
            "ordered_nodes": [
                {
                    "id": node.id,
                    "type": node.type,
                    "name": node.name,
                    "config": dict(node.config),
                    "runtime_policy": dict(node.runtime_policy),
                    "input_schema": (
                        dict(node.input_schema) if node.input_schema is not None else None
                    ),
                    "output_schema": (
                        dict(node.output_schema) if node.output_schema is not None else None
                    ),
                }
                for node in blueprint.ordered_nodes
            ],
            "incoming_nodes": {
                node_id: list(source_ids)
                for node_id, source_ids in blueprint.incoming_nodes.items()
            },
            "outgoing_edges": {
                node_id: [
                    {
                        "id": edge.id,
                        "source_node_id": edge.source_node_id,
                        "target_node_id": edge.target_node_id,
                        "channel": edge.channel,
                        "condition": edge.condition,
                        "condition_expression": edge.condition_expression,
                        "mapping": [dict(item) for item in edge.mapping],
                    }
                    for edge in edges
                ]
                for node_id, edges in blueprint.outgoing_edges.items()
            },
        }

    def load_blueprint(self, payload: dict[str, Any]) -> CompiledWorkflowBlueprint:
        ordered_nodes = tuple(
            CompiledNode(
                id=str(node["id"]),
                type=str(node["type"]),
                name=str(node["name"]),
                config=dict(node.get("config") or {}),
                runtime_policy=dict(node.get("runtime_policy") or {}),
                input_schema=(
                    dict(node["input_schema"])
                    if isinstance(node.get("input_schema"), dict)
                    else None
                ),
                output_schema=(
                    dict(node["output_schema"])
                    if isinstance(node.get("output_schema"), dict)
                    else None
                ),
            )
            for node in (payload.get("ordered_nodes") or [])
        )
        node_lookup = {node.id: node for node in ordered_nodes}
        outgoing_edges = {
            str(node_id): tuple(
                CompiledEdge(
                    id=str(edge["id"]),
                    source_node_id=str(edge["source_node_id"]),
                    target_node_id=str(edge["target_node_id"]),
                    channel=str(edge.get("channel") or "control"),
                    condition=edge.get("condition"),
                    condition_expression=edge.get("condition_expression"),
                    mapping=tuple(
                        dict(item) for item in (edge.get("mapping") or []) if isinstance(item, dict)
                    ),
                )
                for edge in edges
            )
            for node_id, edges in (payload.get("outgoing_edges") or {}).items()
        }
        incoming_nodes = {
            str(node_id): tuple(str(source_id) for source_id in source_ids)
            for node_id, source_ids in (payload.get("incoming_nodes") or {}).items()
        }

        return CompiledWorkflowBlueprint(
            workflow_id=str(payload["workflow_id"]),
            workflow_version=str(payload["workflow_version"]),
            trigger_node_id=str(payload["trigger_node_id"]),
            output_node_ids=tuple(
                str(node_id) for node_id in (payload.get("output_node_ids") or [])
            ),
            workflow_variables={
                str(name): value
                for name, value in (payload.get("workflow_variables") or {}).items()
            },
            ordered_nodes=ordered_nodes,
            node_lookup=node_lookup,
            incoming_nodes=incoming_nodes,
            outgoing_edges=outgoing_edges,
        )

    def _topological_nodes(
        self,
        nodes: list[dict[str, Any]],
        edges: list[dict[str, Any]],
    ) -> list[dict]:
        node_lookup = {node["id"]: node for node in nodes}
        indegree = {node["id"]: 0 for node in nodes}
        adjacency: dict[str, list[str]] = defaultdict(list)

        for edge in edges:
            source = edge.get("sourceNodeId")
            target = edge.get("targetNodeId")
            if source not in node_lookup or target not in node_lookup:
                continue
            adjacency[source].append(target)
            indegree[target] += 1

        queue = deque(node_id for node_id, degree in indegree.items() if degree == 0)
        ordered_ids: list[str] = []

        while queue:
            node_id = queue.popleft()
            ordered_ids.append(node_id)
            for target in adjacency.get(node_id, []):
                indegree[target] -= 1
                if indegree[target] == 0:
                    queue.append(target)

        if len(ordered_ids) != len(nodes):
            raise ValueError(
                "Workflow contains a cycle or disconnected invalid edge configuration."
            )

        return [node_lookup[node_id] for node_id in ordered_ids]
