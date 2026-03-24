from typing import Any, Literal

from pydantic import BaseModel, Field


class AdapterHealthResponse(BaseModel):
    status: str
    adapter_id: str
    ecosystem: str
    mode: str
    detail: str | None = None
    supported_execution_classes: list[str] = Field(default_factory=lambda: ["subprocess"])


class ConstrainedToolInputField(BaseModel):
    name: str
    required: bool = False
    value_source: Literal["llm", "user", "credential", "file"]
    json_schema: dict[str, Any] = Field(default_factory=dict)


class ConstrainedToolConstraints(BaseModel):
    additional_properties: bool = False
    credential_fields: list[str] = Field(default_factory=list)
    file_fields: list[str] = Field(default_factory=list)
    llm_fillable_fields: list[str] = Field(default_factory=list)
    user_config_fields: list[str] = Field(default_factory=list)


class ConstrainedToolIR(BaseModel):
    ir_version: str = "2026-03-10"
    kind: Literal["tool"] = "tool"
    ecosystem: str
    tool_id: str
    name: str
    description: str = ""
    source: str = "plugin"
    supported_execution_classes: list[str] = Field(default_factory=list)
    default_execution_class: Literal["inline", "subprocess", "sandbox", "microvm"] | None = None
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] | None = None
    input_contract: list[ConstrainedToolInputField] = Field(default_factory=list)
    constraints: ConstrainedToolConstraints = Field(default_factory=ConstrainedToolConstraints)
    plugin_meta: dict[str, Any] | None = None


class AdapterToolItem(BaseModel):
    id: str
    name: str
    ecosystem: str
    description: str = ""
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] | None = None
    source: str = "plugin"
    supported_execution_classes: list[str] = Field(default_factory=list)
    default_execution_class: Literal["inline", "subprocess", "sandbox", "microvm"] | None = None
    plugin_meta: dict[str, Any] | None = None
    constrained_ir: ConstrainedToolIR


class AdapterToolListResponse(BaseModel):
    adapter_id: str
    ecosystem: str
    tools: list[AdapterToolItem] = Field(default_factory=list)


class AdapterExecutionContractField(BaseModel):
    name: str
    required: bool = False
    valueSource: Literal["llm", "user", "credential", "file"]
    jsonSchema: dict[str, Any] = Field(default_factory=dict)


class AdapterExecutionContractConstraints(BaseModel):
    additionalProperties: bool = False
    credentialFields: list[str] = Field(default_factory=list)
    fileFields: list[str] = Field(default_factory=list)
    llmFillableFields: list[str] = Field(default_factory=list)
    userConfigFields: list[str] = Field(default_factory=list)


class AdapterExecutionContract(BaseModel):
    irVersion: str = "2026-03-10"
    kind: Literal["tool_execution"] = "tool_execution"
    ecosystem: str
    toolId: str
    inputContract: list[AdapterExecutionContractField] = Field(default_factory=list)
    constraints: AdapterExecutionContractConstraints = Field(
        default_factory=AdapterExecutionContractConstraints
    )
    pluginMeta: dict[str, Any] | None = None


class AdapterInvokeRequest(BaseModel):
    toolId: str = Field(min_length=1, max_length=256)
    ecosystem: str = Field(min_length=1, max_length=64)
    adapterId: str | None = Field(default=None, min_length=1, max_length=128)
    inputs: dict[str, Any] = Field(default_factory=dict)
    credentials: dict[str, str] = Field(default_factory=dict)
    timeout: int = Field(default=30_000, ge=1, le=600_000)
    traceId: str = ""
    execution: dict[str, Any] = Field(default_factory=dict)
    executionContract: AdapterExecutionContract


class AdapterInvokeRequestMeta(BaseModel):
    toolId: str
    adapterId: str
    ecosystem: str
    traceId: str = ""
    execution: dict[str, Any] = Field(default_factory=dict)
    executionContract: dict[str, Any] = Field(default_factory=dict)


class AdapterInvokeResponse(BaseModel):
    status: str
    output: dict[str, Any] = Field(default_factory=dict)
    logs: list[str] = Field(default_factory=list)
    durationMs: int = Field(default=0, ge=0)
    requestMeta: AdapterInvokeRequestMeta | None = None
