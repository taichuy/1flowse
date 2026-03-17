"""LLM Provider Service.

Unified abstraction for calling LLM APIs (OpenAI-compatible and Anthropic).
Supports both synchronous and streaming modes.

Provider routing:
- "openai" / "deepseek" / any OpenAI-compatible → POST {baseUrl}/chat/completions
- "anthropic" → POST {baseUrl}/messages
- Unknown providers default to OpenAI-compatible protocol
"""

from __future__ import annotations

import json
import logging
from collections.abc import Generator
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx

from app.core.config import get_settings

LLMClientFactory = Callable[[], httpx.Client]

_log = logging.getLogger(__name__)

_OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1"
_ANTHROPIC_DEFAULT_BASE_URL = "https://api.anthropic.com"
_ANTHROPIC_VERSION = "2023-06-01"
_DEFAULT_MAX_TOKENS = 4096
_DEFAULT_TIMEOUT_SECONDS = 120

_ANTHROPIC_PROVIDERS = frozenset({"anthropic"})


@dataclass(frozen=True)
class LLMCallConfig:
    """Configuration for a single LLM call."""

    provider: str
    model_id: str
    api_key: str
    messages: list[dict[str, str]]
    system_prompt: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    base_url: str | None = None
    extra_params: dict[str, Any] = field(default_factory=dict)


@dataclass
class LLMResponse:
    """Complete LLM response (non-streaming)."""

    text: str
    model: str = ""
    finish_reason: str = ""
    usage: dict[str, int] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class LLMStreamChunk:
    """Single chunk from a streaming LLM response."""

    delta: str
    finish_reason: str | None = None
    model: str = ""
    usage: dict[str, int] = field(default_factory=dict)


