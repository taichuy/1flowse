"""Tests for AgentRuntime LLM streaming integration.

Validates that when real LLM model config is provided and no mock config exists,
the finalize phase uses chat_stream() to produce real-time node.output.delta events
instead of post-hoc text chunking.
"""

from __future__ import annotations

import json
from collections.abc import Generator

import httpx
from sqlalchemy.orm import Session

from app.models.run import RunEvent
from app.models.workflow import Workflow
from app.services.llm_provider import LLMProviderService, LLMStreamChunk
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


def _openai_stream_lines(content: str, model: str = "gpt-4o", chunk_size: int = 10) -> list[str]:
    """Build SSE lines that simulate an OpenAI streaming response."""
    lines: list[str] = []
    for i in range(0, len(content), chunk_size):
        chunk_text = content[i : i + chunk_size]
        chunk_data = {
            "id": "chatcmpl-stream",
            "object": "chat.completion.chunk",
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "delta": {"content": chunk_text},
                    "finish_reason": None,
                }
            ],
        }
        lines.append(f"data: {json.dumps(chunk_data)}")
    # Final chunk with finish_reason
    final_data = {
        "id": "chatcmpl-stream",
        "object": "chat.completion.chunk",
        "model": model,
        "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
    }
    lines.append(f"data: {json.dumps(final_data)}")
    lines.append("data: [DONE]")
    return lines


def _make_streaming_llm_provider(
    sync_responses: list[dict],
    stream_responses: dict[int, list[str]] | None = None,
) -> LLMProviderService:
    """Create an LLMProviderService with mock transport supporting both sync and stream.

    sync_responses: list of JSON responses for non-streaming calls.
    stream_responses: maps call index -> SSE lines for streaming calls.
    """
    call_index = {"i": 0}
    stream_map = stream_responses or {}

    def handler(request: httpx.Request) -> httpx.Response:
        idx = call_index["i"]
        call_index["i"] += 1
        body = json.loads(request.content)

        if body.get("stream") and idx in stream_map:
            sse_text = "\n".join(stream_map[idx]) + "\n"
            return httpx.Response(
                200,
                content=sse_text.encode(),
                headers={"content-type": "text/event-stream"},
            )

        if idx < len(sync_responses):
            return httpx.Response(200, json=sync_responses[idx])
        return httpx.Response(200, json=_openai_response("fallback"))

    return LLMProviderService(
        client_factory=lambda: httpx.Client(
            transport=httpx.MockTransport(handler),
        ),
    )


def _create_streaming_runtime(
    sync_responses: list[dict],
    stream_responses: dict[int, list[str]] | None = None,
    registry: PluginRegistry | None = None,
) -> RuntimeService:
    if registry is None:
        registry = PluginRegistry()
    proxy = PluginCallProxy(registry)
    runtime = RuntimeService(plugin_call_proxy=proxy)
    llm_provider = _make_streaming_llm_provider(sync_responses, stream_responses)
    runtime._llm_provider = llm_provider
    runtime._agent_runtime._llm_provider = llm_provider
    return runtime


# ---------------------------------------------------------------------------
# Test: streaming finalize produces real-time node.output.delta events
# ---------------------------------------------------------------------------

