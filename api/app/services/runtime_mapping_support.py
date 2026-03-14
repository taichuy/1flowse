from __future__ import annotations

from copy import deepcopy

from app.core.safe_expressions import MISSING
from app.services.runtime_types import WorkflowExecutionError


class RuntimeMappingSupportMixin:
    def _accumulated_input_for_node(self, upstream: dict, mapped: dict) -> dict:
        if mapped:
            return deepcopy(mapped)
        return deepcopy(upstream)

    def _overlay_mapped_input(self, node_input: dict, mapped: dict) -> dict:
        merged_input = deepcopy(node_input)
        return self._deep_merge_dicts(merged_input, mapped)

    def _deep_merge_dicts(self, base: dict, override: dict) -> dict:
        for key, value in override.items():
            if isinstance(base.get(key), dict) and isinstance(value, dict):
                self._deep_merge_dicts(base[key], value)
                continue
            base[key] = deepcopy(value)
        return base

    def _apply_edge_mappings(
        self,
        edge: dict,
        source_node: dict,
        target_node: dict,
        source_output: dict,
        mapped_input: dict,
    ) -> None:
        mappings = edge.get("mapping") or []
        if not mappings:
            return

        merge_strategy = self._join_policy_for_node(target_node).merge_strategy
        for mapping in mappings:
            source_value = self._resolve_mapping_source_value(source_output, mapping)
            if source_value is MISSING:
                continue
            transformed_value = self._transform_mapping_value(source_value, mapping)
            self._merge_mapping_target_value(
                mapped_input=mapped_input,
                target_field=str(mapping["targetField"]),
                value=transformed_value,
                merge_strategy=merge_strategy,
                edge=edge,
                target_node=target_node,
            )

    def _resolve_mapping_source_value(self, source_output: dict, mapping: dict) -> object:
        source_field = str(mapping["sourceField"])
        normalized_source_field = (
            source_field[7:] if source_field.startswith("output.") else source_field
        )
        source_value = self._resolve_selector_path(source_output, normalized_source_field)
        if source_value is not MISSING:
            return source_value
        if "fallback" in mapping:
            return mapping.get("fallback")
        return MISSING

    def _transform_mapping_value(self, value: object, mapping: dict) -> object:
        transform = mapping.get("transform") or {"type": "identity"}
        transform_type = str(transform.get("type", "identity"))
        if transform_type == "identity":
            transformed = value
        elif transform_type == "toString":
            transformed = "" if value is None else str(value)
        elif transform_type == "toNumber":
            transformed = self._to_mapping_number(value)
        elif transform_type == "toBoolean":
            transformed = self._to_mapping_boolean(value)
        else:
            raise WorkflowExecutionError(
                f"Unsupported field mapping transform '{transform_type}'."
            )

        template = mapping.get("template")
        if isinstance(template, str):
            return template.replace("{{value}}", self._stringify_template_value(transformed))
        return transformed

    def _to_mapping_number(self, value: object) -> int | float:
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, int | float):
            return value
        if isinstance(value, str):
            normalized = value.strip()
            if not normalized:
                raise WorkflowExecutionError("Cannot convert empty string to number.")
            try:
                return int(normalized) if normalized.isdigit() else float(normalized)
            except ValueError as exc:
                raise WorkflowExecutionError(
                    f"Cannot convert mapping value '{value}' to number."
                ) from exc
        raise WorkflowExecutionError(f"Cannot convert mapping value '{value}' to number.")

    def _to_mapping_boolean(self, value: object) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, int | float):
            return bool(value)
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "yes", "on"}:
                return True
            if normalized in {"false", "0", "no", "off", ""}:
                return False
        return bool(value)

    def _stringify_template_value(self, value: object) -> str:
        if value is None:
            return ""
        if isinstance(value, str):
            return value
        return str(value)

    def _merge_mapping_target_value(
        self,
        mapped_input: dict,
        target_field: str,
        value: object,
        merge_strategy: str,
        edge: dict,
        target_node: dict,
    ) -> None:
        target_tokens = self._target_path_tokens(target_field)
        current = mapped_input
        for token in target_tokens[:-1]:
            current = current.setdefault(token, {})
            if not isinstance(current, dict):
                raise WorkflowExecutionError(
                    f"Field mapping target '{target_field}' conflicts with an "
                    "existing scalar value."
                )

        leaf_key = target_tokens[-1]
        if leaf_key not in current:
            if merge_strategy == "append":
                current[leaf_key] = [deepcopy(value)]
            else:
                current[leaf_key] = deepcopy(value)
            return

        existing_value = current[leaf_key]
        if merge_strategy == "error":
            raise WorkflowExecutionError(
                f"Node '{target_node['id']}' received conflicting field mapping for "
                f"'{target_field}' from edge '{edge.get('id', '<unknown>')}'."
            )
        if merge_strategy == "overwrite":
            current[leaf_key] = deepcopy(value)
            return
        if merge_strategy == "keep_first":
            return
        if merge_strategy == "append":
            if isinstance(existing_value, list):
                existing_value.append(deepcopy(value))
            else:
                current[leaf_key] = [existing_value, deepcopy(value)]
            return
        raise WorkflowExecutionError(
            f"Node '{target_node['id']}' uses unsupported join mergeStrategy '{merge_strategy}'."
        )

    def _target_path_tokens(self, path: str) -> list[str]:
        tokens = [segment for segment in path.split(".") if segment]
        if not tokens:
            raise WorkflowExecutionError("Field mapping targetField must not be empty.")
        return tokens