class LLMProviderError(RuntimeError):
    """Raised when an LLM API call fails."""

    def __init__(self, message: str, *, status_code: int | None = None, body: str = "") -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class LLMProviderService:
    """Unified LLM provider that routes to OpenAI-compatible or Anthropic APIs."""

    def __init__(
        self,
        *,
        timeout_seconds: int | None = None,
        client_factory: LLMClientFactory | None = None,
    ) -> None:
        if timeout_seconds is None:
            timeout_seconds = getattr(
                get_settings(), "llm_default_timeout_seconds", _DEFAULT_TIMEOUT_SECONDS
            )
        self._timeout_seconds = timeout_seconds
        self._client_factory = client_factory

    def chat(self, config: LLMCallConfig) -> LLMResponse:
        """Synchronous LLM call. Returns complete response."""
        if self._is_anthropic(config.provider):
            return self._anthropic_chat(config)
        return self._openai_chat(config)

    def chat_stream(self, config: LLMCallConfig) -> Generator[LLMStreamChunk, None, None]:
        """Streaming LLM call. Yields chunks as they arrive."""
        if self._is_anthropic(config.provider):
            yield from self._anthropic_chat_stream(config)
        else:
            yield from self._openai_chat_stream(config)

    # --- OpenAI-compatible ---

    def _openai_chat(self, config: LLMCallConfig) -> LLMResponse:
        url = self._openai_url(config)
        headers = self._openai_headers(config)
        body = self._openai_body(config, stream=False)

        with self._make_client() as client:
            resp = client.post(url, headers=headers, json=body)
            self._check_response(resp, config.provider)
            data = resp.json()

        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        return LLMResponse(
            text=message.get("content") or "",
            model=data.get("model") or config.model_id,
            finish_reason=choice.get("finish_reason") or "",
            usage=data.get("usage") or {},
            raw=data,
        )

    def _openai_chat_stream(
        self, config: LLMCallConfig
    ) -> Generator[LLMStreamChunk, None, None]:
        url = self._openai_url(config)
        headers = self._openai_headers(config)
        body = self._openai_body(config, stream=True)

        with self._make_client() as client:
            with client.stream("POST", url, headers=headers, json=body) as resp:
                self._check_response(resp, config.provider)
                for line in resp.iter_lines():
                    chunk = self._parse_openai_sse_line(line, config.model_id)
                    if chunk is not None:
                        yield chunk

    def _openai_url(self, config: LLMCallConfig) -> str:
        base = (config.base_url or _OPENAI_DEFAULT_BASE_URL).rstrip("/")
        return f"{base}/chat/completions"

    def _openai_headers(self, config: LLMCallConfig) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
        }

    def _openai_body(self, config: LLMCallConfig, *, stream: bool) -> dict[str, Any]:
        messages: list[dict[str, str]] = []
        if config.system_prompt:
            messages.append({"role": "system", "content": config.system_prompt})
        messages.extend(config.messages)

        body: dict[str, Any] = {
            "model": config.model_id,
            "messages": messages,
            "stream": stream,
        }
        if stream:
            body["stream_options"] = {"include_usage": True}
        if config.temperature is not None:
            body["temperature"] = config.temperature
        if config.max_tokens is not None:
            body["max_tokens"] = config.max_tokens
        for key, value in config.extra_params.items():
            body.setdefault(key, value)
        return body

    def _parse_openai_sse_line(
        self, line: str, model_id: str
    ) -> LLMStreamChunk | None:
        if not line.startswith("data: "):
            return None
        payload = line[6:].strip()
        if payload == "[DONE]":
            return None
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            return None

        choice = (data.get("choices") or [{}])[0]
        delta = choice.get("delta") or {}
        content = delta.get("content") or ""
        finish_reason = choice.get("finish_reason")
        usage = data.get("usage") if isinstance(data.get("usage"), dict) else {}
        if not content and not finish_reason and not usage:
            return None
        return LLMStreamChunk(
            delta=content,
            finish_reason=finish_reason,
            model=data.get("model") or model_id,
            usage=usage,
        )

    # --- Anthropic ---

    def _anthropic_chat(self, config: LLMCallConfig) -> LLMResponse:
        url = self._anthropic_url(config)
        headers = self._anthropic_headers(config)
        body = self._anthropic_body(config, stream=False)

        with self._make_client() as client:
            resp = client.post(url, headers=headers, json=body)
            self._check_response(resp, config.provider)
            data = resp.json()

        text_parts: list[str] = []
        for block in data.get("content") or []:
            if block.get("type") == "text":
                text_parts.append(block.get("text") or "")

        return LLMResponse(
            text="".join(text_parts),
            model=data.get("model") or config.model_id,
            finish_reason=data.get("stop_reason") or "",
            usage=data.get("usage") or {},
            raw=data,
        )

    def _anthropic_chat_stream(
        self, config: LLMCallConfig
    ) -> Generator[LLMStreamChunk, None, None]:
        url = self._anthropic_url(config)
        headers = self._anthropic_headers(config)
        body = self._anthropic_body(config, stream=True)

        with self._make_client() as client:
            with client.stream("POST", url, headers=headers, json=body) as resp:
                self._check_response(resp, config.provider)
                for line in resp.iter_lines():
                    chunk = self._parse_anthropic_sse_line(line, config.model_id)
                    if chunk is not None:
                        yield chunk

    def _anthropic_url(self, config: LLMCallConfig) -> str:
        base = (config.base_url or _ANTHROPIC_DEFAULT_BASE_URL).rstrip("/")
        return f"{base}/v1/messages"

    def _anthropic_headers(self, config: LLMCallConfig) -> dict[str, str]:
        return {
            "x-api-key": config.api_key,
            "anthropic-version": _ANTHROPIC_VERSION,
            "Content-Type": "application/json",
        }

    def _anthropic_body(self, config: LLMCallConfig, *, stream: bool) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": config.model_id,
            "messages": list(config.messages),
            "max_tokens": config.max_tokens or _DEFAULT_MAX_TOKENS,
            "stream": stream,
        }
        if config.system_prompt:
            body["system"] = config.system_prompt
        if config.temperature is not None:
            body["temperature"] = config.temperature
        for key, value in config.extra_params.items():
            body.setdefault(key, value)
        return body

    def _parse_anthropic_sse_line(
        self, line: str, model_id: str
    ) -> LLMStreamChunk | None:
        if not line.startswith("data: "):
            return None
        payload = line[6:].strip()
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            return None

        event_type = data.get("type") or ""
        if event_type == "content_block_delta":
            delta = data.get("delta") or {}
            text = delta.get("text") or ""
            if text:
                return LLMStreamChunk(delta=text, model=model_id)
        elif event_type == "message_delta":
            stop_reason = (data.get("delta") or {}).get("stop_reason")
            if stop_reason:
                return LLMStreamChunk(delta="", finish_reason=stop_reason, model=model_id)
        elif event_type == "message_stop":
            return LLMStreamChunk(delta="", finish_reason="end_turn", model=model_id)
        return None

    # --- Shared helpers ---

    def _is_anthropic(self, provider: str) -> bool:
        return provider.lower() in _ANTHROPIC_PROVIDERS

    def _make_client(self) -> httpx.Client:
        if self._client_factory is not None:
            return self._client_factory()
        settings = get_settings()
        proxy_url = getattr(settings, "llm_http_proxy", "") or ""
        kwargs: dict[str, Any] = {
            "timeout": httpx.Timeout(self._timeout_seconds, connect=30.0),
            "follow_redirects": True,
        }
        if proxy_url:
            kwargs["proxy"] = proxy_url
        return httpx.Client(**kwargs)

    def _check_response(self, resp: httpx.Response, provider: str) -> None:
        if resp.status_code >= 400:
            body = ""
            try:
                body = resp.text
            except Exception:
                pass
            raise LLMProviderError(
                f"LLM provider '{provider}' returned HTTP {resp.status_code}: {body[:500]}",
                status_code=resp.status_code,
                body=body,
            )


