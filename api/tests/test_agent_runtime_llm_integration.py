"""Tests for AgentRuntime with real LLM provider integration via mock HTTP."""

from __future__ import annotations

import json

import httpx
from sqlalchemy.orm import Session

from app.models.workflow import Workflow
from app.services.llm_provider import LLMProviderService
from app.services.plugin_runtime import PluginCallProxy, PluginRegistry, PluginToolDefinition
from app.services.runtime import RuntimeService


def _openai_response(content: str, model: str = "gpt-4o") -> dict:
    return {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
    }


def _make_llm_provider(responses: list[dict]) -> LLMProviderService:
    """Create an LLMProviderService that returns pre-defined responses in order."""
    call_index = {"i": 0}
    captured_requests: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        idx = call_index["i"]
        call_index["i"] += 1
        captured_requests.append({
            "url": str(request.url),
            "body": json.loads(request.content),
        })
        if idx < len(responses):
            return httpx.Response(200, json=responses[idx])
        return httpx.Response(200, json=_openai_response("fallback"))

    provider = LLMProviderService(
        client_factory=lambda: httpx.Client(
            transport=httpx.MockTransport(handler),
        ),
    )
    provider._captured_requests = captured_requests  # type: ignore[attr-defined]
    return provider


def _create_runtime_with_llm(
    llm_responses: list[dict],
    registry: PluginRegistry | None = None,
) -> RuntimeService:
    """Create a RuntimeService with injected LLM provider."""
    if registry is None:
        registry = PluginRegistry()
    proxy = PluginCallProxy(registry)
    runtime = RuntimeService(plugin_call_proxy=proxy)
    llm_provider = _make_llm_provider(llm_responses)
    runtime._llm_provider = llm_provider
    runtime._agent_runtime._llm_provider = llm_provider
    return runtime


# ---------------------------------------------------------------------------
# Test: finalize output via LLM (no mock config, valid model config)
# ---------------------------------------------------------------------------

