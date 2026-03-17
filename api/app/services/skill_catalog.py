from __future__ import annotations

from collections.abc import Mapping, Sequence
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
                references=[reference.model_dump(mode="python") for reference in payload.references],
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
        missing_skill_ids = [skill_id for skill_id in normalized_skill_ids if skill_id not in record_by_id]
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

        prompt_docs: list[SkillPromptDoc] = []
        for skill_id in normalized_skill_ids:
            record = record_by_id[skill_id]
            prompt_docs.append(
                SkillPromptDoc(
                    id=record.id,
                    name=record.name,
                    description=record.description,
                    body=record.body,
                    references=[
                        SkillPromptReference(
                            id=reference.id,
                            name=reference.name,
                            description=reference.description,
                        )
                        for reference in references_by_skill.get(record.id, [])
                    ],
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
                id=str(reference_id).strip() if isinstance(reference_id, str) and reference_id.strip() else str(uuid4()),
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
    def _normalize_skill_ids(skill_ids: Sequence[str]) -> list[str]:
        normalized: list[str] = []
        for raw_skill_id in skill_ids:
            skill_id = raw_skill_id.strip()
            if skill_id and skill_id not in normalized:
                normalized.append(skill_id)
        return normalized