def build_llm_call_config(
    *,
    model_config: dict[str, Any],
    system_prompt: str | None = None,
    user_prompt: str,
    node_input: dict[str, Any] | None = None,
) -> LLMCallConfig:
    """Build an LLMCallConfig from an agent node's model config and prompts.

    This is the bridge between AgentRuntime's node config format and the
    LLM provider's call config format.
    """
    provider = str(model_config.get("provider") or "openai")
    model_id = str(model_config.get("modelId") or model_config.get("model_id") or "")
    api_key = str(model_config.get("apiKey") or model_config.get("api_key") or "")
    temperature_raw = model_config.get("temperature")
    temperature = float(temperature_raw) if temperature_raw is not None else None
    max_tokens_raw = model_config.get("maxTokens") or model_config.get("max_tokens")
    max_tokens = int(max_tokens_raw) if max_tokens_raw is not None else None
    base_url = model_config.get("baseUrl") or model_config.get("base_url") or None

    if not model_id:
        raise LLMProviderError("model.modelId is required for LLM calls but was empty.")
    if not api_key:
        raise LLMProviderError(
            "model.apiKey is required for LLM calls. "
            "Configure a credential via the credential store and select it in node config."
        )

    # Build the user message, optionally enriching with node input context
    full_user_content = user_prompt
    if node_input:
        context_parts: list[str] = []
        global_ctx = node_input.get("global_context")
        if global_ctx:
            context_parts.append(f"[Global context]\n{json.dumps(global_ctx, ensure_ascii=False)}")
        upstream = node_input.get("upstream")
        if upstream:
            context_parts.append(
                f"[Upstream input]\n{json.dumps(upstream, ensure_ascii=False)}"
            )
        evidence = node_input.get("evidence_context")
        if evidence:
            context_parts.append(
                f"[Evidence]\n{json.dumps(evidence, ensure_ascii=False)}"
            )
        skill_context = node_input.get("skill_context")
        if skill_context:
            context_parts.append(
                f"[Skills]\n{json.dumps(skill_context, ensure_ascii=False)}"
            )
        if context_parts:
            full_user_content = "\n\n".join(context_parts) + "\n\n" + user_prompt

    messages = [{"role": "user", "content": full_user_content}]

    return LLMCallConfig(
        provider=provider,
        model_id=model_id,
        api_key=api_key,
        messages=messages,
        system_prompt=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        base_url=str(base_url) if base_url else None,
    )
