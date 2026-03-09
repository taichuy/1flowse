from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

NodeType = Literal[
    "trigger",
    "llm_agent",
    "tool",
    "sandbox_code",
    "mcp_query",
    "condition",
    "router",
    "loop",
    "output",
]
EdgeChannel = Literal["control", "data"]
PublishProtocol = Literal["native", "openai", "anthropic"]
AuthMode = Literal["api_key", "token", "internal"]


class WorkflowNodeDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=64)
    type: NodeType
    name: str = Field(min_length=1, max_length=128)
    config: dict[str, Any] = Field(default_factory=dict)
    inputSchema: dict[str, Any] | None = None
    outputSchema: dict[str, Any] | None = None
    runtimePolicy: dict[str, Any] | None = None


class WorkflowEdgeDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=64)
    sourceNodeId: str = Field(min_length=1, max_length=64)
    targetNodeId: str = Field(min_length=1, max_length=64)
    channel: EdgeChannel = "control"
    condition: str | None = None
    mapping: list[dict[str, Any]] | None = None


class WorkflowVariableDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str = Field(min_length=1, max_length=128)
    type: str | None = None
    default: Any = None
    description: str | None = None


class WorkflowPublishedEndpointDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=128)
    protocol: PublishProtocol
    workflowVersion: str | None = Field(default=None, min_length=1, max_length=32)
    authMode: AuthMode
    streaming: bool
    inputSchema: dict[str, Any] = Field(default_factory=dict)
    outputSchema: dict[str, Any] | None = None


class WorkflowDefinitionDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nodes: list[WorkflowNodeDefinition] = Field(min_length=1)
    edges: list[WorkflowEdgeDefinition] = Field(default_factory=list)
    variables: list[WorkflowVariableDefinition] = Field(default_factory=list)
    publish: list[WorkflowPublishedEndpointDefinition] = Field(default_factory=list)
    trigger: dict[str, Any] | None = None

    @model_validator(mode="after")
    def validate_graph(self) -> "WorkflowDefinitionDocument":
        node_ids = [node.id for node in self.nodes]
        if len(set(node_ids)) != len(node_ids):
            raise ValueError("Workflow node ids must be unique.")

        edge_ids = [edge.id for edge in self.edges]
        if len(set(edge_ids)) != len(edge_ids):
            raise ValueError("Workflow edge ids must be unique.")

        node_id_set = set(node_ids)
        trigger_count = sum(node.type == "trigger" for node in self.nodes)
        if trigger_count != 1:
            raise ValueError("Workflow definition must contain exactly one trigger node.")

        if not any(node.type == "output" for node in self.nodes):
            raise ValueError("Workflow definition must contain at least one output node.")

        for edge in self.edges:
            if edge.sourceNodeId not in node_id_set:
                raise ValueError(
                    f"Edge '{edge.id}' references missing source node "
                    f"'{edge.sourceNodeId}'."
                )
            if edge.targetNodeId not in node_id_set:
                raise ValueError(
                    f"Edge '{edge.id}' references missing target node "
                    f"'{edge.targetNodeId}'."
                )
            if edge.sourceNodeId == edge.targetNodeId:
                raise ValueError(f"Edge '{edge.id}' cannot point to the same node on both ends.")

        return self


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    definition: dict = Field(default_factory=dict)


class WorkflowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    definition: dict | None = None

    @model_validator(mode="after")
    def ensure_update_payload(self) -> "WorkflowUpdate":
        if self.name is None and self.definition is None:
            raise ValueError("At least one of 'name' or 'definition' must be provided.")
        return self


class WorkflowListItem(BaseModel):
    id: str
    name: str
    version: str
    status: str


class WorkflowVersionItem(BaseModel):
    id: str
    workflow_id: str
    version: str
    created_at: datetime


class WorkflowDetail(WorkflowListItem):
    definition: dict
    created_at: datetime
    updated_at: datetime
    versions: list[WorkflowVersionItem] = Field(default_factory=list)
