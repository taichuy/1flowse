from typing import Any

from pydantic import BaseModel, Field


class AdapterHealthResponse(BaseModel):
    status: str
    adapter_id: str
    ecosystem: str
    mode: str


class AdapterToolItem(BaseModel):
    id: str
    name: str
    ecosystem: str
    description: str = ""
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] | None = None
    source: str = "plugin"
    plugin_meta: dict[str, Any] | None = None


class AdapterToolListResponse(BaseModel):
    adapter_id: str
    ecosystem: str
    tools: list[AdapterToolItem] = Field(default_factory=list)


class AdapterInvokeRequest(BaseModel):
    toolId: str = Field(min_length=1, max_length=256)
    ecosystem: str = Field(min_length=1, max_length=64)
    adapterId: str | None = Field(default=None, min_length=1, max_length=128)
    inputs: dict[str, Any] = Field(default_factory=dict)
    credentials: dict[str, str] = Field(default_factory=dict)
    timeout: int = Field(default=30_000, ge=1, le=600_000)
    traceId: str = ""


class AdapterInvokeResponse(BaseModel):
    status: str
    output: dict[str, Any] = Field(default_factory=dict)
    logs: list[str] = Field(default_factory=list)
    durationMs: int = Field(default=0, ge=0)
