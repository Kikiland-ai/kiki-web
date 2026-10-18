"""Fixed-origin transport. No incoming cookie, owner or proxy header is forwarded."""

from contextlib import asynccontextmanager

import httpx
from websockets.asyncio.client import connect

from .backend import BoundaryError

UNAVAILABLE = "Lab tracking is unavailable; your progress is kept."
MAX_JSON_BYTES = 1_000_000


class LabUpstream:
    def __init__(self, settings, transport=None):
        self.origin = settings.lab_backend_origin
        self.secret = settings.lab_proxy_secret.get_secret_value()
        self.transport = transport

    def headers(self, uid, operation_key=None):
        headers = {
            "x-kiki-owner": f"fb:{uid}",
            "x-kiki-proxy-key": self.secret,
            "Origin": self.origin,
        }
        if operation_key:
            headers["Idempotency-Key"] = operation_key
        return headers

    @asynccontextmanager
    async def response(self, method, path, uid, body=None, operation_key=None):
        try:
            async with httpx.AsyncClient(
                base_url=self.origin,
                transport=self.transport,
                follow_redirects=False,
                timeout=httpx.Timeout(45, connect=5),
                trust_env=False,
            ) as client:
                async with client.stream(
                    method, path, headers=self.headers(uid, operation_key), json=body
                ) as response:
                    status = response.status_code
                    if status == 409:
                        raise BoundaryError(409, "The lab changed. Refresh before trying again.")
                    if status in {401, 403} or status >= 500 or 300 <= status < 400:
                        raise BoundaryError(503, UNAVAILABLE)
                    if not 200 <= status < 300:
                        raise BoundaryError(
                            status if status in {404, 410, 413, 422, 429} else 503,
                            "The lab request could not be completed. Refresh and try again.",
                        )
                    yield response
        except (httpx.HTTPError, OSError, TimeoutError):
            raise BoundaryError(503, UNAVAILABLE) from None

    async def request(self, method, path, uid, body=None, operation_key=None):
        async with self.response(method, path, uid, body, operation_key) as response:
            content = bytearray()
            async for chunk in response.aiter_bytes():
                content.extend(chunk)
                if len(content) > MAX_JSON_BYTES:
                    raise BoundaryError(503, UNAVAILABLE)
            return bytes(content), response.headers.get("Content-Type", "application/json")

    @asynccontextmanager
    async def stream(self, path, uid, body):
        async with self.response("POST", path, uid, body) as response:
            if "text/event-stream" not in response.headers.get("Content-Type", ""):
                raise BoundaryError(503, UNAVAILABLE)
            yield response.aiter_bytes()

    @asynccontextmanager
    async def socket(self, sid, uid):
        origin = self.origin.replace("https://", "wss://").replace("http://", "ws://")
        try:
            async with connect(
                f"{origin}/screen-sessions/{sid}/stream",
                additional_headers=self.headers(uid),
                open_timeout=5,
                close_timeout=2,
                max_size=MAX_JSON_BYTES,
                compression=None,
                proxy=None,
            ) as connection:
                yield connection
        except (OSError, TimeoutError):
            raise BoundaryError(503, UNAVAILABLE) from None