def test_finalize_via_llm_when_no_mock(sqlite_session: Session) -> None:
    """When model config has valid apiKey/modelId and no mockFinalOutput,
    the finalize phase should call the LLM and produce real output."""
    runtime = _create_runtime_with_llm([
        # Plan call response
        _openai_response("I will analyze the topic."),
        # Finalize call response
        _openai_response("The answer to everything is 42."),
    ])

    workflow = Workflow(
        id="wf-llm-finalize",
        name="LLM Finalize Test",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "agent",
                    "type": "llm_agent",
                    "name": "Agent",
                    "config": {
                        "prompt": "What is the answer to everything?",
                        "systemPrompt": "You are a helpful assistant.",
                        "model": {
                            "provider": "openai",
                            "modelId": "gpt-4o",
                            "apiKey": "sk-test-key",
                        },
                        "assistant": {"enabled": False},
                    },
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "agent"},
                {"id": "e2", "sourceNodeId": "agent", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    artifacts = runtime.execute_workflow(sqlite_session, workflow, {"topic": "test"})

    assert artifacts.run.status == "succeeded"
    agent_run = next(nr for nr in artifacts.node_runs if nr.node_id == "agent")
    assert agent_run.phase == "emit_output"
    output = agent_run.output_payload
    assert output["result"] == "The answer to everything is 42."
    assert output["decision_basis"] == "llm"
    assert output["model"] == "gpt-4o"
    assert [r.role for r in artifacts.ai_calls] == ["main_plan", "main_finalize"]

    # Verify the finalize AI call record captured real metrics
    finalize_call = next(r for r in artifacts.ai_calls if r.role == "main_finalize")
    assert finalize_call.model_id == "gpt-4o"
    assert finalize_call.token_usage.get("prompt_tokens") == 10


# ---------------------------------------------------------------------------
# Test: mock config still takes priority over LLM
# ---------------------------------------------------------------------------

def test_mock_config_takes_priority_over_llm(sqlite_session: Session) -> None:
    """When mockFinalOutput is present, LLM should NOT be called for finalize."""
    runtime = _create_runtime_with_llm([
        # Plan call response (will be called since no mockPlan)
        _openai_response("Planning..."),
    ])

    workflow = Workflow(
        id="wf-mock-priority",
        name="Mock Priority Test",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "agent",
                    "type": "llm_agent",
                    "name": "Agent",
                    "config": {
                        "prompt": "Hello",
                        "model": {
                            "provider": "openai",
                            "modelId": "gpt-4o",
                            "apiKey": "sk-test-key",
                        },
                        "assistant": {"enabled": False},
                        "mockFinalOutput": {"result": "mock-output"},
                    },
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "agent"},
                {"id": "e2", "sourceNodeId": "agent", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    artifacts = runtime.execute_workflow(sqlite_session, workflow, {})

    assert artifacts.run.status == "succeeded"
    agent_run = next(nr for nr in artifacts.node_runs if nr.node_id == "agent")
    assert agent_run.output_payload["result"] == "mock-output"


# ---------------------------------------------------------------------------
# Test: no model config falls back to synthetic output
# ---------------------------------------------------------------------------

def test_no_model_config_falls_back_gracefully(sqlite_session: Session) -> None:
    """When no model config (no apiKey/modelId), fall back to legacy behavior."""
    runtime = _create_runtime_with_llm([])

    workflow = Workflow(
        id="wf-no-model",
        name="No Model Test",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "agent",
                    "type": "llm_agent",
                    "name": "Agent",
                    "config": {
                        "prompt": "Say hello",
                        "assistant": {"enabled": False},
                        "mock_output": {"answer": "fallback"},
                    },
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "agent"},
                {"id": "e2", "sourceNodeId": "agent", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    artifacts = runtime.execute_workflow(sqlite_session, workflow, {})

    assert artifacts.run.status == "succeeded"
    agent_run = next(nr for nr in artifacts.node_runs if nr.node_id == "agent")
    assert agent_run.output_payload == {"answer": "fallback"}


# ---------------------------------------------------------------------------
# Test: LLM finalize with tools
# ---------------------------------------------------------------------------

def test_llm_finalize_with_tool_results(sqlite_session: Session) -> None:
    """When tools execute and model config is valid, finalize via LLM with tool context."""
    registry = PluginRegistry()
    registry.register_tool(
        PluginToolDefinition(id="native.search", name="Native Search"),
        invoker=lambda request: {
            "status": "success",
            "content_type": "json",
            "summary": "Found 3 results",
            "structured": {"hits": 3},
            "meta": {"tool_name": "Native Search"},
        },
    )

    runtime = _create_runtime_with_llm(
        [
            # Plan - no LLM call since mockPlan is used
            # Finalize call response
            _openai_response("Based on the search results, I found 3 items."),
        ],
        registry=registry,
    )

    workflow = Workflow(
        id="wf-llm-tools",
        name="LLM With Tools Test",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "agent",
                    "type": "llm_agent",
                    "name": "Agent",
                    "config": {
                        "prompt": "Search and summarize",
                        "model": {
                            "provider": "openai",
                            "modelId": "gpt-4o",
                            "apiKey": "sk-test-key",
                        },
                        "assistant": {"enabled": False},
                        "mockPlan": {
                            "toolCalls": [
                                {"toolId": "native.search", "inputs": {"query": "test"}}
                            ],
                        },
                    },
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "agent"},
                {"id": "e2", "sourceNodeId": "agent", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    artifacts = runtime.execute_workflow(sqlite_session, workflow, {})

    assert artifacts.run.status == "succeeded"
    agent_run = next(nr for nr in artifacts.node_runs if nr.node_id == "agent")
    output = agent_run.output_payload
    assert output["result"] == "Based on the search results, I found 3 items."
    assert output["decision_basis"] == "llm_with_tools"


# ---------------------------------------------------------------------------
# Test: LLM distill evidence
# ---------------------------------------------------------------------------

def test_llm_distill_evidence_with_valid_model(sqlite_session: Session) -> None:
    """When assistant is enabled and model config valid, distill evidence via LLM."""
    registry = PluginRegistry()
    registry.register_tool(
        PluginToolDefinition(id="native.search", name="Native Search"),
        invoker=lambda request: {
            "status": "success",
            "content_type": "json",
            "summary": "search results ready",
            "structured": {"documents": ["doc1"]},
            "meta": {"tool_name": "Native Search"},
        },
    )

    evidence_json = json.dumps({
        "summary": "LLM-distilled evidence from search",
        "key_points": ["Found doc1"],
        "conflicts": [],
        "unknowns": [],
        "confidence": 0.95,
    })

    runtime = _create_runtime_with_llm(
        [
            # Distill evidence call
            _openai_response(evidence_json),
            # Finalize call
            _openai_response("Final answer based on evidence."),
        ],
        registry=registry,
    )

    workflow = Workflow(
        id="wf-llm-distill",
        name="LLM Distill Test",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "agent",
                    "type": "llm_agent",
                    "name": "Agent",
                    "config": {
                        "prompt": "Analyze search results",
                        "model": {
                            "provider": "openai",
                            "modelId": "gpt-4o",
                            "apiKey": "sk-test-key",
                        },
                        "assistant": {"enabled": True, "trigger": "always"},
                        "mockPlan": {
                            "toolCalls": [
                                {"toolId": "native.search", "inputs": {"query": "test"}}
                            ],
                            "needAssistant": True,
                        },
                    },
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "agent"},
                {"id": "e2", "sourceNodeId": "agent", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    artifacts = runtime.execute_workflow(sqlite_session, workflow, {})

    assert artifacts.run.status == "succeeded"
    agent_run = next(nr for nr in artifacts.node_runs if nr.node_id == "agent")

    # Evidence should come from LLM
    evidence = agent_run.evidence_context
    assert evidence is not None
    assert evidence["summary"] == "LLM-distilled evidence from search"
    assert evidence["confidence"] == 0.95

    # Roles should include assistant_distill
    roles = [r.role for r in artifacts.ai_calls]
    assert "assistant_distill" in roles
    assert "main_finalize" in roles


# ---------------------------------------------------------------------------
# Test: LLM error in finalize degrades gracefully
# ---------------------------------------------------------------------------

def test_llm_finalize_error_degrades_gracefully(sqlite_session: Session) -> None:
    """When LLM call fails during finalize, fall back to synthetic output."""

    def error_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal Server Error")

    llm_provider = LLMProviderService(
        client_factory=lambda: httpx.Client(
            transport=httpx.MockTransport(error_handler),
        ),
    )
    registry = PluginRegistry()
    proxy = PluginCallProxy(registry)
    runtime = RuntimeService(plugin_call_proxy=proxy)
    runtime._llm_provider = llm_provider
    runtime._agent_runtime._llm_provider = llm_provider

    workflow = Workflow(
        id="wf-llm-error",
        name="LLM Error Test",
        version="0.1.0",
        status="draft",
        definition={
            "nodes": [
                {"id": "trigger", "type": "trigger", "name": "Trigger", "config": {}},
                {
                    "id": "agent",
                    "type": "llm_agent",
                    "name": "Agent",
                    "config": {
                        "prompt": "Analyze this",
                        "model": {
                            "provider": "openai",
                            "modelId": "gpt-4o",
                            "apiKey": "sk-test-key",
                        },
                        "assistant": {"enabled": False},
                        "mockPlan": {"toolCalls": []},
                    },
                },
                {"id": "output", "type": "output", "name": "Output", "config": {}},
            ],
            "edges": [
                {"id": "e1", "sourceNodeId": "trigger", "targetNodeId": "agent"},
                {"id": "e2", "sourceNodeId": "agent", "targetNodeId": "output"},
            ],
        },
    )
    sqlite_session.add(workflow)
    sqlite_session.commit()

    artifacts = runtime.execute_workflow(sqlite_session, workflow, {})

    # Should still succeed with fallback
    assert artifacts.run.status == "succeeded"
    agent_run = next(nr for nr in artifacts.node_runs if nr.node_id == "agent")
    assert agent_run.output_payload["decision_basis"] == "working_context"
