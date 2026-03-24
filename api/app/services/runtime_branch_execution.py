from __future__ import annotations

from typing import Any

from app.core.safe_expressions import (
    BRANCH_EXPRESSION_NAMES,
    MISSING,
    SafeExpressionError,
    evaluate_expression,
)
from app.services.runtime_types import WorkflowExecutionError


def execute_branch_node(node: dict[str, Any], node_input: dict[str, Any]) -> dict[str, Any]:
    config = node.get("config", {})
    selector = config.get("selector")
    if isinstance(selector, dict):
        selected, matched_rule, default_used = _select_branch_from_rules(
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

    expression = config.get("expression")
    if isinstance(expression, str):
        selected, expression_value, default_used = _select_branch_from_expression(
            node,
            node_input,
        )
        return {
            "selected": selected,
            "received": node_input,
            "expression": {
                "source": expression,
                "value": expression_value,
                "defaultUsed": default_used,
            },
        }

    return {
        "selected": config.get("selected", "default"),
        "received": node_input,
    }


def _select_branch_from_rules(
    selector: dict[str, Any],
    node_input: dict[str, Any],
) -> tuple[str | None, dict[str, Any] | None, bool]:
    for rule in selector.get("rules", []):
        if not isinstance(rule, dict):
            continue
        if _selector_rule_matches(rule, node_input):
            return str(rule["key"]), rule, False

    default_branch = selector.get("default")
    if default_branch is not None:
        return str(default_branch), None, True

    return "default", None, True


def _select_branch_from_expression(
    node: dict[str, Any],
    node_input: dict[str, Any],
) -> tuple[str, object, bool]:
    expression = str(node.get("config", {}).get("expression"))
    try:
        expression_value = evaluate_expression(
            expression,
            context=_branch_expression_context(node_input),
            allowed_names=BRANCH_EXPRESSION_NAMES,
            description=f"Node '{node['id']}' config.expression",
        )
    except SafeExpressionError as exc:
        raise WorkflowExecutionError(str(exc)) from exc

    if node.get("type") == "condition":
        selected = "true" if bool(expression_value) else "false"
        return selected, expression_value, False

    selected = _stringify_branch_key(expression_value)
    if selected is not None:
        return selected, expression_value, False

    return _default_branch_key(node), expression_value, True


def _selector_rule_matches(rule: dict[str, Any], node_input: dict[str, Any]) -> bool:
    actual_value = _resolve_selector_path(node_input, str(rule["path"]))
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
        return _compare_selector_values(actual_value, expected_value, lambda a, b: a > b)
    if operator == "gte":
        return _compare_selector_values(actual_value, expected_value, lambda a, b: a >= b)
    if operator == "lt":
        return _compare_selector_values(actual_value, expected_value, lambda a, b: a < b)
    if operator == "lte":
        return _compare_selector_values(actual_value, expected_value, lambda a, b: a <= b)
    if operator == "in":
        return isinstance(expected_value, list | tuple | set) and actual_value in expected_value
    if operator == "not_in":
        return isinstance(expected_value, list | tuple | set) and actual_value not in expected_value
    if operator == "contains":
        try:
            return expected_value in actual_value
        except TypeError:
            return False
    raise WorkflowExecutionError(f"Unsupported branch selector operator '{operator}'.")


def _compare_selector_values(actual_value: object, expected_value: object, comparator) -> bool:
    try:
        return bool(comparator(actual_value, expected_value))
    except TypeError:
        return False


def _resolve_selector_path(payload: object, path: str) -> object:
    current_value = payload
    for token in _selector_path_tokens(path):
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


def _selector_path_tokens(path: str) -> list[str]:
    normalized_path = path.replace("[", ".").replace("]", "")
    return [segment for segment in normalized_path.split(".") if segment]


def _branch_expression_context(node_input: dict[str, Any]) -> dict[str, object]:
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


def _default_branch_key(node: dict[str, Any]) -> str:
    config = node.get("config", {})
    for key in ("default", "selected"):
        value = config.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return "default"


def _stringify_branch_key(value: object) -> str | None:
    if value is MISSING or value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None
    return str(value)
