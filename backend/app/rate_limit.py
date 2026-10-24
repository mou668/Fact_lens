"""Simple in-memory login rate limiter (per IP + email).
NOTE: resets on restart and is per-process. Use Redis for multi-instance deploys."""
import time
from collections import defaultdict, deque
from fastapi import HTTPException, status
from .config import settings

_attempts: dict[str, deque] = defaultdict(deque)


def check(key: str) -> None:
    now = time.time()
    q = _attempts[key]
    while q and now - q[0] > settings.LOGIN_WINDOW_SECONDS:
        q.popleft()
    if len(q) >= settings.LOGIN_MAX_ATTEMPTS:
        retry = int(settings.LOGIN_WINDOW_SECONDS - (now - q[0]))
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                            f"Too many login attempts. Try again in {retry} seconds.",
                            headers={"Retry-After": str(retry)})


def fail(key: str) -> None:
    _attempts[key].append(time.time())


def reset(key: str) -> None:
    _attempts.pop(key, None)
