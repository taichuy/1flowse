from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

PublishedEndpointLifecycleStatus = Literal["draft", "published", "offline"]
WorkflowPublishedEndpointLegacyAuthGovernanceChecklistKey = Literal[
    "draft_cleanup",
    "published_follow_up",
    "offline_inventory",
]
WorkflowPublishedEndpointLegacyAuthGovernanceChecklistTone = Literal[
    "ready",
    "manual",
    "inventory",
]


class WorkflowPublishedEndpointLegacyAuthGovernanceBindingItem(BaseModel):
    workflow_id: str
    workflow_name: str
    binding_id: str
    endpoint_id: str
    endpoint_name: str
    workflow_version: str
    lifecycle_status: PublishedEndpointLifecycleStatus
    auth_mode: str


class WorkflowPublishedEndpointLegacyAuthGovernanceChecklistItem(BaseModel):
    key: WorkflowPublishedEndpointLegacyAuthGovernanceChecklistKey
    title: str
    tone: WorkflowPublishedEndpointLegacyAuthGovernanceChecklistTone
    tone_label: str
    count: int
    detail: str


class WorkflowPublishedEndpointLegacyAuthGovernanceWorkflowItem(BaseModel):
    workflow_id: str
    workflow_name: str
    binding_count: int
    draft_candidate_count: int
    published_blocker_count: int
    offline_inventory_count: int


class WorkflowPublishedEndpointLegacyAuthGovernanceSummary(BaseModel):
    draft_candidate_count: int = 0
    published_blocker_count: int = 0
    offline_inventory_count: int = 0


class WorkflowPublishedEndpointLegacyAuthGovernanceBuckets(BaseModel):
    draft_candidates: list[WorkflowPublishedEndpointLegacyAuthGovernanceBindingItem] = Field(
        default_factory=list
    )
    published_blockers: list[WorkflowPublishedEndpointLegacyAuthGovernanceBindingItem] = Field(
        default_factory=list
    )
    offline_inventory: list[WorkflowPublishedEndpointLegacyAuthGovernanceBindingItem] = Field(
        default_factory=list
    )


class WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot(BaseModel):
    generated_at: datetime
    workflow_count: int = 0
    binding_count: int = 0
    summary: WorkflowPublishedEndpointLegacyAuthGovernanceSummary = Field(
        default_factory=WorkflowPublishedEndpointLegacyAuthGovernanceSummary
    )
    checklist: list[WorkflowPublishedEndpointLegacyAuthGovernanceChecklistItem] = Field(
        default_factory=list
    )
    workflows: list[WorkflowPublishedEndpointLegacyAuthGovernanceWorkflowItem] = Field(
        default_factory=list
    )
    buckets: WorkflowPublishedEndpointLegacyAuthGovernanceBuckets = Field(
        default_factory=WorkflowPublishedEndpointLegacyAuthGovernanceBuckets
    )
