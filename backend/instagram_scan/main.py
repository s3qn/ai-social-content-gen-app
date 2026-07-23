"""FastAPI scan service (scraped stats + a best-effort Claude Content DNA pass).

Scraping goes through provider.py: ScrapeCreators by default, the Apify actor
when SCRAPER_PROVIDER=apify. The wire contract below is identical on both, and
the 502 error code stays "apify_error" for every provider so no client changes.

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
picked during onboarding. It costs ONE Claude call and no scrape. Nulls are a
normal 200: the client then falls back to the onboarding answer.

Peer suggestions on ScrapeCreators are search-first: 1-2 profile-search
requests find REAL accounts for the niche keyword (follower counts and privacy
arrive inline, so no per-handle verification), and ONE Claude call writes the
card blurbs. If the search strikes out, or on Apify, the older path runs: one
Claude call proposes handles, then one scrape pass verifies them (a single
batched Apify run, or one ScrapeCreators request per candidate handle). The
client caches the result, so this endpoint is hit about once per niche.
Send {"handles": [...]} instead to skip the LLM and only verify (that is the
path for a handle the user typed in). An empty `suggestions` list is a normal
200: the app turns it into its "add your own" fallback.

POST /scan/trending/refresh  {} -> 202 {"status": "refreshing"|"already_refreshing"}

Refreshes the GLOBAL trending cache (supabase trending_batches) if it is older
than the 6h window, and returns immediately: the scrape runs in the background
because no client waits on it. Trending is the same for every user, so this is
scraped once and read by everybody, and concurrent calls collapse to a single
scrape. The app only ever READS the cache; it calls this at most to say "that
batch looks old". Writes use the service role, so no client can poison the cache.

`dna` / `score` come from analyze.ai_content_dna(). That call is best-effort:
if the Anthropic key is missing or the call fails, both stay null and the real
scraped stats are returned as normal. The scan never fails on AI.

Security:
  - Bearer auth: Authorization: Bearer <SCAN_TOKEN>, constant-time compared.
  - Bound to 127.0.0.1:8010 only (see run.sh). This host has a public IP.
  - Handle validated (strip @, [A-Za-z0-9._] only, non-empty, length-capped).
  - Typed JSON errors, never a stack trace.
"""

import asyncio
import hmac
import os
import re
import threading
import time

from dotenv import find_dotenv, load_dotenv
from fastapi import FastAPI, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from analyze import ai_content_dna, engagement_by_type, post_type_breakdown, top_posts
from peers import (
    NICHE_LABELS,
    PEER_COUNT,
    classify_account_niche,
    suggest_peer_handles,
    write_peer_whys,
)
from scrapecreators import OutOfCreditsError

# Imported as modules, not by name: the call sites below read better as
# provider.fetch_profile() / trending.refresh() than as bare verbs, and
# provider is the SCRAPER_PROVIDER toggle between ScrapeCreators and Apify.
import post_analysis
import provider
import scrapecreators
import trending

load_dotenv(find_dotenv())

app = FastAPI(title="Instagram Scan Service", version="0.1.0")

HANDLE_RE = re.compile(r"^[A-Za-z0-9._]+$")
MAX_HANDLE_LEN = 30  # Instagram usernames are <= 30 chars.
POSTS_LIMIT = 20

# A peer is a role model, so it has to be meaningfully bigger than the user.
# Anything closer than this reads as a sibling account, not something to study.
MIN_PEER_FOLLOWER_MULTIPLE = 1.5

# Profile-search pages per peer hunt (1 credit each). Two pages is ~20 hits,
# plenty to fill PEER_COUNT after the private/floor filters.
SEARCH_PAGES = 2


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
    """Pull the caption text out of the Apify-shaped post items."""
    out = []
    for post in posts or []:
        caption = post.get("caption")
        if isinstance(caption, str) and caption.strip():
            out.append(caption)
    return out


def _log_scrape_summary(op: str, label: str, started: float) -> None:
    """One comparable line per operation, the provider A/B test's scoreboard.

    ScrapeCreators bills 1 credit per request, so requests == credits there;
    Apify has no per-call meter, so its line carries only the wall clock.
    """
    total = time.monotonic() - started
    name = provider.provider_name()
    if name == "scrapecreators":
        stats = scrapecreators.tally()
        print(
            f"[{op}] provider=scrapecreators {label}"
            f" requests={stats['requests']} credits_used={stats['requests']}"
            f" credits_remaining={stats['credits_remaining']}"
            f" http_elapsed={stats['http_elapsed']:.1f}s"
            f" total_elapsed={total:.1f}s",
            flush=True,
        )
    else:
        print(f"[{op}] provider=apify {label} total_elapsed={total:.1f}s", flush=True)


