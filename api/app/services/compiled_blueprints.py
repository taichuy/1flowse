from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.run import Run
from app.models.workflow import WorkflowCompiledBlueprint, WorkflowVersion
from app.services.flow_compiler import FlowCompiler
from app.services.runtime_types import CompiledWorkflowBlueprint


class CompiledBlueprintError(ValueError):
    pass


class CompiledBlueprintService:
    compiler_version = "flow-compiler.v1"

    def __init__(self, flow_compiler: FlowCompiler | None = None) -> None:
        self._flow_compiler = flow_compiler or FlowCompiler()

    def ensure_for_workflow_version(
        self,
        db: Session,
        workflow_version: WorkflowVersion,
    ) -> WorkflowCompiledBlueprint:
        record = db.scalar(
            select(WorkflowCompiledBlueprint).where(
                WorkflowCompiledBlueprint.workflow_version_id == workflow_version.id
            )
        )
        if record is not None and record.compiler_version == self.compiler_version:
            return record

        blueprint = self._compile_workflow_version(workflow_version)
        payload = self._flow_compiler.dump_blueprint(blueprint)
        if record is None:
            record = WorkflowCompiledBlueprint(
                id=str(uuid4()),
                workflow_id=workflow_version.workflow_id,
                workflow_version_id=workflow_version.id,
                workflow_version=workflow_version.version,
                compiler_version=self.compiler_version,
                blueprint_payload=payload,
            )
        else:
            record.workflow_id = workflow_version.workflow_id
            record.workflow_version = workflow_version.version
            record.compiler_version = self.compiler_version
            record.blueprint_payload = payload

        db.add(record)
        return record

    def get_for_run(self, db: Session, run: Run) -> WorkflowCompiledBlueprint | None:
        if run.compiled_blueprint_id:
            record = db.get(WorkflowCompiledBlueprint, run.compiled_blueprint_id)
            if record is not None:
                return record

        return db.scalar(
            select(WorkflowCompiledBlueprint).where(
                WorkflowCompiledBlueprint.workflow_id == run.workflow_id,
                WorkflowCompiledBlueprint.workflow_version == run.workflow_version,
            )
        )

    def load_blueprint(
        self,
        record: WorkflowCompiledBlueprint,
    ) -> CompiledWorkflowBlueprint:
        try:
            return self._flow_compiler.load_blueprint(record.blueprint_payload or {})
        except Exception as exc:  # pragma: no cover - defensive guard
            raise CompiledBlueprintError(
                f"Compiled blueprint '{record.id}' is invalid: {exc}"
            ) from exc

    def _compile_workflow_version(
        self,
        workflow_version: WorkflowVersion,
    ) -> CompiledWorkflowBlueprint:
        try:
            return self._flow_compiler.compile_workflow_version(workflow_version)
        except Exception as exc:
            raise CompiledBlueprintError(str(exc)) from exc
