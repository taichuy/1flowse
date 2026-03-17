from __future__ import annotations

import json
import logging
from copy import deepcopy
from typing import Any

from app.services.llm_provider import LLMResponse
from app.services.runtime_types import (
    AgentPlan,
    AgentSkillReferenceRequest,
    AgentToolCall,
    WorkflowExecutionError,
)

_log = logging.getLogger(__name__)
_SKILL_REFERENCE_REQUEST_PREFIX = "SKILL_REFERENCE_REQUEST "


class AgentRuntimeLLMPlanMixin:
    def _to_dict(self, value: Any) -> dict[str, Any]:
        return deepcopy(value) if isinstance(value, dict) else {}

    @staticmethod
    def _has_valid_model_config(model_config: dict[str, Any]) -> bool:
        raise NotImplementedError

    def _assistant_enabled(self, config: dict[str, Any]) -> bool:
        raise NotImplementedError

    def _call_llm(
        self,
        *,
        model_config: dict[str, Any],
        system_prompt: str | None,
        user_prompt: str,
        node_input: dict[str, Any] | None = None,
    ) -> LLMResponse:
        raise NotImplementedError

    def _build_plan(
        self,
        config: dict[str, Any],
        model_config: dict[str, Any],
        node_input: dict[str, Any],
        *,
        allow_skill_reference_request: bool = True,
    ) -> AgentPlan:
        raw_plan = self._to_dict(config.get("mockPlan"))
        raw_tool_calls = raw_plan.get("toolCalls") if raw_plan else None
        tool_calls: list[AgentToolCall] = []
        for raw_tool_call in raw_tool_calls or []:
            tool_calls.append(
                AgentToolCall(
                    tool_id=str(raw_tool_call.get("toolId")),
                    inputs=self._to_dict(raw_tool_call.get("inputs")),
                    ecosystem=str(raw_tool_call.get("ecosystem") or "native"),
                    adapter_id=raw_tool_call.get("adapterId"),
                    label=raw_tool_call.get("label"),
                    timeout_ms=(
                        int(raw_tool_call["timeoutMs"])
                        if raw_tool_call.get("timeoutMs") is not None
                        else None
                    ),
                    execution=self._to_dict(raw_tool_call.get("execution")),
                )
            )
        need_assistant = bool(raw_plan.get("needAssistant")) if raw_plan else False
        if self._assistant_enabled(config):
            need_assistant = True

        analysis = ""
        llm_response: LLMResponse | None = None
        if not raw_plan and self._has_valid_model_config(model_config):
            prompt = str(config.get("prompt") or "")
            if prompt:
                try:
                    system_prompt = (
                        "You are a workflow planning engine. Analyze the task and "
                        "provide a brief analysis of how to approach it. "
                        "Be concise and actionable."
                    )
                    if allow_skill_reference_request and self._has_pending_skill_references(
                        node_input
                    ):
                        system_prompt += (
                            " If the current [Skills] section only gives summaries/handles and you "
                            "need exactly one deeper skill reference body before planning, start "
                            "your response with a single line in the format: "
                            "SKILL_REFERENCE_REQUEST {\"skill_id\":\"...\","
                            "\"reference_id\":\"...\",\"reason\":\"...\"}. "
                            "After that line, include any brief analysis you can already provide. "
                            "Only request one reference and only when it is genuinely necessary."
                        )
                    llm_response = self._call_llm(
                        model_config=model_config,
                        system_prompt=system_prompt,
                        user_prompt=prompt,
                        node_input=node_input,
                    )
                    skill_reference_request, analysis = self._parse_plan_response(
                        llm_response.text,
                        allow_skill_reference_request=allow_skill_reference_request,
                    )
                except WorkflowExecutionError:
                    _log.warning("LLM plan call failed, using empty plan")
                    skill_reference_request = None
            else:
                skill_reference_request = None
        else:
            skill_reference_request = None

        plan = AgentPlan(
            tool_calls=tool_calls,
            need_assistant=need_assistant,
            finalize_from=(
                str(raw_plan.get("finalizeFrom") or "evidence")
                if raw_plan
                else "evidence"
            ),
        )
        if analysis:
            plan.analysis = analysis
        plan.skill_reference_request = skill_reference_request
        plan.llm_response = llm_response
        return plan

    @staticmethod
    def _has_pending_skill_references(node_input: dict[str, Any]) -> bool:
        skill_context = node_input.get("skill_context")
        if not isinstance(skill_context, list):
            return False
        for skill_doc in skill_context:
            if not isinstance(skill_doc, dict):
                continue
            for reference in skill_doc.get("references") or []:
                if not isinstance(reference, dict):
                    continue
                has_body = isinstance(reference.get("body"), str) and bool(reference.get("body"))
                retrieval = reference.get("retrieval")
                if has_body or not isinstance(retrieval, dict):
                    continue
                if retrieval.get("http_path") or retrieval.get("mcp_method"):
                    return True
        return False

    @staticmethod
    def _parse_plan_response(
        value: str,
        *,
        allow_skill_reference_request: bool,
    ) -> tuple[AgentSkillReferenceRequest | None, str]:
        if not allow_skill_reference_request or not isinstance(value, str):
            return None, value

        normalized = value.lstrip()
        if not normalized.startswith(_SKILL_REFERENCE_REQUEST_PREFIX):
            return None, value

        request_line, _, remainder = normalized.partition("\n")
        request_payload = request_line.removeprefix(_SKILL_REFERENCE_REQUEST_PREFIX).strip()
        try:
            parsed = json.loads(request_payload)
        except json.JSONDecodeError:
            return None, value
        if not isinstance(parsed, dict):
            return None, value

        skill_id = str(parsed.get("skill_id") or parsed.get("skillId") or "").strip()
        reference_id = str(
            parsed.get("reference_id") or parsed.get("referenceId") or ""
        ).strip()
        if not skill_id or not reference_id:
            return None, value
        reason = str(parsed.get("reason") or "").strip()
        return (
            AgentSkillReferenceRequest(
                skill_id=skill_id,
                reference_id=reference_id,
                reason=reason,
            ),
            remainder.lstrip(),
        )

    @staticmethod
    def _restore_plan(payload: Any) -> AgentPlan | None:
        if not isinstance(payload, dict):
            return None
        tool_calls: list[AgentToolCall] = []
        for raw_tool_call in payload.get("toolCalls", []):
            if not isinstance(raw_tool_call, dict):
                continue
            tool_calls.append(
                AgentToolCall(
                    tool_id=str(raw_tool_call.get("toolId")),
                    inputs=deepcopy(raw_tool_call.get("inputs"))
                    if isinstance(raw_tool_call.get("inputs"), dict)
                    else {},
                    ecosystem=str(raw_tool_call.get("ecosystem") or "native"),
                    adapter_id=raw_tool_call.get("adapterId"),
                    label=raw_tool_call.get("label"),
                    timeout_ms=(
                        int(raw_tool_call["timeoutMs"])
                        if raw_tool_call.get("timeoutMs") is not None
                        else None
                    ),
                    execution=deepcopy(raw_tool_call.get("execution"))
                    if isinstance(raw_tool_call.get("execution"), dict)
                    else {},
                )
            )
        return AgentPlan(
            tool_calls=tool_calls,
            need_assistant=bool(payload.get("needAssistant")),
            finalize_from=str(payload.get("finalizeFrom") or "evidence"),
        )
