from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from app.schemas.workflow_node_validation import WorkflowNodeSkillBindingPolicy
from app.services.skill_catalog import SkillCatalogReferenceIndexItem


@dataclass(frozen=True)
class WorkflowSkillReferenceIssue:
    message: str
    path: str
    field: str


def collect_invalid_workflow_skill_references(
    definition: dict[str, Any] | None,
    *,
    skill_index: Mapping[str, Any] | None = None,
    skill_reference_ids_index: Mapping[str, SkillCatalogReferenceIndexItem] | None = None,
) -> list[WorkflowSkillReferenceIssue]:
    if not definition or not isinstance(definition, dict):
        return []
    if skill_index is None:
        skill_index = {}
    if skill_reference_ids_index is None:
        skill_reference_ids_index = {}

    issues: list[WorkflowSkillReferenceIssue] = []
    for node_index, node in enumerate(definition.get("nodes") or []):
        if not isinstance(node, dict):
            continue
        if node.get("type") != "llmAgentNode":
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
                        f"LLM agent node '{node_label}' references missing skill "
                        f"document '{skill_id}'."
                    ),
                    path=f"nodes.{node_index}.config.skillIds.{skill_index_position}",
                    field="skillIds",
                )
            )

        raw_skill_binding = config.get("skillBinding")
        if not isinstance(raw_skill_binding, dict):
            continue
        try:
            skill_binding = WorkflowNodeSkillBindingPolicy.model_validate(raw_skill_binding)
        except Exception:
            continue

        bound_skill_ids = {
            str(raw_skill_id or "").strip()
            for raw_skill_id in raw_skill_ids
            if str(raw_skill_id or "").strip()
        }
        for reference_position, reference in enumerate(skill_binding.references):
            if reference.skillId not in bound_skill_ids:
                issues.append(
                    WorkflowSkillReferenceIssue(
                        message=(
                            f"LLM agent node '{node_label}' binds skill reference "
                            f"'{reference.skillId}:{reference.referenceId}' but skill "
                            f"'{reference.skillId}' "
                            "is not present in config.skillIds."
                        ),
                        path=f"nodes.{node_index}.config.skillBinding.references.{reference_position}.skillId",
                        field="skillBinding.references",
                    )
                )
                continue

            reference_index_item = skill_reference_ids_index.get(reference.skillId)
            available_reference_ids = (
                reference_index_item.reference_ids
                if reference_index_item is not None
                else frozenset()
            )
            if reference.referenceId in available_reference_ids:
                continue
            issues.append(
                WorkflowSkillReferenceIssue(
                    message=(
                        f"LLM agent node '{node_label}' references missing skill reference "
                        f"'{reference.skillId}:{reference.referenceId}'."
                    ),
                    path=f"nodes.{node_index}.config.skillBinding.references.{reference_position}.referenceId",
                    field="skillBinding.references",
                )
            )
    return issues
