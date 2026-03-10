from datetime import datetime

from pydantic import BaseModel, Field


class ServiceCheck(BaseModel):
    name: str
    status: str
    detail: str | None = None


class CompatibilityAdapterCheck(BaseModel):
    id: str
    ecosystem: str
    endpoint: str
    enabled: bool
    status: str
    detail: str | None = None


class PluginToolCheck(BaseModel):
    id: str
    name: str
    ecosystem: str
    source: str
    callable: bool


class RecentRunCheck(BaseModel):
    id: str
    workflow_id: str
    workflow_version: str
    status: str
    created_at: datetime
    finished_at: datetime | None = None
    event_count: int = 0


class RecentRunEventCheck(BaseModel):
    id: int
    run_id: str
    node_run_id: str | None = None
    event_type: str
    payload: dict = Field(default_factory=dict)
    created_at: datetime


class RuntimeActivityCheck(BaseModel):
    recent_runs: list[RecentRunCheck] = Field(default_factory=list)
    recent_events: list[RecentRunEventCheck] = Field(default_factory=list)


class SystemOverview(BaseModel):
    status: str
    environment: str
    services: list[ServiceCheck]
    capabilities: list[str]
    plugin_adapters: list[CompatibilityAdapterCheck] = Field(default_factory=list)
    plugin_tools: list[PluginToolCheck] = Field(default_factory=list)
    runtime_activity: RuntimeActivityCheck = Field(default_factory=RuntimeActivityCheck)
