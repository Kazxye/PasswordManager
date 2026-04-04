import uuid
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware): # Attach a unique UUID to every request for end-to-end tracing
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())

        # Accessible in handlers via request.state.request_id
        request.state.request_id = request_id

        response = await call_next(request)

        # Client can use this to reference specific requests in bug reports
        response.headers["X-Request-ID"] = request_id

        return response