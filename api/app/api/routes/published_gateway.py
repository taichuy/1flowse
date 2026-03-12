from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.workflow_publish import (
    AnthropicMessageRequest,
    AnthropicMessageResponse,
    OpenAIChatCompletionRequest,
    OpenAIChatCompletionResponse,
    OpenAIResponseRequest,
    OpenAIResponseResponse,
    PublishedNativeRunRequest,
    PublishedNativeRunResponse,
)
from app.services.published_gateway import (
    PublishedEndpointGatewayError,
    PublishedEndpointGatewayService,
)

router = APIRouter(prefix="/v1", tags=["published-gateway"])
published_gateway_service = PublishedEndpointGatewayService()


def _extract_presented_api_key(request: Request) -> str | None:
    header_api_key = request.headers.get("x-api-key")
    if header_api_key and header_api_key.strip():
        return header_api_key.strip()

    authorization = request.headers.get("authorization")
    if authorization:
        scheme, _, credentials = authorization.partition(" ")
        if scheme.strip().lower() == "bearer" and credentials.strip():
            return credentials.strip()
    return None


def _build_openai_chat_input_payload(payload: OpenAIChatCompletionRequest) -> dict:
    return {
        "model": payload.model,
        "messages": payload.messages,
        "metadata": payload.metadata,
        "temperature": payload.temperature,
    }


def _build_openai_response_input_payload(payload: OpenAIResponseRequest) -> dict:
    return {
        "model": payload.model,
        "input": payload.input,
        "instructions": payload.instructions,
        "metadata": payload.metadata,
    }


def _build_anthropic_message_input_payload(payload: AnthropicMessageRequest) -> dict:
    return {
        "model": payload.model,
        "messages": payload.messages,
        "system": payload.system,
        "max_tokens": payload.max_tokens,
        "metadata": payload.metadata,
    }

@router.post(
    "/workflows/{workflow_id}/published-endpoints/{endpoint_id}/run",
    response_model=PublishedNativeRunResponse,
)
def invoke_published_native_endpoint(
    workflow_id: str,
    endpoint_id: str,
    payload: PublishedNativeRunRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> PublishedNativeRunResponse:
    try:
        result = published_gateway_service.invoke_native_endpoint(
            db,
            workflow_id=workflow_id,
            endpoint_id=endpoint_id,
            input_payload=payload.input_payload,
            presented_api_key=_extract_presented_api_key(request),
        )
    except PublishedEndpointGatewayError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    response.headers["X-7Flows-Cache"] = result.cache_status.upper()
    return PublishedNativeRunResponse.model_validate(result.response_payload)


@router.post(
    "/published-aliases/{endpoint_alias}/run",
    response_model=PublishedNativeRunResponse,
)
def invoke_published_native_endpoint_by_alias(
    endpoint_alias: str,
    payload: PublishedNativeRunRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> PublishedNativeRunResponse:
    try:
        result = published_gateway_service.invoke_native_endpoint_by_alias(
            db,
            endpoint_alias=endpoint_alias,
            input_payload=payload.input_payload,
            presented_api_key=_extract_presented_api_key(request),
        )
    except PublishedEndpointGatewayError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    response.headers["X-7Flows-Cache"] = result.cache_status.upper()
    return PublishedNativeRunResponse.model_validate(result.response_payload)


@router.post(
    "/published-paths/{route_path:path}",
    response_model=PublishedNativeRunResponse,
)
def invoke_published_native_endpoint_by_path(
    route_path: str,
    payload: PublishedNativeRunRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> PublishedNativeRunResponse:
    try:
        result = published_gateway_service.invoke_native_endpoint_by_path(
            db,
            route_path=route_path,
            input_payload=payload.input_payload,
            presented_api_key=_extract_presented_api_key(request),
        )
    except PublishedEndpointGatewayError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    response.headers["X-7Flows-Cache"] = result.cache_status.upper()
    return PublishedNativeRunResponse.model_validate(result.response_payload)


@router.post(
    "/chat/completions",
    response_model=OpenAIChatCompletionResponse,
)
def invoke_published_openai_chat_completion(
    payload: OpenAIChatCompletionRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> OpenAIChatCompletionResponse:
    if payload.stream:
        raise HTTPException(
            status_code=422,
            detail="Streaming chat completions are not supported yet.",
        )

    try:
        result = published_gateway_service.invoke_openai_chat_completion(
            db,
            model=payload.model,
            input_payload=_build_openai_chat_input_payload(payload),
            request_payload=payload.model_dump(mode="json", exclude_none=True),
            presented_api_key=_extract_presented_api_key(request),
        )
    except PublishedEndpointGatewayError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    response.headers["X-7Flows-Cache"] = result.cache_status.upper()
    return OpenAIChatCompletionResponse.model_validate(result.response_payload)


@router.post(
    "/responses",
    response_model=OpenAIResponseResponse,
)
def invoke_published_openai_response(
    payload: OpenAIResponseRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> OpenAIResponseResponse:
    if payload.stream:
        raise HTTPException(
            status_code=422,
            detail="Streaming responses are not supported yet.",
        )

    try:
        result = published_gateway_service.invoke_openai_response(
            db,
            model=payload.model,
            input_payload=_build_openai_response_input_payload(payload),
            request_payload=payload.model_dump(mode="json", exclude_none=True),
            presented_api_key=_extract_presented_api_key(request),
        )
    except PublishedEndpointGatewayError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    response.headers["X-7Flows-Cache"] = result.cache_status.upper()
    return OpenAIResponseResponse.model_validate(result.response_payload)


@router.post(
    "/messages",
    response_model=AnthropicMessageResponse,
)
def invoke_published_anthropic_message(
    payload: AnthropicMessageRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AnthropicMessageResponse:
    if payload.stream:
        raise HTTPException(
            status_code=422,
            detail="Streaming Anthropic messages are not supported yet.",
        )

    try:
        result = published_gateway_service.invoke_anthropic_message(
            db,
            model=payload.model,
            input_payload=_build_anthropic_message_input_payload(payload),
            request_payload=payload.model_dump(mode="json", exclude_none=True),
            presented_api_key=_extract_presented_api_key(request),
        )
    except PublishedEndpointGatewayError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    response.headers["X-7Flows-Cache"] = result.cache_status.upper()
    return AnthropicMessageResponse.model_validate(result.response_payload)
