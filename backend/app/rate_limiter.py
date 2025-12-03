"""Rate limiting configuration for the API."""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request
from starlette.responses import JSONResponse


def get_client_ip(request: Request) -> str:
    """Extract client IP address from request.
    
    Checks X-Forwarded-For header first for proxy support,
    falls back to direct client IP.
    """
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # X-Forwarded-For can contain multiple IPs, first one is the client
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


# Initialize the limiter with in-memory storage
limiter = Limiter(key_func=get_client_ip)


async def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> JSONResponse:
    """Handle rate limit exceeded errors with a JSON response."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": f"Rate limit exceeded: {exc.detail}",
            "retry_after": exc.detail,
        },
        headers={"Retry-After": str(exc.detail)},
    )

