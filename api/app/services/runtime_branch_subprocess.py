from __future__ import annotations

import json
import os
import subprocess
import sys
import textwrap
from dataclasses import dataclass
from typing import Any

from app.services.runtime_types import WorkflowExecutionError

_DEFAULT_TIMEOUT_MS = 30_000

_PYTHON_WRAPPER = textwrap.dedent(
    """
    import io
    import json
    import sys
    import traceback
    from contextlib import redirect_stderr, redirect_stdout

    from app.services.runtime_branch_execution import execute_branch_node

    payload = json.loads(sys.stdin.read() or "{}")
    captured_stdout = io.StringIO()
    captured_stderr = io.StringIO()

    try:
        with redirect_stdout(captured_stdout), redirect_stderr(captured_stderr):
            result = execute_branch_node(
                payload.get("node") or {},
                payload.get("node_input") or {},
            )
        envelope = {
            "ok": True,
            "result": result,
            "stdout": captured_stdout.getvalue(),
            "stderr": captured_stderr.getvalue(),
        }
    except Exception:
        traceback.print_exc(file=captured_stderr)
        envelope = {
            "ok": False,
            "error": captured_stderr.getvalue() or "branch subprocess execution failed",
            "stdout": captured_stdout.getvalue(),
            "stderr": captured_stderr.getvalue(),
        }

    sys.stdout.write(json.dumps(envelope, ensure_ascii=False))
    """
).strip()


@dataclass(frozen=True)
class BranchSubprocessExecutionResult:
    result: dict[str, Any]
    stdout: str
    stderr: str
    effective_adapter: str


class HostBranchNodeExecutor:
    def execute(
        self,
        *,
        node: dict[str, Any],
        node_input: dict[str, Any],
        timeout_ms: int | None,
    ) -> BranchSubprocessExecutionResult:
        resolved_timeout_ms = timeout_ms if isinstance(timeout_ms, int) else _DEFAULT_TIMEOUT_MS
        payload = {"node": node, "node_input": node_input}
        try:
            completed = subprocess.run(
                [sys.executable, "-c", _PYTHON_WRAPPER],
                input=json.dumps(payload, ensure_ascii=False),
                capture_output=True,
                text=True,
                timeout=max(resolved_timeout_ms, 1) / 1000,
                env=self._build_env(),
            )
        except subprocess.TimeoutExpired as exc:
            raise WorkflowExecutionError(
                f"branch node subprocess exceeded timeout after {resolved_timeout_ms}ms."
            ) from exc
        except OSError as exc:
            raise WorkflowExecutionError(
                f"branch node failed to start host subprocess: {exc}"
            ) from exc

        envelope = self._parse_envelope(completed.stdout, stderr=completed.stderr)
        stdout = str(envelope.get("stdout") or "")
        stderr = str(envelope.get("stderr") or completed.stderr or "")
        if not envelope.get("ok"):
            message = str(
                envelope.get("error") or stderr or "branch subprocess execution failed"
            )
            raise WorkflowExecutionError(message.strip())

        result = envelope.get("result")
        if not isinstance(result, dict):
            raise WorkflowExecutionError(
                "branch subprocess returned an invalid response payload."
            )
        return BranchSubprocessExecutionResult(
            result=result,
            stdout=stdout,
            stderr=stderr,
            effective_adapter="host_subprocess_branch",
        )

    def _build_env(self) -> dict[str, str]:
        python_path_entries = [entry for entry in sys.path if isinstance(entry, str) and entry]
        existing_python_path = os.environ.get("PYTHONPATH")
        if existing_python_path:
            python_path_entries.append(existing_python_path)
        return {
            **os.environ,
            "PYTHONPATH": os.pathsep.join(python_path_entries),
        }

    def _parse_envelope(self, stdout: str, *, stderr: str) -> dict[str, Any]:
        raw_stdout = stdout.strip()
        if not raw_stdout:
            if stderr.strip():
                raise WorkflowExecutionError(stderr.strip())
            raise WorkflowExecutionError("branch subprocess returned an empty response.")

        try:
            payload = json.loads(raw_stdout)
        except json.JSONDecodeError as exc:
            raise WorkflowExecutionError(
                "branch subprocess returned a non-JSON envelope."
            ) from exc

        if not isinstance(payload, dict):
            raise WorkflowExecutionError("branch subprocess returned an invalid response.")
        return payload
