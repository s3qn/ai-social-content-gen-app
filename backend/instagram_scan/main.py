"""FastAPI scan service (Apify stats + a best-effort Claude Content DNA pass).

POST /scan  {"username": "..."}  ->
    {
      "stats": {followers, following, posts, fullName, avatarUrl},
      "postTypeBreakdown": {...},
      "engagementInsight": {...},
      "topPosts": [{shortCode, type, likes, comments, views, thumbnailUrl}],
      "dna":   {vibe, topThemes} | null,
      "score": {profileScore, scoreLabel, scoreExplanation} | null,
    }

`topPosts` is the best-performing posts, which the app renders as a sideways
rail of thumbnail tiles under the Content DNA reveal, each linking out to
Instagram. It is always a list (never null): it needs no AI, so it has no
failure mode to model. `views` is null for stills, and `thumbnailUrl` is a
SIGNED CDN link that expires within days (the app falls back to a placeholder).

POST /scan/peers/suggest  {"niche": "...", subtopic, subtopics, themes, vibe,
                           followers} ->
    {"suggestions": [{handle, displayName, avatarUrl, followerCount, why}]}

POST /scan/peers/classify  {themes, vibe, formatMix, followers} ->
    {"niche": "..." | null, "subtopic": "..." | null}

Classify derives the account's real niche from what it already posts, so peer
suggestions are keyed on a specific subtopic instead of the coarse slug the user
picked during onboarding. It costs ONE Claude call and no Apify run. Nulls are a
normal 200: the client then falls back to the onboarding answer.

Peer suggestions cost ONE Claude call plus ONE batched Apify run per niche,
and the client caches the result, so this endpoint is hit about once per niche.
Send {"handles": [...]} instead to skip the LLM and only verify (that is the
path for a handle the user typed in). An empty `suggestions` list is a normal
200: the app turns it into its "add your own" fallback.

`dna` / `score` come from analyze.ai_content_dna(). That call is best-effort:
if the Anthropic key is missing or the call fails, both stay null and the real
Apify-derived stats are returned as normal. The scan never fails on AI.

Security:
  - Bearer auth: Authorization: Bearer <SCAN_TOKEN>, constant-time compared.
  - Bound to 127.0.0.1:8010 only (see run.sh). This host has a public IP.
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

from analyze import ai_content_dna, engagement_by_type, post_type_breakdown, top_posts
from peers import classify_account_niche, suggest_peer_handles
from scraper import fetch_posts, fetch_profile, fetch_profiles, load_apify_api_key

load_dotenv(find_dotenv())

app = FastAPI(title="Instagram Scan Service", version="0.1.0")

HANDLE_RE = re.compile(r"^[A-Za-z0-9._]+$")
MAX_HANDLE_LEN = 30  # Instagram usernames are <= 30 chars.
POSTS_LIMIT = 20

# A peer is a role model, so it has to be meaningfully bigger than the user.
# Anything closer than this reads as a sibling account, not something to study.
MIN_PEER_FOLLOWER_MULTIPLE = 1.5


class ScanRequest(BaseModel):
    username: str


class PeersRequest(BaseModel):
    """Two modes in one body.

    Suggest mode (the normal path) uses `niche` plus whatever profile detail the
    app has. Verify-only mode sends `handles` and skips the LLM: that is what
    the app posts when the user types a handle in by hand.
    """

    niche: str | None = None
    subtopic: str | None = None
    subtopics: list[str] = []
    themes: list[str] = []
    vibe: str | None = None
    followers: int | None = None
    handles: list[str] | None = None


class ClassifyRequest(BaseModel):
    """Signals from the account's own scan, used to name its niche.

    Everything is optional: with nothing usable the model simply comes back
    empty and the endpoint answers with nulls.
    """

    themes: list[str] = []
    vibe: str | None = None
    formatMix: dict | None = None
    followers: int | None = None


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
        "topPosts": top_posts(post_items),
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


def _peer_from_profile(profile: dict, why: str | None) -> dict | None:
    """Shape one raw Apify profile as a suggestion, or None if unusable.

    Drops anything that didn't resolve, that Apify flagged, or that is private:
    a private account is no use as a role model the user can go and study.
    """
    if profile.get("error") or profile.get("errorDescription"):
        return None
    username = profile.get("username")
    if not isinstance(username, str) or not username.strip():
        return None
    if profile.get("private"):
        return None
    return {
        "handle": username,
        "displayName": profile.get("fullName"),
        "avatarUrl": profile.get("profilePicUrlHD") or profile.get("profilePicUrl"),
        "followerCount": profile.get("followersCount"),
        "why": why,
    }


def _run_peers(
    niche: str | None,
    subtopics: list[str],
    themes: list[str],
    vibe: str | None,
    followers: int | None,
    handles: list[str] | None,
    subtopic: str | None = None,
) -> dict:
    api_key = load_apify_api_key() or os.getenv("APIFY_API_KEY")
    if not api_key:
        raise ScanError(500, "server_misconfigured", "Apify API key not configured.")

    if handles is not None:
        # Verify-only: the user typed the handle, so there is nothing to suggest.
        print(f"[peers] verify-only: {len(handles)} handle(s), no LLM call", flush=True)
        candidates = [(h, None) for h in handles]
        floor = None
    else:
        # One Claude call. Never raises, and [] here is a valid empty answer.
        print(
            f"[peers] niche={niche!r} subtopic={subtopic!r}: calling the model",
            flush=True,
        )
        proposed = suggest_peer_handles(
            niche or "", subtopics, themes, vibe, subtopic
        )
        print(f"[peers] model returned {len(proposed)} candidate(s)", flush=True)
        candidates = [(item.get("handle") or "", item.get("why")) for item in proposed]
        floor = (
            followers * MIN_PEER_FOLLOWER_MULTIPLE
            if isinstance(followers, int) and followers > 0
            else None
        )

    # Clean, drop anything malformed, and dedupe: the model can repeat itself,
    # and a duplicate would cost an extra URL in the batch for nothing.
    why_by_handle: dict[str, str | None] = {}
    for raw, why in candidates:
        try:
            handle = _clean_handle(raw)
        except ScanError:
            continue
        key = handle.lower()
        if key in why_by_handle:
            continue
        why_by_handle[key] = why

    if not why_by_handle:
        return {"suggestions": []}

    try:
        # ONE batched run for every candidate. Never one run per handle.
        profile_items = fetch_profiles(api_key, list(why_by_handle.keys()))
    except Exception:
        raise ScanError(502, "apify_error", "Upstream scrape failed. Try again later.")

    suggestions = []
    for profile in profile_items or []:
        username = profile.get("username")
        why = why_by_handle.get(username.lower()) if isinstance(username, str) else None
        peer = _peer_from_profile(profile, why)
        if peer is None:
            continue
        count = peer["followerCount"]
        if floor is not None and (not isinstance(count, int) or count < floor):
            continue
        suggestions.append(peer)

    # One line that explains the whole funnel, so an empty result is never a
    # mystery: how many the model named, how many Instagram actually resolved,
    # and how many survived the "meaningfully bigger" floor.
    print(
        f"[peers] {len(why_by_handle)} asked -> {len(profile_items or [])} resolved"
        f" -> {len(suggestions)} kept (floor={floor})",
        flush=True,
    )
    return {"suggestions": suggestions}


def _run_classify(
    themes: list[str],
    vibe: str | None,
    format_mix: dict | None,
    followers: int | None,
) -> dict:
    """One Claude call, no Apify run. Nulls are a valid answer."""
    result = classify_account_niche(themes, vibe, format_mix, followers)
    niche = result["niche"] if result else None
    subtopic = result["subtopic"] if result else None
    print(
        f"[peers] classify: {len(themes or [])} theme(s) -> "
        f"niche={niche!r} subtopic={subtopic!r}",
        flush=True,
    )
    return {"niche": niche, "subtopic": subtopic}


@app.exception_handler(ScanError)
async def _scan_error_handler(_request: Request, exc: ScanError) -> JSONResponse:
    return _error(exc.status, exc.code, exc.message)


@app.get("/scan/peers/health")
async def peers_health() -> JSONResponse:
    """Proves THIS build has the peers route, without spending an Apify run.

    A 404 here means the service is running an older build, which is the single
    most likely reason peer suggestions come back empty.
    """
    return JSONResponse(status_code=200, content={"ok": True, "peers": True})


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


# Mounted UNDER /scan on purpose: the cloudflared ingress forwards only
# ^/scan(/.*)?$ to this service, so a top-level /peers path would never reach it
# and would need a tunnel config change to expose a second route.
@app.post("/scan/peers/suggest")
async def peers_suggest(
    body: PeersRequest,
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    _check_auth(authorization)
    if body.handles is None and not (body.niche or "").strip():
        raise ScanError(400, "bad_request", "Either niche or handles is required.")
    try:
        # Same reasoning as /scan: the Claude call and Apify HTTP both block.
        result = await run_in_threadpool(
            _run_peers,
            body.niche,
            body.subtopics,
            body.themes,
            body.vibe,
            body.followers,
            body.handles,
            body.subtopic,
        )
    except ScanError:
        raise
    except Exception:
        # Never leak a stack trace.
        raise ScanError(502, "apify_error", "Peer lookup failed unexpectedly.")
    # An empty list is a valid 200: the app uses it to offer "add your own".
    return JSONResponse(status_code=200, content=result)


# Also mounted under /scan for the ingress reason above. No Apify run here, so
# this is the cheap call: one model pass over signals the scan already produced.
@app.post("/scan/peers/classify")
async def peers_classify(
    body: ClassifyRequest,
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    _check_auth(authorization)
    try:
        # The CLI provider spawns a subprocess, so keep it off the event loop.
        result = await run_in_threadpool(
            _run_classify,
            body.themes,
            body.vibe,
            body.formatMix,
            body.followers,
        )
    except ScanError:
        raise
    except Exception:
        # Never leak a stack trace.
        raise ScanError(502, "classify_error", "Niche classification failed.")
    # Nulls are a valid 200: the app falls back to the onboarding niche.
    return JSONResponse(status_code=200, content=result)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}