def _run_scan(handle: str) -> dict:
    started = time.monotonic()
    scrapecreators.tally_reset()
    api_key = provider.load_api_key()
    if not api_key:
        raise ScanError(500, "server_misconfigured", "Scrape API key not configured.")

    try:
        profile_items = provider.fetch_profile(api_key, handle)
    except OutOfCreditsError:
        raise ScanError(502, "apify_error", "Scrape provider is out of credits.")
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
        post_items = provider.fetch_posts(api_key, handle, POSTS_LIMIT)
    except OutOfCreditsError:
        raise ScanError(502, "apify_error", "Scrape provider is out of credits.")
    except Exception:
        raise ScanError(502, "apify_error", "Upstream scrape failed. Try again later.")
    post_items = post_items or []

    # The scrape is done: log the scoreboard line before the Claude pass so
    # its elapsed time measures the provider, not the AI.
    _log_scrape_summary("scan", f"handle={handle}", started)

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
    """Shape one Apify-shaped profile as a suggestion, or None if unusable.

    Drops anything that didn't resolve, that the scrape flagged, or that is private:
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


def _search_query(niche: str | None, subtopic: str | None) -> str:
    """Keyword phrase for the profile search: the specific subtopic when the
    classify step produced one, else the human niche label."""
    clean = (subtopic or "").strip().lower().replace("_", " ").strip()
    if clean:
        return clean
    key = (niche or "").strip().lower()
    return NICHE_LABELS.get(key, key.replace("_", " ")).strip()


def _run_peers_search(
    api_key: str,
    niche: str | None,
    subtopic: str | None,
    followers: int | None,
) -> dict | None:
    """Peer suggestions from a real profile search instead of model guesses.

    Search hits carry follower counts and privacy inline, so this needs NO
    per-handle verification scrape: 1-2 search credits replace the old
    one-credit-per-candidate fan-out. Claude's only remaining job is the one
    batched `write_peer_whys` call for the card blurbs.

    Returns None to signal "fall back to the model-suggestion path": a search
    error, or a query that found nothing usable, must not take the feature
    down with it.
    """
    query = _search_query(niche, subtopic)
    if not query:
        return None
    floor = (
        followers * MIN_PEER_FOLLOWER_MULTIPLE
        if isinstance(followers, int) and followers > 0
        else None
    )

    started = time.monotonic()
    scrapecreators.tally_reset()
    kept: list[dict] = []
    seen: set[str] = set()
    found = 0
    cursor: str | None = None
    pages = 0
    try:
        for _ in range(SEARCH_PAGES):
            profiles, cursor = scrapecreators.search_profiles(api_key, query, cursor)
            pages += 1
            for profile in profiles:
                try:
                    handle = _clean_handle(profile.get("username") or "")
                except ScanError:
                    continue
                key = handle.lower()
                if key in seen:
                    continue
                seen.add(key)
                found += 1
                if profile.get("private"):
                    continue
                count = profile.get("followersCount")
                if floor is not None and (not isinstance(count, int) or count < floor):
                    continue
                kept.append(profile)
            if len(kept) >= PEER_COUNT or not cursor:
                break
    except OutOfCreditsError:
        raise ScanError(502, "apify_error", "Scrape provider is out of credits.")
    except Exception:
        print(
            f"[peers] search query={query!r} failed; falling back to model"
            " suggestions",
            flush=True,
        )
        return None

    kept = kept[:PEER_COUNT]
    if not kept:
        print(
            f"[peers] search query={query!r} pages={pages} -> {found} found"
            f" -> 0 kept (floor={floor}); falling back to model suggestions",
            flush=True,
        )
        return None

    # ONE Claude call for the card blurbs. Best-effort: {} means no why lines.
    whys = write_peer_whys(niche or "", kept, subtopic)

    suggestions = []
    for profile in kept:
        peer = _peer_from_profile(
            profile, whys.get(profile["username"].strip().lower())
        )
        if peer is not None:
            suggestions.append(peer)

    _log_scrape_summary("peers", f"query={query!r}", started)
    print(
        f"[peers] search query={query!r} pages={pages} -> {found} found"
        f" -> {len(suggestions)} kept (floor={floor})",
        flush=True,
    )
    return {"suggestions": suggestions}


def _run_peers(
    niche: str | None,
    subtopics: list[str],
    themes: list[str],
    vibe: str | None,
    followers: int | None,
    handles: list[str] | None,
    subtopic: str | None = None,
) -> dict:
    api_key = provider.load_api_key()
    if not api_key:
        raise ScanError(500, "server_misconfigured", "Scrape API key not configured.")

    if handles is not None:
        # Verify-only: the user typed the handle, so there is nothing to suggest.
        print(f"[peers] verify-only: {len(handles)} handle(s), no LLM call", flush=True)
        candidates = [(h, None) for h in handles]
        floor = None
    else:
        # Search-first on ScrapeCreators: real profiles from the niche keyword.
        # None here means the search struck out; the model path below still runs.
        if provider.provider_name() == "scrapecreators":
            searched = _run_peers_search(api_key, niche, subtopic, followers)
            if searched is not None:
                return searched
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

    # Timed from here, not from entry, so the scoreboard line measures the
    # provider and not the Claude call that names the candidates.
    started = time.monotonic()
    scrapecreators.tally_reset()
    try:
        # Apify: ONE batched run for every candidate. ScrapeCreators has no
        # batch endpoint, so its adapter fans out one request per handle.
        profile_items = provider.fetch_profiles(api_key, list(why_by_handle.keys()))
    except OutOfCreditsError:
        raise ScanError(502, "apify_error", "Scrape provider is out of credits.")
    except Exception:
        raise ScanError(502, "apify_error", "Upstream scrape failed. Try again later.")
    _log_scrape_summary("peers", f"handles={len(why_by_handle)}", started)

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


# --- Global trending -------------------------------------------------------
# Trending is identical for every user, so it is scraped ONCE per window into the
# shared trending_batches cache (0008) and read by everybody. The app never
# triggers a scrape directly: it reads the cache, and only pings this endpoint
# when the cached batch is past its window.
#
# SINGLE-FLIGHT, and this is the whole cost argument for the feature. uvicorn
# runs this app in ONE process (run.sh passes no --workers), so a module-level
# asyncio.Lock genuinely serialises every concurrent refresh in the service.
# Without it, N users opening the tab against a stale cache would each start a
# scrape for identical global data.
_trending_lock = asyncio.Lock()

# asyncio only holds a WEAK reference to a running task, so a fire-and-forget
# task can be garbage collected mid-scrape. Holding it here keeps it alive.
_trending_task: asyncio.Task | None = None


async def _refresh_trending_if_stale() -> None:
    async with _trending_lock:
        try:
            # Re-checked INSIDE the lock on purpose: a caller that queued behind
            # a running scrape must see the batch that scrape just wrote and do
            # nothing, rather than immediately scrape the same data again.
            if await run_in_threadpool(trending.cache_is_fresh):
                return
            await run_in_threadpool(trending.refresh)
        except Exception:
            # Nothing awaits this task. A failed refresh simply leaves the
            # previous batch in place until the next tab open tries again, which
            # is the right outcome: stale trending beats no trending.
            pass


# Mounted under /scan for the same ingress reason as the peers endpoints.
@app.post("/scan/trending/refresh")
async def trending_refresh(
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    _check_auth(authorization)
    global _trending_task
    # Fast path so a burst of tab opens does not queue N coroutines behind the
    # lock. The lock plus the freshness re-check above is what actually
    # guarantees one scrape; this only stops the pile-up.
    if _trending_lock.locked():
        return JSONResponse(status_code=202, content={"status": "already_refreshing"})
    # Fire and forget: the scrape runs 30-90s and no client waits on it.
    _trending_task = asyncio.create_task(_refresh_trending_if_stale())
    return JSONResponse(status_code=202, content={"status": "refreshing"})


# --- Related posts ---------------------------------------------------------
# RELATED TO YOU on the Trends tab: recent posts for the account's classified
# subtopic keyword. ScrapeCreators only (the Apify provider answers empty).
# One credit per (query, 6h): the in-memory cache makes repeated tab opens
# free, and losing it on restart just means one extra credit.

RELATED_TTL_S = 6 * 3600
_related_cache: dict[str, tuple[float, list[dict]]] = {}
_related_lock = threading.Lock()


class RelatedRequest(BaseModel):
    niche: str | None = None
    subtopic: str | None = None


def _run_related(niche: str | None, subtopic: str | None) -> dict:
    if provider.provider_name() != "scrapecreators":
        return {"posts": []}
    query = _search_query(niche, subtopic)
    if not query:
        return {"posts": []}

    now = time.monotonic()
    with _related_lock:
        cached = _related_cache.get(query)
        if cached and now - cached[0] < RELATED_TTL_S:
            print(f"[related] query={query!r} served from cache", flush=True)
            return {"posts": cached[1]}

    api_key = provider.load_api_key()
    if not api_key:
        raise ScanError(500, "server_misconfigured", "Scrape API key not configured.")

    started = time.monotonic()
    scrapecreators.tally_reset()
    try:
        posts = scrapecreators.search_hashtag_posts(api_key, query)
    except OutOfCreditsError:
        raise ScanError(502, "apify_error", "Scrape provider is out of credits.")
    except Exception:
        raise ScanError(502, "apify_error", "Upstream scrape failed. Try again later.")

    _log_scrape_summary("related", f"query={query!r}", started)
    print(f"[related] query={query!r} -> {len(posts)} post(s)", flush=True)
    # Only cache hits: the search 404s transiently, and caching a flake would
    # blank the section for 6h. An empty answer re-tries on the next open.
    if posts:
        with _related_lock:
            _related_cache[query] = (time.monotonic(), posts)
    return {"posts": posts}


@app.post("/scan/related")
async def related(
    body: RelatedRequest,
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    _check_auth(authorization)
    try:
        result = await run_in_threadpool(_run_related, body.niche, body.subtopic)
    except ScanError:
        raise
    except Exception:
        # Never leak a stack trace.
        raise ScanError(502, "apify_error", "Related lookup failed unexpectedly.")
    return JSONResponse(status_code=200, content=result)


# --- Post analysis ----------------------------------------------------------
# One tapped post: fresh public numbers plus a best-effort strategist analysis
# (post_analysis.analyze_post, one Claude call). Cached in memory per shortcode
# so re-opening the same post within a day costs nothing.

ANALYZE_TTL_S = 24 * 3600
_analyze_cache: dict[str, tuple[float, dict]] = {}
_analyze_lock = threading.Lock()

POST_URL_RE = re.compile(r"^https://www\.instagram\.com/(p|reel|reels)/[A-Za-z0-9_-]+/?")


class AnalyzeRequest(BaseModel):
    """The client passes what it already knows from the trending cache, so the
    endpoint can still answer if the fresh lookup fails."""

    url: str
    shortCode: str | None = None
    caption: str | None = None
    likes: int | None = None
    comments: int | None = None
    views: int | None = None
    thumbnailUrl: str | None = None
    ownerUsername: str | None = None


def _run_analyze(body: AnalyzeRequest) -> dict:
    url = (body.url or "").strip()
    if not POST_URL_RE.match(url):
        raise ScanError(400, "bad_request", "Not an Instagram post URL.")
    cache_key = body.shortCode or url

    now = time.monotonic()
    with _analyze_lock:
        cached = _analyze_cache.get(cache_key)
        if cached and now - cached[0] < ANALYZE_TTL_S:
            print(f"[analyze] {cache_key} served from cache", flush=True)
            return cached[1]

    api_key = provider.load_api_key()
    if not api_key:
        raise ScanError(500, "server_misconfigured", "Scrape API key not configured.")

    started = time.monotonic()
    scrapecreators.tally_reset()
    fresh: dict | None = None
    if provider.provider_name() == "scrapecreators":
        try:
            fresh = scrapecreators.fetch_post_info(api_key, url)
        except OutOfCreditsError:
            raise ScanError(502, "apify_error", "Scrape provider is out of credits.")
        except Exception:
            # Fall back to the client's cached numbers below.
            fresh = None

    post = {
        "url": url,
        "shortCode": body.shortCode,
        "caption": (fresh or {}).get("caption") or body.caption or "",
        "likes": (fresh or {}).get("likes") if fresh else body.likes,
        "comments": (fresh or {}).get("comments") if fresh else body.comments,
        "views": (fresh or {}).get("views") if fresh else body.views,
        "ownerUsername": (fresh or {}).get("ownerUsername") or body.ownerUsername,
        "isVideo": (fresh or {}).get("isVideo"),
        "thumbnailUrl": (fresh or {}).get("displayUrl") or body.thumbnailUrl,
        "fresh": fresh is not None,
    }

    # Best-effort: None means the modal shows numbers without the breakdown.
    analysis = post_analysis.analyze_post(post)

    result = {"post": post, "analysis": analysis}
    _log_scrape_summary("analyze", f"post={cache_key}", started)
    with _analyze_lock:
        _analyze_cache[cache_key] = (time.monotonic(), result)
    return result


@app.post("/scan/trending/analyze")
async def trending_analyze(
    body: AnalyzeRequest,
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    _check_auth(authorization)
    try:
        # Blocking: one scrape HTTP call plus the Claude analysis subprocess.
        result = await run_in_threadpool(_run_analyze, body)
    except ScanError:
        raise
    except Exception:
        # Never leak a stack trace.
        raise ScanError(502, "apify_error", "Post analysis failed unexpectedly.")
    return JSONResponse(status_code=200, content=result)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}
