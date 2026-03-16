from __future__ import annotations

from typing import Any

from app.services.workflow_definitions import WorkflowDefinitionValidationIssue


def collect_workspace_starter_portability_issues(
    definition: dict[str, Any] | None,
) -> list[WorkflowDefinitionValidationIssue]:
    if not isinstance(definition, dict):
        return []

    publish_entries = definition.get("publish")
    if not isinstance(publish_entries, list):
        return []

    issues: list[WorkflowDefinitionValidationIssue] = []
    for index, raw_entry in enumerate(publish_entries):
        if not isinstance(raw_entry, dict):
            continue

        workflow_version = raw_entry.get("workflowVersion")
        if not isinstance(workflow_version, str):
            continue

        normalized_workflow_version = workflow_version.strip()
        if not normalized_workflow_version:
            continue

        endpoint_id = str(raw_entry.get("id") or f"publish[{index}]")
        issues.append(
            WorkflowDefinitionValidationIssue(
                category="starter_portability",
                message=(
                    f"Workspace starter publish endpoint '{endpoint_id}' pins workflowVersion "
                    f"'{normalized_workflow_version}', which is not portable when the starter is "
                    "reused by a new workflow. Clear workflowVersion so the derived workflow can "
                    "publish against its own saved version."
                ),
                path=f"publish.{index}.workflowVersion",
                field="workflowVersion",
            )
        )

    return issues
