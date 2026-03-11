from __future__ import annotations

from dataclasses import dataclass, field

from app.models.run import AICallRecord, NodeRun, Run, RunArtifact, RunEvent, ToolCallRecord


@dataclass
class ExecutionArtifacts:
    run: Run
    node_runs: list[NodeRun]
    events: list[RunEvent]
    artifacts: list[RunArtifact] = field(default_factory=list)
    tool_calls: list[ToolCallRecord] = field(default_factory=list)
    ai_calls: list[AICallRecord] = field(default_factory=list)


@dataclass
class CallbackHandleResult:
    callback_status: str
    ticket: str
    run_id: str
    node_run_id: str
    artifacts: ExecutionArtifacts
