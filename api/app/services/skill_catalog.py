from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from urllib.parse import urlencode
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.skill import SkillRecord, SkillReferenceRecord
from app.schemas.skill import (
    SkillDocCreate,
    SkillDocDetail,
    SkillDocListItem,
    SkillDocUpdate,
    SkillMcpResponse,
    SkillPromptDoc,
    SkillPromptReference,
    SkillReferenceDocDetail,
    SkillReferenceDocSummary,
    SkillReferenceRetrieval,
)


class SkillCatalogError(ValueError):
    pass


_REFERENCE_QUERY_TOKEN_RE = re.compile(r"[A-Za-z0-9_]{3,}|[\u4e00-\u9fff]{2,}")
_REFERENCE_REASON_STOPWORDS = frozenset(
    {
        "and",
        "the",
        "with",
        "this",
        "that",
        "from",
        "into",
        "before",
        "after",
        "over",
        "under",
        "need",
    }
)


@dataclass(frozen=True)
class SkillCatalogReferenceIndexItem:
    reference_ids: frozenset[str]


@dataclass(frozen=True)
class SkillCatalogReferenceSuggestionItem:
    reference_id: str
    score: int
    matched_terms: tuple[str, ...] = ()

    @property
    def fetch_reason(self) -> str | None:
        if not self.matched_terms:
            return None
        return "Matched query terms: " + ", ".join(self.matched_terms)


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
            selected_reference_ids = normalized_reference_selections.get(skill_id, ())
            selected_reference_id_set = set(selected_reference_ids)
            selected_reference_order = {
                reference_id: index for index, reference_id in enumerate(selected_reference_ids)
            }
            prompt_references: list[SkillPromptReference] = []
            ordered_references = sorted(
                references_by_skill.get(record.id, []),
                key=lambda reference: (
                    0 if reference.id in selected_reference_id_set else 1,
                    selected_reference_order.get(reference.id, len(selected_reference_order)),
                    reference.name.lower(),
                    reference.id,
                ),
            )
            for reference in ordered_references:
                reference_body: str | None = None
                if reference.id in selected_reference_id_set:
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
                        retrieval=self.build_reference_retrieval(
                            skill_id=record.id,
                            reference_id=reference.id,
                            workspace_id=workspace_id,
                        ),
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

    def suggest_references(
        self,
        db: Session,
        *,
        skill_ids: Sequence[str],
        query_text: str,
        workspace_id: str = "default",
        excluded_reference_ids_by_skill: Mapping[str, Sequence[str]] | None = None,
        max_references_per_skill: int = 1,
    ) -> dict[str, list[SkillCatalogReferenceSuggestionItem]]:
        normalized_skill_ids = self._normalize_skill_ids(skill_ids)
        if not normalized_skill_ids:
            return {}

        query_tokens = self._tokenize_reference_query(query_text)
        if not query_tokens:
            return {}

        excluded_reference_ids = self._normalize_reference_selections(
            excluded_reference_ids_by_skill
        )
        reference_rows = db.scalars(
            select(SkillReferenceRecord)
            .join(SkillRecord, SkillRecord.id == SkillReferenceRecord.skill_id)
            .where(
                SkillRecord.workspace_id == workspace_id,
                SkillReferenceRecord.skill_id.in_(normalized_skill_ids),
            )
            .order_by(
                SkillReferenceRecord.skill_id.asc(),
                SkillReferenceRecord.name.asc(),
                SkillReferenceRecord.id.asc(),
            )
        ).all()
        references_by_skill: dict[str, list[SkillReferenceRecord]] = {}
        for reference in reference_rows:
            references_by_skill.setdefault(reference.skill_id, []).append(reference)

        per_skill_limit = max(1, int(max_references_per_skill))
        suggestions: dict[str, list[SkillCatalogReferenceSuggestionItem]] = {}
        for skill_id in normalized_skill_ids:
            excluded_ids = set(excluded_reference_ids.get(skill_id, ()))
            ranked_reference_ids: list[tuple[int, str, str, tuple[str, ...]]] = []
            for reference in references_by_skill.get(skill_id, []):
                if reference.id in excluded_ids:
                    continue
                score, matched_terms = self._match_reference_query(reference, query_tokens)
                if score <= 0:
                    continue
                ranked_reference_ids.append(
                    (
                        -score,
                        reference.name.lower(),
                        reference.id,
                        matched_terms,
                    )
                )
            if not ranked_reference_ids:
                continue
            ranked_reference_ids.sort()
            suggestions[skill_id] = [
                SkillCatalogReferenceSuggestionItem(
                    reference_id=reference_id,
                    score=-score,
                    matched_terms=matched_terms,
                )
                for score, _, reference_id, matched_terms in ranked_reference_ids[:per_skill_limit]
            ]
        return suggestions

    def suggest_reference_ids(
        self,
        db: Session,
        *,
        skill_ids: Sequence[str],
        query_text: str,
        workspace_id: str = "default",
        excluded_reference_ids_by_skill: Mapping[str, Sequence[str]] | None = None,
        max_references_per_skill: int = 1,
    ) -> dict[str, list[str]]:
        suggestions = self.suggest_references(
            db,
            skill_ids=skill_ids,
            query_text=query_text,
            workspace_id=workspace_id,
            excluded_reference_ids_by_skill=excluded_reference_ids_by_skill,
            max_references_per_skill=max_references_per_skill,
        )
        return {
            skill_id: [item.reference_id for item in suggestion_items]
            for skill_id, suggestion_items in suggestions.items()
        }

    def build_reference_retrieval(
        self,
        *,
        skill_id: str,
        reference_id: str,
        workspace_id: str = "default",
    ) -> SkillReferenceRetrieval:
        query = urlencode({"workspace_id": workspace_id}) if workspace_id else ""
        http_path = f"/api/skills/{skill_id}/references/{reference_id}"
        if query:
            http_path = f"{http_path}?{query}"
        return SkillReferenceRetrieval(
            http_path=http_path,
            mcp_method="skills.get_reference",
            mcp_params={
                "skill_id": skill_id,
                "reference_id": reference_id,
                "workspace_id": workspace_id,
            },
        )

    def invoke_mcp_method(
        self,
        db: Session,
        *,
        method: str,
        params: Mapping[str, object] | None = None,
    ) -> SkillMcpResponse:
        normalized_method = str(method or "").strip()
        raw_params = params or {}
        workspace_id = self._read_workspace_id(raw_params)

        if normalized_method == "skills.list":
            result = [
                item.model_dump(mode="python")
                for item in self.list_skills(db, workspace_id=workspace_id)
            ]
            return SkillMcpResponse(method=normalized_method, result=result)

        if normalized_method == "skills.get":
            skill_id = self._read_required_param(
                raw_params,
                method=normalized_method,
                keys=("skill_id", "skillId"),
            )
            record = self.get_skill(db, skill_id=skill_id, workspace_id=workspace_id)
            if record is None:
                raise SkillCatalogError(f"Skill '{skill_id}' not found.")
            return SkillMcpResponse(
                method=normalized_method,
                result=self.serialize_detail(db, record).model_dump(mode="python"),
            )

        if normalized_method == "skills.get_reference":
            skill_id = self._read_required_param(
                raw_params,
                method=normalized_method,
                keys=("skill_id", "skillId"),
            )
            reference_id = self._read_required_param(
                raw_params,
                method=normalized_method,
                keys=("reference_id", "referenceId", "ref_id", "refId"),
            )
            reference = self.get_reference(
                db,
                skill_id=skill_id,
                reference_id=reference_id,
                workspace_id=workspace_id,
            )
            if reference is None:
                raise SkillCatalogError(
                    f"Skill reference '{skill_id}:{reference_id}' not found."
                )
            return SkillMcpResponse(
                method=normalized_method,
                result=self.serialize_reference_detail(reference).model_dump(mode="python"),
            )

        raise SkillCatalogError(
            "Unsupported skill retrieval method: "
            f"{normalized_method or '<empty>'}."
        )

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
    ) -> dict[str, tuple[str, ...]]:
        if not selected_reference_ids_by_skill:
            return {}

        normalized: dict[str, tuple[str, ...]] = {}
        for raw_skill_id, raw_reference_ids in selected_reference_ids_by_skill.items():
            skill_id = str(raw_skill_id or "").strip()
            if not skill_id:
                continue
            normalized_reference_ids: list[str] = []
            seen_reference_ids: set[str] = set()
            for raw_reference_id in raw_reference_ids:
                reference_id = str(raw_reference_id).strip()
                if not reference_id or reference_id in seen_reference_ids:
                    continue
                normalized_reference_ids.append(reference_id)
                seen_reference_ids.add(reference_id)
            if normalized_reference_ids:
                normalized[skill_id] = tuple(normalized_reference_ids)
        return normalized

    @staticmethod
    def _ensure_selected_references_exist(
        *,
        normalized_skill_ids: Sequence[str],
        references_by_skill: Mapping[str, Sequence[SkillReferenceRecord]],
        selected_reference_ids_by_skill: Mapping[str, Sequence[str]],
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

    @classmethod
    def _tokenize_reference_query(cls, value: str) -> frozenset[str]:
        if not isinstance(value, str) or not value.strip():
            return frozenset()
        return frozenset(
            match.group(0).lower() for match in _REFERENCE_QUERY_TOKEN_RE.finditer(value)
        )

    @classmethod
    def _score_reference_query_match(
        cls,
        query_tokens: frozenset[str],
        reference: SkillReferenceRecord,
    ) -> int:
        score, _ = cls._match_reference_query(reference, query_tokens)
        return score

    @classmethod
    def _match_reference_query(
        cls,
        reference: SkillReferenceRecord,
        query_tokens: frozenset[str],
    ) -> tuple[int, tuple[str, ...]]:
        name_tokens = cls._tokenize_reference_query(reference.name)
        description_tokens = cls._tokenize_reference_query(reference.description)
        raw_matched_terms = query_tokens & (name_tokens | description_tokens)
        matched_terms = tuple(
            sorted(term for term in raw_matched_terms if term not in _REFERENCE_REASON_STOPWORDS)
        )
        if not matched_terms:
            matched_terms = tuple(sorted(raw_matched_terms))
        score = len(query_tokens & name_tokens) * 3 + len(query_tokens & description_tokens)
        return score, matched_terms

    @staticmethod
    def _read_workspace_id(params: Mapping[str, object]) -> str:
        workspace_id = str(
            params.get("workspace_id") or params.get("workspaceId") or "default"
        ).strip()
        if not workspace_id:
            raise SkillCatalogError("workspace_id must be a non-empty string.")
        return workspace_id

    @staticmethod
    def _read_required_param(
        params: Mapping[str, object],
        *,
        method: str,
        keys: Sequence[str],
    ) -> str:
        for key in keys:
            value = params.get(key)
            if value is None:
                continue
            normalized = str(value).strip()
            if normalized:
                return normalized
        joined_keys = ", ".join(keys)
        raise SkillCatalogError(
            f"Method '{method}' requires one of: {joined_keys}."
        )
