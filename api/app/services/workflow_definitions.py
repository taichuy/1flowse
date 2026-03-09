from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from app.schemas.workflow import WorkflowDefinitionDocument


class WorkflowDefinitionValidationError(ValueError):
    pass


def validate_workflow_definition(definition: dict[str, Any] | None) -> dict[str, Any]:
    try:
        document = WorkflowDefinitionDocument.model_validate(definition or {})
    except ValidationError as exc:
        messages = []
        for error in exc.errors():
            location = ".".join(str(item) for item in error["loc"])
            if location:
                messages.append(f"{location}: {error['msg']}")
            else:
                messages.append(error["msg"])
        raise WorkflowDefinitionValidationError("; ".join(messages)) from exc

    return document.model_dump(mode="python", exclude_none=True)


def bump_workflow_version(version: str) -> str:
    parts = version.split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise WorkflowDefinitionValidationError(
            "Workflow version must use semantic version format 'major.minor.patch'."
        )
    major, minor, patch = (int(part) for part in parts)
    return f"{major}.{minor}.{patch + 1}"
