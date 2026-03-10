from __future__ import annotations

import ast
from collections.abc import Mapping, Sequence

BRANCH_EXPRESSION_NAMES = frozenset(
    {
        "trigger_input",
        "upstream",
        "accumulated",
        "activated_by",
        "authorized_context",
        "attempt",
        "config",
    }
)
EDGE_EXPRESSION_NAMES = frozenset(
    {
        "source_output",
        "source_node",
        "target_node",
        "edge",
        "outcome",
    }
)


class SafeExpressionError(ValueError):
    pass


class SafeExpressionValidationError(SafeExpressionError):
    pass


class SafeExpressionEvaluationError(SafeExpressionError):
    pass


class _MissingValue:
    def __bool__(self) -> bool:
        return False

    def __repr__(self) -> str:
        return "<missing>"


MISSING = _MissingValue()


def validate_expression(expression: str, *, allowed_names: set[str] | frozenset[str]) -> None:
    parsed = _parse_expression(expression)
    _SafeExpressionValidator(allowed_names=allowed_names).visit(parsed)


def evaluate_expression(
    expression: str,
    *,
    context: Mapping[str, object],
    allowed_names: set[str] | frozenset[str],
    description: str,
) -> object:
    parsed = _parse_expression(expression)
    _SafeExpressionValidator(allowed_names=allowed_names).visit(parsed)
    evaluator = _SafeExpressionEvaluator(context=context, description=description)
    return evaluator.visit(parsed.body)


def _parse_expression(expression: str) -> ast.Expression:
    if not isinstance(expression, str) or not expression.strip():
        raise SafeExpressionValidationError("Expression must be a non-empty string.")
    try:
        return ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise SafeExpressionValidationError(f"Invalid expression syntax: {exc.msg}.") from exc


class _SafeExpressionValidator(ast.NodeVisitor):
    _ALLOWED_NODES = (
        ast.Expression,
        ast.BoolOp,
        ast.UnaryOp,
        ast.Compare,
        ast.IfExp,
        ast.Name,
        ast.Load,
        ast.Attribute,
        ast.Subscript,
        ast.Constant,
        ast.List,
        ast.Tuple,
        ast.Set,
        ast.Dict,
        ast.And,
        ast.Or,
        ast.Not,
        ast.Eq,
        ast.NotEq,
        ast.Gt,
        ast.GtE,
        ast.Lt,
        ast.LtE,
        ast.In,
        ast.NotIn,
        ast.Is,
        ast.IsNot,
    )

    def __init__(self, *, allowed_names: set[str] | frozenset[str]) -> None:
        self._allowed_names = set(allowed_names)

    def generic_visit(self, node: ast.AST) -> None:
        if not isinstance(node, self._ALLOWED_NODES):
            raise SafeExpressionValidationError(
                f"Unsupported expression syntax '{node.__class__.__name__}'."
            )
        super().generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if node.id not in self._allowed_names:
            raise SafeExpressionValidationError(
                f"Unknown expression variable '{node.id}'. "
                f"Allowed variables: {', '.join(sorted(self._allowed_names))}."
            )


