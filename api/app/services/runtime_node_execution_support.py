from __future__ import annotations

from copy import deepcopy

from sqlalchemy.orm import Session

from app.models.run import NodeRun, RunEvent
from app.services.runtime_types import (
    AuthorizedContextRefs,
    CompiledEdge,
    CompiledNode,
    FlowCheckpointState,
    JoinDecision,
    NodeExecutionResult,
    RetryPolicy,
    WorkflowExecutionError,
)


class RuntimeNodeExecutionSupportMixin:
    def _execute_node_with_retry(
        self,
        db: Session,
        *,
        node: dict,
        node_run: NodeRun,
        run_id: str,
        input_payload: dict,
        upstream: dict,
        mapped: dict,
        accumulated: dict,
        activated_by: set[str],
        authorized_context: AuthorizedContextRefs,
        join_decision: JoinDecision,
        outputs: dict[str, dict],
        retry_policy: RetryPolicy,
        global_context: dict,
        events: list[RunEvent],
    ) -> NodeExecutionResult:
        last_error: Exception | None = None
        starting_attempt_number = self._starting_retry_attempt(node_run)

        for attempt_number in range(starting_attempt_number, retry_policy.max_attempts + 1):
            node_input = self._build_node_input(
                node=node,
                node_run=node_run,
                input_payload=input_payload,
                upstream=upstream,
                mapped=mapped,
                accumulated=accumulated,
                activated_by=activated_by,
                authorized_context=authorized_context,
                join_decision=join_decision,
                attempt_number=attempt_number,
                max_attempts=retry_policy.max_attempts,
                global_context=global_context,
            )
            node_run.input_payload = node_input
            node_run.retry_count = attempt_number - 1
            if attempt_number > 1 and node_run.phase not in {"waiting_tool", "waiting_callback"}:
                node_run.status = "retrying"

            try:
                result = self._execute_node(
                    db,
                    node=node,
                    node_run=node_run,
                    node_input=node_input,
                    run_id=run_id,
                    attempt_number=attempt_number,
                    authorized_context=authorized_context,
                    outputs=outputs,
                )
                self._clear_retry_state(node_run)
                return result
            except Exception as exc:
                last_error = exc
                node_run.retry_count = attempt_number
                if attempt_number >= retry_policy.max_attempts:
                    self._clear_retry_state(node_run)
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
                    next_attempt_number = attempt_number + 1
                    retry_waiting_reason = (
                        "Retry "
                        f"{next_attempt_number}/{retry_policy.max_attempts} "
                        f"scheduled in {delay_seconds:g}s after error: {exc}"
                    )
                    self._set_retry_state(
                        node_run,
                        next_attempt_number=next_attempt_number,
                        delay_seconds=delay_seconds,
                        error_message=str(exc),
                    )
                    return NodeExecutionResult(
                        suspended=True,
                        waiting_status="retrying",
                        waiting_reason=retry_waiting_reason,
                        resume_after_seconds=delay_seconds,
                    )
                self._clear_retry_state(node_run)

        if last_error is None:
            raise WorkflowExecutionError(f"Node '{node['id']}' exhausted retries without error.")
        raise last_error

    def _resolve_run_output(
        self,
        nodes: tuple[CompiledNode, ...],
        outputs: dict[str, dict],
        completed_output_nodes: set[str],
    ) -> dict:
        for node in reversed(nodes):
            if node.type == "output" and node.id in completed_output_nodes:
                return outputs.get(node.id, {})
        return outputs.get(nodes[-1].id, {})

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
        *,
        source_node: dict,
        source_output: dict,
        outcome: str,
        outgoing_edges: tuple[CompiledEdge, ...],
        node_lookup: dict[str, dict],
        checkpoint_state: FlowCheckpointState,
    ) -> list[str]:
        activated_targets: list[str] = []
        sibling_edges = [self._edge_payload(item) for item in outgoing_edges]
        for compiled_edge in outgoing_edges:
            edge = self._edge_payload(compiled_edge)
            target_id = edge.get("targetNodeId")
            if not target_id or target_id not in node_lookup:
                continue
            if not self._should_activate_edge(
                source_node,
                source_output,
                outcome,
                edge,
                node_lookup[target_id],
                sibling_edges,
            ):
                continue
            checkpoint_state.activated_by.setdefault(target_id, [])
            if source_node["id"] not in checkpoint_state.activated_by[target_id]:
                checkpoint_state.activated_by[target_id].append(source_node["id"])
            checkpoint_state.upstream_inputs.setdefault(target_id, {})
            checkpoint_state.upstream_inputs[target_id][source_node["id"]] = deepcopy(source_output)
            checkpoint_state.mapped_inputs.setdefault(target_id, {})
            self._apply_edge_mappings(
                edge=edge,
                source_node=source_node,
                target_node=node_lookup[target_id],
                source_output=source_output,
                mapped_input=checkpoint_state.mapped_inputs[target_id],
            )
            activated_targets.append(target_id)
        return activated_targets
