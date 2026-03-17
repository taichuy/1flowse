from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.skill import SkillRecord, SkillReferenceRecord
from app.schemas.skill import (
    SkillDocCreate,
    SkillDocDetail,
    SkillDocListItem,
    SkillDocUpdate,
    SkillPromptDoc,
    SkillPromptReference,
    SkillReferenceDocDetail,
    SkillReferenceDocSummary,
)


class SkillCatalogError(ValueError):
    pass


@dataclass(frozen=True)
class SkillCatalogReferenceIndexItem:
    reference_ids: frozenset[str]


class SkillCatalogService:
    def list_skills(
        self,
        db: Session,
        *,
        workspace_id: str = "default",
    ) -> list[SkillDocListItem]:
        records = db.scalars(
            select(SkillRecord)
            .where(SkillRecord.workspace_id == workspace_id)
            .order_by(SkillRecord.name.asc(), SkillRecord.id.asc())
        ).all()
        reference_counts = self._reference_counts_by_skill(db, [record.id for record in records])
        return [
            SkillDocListItem(
                id=record.id,
                workspace_id=record.workspace_id,
                name=record.name,
                description=record.description,
                reference_count=reference_counts.get(record.id, 0),
                updated_at=record.updated_at,
            )
            for record in records
        ]

    def get_skill(
        self,
        db: Session,
        *,
        skill_id: str,
        workspace_id: str = "default",
    ) -> SkillRecord | None:
        record = db.get(SkillRecord, skill_id)
        if record is None or record.workspace_id != workspace_id:
            return None
        return record

    def get_reference(
        self,
        db: Session,
        *,
        skill_id: str,
        reference_id: str,
        workspace_id: str = "default",
    ) -> SkillReferenceRecord | None:
        skill = self.get_skill(db, skill_id=skill_id, workspace_id=workspace_id)
        if skill is None:
            return None
        reference = db.get(SkillReferenceRecord, reference_id)
        if reference is None or reference.skill_id != skill.id:
            return None
        return reference

    def create_skill(self, db: Session, payload: SkillDocCreate) -> SkillRecord:
        skill_id = payload.id.strip() if payload.id else str(uuid4())
        if db.get(SkillRecord, skill_id) is not None:
            raise SkillCatalogError(f"Skill '{skill_id}' already exists.")

        record = SkillRecord(
            id=skill_id,
            workspace_id=payload.workspace_id,
            name=payload.name,
            description=payload.description,
            body=payload.body,
        )
        db.add(record)
        db.flush()
        self._replace_references(
            db,
            skill_id=record.id,
            references=[reference.model_dump(mode="python") for reference in payload.references],
        )
        db.flush()
        return record

    def update_skill(
        self,
        db: Session,
        *,
        record: SkillRecord,
        payload: SkillDocUpdate,
    ) -> SkillRecord:
        if payload.name is not None:
            record.name = payload.name
        if payload.description is not None:
            record.description = payload.description
        if payload.body is not None:
            record.body = payload.body
        db.add(record)
        db.flush()
        if payload.references is not None:
            self._replace_references(
                db,
                skill_id=record.id,
                references=[
                    reference.model_dump(mode="python")
                    for reference in payload.references
                ],
            )
        db.flush()
        return record

    def delete_skill(self, db: Session, *, record: SkillRecord) -> None:
        db.execute(delete(SkillReferenceRecord).where(SkillReferenceRecord.skill_id == record.id))
        db.delete(record)

    def serialize_detail(self, db: Session, record: SkillRecord) -> SkillDocDetail:
        references = self._list_reference_records(db, skill_id=record.id)
        return SkillDocDetail(
            id=record.id,
            workspace_id=record.workspace_id,
            name=record.name,
            description=record.description,
            body=record.body,
            references=[self.serialize_reference_summary(reference) for reference in references],
            created_at=record.created_at,
            updated_at=record.updated_at,
        )

    @staticmethod
    def serialize_reference_summary(reference: SkillReferenceRecord) -> SkillReferenceDocSummary:
        return SkillReferenceDocSummary(
            id=reference.id,
            name=reference.name,
            description=reference.description,
        )

    @staticmethod
    def serialize_reference_detail(reference: SkillReferenceRecord) -> SkillReferenceDocDetail:
        return SkillReferenceDocDetail(
            id=reference.id,
            name=reference.name,
            description=reference.description,
            body=reference.body,
        )

    def build_prompt_docs(
        self,
        db: Session,
        *,
        skill_ids: Sequence[str],
        workspace_id: str = "default",
        selected_reference_ids_by_skill: Mapping[str, Sequence[str]] | None = None,
        prompt_budget_chars: int | None = None,
    ) -> list[SkillPromptDoc]:
        normalized_skill_ids = self._normalize_skill_ids(skill_ids)
        if not normalized_skill_ids:
            return []

        records = db.scalars(
            select(SkillRecord)
            .where(
                SkillRecord.workspace_id == workspace_id,
                SkillRecord.id.in_(normalized_skill_ids),
            )
            .order_by(SkillRecord.name.asc(), SkillRecord.id.asc())
        ).all()
        record_by_id = {record.id: record for record in records}
        missing_skill_ids = [
            skill_id
            for skill_id in normalized_skill_ids
            if skill_id not in record_by_id
        ]
        if missing_skill_ids:
            raise SkillCatalogError(
                "Missing skill documents: " + ", ".join(missing_skill_ids)
            )

        reference_rows = db.scalars(
            select(SkillReferenceRecord)
            .where(SkillReferenceRecord.skill_id.in_(normalized_skill_ids))
            .order_by(SkillReferenceRecord.name.asc(), SkillReferenceRecord.id.asc())
        ).all()
        references_by_skill: dict[str, list[SkillReferenceRecord]] = {}
        for reference in reference_rows:
            references_by_skill.setdefault(reference.skill_id, []).append(reference)

        normalized_reference_selections = self._normalize_reference_selections(
            selected_reference_ids_by_skill
        )
        self._ensure_selected_references_exist(
            normalized_skill_ids=normalized_skill_ids,
            references_by_skill=references_by_skill,
            selected_reference_ids_by_skill=normalized_reference_selections,
        )

        remaining_budget = None
        if isinstance(prompt_budget_chars, int) and prompt_budget_chars > 0:
            remaining_budget = prompt_budget_chars

        prompt_docs: list[SkillPromptDoc] = []
        for skill_id in normalized_skill_ids:
            record = record_by_id[skill_id]
            body, remaining_budget = self._consume_prompt_budget(record.body, remaining_budget)
            selected_reference_ids = normalized_reference_selections.get(skill_id, frozenset())
            prompt_references: list[SkillPromptReference] = []
            for reference in references_by_skill.get(record.id, []):
                reference_body: str | None = None
                if reference.id in selected_reference_ids:
                    reference_body, remaining_budget = self._consume_prompt_budget(
                        reference.body,
                        remaining_budget,
                    )
                prompt_references.append(
                    SkillPromptReference(
                        id=reference.id,
                        name=reference.name,
                        description=reference.description,
                        body=reference_body,
                    )
                )
            prompt_docs.append(
                SkillPromptDoc(
                    id=record.id,
                    name=record.name,
                    description=record.description,
                    body=body,
                    references=prompt_references,
                )
            )
        return prompt_docs

    def build_reference_index(
        self,
        db: Session,
        *,
        workspace_id: str = "default",
    ) -> dict[str, SkillDocListItem]:
        return {
            item.id: item
            for item in self.list_skills(
                db,
                workspace_id=workspace_id,
            )
        }

    def build_reference_ids_by_skill(
        self,
        db: Session,
        *,
        workspace_id: str = "default",
    ) -> dict[str, SkillCatalogReferenceIndexItem]:
        skill_ids = tuple(self.build_reference_index(db, workspace_id=workspace_id).keys())
        if not skill_ids:
            return {}

        reference_ids_by_skill: dict[str, set[str]] = {}
        for reference in db.scalars(
            select(SkillReferenceRecord).where(SkillReferenceRecord.skill_id.in_(skill_ids))
        ).all():
            reference_ids_by_skill.setdefault(reference.skill_id, set()).add(reference.id)

        return {
            skill_id: SkillCatalogReferenceIndexItem(
                reference_ids=frozenset(reference_ids_by_skill.get(skill_id, set()))
            )
            for skill_id in skill_ids
        }

    def _replace_references(
        self,
        db: Session,
        *,
        skill_id: str,
        references: Sequence[Mapping[str, object]],
    ) -> None:
        db.execute(delete(SkillReferenceRecord).where(SkillReferenceRecord.skill_id == skill_id))
        for reference in references:
            reference_id = reference.get("id")
            record = SkillReferenceRecord(
                id=(
                    str(reference_id).strip()
                    if isinstance(reference_id, str) and reference_id.strip()
                    else str(uuid4())
                ),
                skill_id=skill_id,
                name=str(reference.get("name") or "").strip(),
                description=str(reference.get("description") or ""),
                body=str(reference.get("body") or ""),
            )
            db.add(record)

    def _list_reference_records(
        self,
        db: Session,
        *,
        skill_id: str,
    ) -> list[SkillReferenceRecord]:
        return db.scalars(
            select(SkillReferenceRecord)
            .where(SkillReferenceRecord.skill_id == skill_id)
            .order_by(SkillReferenceRecord.name.asc(), SkillReferenceRecord.id.asc())
        ).all()

    def _reference_counts_by_skill(
        self,
        db: Session,
        skill_ids: Sequence[str],
    ) -> dict[str, int]:
        normalized_skill_ids = self._normalize_skill_ids(skill_ids)
        if not normalized_skill_ids:
            return {}
        counts: dict[str, int] = {}
        for reference in db.scalars(
            select(SkillReferenceRecord).where(SkillReferenceRecord.skill_id.in_(normalized_skill_ids))
        ).all():
            counts[reference.skill_id] = counts.get(reference.skill_id, 0) + 1
        return counts

    @staticmethod
    def _normalize_reference_selections(
        selected_reference_ids_by_skill: Mapping[str, Sequence[str]] | None,
    ) -> dict[str, frozenset[str]]:
        if not selected_reference_ids_by_skill:
            return {}

        normalized: dict[str, frozenset[str]] = {}
        for raw_skill_id, raw_reference_ids in selected_reference_ids_by_skill.items():
            skill_id = str(raw_skill_id or "").strip()
            if not skill_id:
                continue
            normalized_reference_ids = {
                str(reference_id).strip()
                for reference_id in raw_reference_ids
                if str(reference_id).strip()
            }
            if normalized_reference_ids:
                normalized[skill_id] = frozenset(sorted(normalized_reference_ids))
        return normalized

    @staticmethod
    def _ensure_selected_references_exist(
        *,
        normalized_skill_ids: Sequence[str],
        references_by_skill: Mapping[str, Sequence[SkillReferenceRecord]],
        selected_reference_ids_by_skill: Mapping[str, frozenset[str]],
    ) -> None:
        missing_references: list[str] = []
        selected_skill_ids = set(selected_reference_ids_by_skill)
        missing_skill_ids = sorted(selected_skill_ids.difference(normalized_skill_ids))
        if missing_skill_ids:
            raise SkillCatalogError(
                "Selected skill reference bindings target missing skills: "
                + ", ".join(missing_skill_ids)
            )

        for skill_id, selected_reference_ids in selected_reference_ids_by_skill.items():
            available_reference_ids = {
                reference.id for reference in references_by_skill.get(skill_id, [])
            }
            for reference_id in selected_reference_ids:
                if reference_id not in available_reference_ids:
                    missing_references.append(f"{skill_id}:{reference_id}")

        if missing_references:
            raise SkillCatalogError(
                "Missing skill references: " + ", ".join(sorted(missing_references))
            )

    @staticmethod
    def _consume_prompt_budget(
        value: str,
        remaining_budget: int | None,
    ) -> tuple[str, int | None]:
        if remaining_budget is None:
            return value, None
        if remaining_budget <= 0:
            return "", 0
        if len(value) <= remaining_budget:
            return value, remaining_budget - len(value)
        if remaining_budget <= 1:
            return value[:remaining_budget], 0
        return value[: remaining_budget - 1] + "…", 0

    @staticmethod
    def _normalize_skill_ids(skill_ids: Sequence[str]) -> list[str]:
        normalized: list[str] = []
        for raw_skill_id in skill_ids:
            skill_id = raw_skill_id.strip()
            if skill_id and skill_id not in normalized:
                normalized.append(skill_id)
        return normalized
