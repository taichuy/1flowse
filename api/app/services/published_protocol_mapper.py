from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.schemas.workflow_publish import (
    AnthropicMessageResponse,
    AnthropicMessageResponseContentBlock,
    AnthropicMessageResponseUsage,
    OpenAIChatCompletionChoice,
    OpenAIChatCompletionChoiceMessage,
    OpenAIChatCompletionResponse,
    OpenAIChatCompletionUsage,
    OpenAIResponseMessage,
    OpenAIResponseOutputContent,
    OpenAIResponseOutputItem,
    OpenAIResponseResponse,
    OpenAIResponseUsage,
)

_PREFERRED_TEXT_KEYS = ("text", "content", "answer", "output", "message", "result")


def build_cache_identity_payload(
    *,
    surface: str,
    request_payload: dict[str, Any],
) -> dict[str, Any]:
    return {
        "_surface": surface,
        "request": request_payload,
    }


def extract_text_output(output_payload: Any) -> str:
    preferred_value = _find_preferred_scalar(output_payload)
    if preferred_value is not None:
        return preferred_value
    if output_payload is None:
        return ""
    return json.dumps(
        output_payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def build_openai_chat_completion_response(
    *,
    model: str,
    output_payload: Any,
) -> dict[str, Any]:
    content = extract_text_output(output_payload)
    response = OpenAIChatCompletionResponse(
        id=f"chatcmpl_{uuid4().hex}",
        created=int(datetime.now(UTC).timestamp()),
        model=model,
        choices=[
            OpenAIChatCompletionChoice(
                index=0,
                message=OpenAIChatCompletionChoiceMessage(content=content),
                finish_reason="stop",
            )
        ],
        usage=OpenAIChatCompletionUsage(),
    )
    return response.model_dump(mode="json", exclude_none=True)


def build_openai_response_api_response(
    *,
    model: str,
    output_payload: Any,
) -> dict[str, Any]:
    content = extract_text_output(output_payload)
    response = OpenAIResponseResponse(
        id=f"resp_{uuid4().hex}",
        created_at=int(datetime.now(UTC).timestamp()),
        model=model,
        output=[
            OpenAIResponseOutputItem(
                id=f"msg_{uuid4().hex}",
                content=[
                    OpenAIResponseOutputContent(text=content),
                ],
                message=OpenAIResponseMessage(content=content),
            )
        ],
        output_text=content,
        usage=OpenAIResponseUsage(),
    )
    return response.model_dump(mode="json", exclude_none=True)


def build_anthropic_message_response(
    *,
    model: str,
    output_payload: Any,
) -> dict[str, Any]:
    content = extract_text_output(output_payload)
    response = AnthropicMessageResponse(
        id=f"msg_{uuid4().hex}",
        model=model,
        content=[AnthropicMessageResponseContentBlock(text=content)],
        usage=AnthropicMessageResponseUsage(),
    )
    return response.model_dump(mode="json", exclude_none=True)


def _find_preferred_scalar(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None
    if isinstance(value, (bool, int, float)):
        return str(value)
    if isinstance(value, dict):
        for key in _PREFERRED_TEXT_KEYS:
            candidate = value.get(key)
            resolved = _find_preferred_scalar(candidate)
            if resolved is not None:
                return resolved
        for candidate in value.values():
            resolved = _find_preferred_scalar(candidate)
            if resolved is not None:
                return resolved
        return None
    if isinstance(value, list):
        for candidate in value:
            resolved = _find_preferred_scalar(candidate)
            if resolved is not None:
                return resolved
        return None
    return str(value)
