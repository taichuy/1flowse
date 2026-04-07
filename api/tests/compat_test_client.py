import asyncio
from collections.abc import Callable
from contextlib import AbstractContextManager
from typing import Any

import anyio.to_thread
import httpx

import fastapi.concurrency
import fastapi.dependencies.utils
import fastapi.routing
import starlette.background
import starlette._exception_handler
import starlette.concurrency
import starlette.datastructures
import starlette.endpoints
import starlette.middleware.errors
import starlette.responses
import starlette.routing
import starlette.staticfiles


async def _run_in_threadpool_compat(func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    return func(*args, **kwargs)


async def _run_sync_inline(
    func: Callable[..., Any],
    *args: Any,
    abandon_on_cancel: bool = False,
    cancellable: bool | None = None,
    limiter: Any = None,
) -> Any:
    del abandon_on_cancel, cancellable, limiter
    return func(*args)


def install_sync_endpoint_threadpool_compat() -> None:
    anyio.to_thread.run_sync = _run_sync_inline
    for module in (
        fastapi.concurrency,
        fastapi.dependencies.utils,
        fastapi.routing,
        starlette.background,
        starlette._exception_handler,
        starlette.concurrency,
        starlette.datastructures,
        starlette.endpoints,
        starlette.middleware.errors,
        starlette.responses,
        starlette.routing,
        starlette.staticfiles,
    ):
        module.run_in_threadpool = _run_in_threadpool_compat


class _BufferedStreamContextManager(AbstractContextManager[httpx.Response]):
    def __init__(
        self,
        client: "CompatTestClient",
        method: str,
        url: str,
        kwargs: dict[str, Any],
    ) -> None:
        self._client = client
        self._method = method
        self._url = url
        self._kwargs = kwargs
        self._response: httpx.Response | None = None

    def __enter__(self) -> httpx.Response:
        self._response = self._client.request(self._method, self._url, **self._kwargs)
        return self._response

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        if self._response is not None:
            self._response.close()


class CompatTestClient:
    def __init__(
        self,
        app,
        *,
        base_url: str = "http://testserver",
        raise_server_exceptions: bool = True,
        root_path: str = "",
        headers: dict[str, str] | None = None,
        follow_redirects: bool = True,
        client: tuple[str, int] = ("testclient", 50000),
    ) -> None:
        install_sync_endpoint_threadpool_compat()
        self.app = app
        self.base_url = base_url
        self.raise_server_exceptions = raise_server_exceptions
        self.root_path = root_path
        self.headers = httpx.Headers(headers)
        self.follow_redirects = follow_redirects
        self.client = client
        self.cookies = httpx.Cookies()

    async def _request_async(
        self,
        method: str,
        url: str,
        **kwargs: Any,
    ) -> httpx.Response:
        transport = httpx.ASGITransport(
            app=self.app,
            raise_app_exceptions=self.raise_server_exceptions,
            root_path=self.root_path,
            client=self.client,
        )
        async with httpx.AsyncClient(
            transport=transport,
            base_url=self.base_url,
            cookies=self.cookies,
            follow_redirects=self.follow_redirects,
            headers=self.headers,
        ) as client:
            response = await client.request(method, url, **kwargs)
            content = await response.aread()
            self.cookies = httpx.Cookies(client.cookies)
            return httpx.Response(
                status_code=response.status_code,
                headers=response.headers,
                content=content,
                request=response.request,
                extensions=response.extensions,
            )

    def request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        return asyncio.run(self._request_async(method, url, **kwargs))

    def get(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("PUT", url, **kwargs)

    def patch(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("PATCH", url, **kwargs)

    def delete(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("DELETE", url, **kwargs)

    def stream(self, method: str, url: str, **kwargs: Any) -> _BufferedStreamContextManager:
        return _BufferedStreamContextManager(self, method, url, kwargs)

    def close(self) -> None:
        return None

    def __enter__(self) -> "CompatTestClient":
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        self.close()
