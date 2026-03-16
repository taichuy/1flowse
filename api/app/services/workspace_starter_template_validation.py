from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.workflow_definitions import (
    WorkflowDefinitionValidationError,
    build_workflow_adapter_reference_list,
    build_workflow_tool_reference_index,
    bump_workflow_version,
    validate_persistable_workflow_definition,
)
from app.services.workflow_publish_version_references import (
    build_allowed_publish_workflow_versions,
)
from app.services.workspace_starter_portability_validation import (
    collect_workspace_starter_portability_issues,
)


def build_allowed_publish_versions_for_template(
    db: Session,
    *,
    workflow_id: str | None,
    workflow_version: str | None,
    allow_next_version: bool,
) -> set[str] | None:
    normalized_workflow_version = workflow_version.strip() if workflow_version else None
    if workflow_id is None and not normalized_workflow_version:
        return None

    allowed_versions = build_allowed_publish_workflow_versions(
        db,
        workflow_id=workflow_id,
        current_version=normalized_workflow_version,
    )
    if allow_next_version and normalized_workflow_version:
        try:
            allowed_versions.add(bump_workflow_version(normalized_workflow_version))
        except ValueError:
            pass
    return allowed_versions


def normalize_workspace_starter_tags(tags: list[str]) -> list[str]:
    normalized_tags: list[str] = []
    for raw_tag in tags:
        tag = raw_tag.strip()
        if tag and tag not in normalized_tags:
            normalized_tags.append(tag)
    return normalized_tags


def validate_workspace_starter_definition(
    db: Session,
    *,
    workspace_id: str,
    definition: dict,
    workflow_id: str | None,
    workflow_version: str | None,
    allow_next_version: bool,
) -> dict:
    validated_definition = validate_persistable_workflow_definition(
        definition,
        tool_index=build_workflow_tool_reference_index(
            db,
            workspace_id=workspace_id,
        ),
        adapters=build_workflow_adapter_reference_list(
            db,
            workspace_id=workspace_id,
        ),
        allowed_publish_versions=build_allowed_publish_versions_for_template(
            db,
            workflow_id=workflow_id,
            workflow_version=workflow_version,
            allow_next_version=allow_next_version,
        ),
    )
    portability_issues = collect_workspace_starter_portability_issues(
        validated_definition
    )
    if portability_issues:
        raise WorkflowDefinitionValidationError(
            "Workspace starter definition contains publish version pins that are not portable for starter reuse: "
            + "; ".join(issue.message for issue in portability_issues),
            issues=portability_issues,
        )
    return validated_definition