def test_streaming_finalize_produces_realtime_deltas(sqlite_session: Session) -> None:
    """When LLM streaming is available, finalize phase should produce
    per-chunk node.output.delta events instead of post-hoc chunking."""
    full_answer = "The answer to everything is 42."
    stream_lines = _openai_stream_lines(full_answer, chunk_size=10)

    runtime = _create_streaming_runtime(
        sync_responses=[
            # Plan call (sync) - call index 0
            _openai_response("I will analyze the topic."),
        ],
        stream_responses={
            # Finalize call (streaming) - call index 1
            1: stream_lines,
        },
    )

    workflow = Workflow(
        id="wf-stream-finalize",
        name="Streaming Finalize Test",
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
    output = agent_run.output_payload
    assert output["result"] == full_answer
    assert output["decision_basis"] == "llm"
    assert output.get("streaming") is True

    # Check that real-time delta events were persisted
    delta_events = [
        e for e in artifacts.events
        if e.event_type == "node.output.delta"
        and (e.payload or {}).get("node_id") == "agent"
    ]
    assert len(delta_events) >= 2, "Should have multiple streaming delta events"

    # Verify delta content concatenates to full answer
    delta_text = "".join(
        (e.payload or {}).get("delta", "") for e in delta_events
    )
    assert delta_text == full_answer


# ---------------------------------------------------------------------------
# Test: streaming fallback to sync when stream fails
# ---------------------------------------------------------------------------

def test_streaming_fallback_to_sync_on_error(sqlite_session: Session) -> None:
    """When streaming fails, finalize should fall back to sync LLM call
    and produce post-hoc delta events."""
    runtime = _create_streaming_runtime(
        sync_responses=[
            # Plan call (sync) - call index 0
            _openai_response("Planning..."),
            # Finalize sync fallback - call index 1 (stream will fail, retry sync)
            _openai_response("Sync fallback answer."),
        ],
        stream_responses={
            # Finalize streaming will return error
            1: [],  # Empty stream → LLMProviderError("empty content")
        },
    )

    workflow = Workflow(
        id="wf-stream-fallback",
        name="Stream Fallback Test",
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

    assert artifacts.run.status == "succeeded"
    agent_run = next(nr for nr in artifacts.node_runs if nr.node_id == "agent")
    output = agent_run.output_payload
    # Should have gotten sync fallback result
    assert output["decision_basis"] == "llm"
    assert output.get("streaming") is None  # Not streaming since fell back


# ---------------------------------------------------------------------------
# Test: mock config still bypasses streaming
# ---------------------------------------------------------------------------

def test_mock_config_bypasses_streaming(sqlite_session: Session) -> None:
    """When mockFinalOutput is present, streaming should NOT be attempted."""
    runtime = _create_streaming_runtime(
        sync_responses=[],
        stream_responses={},
    )

    workflow = Workflow(
        id="wf-mock-no-stream",
        name="Mock No Stream Test",
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
                        "mockPlan": {"toolCalls": []},
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
    assert agent_run.output_payload.get("streaming") is None


# ---------------------------------------------------------------------------
# Test: streaming with tools produces correct delta events
# ---------------------------------------------------------------------------

def test_streaming_finalize_with_tool_results(sqlite_session: Session) -> None:
    """When tools execute and streaming LLM is available, finalize via streaming
    with tool context included."""
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

    full_answer = "Based on search results, I found 3 items."
    stream_lines = _openai_stream_lines(full_answer, chunk_size=15)

    runtime = _create_streaming_runtime(
        sync_responses=[],
        stream_responses={
            # Finalize streaming - call index 0 (no plan LLM since mockPlan)
            0: stream_lines,
        },
        registry=registry,
    )

    workflow = Workflow(
        id="wf-stream-tools",
        name="Stream With Tools Test",
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
    assert output["result"] == full_answer
    assert output["decision_basis"] == "llm_with_tools"
    assert output.get("streaming") is True

    # Should have streaming delta events
    delta_events = [
        e for e in artifacts.events
        if e.event_type == "node.output.delta"
        and (e.payload or {}).get("node_id") == "agent"
    ]
    assert len(delta_events) >= 2


# ---------------------------------------------------------------------------
# Test: streaming HTTP 500 falls back to synthetic output
# ---------------------------------------------------------------------------

def test_streaming_http_error_degrades_gracefully(sqlite_session: Session) -> None:
    """When both streaming and sync LLM calls fail, fall back to synthetic output."""

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
        id="wf-stream-error",
        name="Stream Error Test",
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

    # Should still succeed via synthetic fallback
    assert artifacts.run.status == "succeeded"
    agent_run = next(nr for nr in artifacts.node_runs if nr.node_id == "agent")
    assert agent_run.output_payload["decision_basis"] == "working_context"
