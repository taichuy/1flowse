from __future__ import annotations

from typing import Any

from app.catalog import build_execution_contract
from app.schemas import AdapterExecutionContract, AdapterToolItem


class InvocationValidationError(ValueError):
    pass


def validate_invocation_request(
    *,
    tool: AdapterToolItem,
    execution_contract: AdapterExecutionContract,
    inputs: dict[str, Any],
    credentials: dict[str, str],
) -> tuple[dict[str, Any], dict[str, str]]:
    expected_contract = build_execution_contract(tool)
    if execution_contract.model_dump() != expected_contract.model_dump():
        raise InvocationValidationError(
            f"Tool '{tool.id}' received an execution contract that does not match the local catalog."
        )

    fields_by_name = {field.name: field for field in expected_contract.inputContract}
    allowed_input_fields = {
        name for name, field in fields_by_name.items() if field.valueSource != "credential"
    }
    allowed_credential_fields = set(expected_contract.constraints.credentialFields)
    additional_properties = expected_contract.constraints.additionalProperties

    extra_inputs = sorted(set(inputs) - allowed_input_fields)
    if extra_inputs and not additional_properties:
        raise InvocationValidationError(
            f"Tool '{tool.id}' received unsupported input fields: {', '.join(extra_inputs)}."
        )

    extra_credentials = sorted(set(credentials) - allowed_credential_fields)
    if extra_credentials and not additional_properties:
        raise InvocationValidationError(
            f"Tool '{tool.id}' received unsupported credential fields: "
            f"{', '.join(extra_credentials)}."
        )

    normalized_inputs: dict[str, Any] = {}
    normalized_credentials: dict[str, str] = {}
    for name, field in fields_by_name.items():
        if field.valueSource == "credential":
            if name in inputs:
                raise InvocationValidationError(
                    f"Tool '{tool.id}' must receive credential field '{name}' via credentials, "
                    "not inputs."
                )
            if name not in credentials:
                if field.required:
                    raise InvocationValidationError(
                        f"Tool '{tool.id}' is missing required credential '{name}'."
                    )
                continue
            value = credentials[name]
            _validate_field_value(tool_id=tool.id, field_name=name, value=value, schema=field.jsonSchema)
            normalized_credentials[name] = value
            continue

        if name in credentials:
            raise InvocationValidationError(
                f"Tool '{tool.id}' must receive field '{name}' via inputs, not credentials."
            )
        if name not in inputs:
            if field.required:
                raise InvocationValidationError(
                    f"Tool '{tool.id}' is missing required input '{name}'."
                )
            continue
        value = inputs[name]
        _validate_field_value(tool_id=tool.id, field_name=name, value=value, schema=field.jsonSchema)
        normalized_inputs[name] = value

    return normalized_inputs, normalized_credentials


def _validate_field_value(
    *,
    tool_id: str,
    field_name: str,
    value: Any,
    schema: dict[str, Any],
) -> None:
    schema_type = str(schema.get("type") or "").strip()
    if schema_type == "string" and not isinstance(value, str):
        raise InvocationValidationError(f"Tool '{tool_id}' field '{field_name}' expects a string.")
    if schema_type == "number" and (not isinstance(value, (int, float)) or isinstance(value, bool)):
        raise InvocationValidationError(f"Tool '{tool_id}' field '{field_name}' expects a number.")
    if schema_type == "integer" and (not isinstance(value, int) or isinstance(value, bool)):
        raise InvocationValidationError(f"Tool '{tool_id}' field '{field_name}' expects an integer.")
    if schema_type == "boolean" and not isinstance(value, bool):
        raise InvocationValidationError(f"Tool '{tool_id}' field '{field_name}' expects a boolean.")
    if schema_type == "object" and not isinstance(value, dict):
        raise InvocationValidationError(f"Tool '{tool_id}' field '{field_name}' expects an object.")
    if schema_type == "array" and not isinstance(value, list):
        raise InvocationValidationError(f"Tool '{tool_id}' field '{field_name}' expects an array.")

    enum_values = schema.get("enum")
    if isinstance(enum_values, list) and value not in enum_values:
        raise InvocationValidationError(
            f"Tool '{tool_id}' field '{field_name}' must be one of "
            f"{', '.join(str(item) for item in enum_values)}."
        )
