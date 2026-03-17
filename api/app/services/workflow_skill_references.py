from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from app.schemas.skill import SkillDocListItem


@dataclass(frozen=True)
class WorkflowSkillReferenceIssue:
    message: str
    path: str
    field: str


def collect_invalid_workflow_skill_references(
    definition: dict[str, Any] | None,
    *,
    skill_index: Mapping[str, SkillDocListItem] | None = None,
) -> list[WorkflowSkillReferenceIssue]:
    if not definition or not isinstance(definition, dict):
        return []
    if skill_index is None:
        skill_index = {}

    issues: list[WorkflowSkillReferenceIssue] = []
    for node_index, node in enumerate(definition.get("nodes") or []):
        if not isinstance(node, dict):
            continue
        if node.get("type") != "llm_agent":
            continue
        config = node.get("config") or {}
        if not isinstance(config, dict):
            continue
        raw_skill_ids = config.get("skillIds") or []
        if not isinstance(raw_skill_ids, list):
            continue

        node_label = str(node.get("name") or node.get("id") or f"node-{node_index}")
        for skill_index_position, raw_skill_id in enumerate(raw_skill_ids):
            skill_id = str(raw_skill_id or "").strip()
            if not skill_id:
                continue
            if skill_id in skill_index:
                continue
            issues.append(
                WorkflowSkillReferenceIssue(
                    message=(
                        f"LLM agent node '{node_label}' references missing skill document '{skill_id}'."
                    ),
                    path=f"nodes.{node_index}.config.skillIds.{skill_index_position}",
                    field="skillIds",
                )
            )
    return issues
