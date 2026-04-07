from __future__ import annotations

from app.core.safe_expressions import (
    BRANCH_EXPRESSION_NAMES,
    EDGE_EXPRESSION_NAMES,
    MISSING,
    SafeExpressionError,
    evaluate_expression,
)
from app.services.runtime_types import WorkflowExecutionError


class RuntimeBranchSupportMixin:
    def _should_activate_edge(
        self,
        source_node: dict,
        source_output: dict,
        outcome: str,
        edge: dict,
        target_node: dict,
        sibling_edges: list[dict],
    ) -> bool:
        condition = self._normalize_branch_value(edge.get("condition"))
        if outcome == "failed":
            if condition not in {"error", "failed", "on_error"}:
                return False
            return self._edge_expression_matches(
                source_node=source_node,
                target_node=target_node,
                source_output=source_output,
                outcome=outcome,
                edge=edge,
            )

        if source_node.get("type") in {"conditionNode", "routerNode"}:
            selected = self._normalize_branch_value(source_output.get("selected"))
            has_branch_conditions = any(
                self._normalize_branch_value(candidate.get("condition")) is not None
                for candidate in sibling_edges
            )
            if selected is None:
                matches_branch = not has_branch_conditions and condition is None
                if not matches_branch:
                    return False
                return self._edge_expression_matches(
                    source_node=source_node,
                    target_node=target_node,
                    source_output=source_output,
                    outcome=outcome,
                    edge=edge,
                )

            if condition == selected:
                return self._edge_expression_matches(
                    source_node=source_node,
                    target_node=target_node,
                    source_output=source_output,
                    outcome=outcome,
                    edge=edge,
                )

            has_explicit_match = any(
                self._normalize_branch_value(candidate.get("condition")) == selected
                for candidate in sibling_edges
            )
            if condition is not None or has_explicit_match:
                return False
            return self._edge_expression_matches(
                source_node=source_node,
                target_node=target_node,
                source_output=source_output,
                outcome=outcome,
                edge=edge,
            )

        if condition not in {None, "success", "succeeded", "default"}:
            return False
        return self._edge_expression_matches(
            source_node=source_node,
            target_node=target_node,
            source_output=source_output,
            outcome=outcome,
            edge=edge,
        )

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

    def _select_branch_from_expression(
        self,
        node: dict,
        node_input: dict,
    ) -> tuple[str, object, bool]:
        expression = str(node.get("config", {}).get("expression"))
        try:
            expression_value = evaluate_expression(
                expression,
                context=self._branch_expression_context(node_input),
                allowed_names=BRANCH_EXPRESSION_NAMES,
                description=f"Node '{node['id']}' config.expression",
            )
        except SafeExpressionError as exc:
            raise WorkflowExecutionError(str(exc)) from exc

        if node.get("type") == "conditionNode":
            selected = "true" if bool(expression_value) else "false"
            return selected, expression_value, False

        selected = self._stringify_branch_key(expression_value)
        if selected is not None:
            return selected, expression_value, False

        return self._default_branch_key(node), expression_value, True

    def _selector_rule_matches(self, rule: dict, node_input: dict) -> bool:
        actual_value = self._resolve_selector_path(node_input, str(rule["path"]))
        operator = rule.get("operator", "eq")
        expected_value = rule.get("value")

        if operator == "exists":
            return actual_value is not MISSING
        if operator == "not_exists":
            return actual_value is MISSING
        if actual_value is MISSING:
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
                    return MISSING
                current_value = current_value[token]
                continue
            if isinstance(current_value, list):
                if not token.isdigit():
                    return MISSING
                index = int(token)
                if index < 0 or index >= len(current_value):
                    return MISSING
                current_value = current_value[index]
                continue
            return MISSING
        return current_value

    def _selector_path_tokens(self, path: str) -> list[str]:
        normalized_path = path.replace("[", ".").replace("]", "")
        return [segment for segment in normalized_path.split(".") if segment]

    def _branch_expression_context(self, node_input: dict) -> dict[str, object]:
        return {
            "trigger_input": node_input.get("trigger_input", {}),
            "upstream": node_input.get("upstream", {}),
            "accumulated": node_input.get("accumulated", {}),
            "activated_by": node_input.get("activated_by", []),
            "authorized_context": node_input.get("authorized_context", {}),
            "attempt": node_input.get("attempt", {}),
            "config": node_input.get("config", {}),
            "global_context": node_input.get("global_context", {}),
            "working_context": node_input.get("working_context", {}),
            "evidence_context": node_input.get("evidence_context", {}),
        }

    def _edge_expression_matches(
        self,
        source_node: dict,
        target_node: dict,
        source_output: dict,
        outcome: str,
        edge: dict,
    ) -> bool:
        expression = edge.get("conditionExpression")
        if expression is None:
            return True

        try:
            result = evaluate_expression(
                str(expression),
                context={
                    "source_output": source_output,
                    "source_node": source_node,
                    "target_node": target_node,
                    "edge": edge,
                    "outcome": outcome,
                },
                allowed_names=EDGE_EXPRESSION_NAMES,
                description=f"Edge '{edge.get('id', '<unknown>')}' conditionExpression",
            )
        except SafeExpressionError as exc:
            raise WorkflowExecutionError(str(exc)) from exc

        return bool(result)

    def _default_branch_key(self, node: dict) -> str:
        config = node.get("config", {})
        for key in ("default", "selected"):
            value = config.get(key)
            if isinstance(value, str) and value.strip():
                return value
        return "default"

    def _stringify_branch_key(self, value: object) -> str | None:
        if value is MISSING or value is None:
            return None
        if isinstance(value, str):
            normalized = value.strip()
            return normalized or None
        return str(value)