class _SafeExpressionEvaluator(ast.NodeVisitor):
    def __init__(self, *, context: Mapping[str, object], description: str) -> None:
        self._context = dict(context)
        self._description = description

    def visit_Name(self, node: ast.Name) -> object:
        try:
            return self._context[node.id]
        except KeyError as exc:
            raise SafeExpressionEvaluationError(
                f"{self._description} referenced unknown variable '{node.id}'."
            ) from exc

    def visit_Constant(self, node: ast.Constant) -> object:
        return node.value

    def visit_List(self, node: ast.List) -> list[object]:
        return [self.visit(element) for element in node.elts]

    def visit_Tuple(self, node: ast.Tuple) -> tuple[object, ...]:
        return tuple(self.visit(element) for element in node.elts)

    def visit_Set(self, node: ast.Set) -> set[object]:
        return {self.visit(element) for element in node.elts}

    def visit_Dict(self, node: ast.Dict) -> dict[object, object]:
        return {
            self.visit(key): self.visit(value)
            for key, value in zip(node.keys, node.values, strict=True)
        }

    def visit_Attribute(self, node: ast.Attribute) -> object:
        return self._resolve_member(self.visit(node.value), node.attr)

    def visit_Subscript(self, node: ast.Subscript) -> object:
        return self._resolve_item(self.visit(node.value), self.visit(node.slice))

    def visit_BoolOp(self, node: ast.BoolOp) -> object:
        if isinstance(node.op, ast.And):
            result: object = True
            for value in node.values:
                result = self.visit(value)
                if not bool(result):
                    return result
            return result

        if isinstance(node.op, ast.Or):
            result: object = False
            for value in node.values:
                result = self.visit(value)
                if bool(result):
                    return result
            return result

        raise SafeExpressionEvaluationError(
            f"{self._description} uses unsupported boolean operator '{node.op.__class__.__name__}'."
        )

    def visit_UnaryOp(self, node: ast.UnaryOp) -> object:
        if isinstance(node.op, ast.Not):
            return not bool(self.visit(node.operand))
        raise SafeExpressionEvaluationError(
            f"{self._description} uses unsupported unary operator '{node.op.__class__.__name__}'."
        )

    def visit_IfExp(self, node: ast.IfExp) -> object:
        if bool(self.visit(node.test)):
            return self.visit(node.body)
        return self.visit(node.orelse)

    def visit_Compare(self, node: ast.Compare) -> bool:
        left = self.visit(node.left)
        for operator, comparator_node in zip(node.ops, node.comparators, strict=True):
            right = self.visit(comparator_node)
            if not self._compare(left, operator, right):
                return False
            left = right
        return True

    def generic_visit(self, node: ast.AST) -> object:
        raise SafeExpressionEvaluationError(
            f"{self._description} uses unsupported syntax '{node.__class__.__name__}'."
        )

    def _resolve_member(self, value: object, member: str) -> object:
        if value is MISSING:
            return MISSING
        if isinstance(value, Mapping):
            return value.get(member, MISSING)
        raise SafeExpressionEvaluationError(
            f"{self._description} can only use dotted access on objects/maps."
        )

    def _resolve_item(self, value: object, key: object) -> object:
        if value is MISSING:
            return MISSING
        if isinstance(value, Mapping):
            return value.get(key, MISSING)
        if isinstance(value, Sequence) and not isinstance(value, str | bytes | bytearray):
            if not isinstance(key, int):
                return MISSING
            if key < 0 or key >= len(value):
                return MISSING
            return value[key]
        return MISSING

    def _compare(self, left: object, operator: ast.AST, right: object) -> bool:
        if left is MISSING or right is MISSING:
            return False

        if isinstance(operator, ast.Eq):
            return left == right
        if isinstance(operator, ast.NotEq):
            return left != right
        if isinstance(operator, ast.Gt):
            return self._safe_binary_compare(left, right, lambda a, b: a > b)
        if isinstance(operator, ast.GtE):
            return self._safe_binary_compare(left, right, lambda a, b: a >= b)
        if isinstance(operator, ast.Lt):
            return self._safe_binary_compare(left, right, lambda a, b: a < b)
        if isinstance(operator, ast.LtE):
            return self._safe_binary_compare(left, right, lambda a, b: a <= b)
        if isinstance(operator, ast.In):
            try:
                return left in right
            except TypeError:
                return False
        if isinstance(operator, ast.NotIn):
            try:
                return left not in right
            except TypeError:
                return False
        if isinstance(operator, ast.Is):
            return left is right
        if isinstance(operator, ast.IsNot):
            return left is not right
        raise SafeExpressionEvaluationError(
            f"{self._description} uses unsupported comparison operator "
            f"'{operator.__class__.__name__}'."
        )

    def _safe_binary_compare(self, left: object, right: object, comparator) -> bool:
        try:
            return bool(comparator(left, right))
        except TypeError:
            return False
