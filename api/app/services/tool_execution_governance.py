from __future__ import annotations

from collections.abc import Iterable, Mapping

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sensitive_access import SensitiveResourceRecord

_EXECUTION_CLASS_ORDER = {
    "inline": 0,
    "subprocess": 1,
    "sandbox": 2,
    "microvm": 3,
}

_SENSITIVITY_DEFAULT_EXECUTION_CLASS = {
    "L2": "sandbox",
    "L3": "microvm",
}

_SENSITIVITY_ORDER = {"L0": 0, "L1": 1, "L2": 2, "L3": 3}


def sensitivity_default_execution_class(sensitivity_level: str | None) -> str | None:
    if not isinstance(sensitivity_level, str):
        return None
    return _SENSITIVITY_DEFAULT_EXECUTION_CLASS.get(sensitivity_level.strip().upper())


def governed_default_execution_class(
    *,
    configured_default_execution_class: str | None,
    sensitivity_level: str | None,
) -> str | None:
    configured = _normalize_execution_class(configured_default_execution_class)
    sensitivity_default = _normalize_execution_class(
        sensitivity_default_execution_class(sensitivity_level)
    )
    if configured is None:
        return sensitivity_default
    if sensitivity_default is None:
        return configured
    if _EXECUTION_CLASS_ORDER[configured] >= _EXECUTION_CLASS_ORDER[sensitivity_default]:
        return configured
    return sensitivity_default


def build_tool_sensitivity_index(
    db: Session,
) -> dict[tuple[str, str | None, str | None], str]:
    statement = select(SensitiveResourceRecord).where(
        SensitiveResourceRecord.source == "local_capability"
    )
    index: dict[tuple[str, str | None, str | None], str] = {}
    for record in db.scalars(statement):
        metadata_payload = record.metadata_payload or {}
        workflow_id = _normalize_optional_string(metadata_payload.get("workflow_id"))
        if workflow_id is not None:
            continue
        tool_id = _normalize_optional_string(
            metadata_payload.get("tool_id") or metadata_payload.get("toolId")
        )
        if tool_id is None:
            continue
        ecosystem = _normalize_optional_string(metadata_payload.get("ecosystem"))
        adapter_id = _normalize_optional_string(
            metadata_payload.get("adapter_id") or metadata_payload.get("adapterId")
        )
        level = _normalize_sensitivity_level(record.sensitivity_level)
        if level is None:
            continue
        index[(tool_id, ecosystem, adapter_id)] = level
    return index


def resolve_tool_sensitivity_level(
    *,
    tool_id: str,
    ecosystem: str | None,
    adapter_id: str | None,
    sensitivity_index: Mapping[tuple[str, str | None, str | None], str] | None,
) -> str | None:
    if sensitivity_index is None:
        return None
    normalized_tool_id = _normalize_optional_string(tool_id)
    if normalized_tool_id is None:
        return None
    normalized_ecosystem = _normalize_optional_string(ecosystem)
    normalized_adapter_id = _normalize_optional_string(adapter_id)
    candidates: Iterable[tuple[str, str | None, str | None]] = (
        (normalized_tool_id, normalized_ecosystem, normalized_adapter_id),
        (normalized_tool_id, normalized_ecosystem, None),
        (normalized_tool_id, None, normalized_adapter_id),
        (normalized_tool_id, None, None),
    )
    for key in candidates:
        level = sensitivity_index.get(key)
        if level is not None:
            return level
    fallback_level: str | None = None
    for (
        candidate_tool_id,
        candidate_ecosystem,
        _candidate_adapter_id,
    ), level in sensitivity_index.items():
        if candidate_tool_id != normalized_tool_id:
            continue
        if candidate_ecosystem not in {None, normalized_ecosystem}:
            continue
        if fallback_level is None or _SENSITIVITY_ORDER[level] > _SENSITIVITY_ORDER[fallback_level]:
            fallback_level = level
    if fallback_level is not None:
        return fallback_level
    return None


def _normalize_execution_class(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    if normalized not in _EXECUTION_CLASS_ORDER:
        return None
    return normalized


def _normalize_optional_string(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_sensitivity_level(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().upper()
    if normalized not in {"L0", "L1", "L2", "L3"}:
        return None
    return normalized
