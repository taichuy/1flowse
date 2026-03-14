"""Tests for LLMProviderService and build_llm_call_config."""

from __future__ import annotations

import json

import httpx
import pytest

from app.services.llm_provider import (
    LLMCallConfig,
    LLMProviderError,
    LLMProviderService,
    LLMStreamChunk,
    build_llm_call_config,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _openai_response(content: str = "Hello!", model: str = "gpt-4o") -> dict:
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


def _anthropic_response(text: str = "Hello!", model: str = "claude-sonnet-4-20250514") -> dict:
    return {
        "id": "msg_test",
        "type": "message",
        "role": "assistant",
        "model": model,
        "content": [{"type": "text", "text": text}],
        "stop_reason": "end_turn",
        "usage": {"input_tokens": 10, "output_tokens": 5},
    }


def _make_service(handler) -> LLMProviderService:
    return LLMProviderService(
        client_factory=lambda: httpx.Client(
            transport=httpx.MockTransport(handler),
        ),
    )


def _config(
    provider: str = "openai",
    model_id: str = "gpt-4o",
    api_key: str = "sk-test",
    **kwargs,
) -> LLMCallConfig:
    return LLMCallConfig(
        provider=provider,
        model_id=model_id,
        api_key=api_key,
        messages=[{"role": "user", "content": "Hi"}],
        **kwargs,
    )


# ---------------------------------------------------------------------------
# OpenAI sync
# ---------------------------------------------------------------------------

def test_openai_chat_returns_response():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        captured["auth"] = request.headers.get("authorization")
        return httpx.Response(200, json=_openai_response("world"))

    svc = _make_service(handler)
    resp = svc.chat(_config())

    assert resp.text == "world"
    assert resp.model == "gpt-4o"
    assert resp.finish_reason == "stop"
    assert resp.usage["prompt_tokens"] == 10
    assert "chat/completions" in captured["url"]
    assert captured["auth"] == "Bearer sk-test"
    assert captured["body"]["model"] == "gpt-4o"
    assert captured["body"]["stream"] is False


def test_openai_chat_with_system_prompt():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json=_openai_response())

    svc = _make_service(handler)
    svc.chat(_config(system_prompt="Be helpful"))

    messages = captured["body"]["messages"]
    assert messages[0]["role"] == "system"
    assert messages[0]["content"] == "Be helpful"
    assert messages[1]["role"] == "user"


def test_openai_chat_with_custom_base_url():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        return httpx.Response(200, json=_openai_response())

    svc = _make_service(handler)
    svc.chat(_config(base_url="https://api.deepseek.com/v1"))

    assert "api.deepseek.com" in captured["url"]


def test_openai_chat_error_raises():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, text="Rate limited")

    svc = _make_service(handler)
    with pytest.raises(LLMProviderError) as exc_info:
        svc.chat(_config())

    assert exc_info.value.status_code == 429
    assert "Rate limited" in exc_info.value.body


# ---------------------------------------------------------------------------
# Anthropic sync
# ---------------------------------------------------------------------------

def test_anthropic_chat_returns_response():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        captured["api_key"] = request.headers.get("x-api-key")
        captured["version"] = request.headers.get("anthropic-version")
        return httpx.Response(200, json=_anthropic_response("bonjour"))

    svc = _make_service(handler)
    resp = svc.chat(_config(provider="anthropic", model_id="claude-sonnet-4-20250514"))

    assert resp.text == "bonjour"
    assert resp.model == "claude-sonnet-4-20250514"
    assert resp.finish_reason == "end_turn"
    assert "/v1/messages" in captured["url"]
    assert captured["api_key"] == "sk-test"
    assert captured["version"] == "2023-06-01"
    assert captured["body"]["max_tokens"] == 4096  # default


def test_anthropic_chat_system_prompt_in_body():
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json=_anthropic_response())

    svc = _make_service(handler)
    svc.chat(_config(provider="anthropic", system_prompt="Be concise"))

    assert captured["body"]["system"] == "Be concise"


