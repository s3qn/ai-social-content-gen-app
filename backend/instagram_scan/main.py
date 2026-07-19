"""FastAPI scan service (Apify stats + a best-effort Claude Content DNA pass).

POST /scan  {"username": "..."}  ->
    {
      "stats": {followers, following, posts, fullName, avatarUrl},
      "postTypeBreakdown": {...},
      "engagementInsight": {...},
      "dna":   {vibe, topThemes} | null,
      "score": {profileScore, scoreLabel, scoreExplanation} | null,
    }

`dna` / `score` come from analyze.ai_content_dna(). That call is best-effort:
if the Anthropic key is missing or the call fails, both stay null and the real
Apify-derived stats are returned as normal — the scan never fails on AI.

Security:
  - Bearer auth: Authorization: Bearer <SCAN_TOKEN>, constant-time compared.
  - Bound to 127.0.0.1:8010 only (see run.sh) — this host has a public IP.
  - Handle validated (strip @, [A-Za-z0-9._] only, non-empty, length-capped).
  - Typed JSON errors, never a stack trace.
"""

import hmac
import os
import re

from dotenv import find_dotenv, load_dotenv
from fastapi import FastAPI, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from analyze import ai_content_dna, engagement_by_type, post_type_breakdown
from scraper import fetch_posts, fetch_profile, load_apify_api_key

load_dotenv(find_dotenv())

app = FastAPI(title="Instagram Scan Service", version="0.1.0")

HANDLE_RE = re.compile(r"^[A-Za-z0-9._]+$")
MAX_HANDLE_LEN = 30  # Instagram usernames are <= 30 chars.
POSTS_LIMIT = 20


class ScanRequest(BaseModel):
    username: str


class ScanError(Exception):
    """Typed error carrying an HTTP status + machine code + message."""

    def __init__(self, status: int, code: str, message: str):
        self.status = status
        self.code = code
        self.message = message
        super().__init__(message)


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code, "detail": message})


def _check_auth(authorization: str | None) -> None:
    """Constant-time Bearer check against SCAN_TOKEN. Raises ScanError(401)."""
    expected = os.getenv("SCAN_TOKEN") or ""
    if not expected:
        # Misconfiguration: refuse rather than accept everything.
        raise ScanError(500, "server_misconfigured", "Scan token not configured.")
    prefix = "Bearer "
    if not authorization or not authorization.startswith(prefix):
        raise ScanError(401, "unauthorized", "Missing or malformed bearer token.")
    presented = authorization[len(prefix):]
    if not hmac.compare_digest(presented, expected):
        raise ScanError(401, "unauthorized", "Invalid bearer token.")


def _clean_handle(raw: str) -> str:
    """Strip a leading @ and validate. Raises ScanError(400) on bad input."""
    handle = (raw or "").strip().lstrip("@").strip()
    if not handle:
        raise ScanError(400, "bad_handle", "Username is required.")
    if len(handle) > MAX_HANDLE_LEN:
        raise ScanError(400, "bad_handle", "Username is too long.")
    if not HANDLE_RE.match(handle):
        raise ScanError(
            400, "bad_handle", "Username may contain only letters, numbers, '.', '_'."
        )
    return handle


def _profile_stats(profile: dict) -> dict:
    return {
        "followers": profile.get("followersCount"),
        "following": profile.get("followsCount"),
        "posts": profile.get("postsCount"),
        "fullName": profile.get("fullName"),
        "avatarUrl": profile.get("profilePicUrlHD") or profile.get("profilePicUrl"),
    }


def _captions(posts: list[dict]) -> list[str]:
    """Pull the caption text out of the raw Apify post items."""
    out = []
    for post in posts or []:
        caption = post.get("caption")
        if isinstance(caption, str) and caption.strip():
            out.append(caption)
    return out


def _run_scan(handle: str) -> dict:
    api_key = load_apify_api_key() or os.getenv("APIFY_API_KEY")
    if not api_key:
        raise ScanError(500, "server_misconfigured", "Apify API key not configured.")

    try:
        profile_items = fetch_profile(api_key, handle)
    except Exception:
        raise ScanError(502, "apify_error", "Upstream scrape failed. Try again later.")

    if not profile_items:
        raise ScanError(404, "not_found", "Profile not found.")

    profile = profile_items[0]
    # Apify reports a lookup error inside the item for missing handles.
    if profile.get("error") or profile.get("errorDescription"):
        raise ScanError(404, "not_found", "Profile not found.")
    if profile.get("username") is None and profile.get("followersCount") is None:
        raise ScanError(404, "not_found", "Profile not found.")
    if profile.get("private"):
        raise ScanError(404, "private", "This profile is private.")

    try:
        post_items = fetch_posts(api_key, handle, POSTS_LIMIT)
    except Exception:
        raise ScanError(502, "apify_error", "Upstream scrape failed. Try again later.")
    post_items = post_items or []

    # Best-effort Claude pass over the captions. `ai_content_dna` never raises;
    # when it returns None (no key, API failure, bad output) `dna`/`score` stay
    # null and the real stats below still go out.
    dna_result = ai_content_dna(_captions(post_items))

    return {
        "stats": _profile_stats(profile),
        "postTypeBreakdown": post_type_breakdown(post_items),
        "engagementInsight": engagement_by_type(post_items),
        "dna": (
            {"vibe": dna_result["vibe"], "topThemes": dna_result["topThemes"]}
            if dna_result
            else None
        ),
        "score": (
            {
                "profileScore": dna_result["profileScore"],
                "scoreLabel": dna_result["scoreLabel"],
                "scoreExplanation": dna_result["scoreExplanation"],
            }
            if dna_result
            else None
        ),
    }


@app.exception_handler(ScanError)
async def _scan_error_handler(_request: Request, exc: ScanError) -> JSONResponse:
    return _error(exc.status, exc.code, exc.message)


@app.post("/scan")
async def scan(
    body: ScanRequest,
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    _check_auth(authorization)
    handle = _clean_handle(body.username)
    try:
        # `_run_scan` is fully blocking (Apify HTTP + the Content-DNA Claude
        # call, which shells out to the `claude` CLI). Off the event loop it
        # goes, or one scan freezes every other request.
        result = await run_in_threadpool(_run_scan, handle)
    except ScanError:
        raise
    except Exception:
        # Never leak a stack trace.
        raise ScanError(502, "apify_error", "Scan failed unexpectedly.")
    return JSONResponse(status_code=200, content=result)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}
