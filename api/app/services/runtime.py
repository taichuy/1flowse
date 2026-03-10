from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.run import NodeRun, Run, RunEvent
from app.models.workflow import Workflow

_MISSING = object()


class WorkflowExecutionError(RuntimeError):
    pass


@dataclass
class ExecutionArtifacts:
    run: Run
    node_runs: list[NodeRun]
    events: list[RunEvent]


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 1
    backoff_seconds: float = 0.0
    backoff_multiplier: float = 1.0


@dataclass(frozen=True)
class AuthorizedContextRefs:
    current_node_id: str
    readable_node_ids: tuple[str, ...] = ()
    readable_artifacts: tuple[tuple[str, str], ...] = ()


def _utcnow() -> datetime:
    return datetime.now(UTC)


class RuntimeService:
    def execute_workflow(
        self,
        db: Session,
        workflow: Workflow,
        input_payload: dict,
    ) -> ExecutionArtifacts:
        definition = workflow.definition or {}
        nodes = definition.get("nodes", [])
        edges = definition.get("edges", [])

        if not nodes:
            raise WorkflowExecutionError("Workflow definition has no nodes.")

        if any(node.get("type") == "loop" for node in nodes):
            raise WorkflowExecutionError("Loop nodes are not supported by the MVP executor yet.")

        ordered_nodes = self._topological_nodes(nodes, edges)
        node_lookup = {node["id"]: node for node in ordered_nodes}
        incoming_nodes = self._incoming_nodes(edges)
        outgoing_edges = self._outgoing_edges(edges)
        activated_by: dict[str, set[str]] = defaultdict(set)
        data_inputs: dict[str, dict] = defaultdict(dict)

        run = Run(
            id=str(uuid4()),
            workflow_id=workflow.id,
            workflow_version=workflow.version,
            status="running",
            input_payload=input_payload,
            started_at=_utcnow(),
        )
        db.add(run)
        db.flush()

        events: list[RunEvent] = []
        node_runs: list[NodeRun] = []
        outputs: dict[str, dict] = {}
        completed_output_nodes: set[str] = set()
        active_node_run: NodeRun | None = None

        events.append(self._build_event(run.id, None, "run.started", {"input": input_payload}))

        try:
            for node in ordered_nodes:
                node_id = node["id"]
                retry_policy = self._retry_policy_for_node(node)
                accumulated_input = data_inputs.get(node_id, {})
                activation_sources = activated_by.get(node_id, set())
                authorized_context = self._authorized_context_for_node(node)
                node_input = self._build_node_input(
                    node=node,
                    input_payload=input_payload,
                    accumulated=accumulated_input,
                    activated_by=activation_sources,
                    authorized_context=authorized_context,
                    attempt_number=1,
                    max_attempts=retry_policy.max_attempts,
                )
                if not self._should_execute_node(
                    node,
                    incoming_nodes.get(node_id, []),
                    activated_by,
                ):
                    skipped_node_run = self._build_skipped_node_run(node, run.id, node_input)
                    db.add(skipped_node_run)
                    db.flush()
                    node_runs.append(skipped_node_run)
                    events.append(
                        self._build_event(
                            run.id,
                            skipped_node_run.id,
                            "node.skipped",
                            {
                                "node_id": node_id,
                                "reason": "No active incoming branch reached this node.",
                            },
                        )
                    )
                    continue

                node_run = NodeRun(
                    id=str(uuid4()),
                    run_id=run.id,
                    node_id=node_id,
                    node_name=node.get("name", node_id),
                    node_type=node.get("type", "unknown"),
                    status="running",
                    input_payload=node_input,
                    started_at=_utcnow(),
                )
                db.add(node_run)
                db.flush()
                node_runs.append(node_run)
                active_node_run = node_run
                events.append(
                    self._build_event(
                        run.id,
                        node_run.id,
                        "node.started",
                        {"node_id": node_id, "node_type": node_run.node_type},
                    )
                )

                try:
                    node_output = self._execute_node_with_retry(
                        node=node,
                        node_run=node_run,
                        run_id=run.id,
                        input_payload=input_payload,
                        accumulated=accumulated_input,
                        activated_by=activation_sources,
                        authorized_context=authorized_context,
                        outputs=outputs,
                        retry_policy=retry_policy,
                        events=events,
                    )
                except Exception as exc:
                    node_error = str(exc)
                    node_run.status = "failed"
                    node_run.error_message = node_error
                    node_run.finished_at = _utcnow()
                    active_node_run = None
                    failure_output = self._build_failure_output(node, node_error)
                    outputs[node_id] = failure_output
                    events.append(
                        self._build_event(
                            run.id,
                            node_run.id,
                            "node.failed",
                            {"node_id": node_id, "error": node_error},
                        )
                    )
                    activated_targets = self._activate_downstream_edges(
                        source_node=node,
                        source_output=failure_output,
                        outcome="failed",
                        outgoing_edges=outgoing_edges.get(node_id, []),
                        node_lookup=node_lookup,
                        activated_by=activated_by,
                        data_inputs=data_inputs,
                    )
                    if not activated_targets:
                        raise WorkflowExecutionError(node_error) from exc
                    continue

                node_run.output_payload = node_output
                node_run.status = "succeeded"
                node_run.finished_at = _utcnow()
                active_node_run = None
                outputs[node_id] = node_output
                if node.get("type") == "output":
                    completed_output_nodes.add(node_id)
                events.append(
                    self._build_event(
                        run.id,
                        node_run.id,
                        "node.output.completed",
                        {"node_id": node_id, "output": node_output},
                    )
                )

                self._activate_downstream_edges(
                    source_node=node,
                    source_output=node_output,
                    outcome="succeeded",
                    outgoing_edges=outgoing_edges.get(node_id, []),
                    node_lookup=node_lookup,
                    activated_by=activated_by,
                    data_inputs=data_inputs,
                )

            if not completed_output_nodes:
                raise WorkflowExecutionError(
                    "Workflow completed without producing a reachable output node."
                )

            run.status = "succeeded"
            run.output_payload = self._resolve_run_output(
                ordered_nodes,
                outputs,
                completed_output_nodes,
            )
            run.finished_at = _utcnow()
            events.append(
                self._build_event(
                    run.id,
                    None,
                    "run.completed",
                    {"output": run.output_payload},
                )
            )
        except WorkflowExecutionError as exc:
            if active_node_run is not None and active_node_run.status == "running":
                active_node_run.status = "failed"
                active_node_run.error_message = str(exc)
                active_node_run.finished_at = _utcnow()
                events.append(
                    self._build_event(
                        run.id,
                        active_node_run.id,
                        "node.failed",
                        {"node_id": active_node_run.node_id, "error": str(exc)},
                    )
                )
            run.status = "failed"
            run.error_message = str(exc)
            run.finished_at = _utcnow()
            events.append(
                self._build_event(run.id, None, "run.failed", {"error": str(exc)})
            )
        except Exception as exc:
            if active_node_run is not None and active_node_run.status == "running":
                active_node_run.status = "failed"
                active_node_run.error_message = str(exc)
                active_node_run.finished_at = _utcnow()
                events.append(
                    self._build_event(
                        run.id,
                        active_node_run.id,
                        "node.failed",
                        {"node_id": active_node_run.node_id, "error": str(exc)},
                    )
                )
            run.status = "failed"
            run.error_message = str(exc)
            run.finished_at = _utcnow()
            events.append(
                self._build_event(run.id, None, "run.failed", {"error": str(exc)})
            )
            raise
        finally:
            for event in events:
                db.add(event)
            db.commit()
            db.refresh(run)
            for node_run in node_runs:
                db.refresh(node_run)

        if run.status != "succeeded":
            raise WorkflowExecutionError(run.error_message or "Workflow execution failed.")

        persisted_events = db.scalars(
            select(RunEvent).where(RunEvent.run_id == run.id).order_by(RunEvent.id.asc())
        ).all()
        return ExecutionArtifacts(run=run, node_runs=node_runs, events=persisted_events)

    def load_run(self, db: Session, run_id: str) -> ExecutionArtifacts | None:
        run = db.get(Run, run_id)
        if run is None:
            return None
        node_runs = db.scalars(
            select(NodeRun).where(NodeRun.run_id == run_id).order_by(NodeRun.created_at.asc())
        ).all()
        events = db.scalars(
            select(RunEvent).where(RunEvent.run_id == run_id).order_by(RunEvent.id.asc())
        ).all()
        return ExecutionArtifacts(run=run, node_runs=node_runs, events=events)

    def list_workflow_runs(self, db: Session, workflow_id: str) -> list[Run]:
        return db.scalars(
            select(Run).where(Run.workflow_id == workflow_id).order_by(Run.created_at.desc())
        ).all()

    def _execute_node_with_retry(
        self,
        node: dict,
        node_run: NodeRun,
        run_id: str,
        input_payload: dict,
        accumulated: dict,
        activated_by: set[str],
        authorized_context: AuthorizedContextRefs,
        outputs: dict[str, dict],
        retry_policy: RetryPolicy,
        events: list[RunEvent],
    ) -> dict:
        last_error: Exception | None = None

        for attempt_number in range(1, retry_policy.max_attempts + 1):
            node_run.input_payload = self._build_node_input(
                node=node,
                input_payload=input_payload,
                accumulated=accumulated,
                activated_by=activated_by,
                authorized_context=authorized_context,
                attempt_number=attempt_number,
                max_attempts=retry_policy.max_attempts,
            )
            node_run.status = "retrying" if attempt_number > 1 else "running"

            try:
                node_output = self._execute_node(
                    node=node,
                    node_input=node_run.input_payload,
                    attempt_number=attempt_number,
                    authorized_context=authorized_context,
                    outputs=outputs,
                )
                if node.get("type") == "mcp_query":
                    events.append(
                        self._build_event(
                            run_id,
                            node_run.id,
                            "node.context.read",
                            self._build_context_read_payload(node, node_output),
                        )
                    )
                return node_output
            except Exception as exc:
                last_error = exc
                if attempt_number >= retry_policy.max_attempts:
                    raise

                delay_seconds = self._retry_delay_seconds(retry_policy, attempt_number)
                events.append(
                    self._build_event(
                        run_id,
                        node_run.id,
                        "node.retrying",
                        {
                            "node_id": node["id"],
                            "attempt": attempt_number,
                            "max_attempts": retry_policy.max_attempts,
                            "error": str(exc),
                            "next_retry_in_seconds": delay_seconds,
                        },
                    )
                )
                if delay_seconds > 0:
                    time.sleep(delay_seconds)

        if last_error is None:
            raise WorkflowExecutionError(f"Node '{node['id']}' exhausted retries without error.")
        raise last_error

    def _execute_node(
        self,
        node: dict,
        node_input: dict,
        attempt_number: int,
        authorized_context: AuthorizedContextRefs,
        outputs: dict[str, dict],
    ) -> dict:
        config = node.get("config", {})
        mock_error_sequence = config.get("mock_error_sequence")
        if isinstance(mock_error_sequence, list):
            attempt_index = attempt_number - 1
            if attempt_index < len(mock_error_sequence):
                attempt_error = mock_error_sequence[attempt_index]
                if attempt_error:
                    raise WorkflowExecutionError(str(attempt_error))
        if "mock_error" in config:
            raise WorkflowExecutionError(str(config["mock_error"]))
        if "mock_output" in config:
            mock_output = config["mock_output"]
            return mock_output if isinstance(mock_output, dict) else {"value": mock_output}

        node_type = node.get("type")
        if node_type == "trigger":
            return node_input.get("trigger_input", {})
        if node_type == "output":
            return node_input.get("upstream", {})
        if node_type == "mcp_query":
            return self._execute_mcp_query_node(node, authorized_context, outputs)
        if node_type in {"condition", "router"}:
            return self._execute_branch_node(node, node_input)
        return {
            "node_id": node.get("id"),
            "node_type": node_type,
            "received": node_input,
        }

    def _execute_branch_node(self, node: dict, node_input: dict) -> dict:
        config = node.get("config", {})
        selector = config.get("selector")
        if isinstance(selector, dict):
            selected, matched_rule, default_used = self._select_branch_from_rules(
                selector,
                node_input,
            )
            return {
                "selected": selected,
                "received": node_input,
                "selector": {
                    "matchedRule": matched_rule,
                    "defaultUsed": default_used,
                },
            }

        return {
            "selected": config.get("selected", "default"),
            "received": node_input,
        }

    def _resolve_run_output(
        self,
        nodes: list[dict],
        outputs: dict[str, dict],
        completed_output_nodes: set[str],
    ) -> dict:
        for node in reversed(nodes):
            if node.get("type") == "output" and node["id"] in completed_output_nodes:
                return outputs.get(node["id"], {})
        return outputs.get(nodes[-1]["id"], {})

    def _topological_nodes(self, nodes: list[dict], edges: list[dict]) -> list[dict]:
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
            raise WorkflowExecutionError(
                "Workflow contains a cycle or disconnected invalid edge configuration."
            )

        return [node_lookup[node_id] for node_id in ordered_ids]

    def _incoming_nodes(self, edges: list[dict]) -> dict[str, list[str]]:
        incoming: dict[str, list[str]] = defaultdict(list)
        for edge in edges:
            source = edge.get("sourceNodeId")
            target = edge.get("targetNodeId")
            if source and target:
                incoming[target].append(source)
        return incoming

    def _outgoing_edges(self, edges: list[dict]) -> dict[str, list[dict]]:
        outgoing: dict[str, list[dict]] = defaultdict(list)
        for edge in edges:
            source = edge.get("sourceNodeId")
            if source:
                outgoing[source].append(edge)
        return outgoing

    def _should_execute_node(
        self,
        node: dict,
        incoming: list[str],
        activated_by: dict[str, set[str]],
    ) -> bool:
        if node.get("type") == "trigger":
            return True
        if not incoming:
            return False
        return bool(activated_by.get(node["id"]))

    def _build_node_input(
        self,
        node: dict,
        input_payload: dict,
        accumulated: dict,
        activated_by: set[str],
        authorized_context: AuthorizedContextRefs,
        attempt_number: int,
        max_attempts: int,
    ) -> dict:
        return {
            "trigger_input": input_payload,
            "upstream": accumulated,
            "accumulated": accumulated,
            "activated_by": sorted(activated_by),
            "authorized_context": {
                "currentNodeId": authorized_context.current_node_id,
                "readableNodeIds": list(authorized_context.readable_node_ids),
                "readableArtifacts": [
                    {"nodeId": node_id, "artifactType": artifact_type}
                    for node_id, artifact_type in authorized_context.readable_artifacts
                ],
            },
            "attempt": {
                "current": attempt_number,
                "max": max_attempts,
            },
            "config": node.get("config", {}),
        }

    def _build_skipped_node_run(self, node: dict, run_id: str, node_input: dict) -> NodeRun:
        timestamp = _utcnow()
        return NodeRun(
            id=str(uuid4()),
            run_id=run_id,
            node_id=node["id"],
            node_name=node.get("name", node["id"]),
            node_type=node.get("type", "unknown"),
            status="skipped",
            input_payload=node_input,
            started_at=timestamp,
            finished_at=timestamp,
        )

    def _build_failure_output(self, node: dict, error: str) -> dict:
        return {
            "error": {
                "node_id": node.get("id"),
                "node_type": node.get("type"),
                "message": error,
            }
        }

    def _activate_downstream_edges(
        self,
        source_node: dict,
        source_output: dict,
        outcome: str,
        outgoing_edges: list[dict],
        node_lookup: dict[str, dict],
        activated_by: dict[str, set[str]],
        data_inputs: dict[str, dict],
    ) -> list[str]:
        activated_targets: list[str] = []
        for edge in outgoing_edges:
            if not self._should_activate_edge(
                source_node,
                source_output,
                outcome,
                edge,
                outgoing_edges,
            ):
                continue
            target_id = edge.get("targetNodeId")
            if not target_id or target_id not in node_lookup:
                continue
            activated_by[target_id].add(source_node["id"])
            data_inputs[target_id][source_node["id"]] = source_output
            activated_targets.append(target_id)
        return activated_targets

    def _should_activate_edge(
        self,
        source_node: dict,
        source_output: dict,
        outcome: str,
        edge: dict,
        sibling_edges: list[dict],
    ) -> bool:
        condition = self._normalize_branch_value(edge.get("condition"))
        if outcome == "failed":
            return condition in {"error", "failed", "on_error"}

        if source_node.get("type") in {"condition", "router"}:
            selected = self._normalize_branch_value(source_output.get("selected"))
            has_branch_conditions = any(
                self._normalize_branch_value(candidate.get("condition")) is not None
                for candidate in sibling_edges
            )
            if selected is None:
                return not has_branch_conditions and condition is None

            if condition == selected:
                return True

            has_explicit_match = any(
                self._normalize_branch_value(candidate.get("condition")) == selected
                for candidate in sibling_edges
            )
            return condition is None and not has_explicit_match

        return condition in {None, "success", "succeeded", "default"}

    def _normalize_branch_value(self, value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip().lower()
        return normalized or None

    def _select_branch_from_rules(
        self,
        selector: dict,
        node_input: dict,
    ) -> tuple[str | None, dict | None, bool]:
        for rule in selector.get("rules", []):
            if self._selector_rule_matches(rule, node_input):
                return rule["key"], rule, False

        default_branch = selector.get("default")
        if default_branch is not None:
            return str(default_branch), None, True

        return "default", None, True

    def _selector_rule_matches(self, rule: dict, node_input: dict) -> bool:
        actual_value = self._resolve_selector_path(node_input, str(rule["path"]))
        operator = rule.get("operator", "eq")
        expected_value = rule.get("value")

        if operator == "exists":
            return actual_value is not _MISSING
        if operator == "not_exists":
            return actual_value is _MISSING
        if actual_value is _MISSING:
            return False
        if operator == "eq":
            return actual_value == expected_value
        if operator == "ne":
            return actual_value != expected_value
        if operator == "gt":
            return self._compare_selector_values(actual_value, expected_value, lambda a, b: a > b)
        if operator == "gte":
            return self._compare_selector_values(actual_value, expected_value, lambda a, b: a >= b)
        if operator == "lt":
            return self._compare_selector_values(actual_value, expected_value, lambda a, b: a < b)
        if operator == "lte":
            return self._compare_selector_values(actual_value, expected_value, lambda a, b: a <= b)
        if operator == "in":
            return isinstance(expected_value, list | tuple | set) and actual_value in expected_value
        if operator == "not_in":
            return isinstance(
                expected_value,
                list | tuple | set,
            ) and actual_value not in expected_value
        if operator == "contains":
            try:
                return expected_value in actual_value
            except TypeError:
                return False
        raise WorkflowExecutionError(f"Unsupported branch selector operator '{operator}'.")

    def _compare_selector_values(
        self,
        actual_value: object,
        expected_value: object,
        comparator,
    ) -> bool:
        try:
            return bool(comparator(actual_value, expected_value))
        except TypeError:
            return False

    def _resolve_selector_path(self, payload: object, path: str) -> object:
        current_value = payload
        for token in self._selector_path_tokens(path):
            if isinstance(current_value, dict):
                if token not in current_value:
                    return _MISSING
                current_value = current_value[token]
                continue
            if isinstance(current_value, list):
                if not token.isdigit():
                    return _MISSING
                index = int(token)
                if index < 0 or index >= len(current_value):
                    return _MISSING
                current_value = current_value[index]
                continue
            return _MISSING
        return current_value

    def _selector_path_tokens(self, path: str) -> list[str]:
        normalized_path = path.replace("[", ".").replace("]", "")
        return [segment for segment in normalized_path.split(".") if segment]

    def _authorized_context_for_node(self, node: dict) -> AuthorizedContextRefs:
        config = node.get("config", {})
        context_access = config.get("contextAccess") or {}
        readable_node_ids = {
            str(node_id)
            for node_id in context_access.get("readableNodeIds", [])
            if str(node_id).strip()
        }
        readable_artifacts: set[tuple[str, str]] = set()

        for node_id in readable_node_ids:
            readable_artifacts.add((node_id, "json"))

        for artifact in context_access.get("readableArtifacts", []):
            artifact_node_id = str(artifact.get("nodeId", "")).strip()
            artifact_type = str(artifact.get("artifactType", "")).strip()
            if not artifact_node_id or not artifact_type:
                continue
            readable_node_ids.add(artifact_node_id)
            readable_artifacts.add((artifact_node_id, artifact_type))

        return AuthorizedContextRefs(
            current_node_id=node["id"],
            readable_node_ids=tuple(sorted(readable_node_ids)),
            readable_artifacts=tuple(sorted(readable_artifacts)),
        )

    def _execute_mcp_query_node(
        self,
        node: dict,
        authorized_context: AuthorizedContextRefs,
        outputs: dict[str, dict],
    ) -> dict:
        query = node.get("config", {}).get("query") or {}
        query_type = query.get("type")
        if query_type != "authorized_context":
            raise WorkflowExecutionError(
                f"Node '{node['id']}' uses unsupported MCP query type '{query_type}'."
            )

        authorized_artifacts = self._authorized_artifact_lookup(authorized_context)
        requested_source_ids = [
            str(source_node_id)
            for source_node_id in (
                query.get("sourceNodeIds") or authorized_context.readable_node_ids
            )
        ]
        unauthorized_sources = sorted(
            source_node_id
            for source_node_id in requested_source_ids
            if source_node_id not in authorized_artifacts
        )
        if unauthorized_sources:
            raise WorkflowExecutionError(
                f"Node '{node['id']}' requested unauthorized context sources: "
                f"{', '.join(unauthorized_sources)}."
            )

        requested_artifact_types = {
            str(artifact_type)
            for artifact_type in (query.get("artifactTypes") or ["json"])
        }

        results: list[dict] = []
        for source_node_id in requested_source_ids:
            allowed_artifact_types = authorized_artifacts.get(source_node_id, set())
            unauthorized_artifact_types = sorted(requested_artifact_types - allowed_artifact_types)
            if unauthorized_artifact_types:
                raise WorkflowExecutionError(
                    f"Node '{node['id']}' requested unauthorized artifact types from "
                    f"'{source_node_id}': {', '.join(unauthorized_artifact_types)}."
                )

            if "json" in requested_artifact_types and source_node_id in outputs:
                results.append(
                    {
                        "nodeId": source_node_id,
                        "artifactType": "json",
                        "content": outputs[source_node_id],
                    }
                )

        return {
            "query": {
                "type": query_type,
                "sourceNodeIds": requested_source_ids,
                "artifactTypes": sorted(requested_artifact_types),
            },
            "results": results,
        }

    def _authorized_artifact_lookup(
        self,
        authorized_context: AuthorizedContextRefs,
    ) -> dict[str, set[str]]:
        artifact_lookup: dict[str, set[str]] = defaultdict(set)
        for node_id in authorized_context.readable_node_ids:
            artifact_lookup[node_id].add("json")
        for node_id, artifact_type in authorized_context.readable_artifacts:
            artifact_lookup[node_id].add(artifact_type)
        return artifact_lookup

    def _retry_policy_for_node(self, node: dict) -> RetryPolicy:
        runtime_policy = node.get("runtimePolicy") or {}
        retry_config = runtime_policy.get("retry")
        if retry_config is None and any(
            key in runtime_policy for key in ("maxAttempts", "backoffSeconds", "backoffMultiplier")
        ):
            retry_config = runtime_policy
        if retry_config is None:
            return RetryPolicy()

        max_attempts = int(retry_config.get("maxAttempts", 1))
        backoff_seconds = float(retry_config.get("backoffSeconds", 0.0))
        backoff_multiplier = float(retry_config.get("backoffMultiplier", 1.0))

        if max_attempts < 1:
            raise WorkflowExecutionError(
                f"Node '{node['id']}' retry policy must use maxAttempts >= 1."
            )
        if backoff_seconds < 0:
            raise WorkflowExecutionError(
                f"Node '{node['id']}' retry policy must use backoffSeconds >= 0."
            )
        if backoff_multiplier < 1:
            raise WorkflowExecutionError(
                f"Node '{node['id']}' retry policy must use backoffMultiplier >= 1."
            )

        return RetryPolicy(
            max_attempts=max_attempts,
            backoff_seconds=backoff_seconds,
            backoff_multiplier=backoff_multiplier,
        )

    def _retry_delay_seconds(self, retry_policy: RetryPolicy, failed_attempt_number: int) -> float:
        if retry_policy.backoff_seconds <= 0:
            return 0.0
        multiplier = retry_policy.backoff_multiplier ** (failed_attempt_number - 1)
        return retry_policy.backoff_seconds * multiplier

    def _build_context_read_payload(self, node: dict, node_output: dict) -> dict:
        results = node_output.get("results", [])
        return {
            "node_id": node["id"],
            "query_type": node_output.get("query", {}).get("type"),
            "source_node_ids": [item["nodeId"] for item in results],
            "artifact_types": sorted({item["artifactType"] for item in results}),
            "result_count": len(results),
        }

    def _build_event(
        self,
        run_id: str,
        node_run_id: str | None,
        event_type: str,
        payload: dict,
    ) -> RunEvent:
        return RunEvent(
            run_id=run_id,
            node_run_id=node_run_id,
            event_type=event_type,
            payload=payload,
        )