def test_anthropic_chat_error_raises():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="Internal error")

    svc = _make_service(handler)
    with pytest.raises(LLMProviderError) as exc_info:
        svc.chat(_config(provider="anthropic"))

    assert exc_info.value.status_code == 500


# ---------------------------------------------------------------------------
# OpenAI streaming
# ---------------------------------------------------------------------------

def test_openai_chat_stream_yields_chunks():
    sse_lines = (
        'data: {"choices":[{"delta":{"content":"He"},"finish_reason":null}],"model":"gpt-4o"}\n'
        'data: {"choices":[{"delta":{"content":"llo"},"finish_reason":null}],"model":"gpt-4o"}\n'
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"model":"gpt-4o"}\n'
        "data: [DONE]\n"
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=sse_lines, headers={"content-type": "text/event-stream"})

    svc = _make_service(handler)
    chunks = list(svc.chat_stream(_config()))

    assert len(chunks) == 3
    assert chunks[0].delta == "He"
    assert chunks[1].delta == "llo"
    assert chunks[2].finish_reason == "stop"


# ---------------------------------------------------------------------------
# Anthropic streaming
# ---------------------------------------------------------------------------

def test_anthropic_chat_stream_yields_chunks():
    sse_lines = (
        'data: {"type":"content_block_delta","delta":{"text":"Bon"}}\n'
        'data: {"type":"content_block_delta","delta":{"text":"jour"}}\n'
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n'
        'data: {"type":"message_stop"}\n'
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text=sse_lines, headers={"content-type": "text/event-stream"})

    svc = _make_service(handler)
    chunks = list(svc.chat_stream(_config(provider="anthropic")))

    assert len(chunks) == 4
    assert chunks[0].delta == "Bon"
    assert chunks[1].delta == "jour"
    assert chunks[2].finish_reason == "end_turn"
    assert chunks[3].finish_reason == "end_turn"


# ---------------------------------------------------------------------------
# build_llm_call_config
# ---------------------------------------------------------------------------

def test_build_config_basic():
    cfg = build_llm_call_config(
        model_config={
            "provider": "openai",
            "modelId": "gpt-4o",
            "apiKey": "sk-abc",
        },
        user_prompt="Hello",
    )
    assert cfg.provider == "openai"
    assert cfg.model_id == "gpt-4o"
    assert cfg.api_key == "sk-abc"
    assert cfg.messages[0]["content"] == "Hello"


def test_build_config_camel_and_snake():
    cfg = build_llm_call_config(
        model_config={
            "provider": "deepseek",
            "model_id": "deepseek-chat",
            "api_key": "sk-ds",
            "base_url": "https://api.deepseek.com/v1",
            "max_tokens": 2048,
        },
        user_prompt="Test",
    )
    assert cfg.model_id == "deepseek-chat"
    assert cfg.base_url == "https://api.deepseek.com/v1"
    assert cfg.max_tokens == 2048


def test_build_config_enriches_with_node_input():
    cfg = build_llm_call_config(
        model_config={"provider": "openai", "modelId": "gpt-4o", "apiKey": "k"},
        user_prompt="Analyze",
        node_input={
            "global_context": {"key": "value"},
            "upstream": {"data": "from_previous"},
        },
    )
    content = cfg.messages[0]["content"]
    assert "[Global context]" in content
    assert "[Upstream input]" in content
    assert "Analyze" in content


def test_build_config_missing_model_id_raises():
    with pytest.raises(LLMProviderError, match="modelId"):
        build_llm_call_config(
            model_config={"provider": "openai", "apiKey": "sk-abc"},
            user_prompt="Hello",
        )


def test_build_config_missing_api_key_raises():
    with pytest.raises(LLMProviderError, match="apiKey"):
        build_llm_call_config(
            model_config={"provider": "openai", "modelId": "gpt-4o"},
            user_prompt="Hello",
        )


def test_build_config_with_system_prompt():
    cfg = build_llm_call_config(
        model_config={"provider": "openai", "modelId": "gpt-4o", "apiKey": "k"},
        system_prompt="Be helpful",
        user_prompt="Hi",
    )
    assert cfg.system_prompt == "Be helpful"
