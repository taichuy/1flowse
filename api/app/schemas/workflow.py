from __future__ import annotations

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
ArtifactType = Literal["text", "json", "file", "tool_result", "message"]


class WorkflowNodeContextArtifactRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nodeId: str = Field(min_length=1, max_length=64)
    artifactType: ArtifactType


class WorkflowNodeContextAccess(BaseModel):
    model_config = ConfigDict(extra="forbid")

    readableNodeIds: list[str] = Field(default_factory=list)
    readableArtifacts: list[WorkflowNodeContextArtifactRef] = Field(default_factory=list)


class WorkflowNodeMcpQuery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["authorized_context"]
    sourceNodeIds: list[str] | None = None
    artifactTypes: list[ArtifactType] | None = None


BranchSelectorOperator = Literal[
    "exists",
    "not_exists",
    "eq",
    "ne",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "not_in",
    "contains",
]


class WorkflowNodeBranchRule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(min_length=1, max_length=64)
    path: str = Field(min_length=1, max_length=256)
    operator: BranchSelectorOperator = "eq"
    value: Any = None

    @model_validator(mode="after")
    def validate_value_requirement(self) -> WorkflowNodeBranchRule:
        if self.operator in {"exists", "not_exists"}:
            return self
        if self.value is None:
            raise ValueError("Branch selector rules require 'value' for this operator.")
        return self


class WorkflowNodeBranchSelector(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rules: list[WorkflowNodeBranchRule] = Field(min_length=1)
    default: str | None = Field(default=None, min_length=1, max_length=64)

    @model_validator(mode="after")
    def validate_unique_rule_keys(self) -> WorkflowNodeBranchSelector:
        rule_keys = [rule.key for rule in self.rules]
        if len(set(rule_keys)) != len(rule_keys):
            raise ValueError("Branch selector rule keys must be unique.")
        return self


class WorkflowNodeDefinition(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=64)
    type: NodeType
    name: str = Field(min_length=1, max_length=128)
    config: dict[str, Any] = Field(default_factory=dict)
    inputSchema: dict[str, Any] | None = None
    outputSchema: dict[str, Any] | None = None
    runtimePolicy: WorkflowNodeRuntimePolicy | None = None

    @model_validator(mode="after")
    def validate_embedded_config(self) -> WorkflowNodeDefinition:
        context_access = self.config.get("contextAccess")
        if context_access is not None:
            WorkflowNodeContextAccess.model_validate(context_access)

        query = self.config.get("query")
        if self.type == "mcp_query":
            if query is None:
                raise ValueError("MCP query nodes must define config.query.")
            WorkflowNodeMcpQuery.model_validate(query)

        selector = self.config.get("selector")
        if selector is not None:
            if self.type not in {"condition", "router"}:
                raise ValueError("Only condition/router nodes may define config.selector.")
            WorkflowNodeBranchSelector.model_validate(selector)

        return self


class WorkflowNodeRetryPolicy(BaseModel):
    model_config = ConfigDict(extra="allow")

    maxAttempts: int = Field(default=1, ge=1)
    backoffSeconds: float = Field(default=0.0, ge=0.0)
    backoffMultiplier: float = Field(default=1.0, ge=1.0)


class WorkflowNodeRuntimePolicy(BaseModel):
    model_config = ConfigDict(extra="allow")

    retry: WorkflowNodeRetryPolicy | None = None


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
    def validate_graph(self) -> WorkflowDefinitionDocument:
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

        for node in self.nodes:
            context_access = WorkflowNodeContextAccess.model_validate(
                node.config.get("contextAccess") or {}
            )
            authorized_node_ids = set(context_access.readableNodeIds)
            authorized_node_ids.update(
                artifact.nodeId for artifact in context_access.readableArtifacts
            )

            for readable_node_id in sorted(authorized_node_ids):
                if readable_node_id not in node_id_set:
                    raise ValueError(
                        f"Node '{node.id}' contextAccess references missing node "
                        f"'{readable_node_id}'."
                    )

            if node.type == "mcp_query":
                query = WorkflowNodeMcpQuery.model_validate(node.config["query"])
                requested_source_ids = set(query.sourceNodeIds or [])
                for source_node_id in sorted(requested_source_ids):
                    if source_node_id not in node_id_set:
                        raise ValueError(
                            f"Node '{node.id}' query references missing source node "
                            f"'{source_node_id}'."
                        )
                unauthorized_sources = sorted(requested_source_ids - authorized_node_ids)
                if unauthorized_sources:
                    joined_sources = ", ".join(unauthorized_sources)
                    raise ValueError(
                        f"Node '{node.id}' query references unauthorized source nodes: "
                        f"{joined_sources}."
                    )

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
    def ensure_update_payload(self) -> WorkflowUpdate:
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
