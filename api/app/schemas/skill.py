from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class SkillReferenceDocBase(BaseModel):
    id: str | None = Field(default=None, min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    description: str = ""
    body: str = ""


class SkillReferenceDocCreate(SkillReferenceDocBase):
    pass


class SkillReferenceDocUpdate(BaseModel):
    id: str | None = Field(default=None, min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    description: str = ""
    body: str = ""


class SkillReferenceDocSummary(BaseModel):
    id: str
    name: str
    description: str


class SkillReferenceDocDetail(SkillReferenceDocSummary):
    body: str


class SkillDocBase(BaseModel):
    workspace_id: str = Field(default="default", min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    description: str = ""
    body: str = ""
    references: list[SkillReferenceDocCreate] = Field(default_factory=list)

    @model_validator(mode="after")
    def ensure_unique_reference_names(self) -> SkillDocBase:
        seen_names: set[str] = set()
        seen_ids: set[str] = set()
        for reference in self.references:
            normalized_name = reference.name.strip().lower()
            if normalized_name in seen_names:
                raise ValueError("Skill reference names must be unique within a skill.")
            seen_names.add(normalized_name)

            if reference.id is None:
                continue
            normalized_id = reference.id.strip().lower()
            if normalized_id in seen_ids:
                raise ValueError("Skill reference ids must be unique within a skill.")
            seen_ids.add(normalized_id)
        return self


class SkillDocCreate(SkillDocBase):
    id: str | None = Field(default=None, min_length=1, max_length=64)


class SkillDocUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    description: str | None = None
    body: str | None = None
    references: list[SkillReferenceDocUpdate] | None = None

    @model_validator(mode="after")
    def ensure_update_payload(self) -> SkillDocUpdate:
        if self.name is None and self.description is None and self.body is None and self.references is None:
            raise ValueError(
                "At least one of 'name', 'description', 'body' or 'references' must be provided."
            )
        return self


class SkillDocListItem(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: str
    reference_count: int
    updated_at: datetime


class SkillDocDetail(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: str
    body: str
    references: list[SkillReferenceDocSummary] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class SkillPromptReference(BaseModel):
    id: str
    name: str
    description: str


class SkillPromptDoc(BaseModel):
    id: str
    name: str
    description: str
    body: str
    references: list[SkillPromptReference] = Field(default_factory=list)

