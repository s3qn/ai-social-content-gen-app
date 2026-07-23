"""ScrapeCreators Instagram scraping: profile, posts, trending reels.

Test replacement for the Apify actor in scraper.py. Every function returns the
same Apify-shaped dicts the rest of the service already consumes
(followersCount, shortCode, displayUrl, ...), so main.py, analyze.py and
trending.py stay provider-blind. provider.py picks between this module and
scraper.py via SCRAPER_PROVIDER.

Cost model: flat 1 credit per HTTP request, and every response carries
credits_remaining. Each call logs its latency and the remaining balance, and a
per-operation tally lets main.py print one comparable summary line per scan.
That logging is the point: this migration is a reliability/speed/credit test
against Apify.

No batch profile endpoint exists, so the peer batch (one Apify run for N
handles) becomes N parallel single-profile requests here.
"""

import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import httpx
from dotenv import find_dotenv, load_dotenv

BASE_URL = "https://api.scrapecreators.com"
# Uncached lookups can take a while; connect failures should still surface fast.
TIMEOUT = httpx.Timeout(60.0, connect=10.0)
# The v2 posts endpoint returns ~12 items per page, so a 20-post scan needs at
# most two pages. Hard cap: pagination must never turn one scan into a crawl.
MAX_POST_PAGES = 2
# Fan-out width for the peer batch. Far below the documented 500-concurrent
# ceiling; enough that 5-10 candidate handles resolve in one or two waves.
PROFILE_CONCURRENCY = 6

_MEDIA_TYPES = {1: "Image", 2: "Video", 8: "Sidecar"}

# One shared client (httpx.Client is thread-safe) so the peer fan-out reuses
# connections instead of opening one per handle.
_client = httpx.Client(base_url=BASE_URL, timeout=TIMEOUT)


class ScrapeCreatorsError(Exception):
    """Upstream failure carrying the HTTP status and a short detail."""

    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail
        super().__init__(f"{status}: {detail}")


class OutOfCreditsError(ScrapeCreatorsError):
    """HTTP 402: the account balance is empty. Kept distinct so main.py can
    answer with a message that names the actual problem."""

    def __init__(self):
        super().__init__(402, "ScrapeCreators account is out of credits.")


def load_api_key() -> str | None:
    """Load SCRAPECREATORS_API_KEY from the environment (.env is loaded by the
    caller / run.sh, but we also best-effort find one here)."""
    load_dotenv(find_dotenv())
    return os.getenv("SCRAPECREATORS_API_KEY")


# --- Per-operation tally ----------------------------------------------------
# main.py resets this at the start of a scan and prints it at the end, giving
# one line per operation with request count (== credits at 1 credit/request),
# cumulative HTTP time and the last seen balance. The tally object lives in a
# threading.local keyed to the operation's threadpool thread; fetch_profiles
# hands the SAME object to its worker threads, so the fan-out still counts.


class _Tally:
    def __init__(self):
        self.requests = 0
        self.http_elapsed = 0.0
        self.credits_remaining = None
        self._lock = threading.Lock()

    def add(self, elapsed: float, credits_remaining) -> None:
        with self._lock:
            self.requests += 1
            self.http_elapsed += elapsed
            if credits_remaining is not None:
                self.credits_remaining = credits_remaining

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "requests": self.requests,
                "http_elapsed": self.http_elapsed,
                "credits_remaining": self.credits_remaining,
            }


_LOCAL = threading.local()


def tally_reset() -> None:
    _LOCAL.tally = _Tally()


def tally() -> dict:
    current = getattr(_LOCAL, "tally", None)
    if current is None:
        return {"requests": 0, "http_elapsed": 0.0, "credits_remaining": None}
    return current.snapshot()


# --- HTTP -------------------------------------------------------------------


def _get(api_key: str, path: str, params: dict, label: str) -> dict | None:
    """One authenticated GET. Logs latency + balance, feeds the tally.

    Returns the parsed JSON body, or None on a 404 (the caller decides what a
    missing resource means). Raises OutOfCreditsError on 402 and
    ScrapeCreatorsError on everything else that is not a usable 2xx body.
    """
    started = time.monotonic()
    try:
        response = _client.get(path, params=params, headers={"x-api-key": api_key})
    except httpx.HTTPError as exc:
        raise ScrapeCreatorsError(502, f"request failed: {type(exc).__name__}")
    elapsed = time.monotonic() - started

    try:
        body = response.json()
    except ValueError:
        body = None
    credits = body.get("credits_remaining") if isinstance(body, dict) else None

    current = getattr(_LOCAL, "tally", None)
    if current is not None:
        current.add(elapsed, credits)
    print(
        f"[scrapecreators] GET {path} {label} status={response.status_code}"
        f" elapsed={elapsed:.2f}s credits_remaining={credits}",
        flush=True,
    )

    if response.status_code == 402:
        raise OutOfCreditsError()
    if response.status_code == 404:
        return None
    if response.status_code >= 400 or not isinstance(body, dict):
        raise ScrapeCreatorsError(response.status_code, "upstream error")
    if body.get("success") is False:
        raise ScrapeCreatorsError(
            response.status_code, str(body.get("message") or "success=false")[:200]
        )
    return body


def _iso_from_taken_at(value) -> str | None:
    """taken_at arrives as a unix int on the v2/reels endpoints and as an ISO
    string elsewhere. trending.normalize drops anything that is not an ISO
    string, so everything is converted here."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)) and value > 0:
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
    if isinstance(value, str) and value:
        return value
    return None


def _caption_text(raw) -> str:
    """v2 captions are objects ({text: ...}), v1 captions are plain strings.
    main._captions and trending.normalize both want a plain string."""
    if isinstance(raw, dict):
        text = raw.get("text")
        return text if isinstance(text, str) else ""
    return raw if isinstance(raw, str) else ""


def _first_candidate_url(container) -> str | None:
    candidates = (
        container.get("candidates") if isinstance(container, dict) else None
    )
    if isinstance(candidates, list) and candidates and isinstance(candidates[0], dict):
        return candidates[0].get("url")
    return None


# --- Profile ----------------------------------------------------------------


def _edge_count(edge):
    return edge.get("count") if isinstance(edge, dict) else None


def _map_profile(user: dict) -> dict:
    return {
        "username": user.get("username"),
        "fullName": user.get("full_name"),
        "profilePicUrlHD": user.get("profile_pic_url_hd"),
        "profilePicUrl": user.get("profile_pic_url"),
        "followersCount": _edge_count(user.get("edge_followed_by")),
        "followsCount": _edge_count(user.get("edge_follow")),
        "postsCount": _edge_count(user.get("edge_owner_to_timeline_media")),
        "private": bool(user.get("is_private")),
    }


def fetch_profile(api_key: str, handle: str) -> list[dict]:
    """Fetch profile details for a single handle. 1 credit.

    Returns a single-item list shaped like the Apify details item, or [] when
    the handle does not resolve, which drives main.py's existing not_found
    path. Never sets error/errorDescription: a missing profile IS the empty
    list here.
    """
    body = _get(
        api_key,
        "/v1/instagram/profile",
        {"handle": handle, "trim": "true"},
        f"handle={handle}",
    )
    if body is None:
        return []
    user = (body.get("data") or {}).get("user")
    if not isinstance(user, dict) or not user:
        return []
    return [_map_profile(user)]


def fetch_profiles(api_key: str, handles: list[str]) -> list[dict]:
    """Fetch profile details for many handles. 1 credit per handle.

    There is no batch endpoint, so this fans out parallel single-profile
    requests. A handle that fails to resolve, or errors on its own, is logged
    and skipped so one bad candidate cannot sink the whole peer batch; an
    empty balance still aborts everything.
    """
    if not handles:
        return []

    # Workers run on their own threads, so hand them the caller's tally object
    # or the fan-out's requests would vanish from the scan summary.
    caller_tally = getattr(_LOCAL, "tally", None)

    def worker(handle: str) -> list[dict]:
        _LOCAL.tally = caller_tally
        try:
            return fetch_profile(api_key, handle)
        except OutOfCreditsError:
            raise
        except ScrapeCreatorsError as exc:
            print(
                f"[scrapecreators] profile handle={handle} skipped:"
                f" {exc.status} {exc.detail}",
                flush=True,
            )
            return []

    out: list[dict] = []
    workers = min(PROFILE_CONCURRENCY, len(handles))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for items in pool.map(worker, handles):
            out.extend(items)
    return out


# --- Profile search ---------------------------------------------------------


def _map_search_profile(item: dict) -> dict | None:
    """One search hit to the Apify-profile shape _peer_from_profile consumes.

    Search hits carry follower_count, privacy and names inline, so a hit needs
    NO follow-up profile request. Two extra keys ride along for the why-writer:
    categoryName and biography (untrusted scraped text, fenced downstream).
    """
    username = item.get("username")
    if not isinstance(username, str) or not username.strip():
        return None
    return {
        "username": username.strip(),
        "fullName": item.get("full_name"),
        # Search has no HD variant; both keys point at the same URL so the
        # existing avatarUrl fallback chain works unchanged.
        "profilePicUrlHD": item.get("profile_pic_url"),
        "profilePicUrl": item.get("profile_pic_url"),
        "followersCount": item.get("follower_count"),
        "private": bool(item.get("is_private")),
        "categoryName": item.get("category_name"),
        "biography": item.get("biography"),
    }


def search_profiles(
    api_key: str, query: str, cursor: str | None = None
) -> tuple[list[dict], str | None]:
    """Find real profiles by bio/caption keyword. 1 credit per page.

    Backed by Google-indexed public Instagram pages, so every hit is an
    account that exists right now. Returns (profiles, next_cursor); cursor is
    the next Google results page number, None when the response omits it.
    """
    params: dict = {"query": query}
    if cursor:
        params["cursor"] = cursor
    body = _get(
        api_key,
        "/v1/instagram/search/profiles",
        params,
        f"query={query} cursor={cursor or 1}",
    )
    if body is None:
        return [], None
    # `profiles` sits at the top level, like the trending response.
    hits = body.get("profiles")
    if not isinstance(hits, list):
        hits = (body.get("data") or {}).get("profiles")
    if not isinstance(hits, list):
        return [], None
    out: list[dict] = []
    for item in hits:
        if not isinstance(item, dict):
            continue
        mapped = _map_search_profile(item)
        if mapped is not None:
            out.append(mapped)
    # Documented as a string page number ("2"), but accept a bare int too.
    next_cursor = body.get("cursor")
    if isinstance(next_cursor, int) and next_cursor > 0:
        return out, str(next_cursor)
    return out, next_cursor if isinstance(next_cursor, str) and next_cursor else None


# --- Hashtag post search ----------------------------------------------------


def search_hashtag_posts(api_key: str, query: str) -> list[dict]:
    """Recent posts and reels for a keyword, in the client TrendingPost shape.

    Backs the RELATED TO YOU section: the keyword is the account's classified
    subtopic, flattened to one hashtag-ish token. 1 credit per call; the
    endpoint is Google-backed, filtered to the last week for freshness.
    """
    tag = re.sub(r"[^a-z0-9]", "", (query or "").lower())
    if not tag:
        return []
    params = {"hashtag": tag, "media_type": "all", "date_posted": "last-week"}
    body = _get(api_key, "/v1/instagram/search/hashtag", params, f"hashtag={tag}")
    if body is None:
        # Measured 2026-07-23: this Google-backed endpoint 404s transiently on
        # a cold query and answers fine seconds later. One retry earns its
        # credit; a second failure is a real miss.
        time.sleep(1.0)
        body = _get(
            api_key, "/v1/instagram/search/hashtag", params, f"hashtag={tag} retry"
        )
    if body is None:
        return []
    hits = body.get("posts")
    if not isinstance(hits, list):
        hits = (body.get("data") or {}).get("posts")
    if not isinstance(hits, list):
        return []

    now = datetime.now(timezone.utc)
    out: list[dict] = []
    seen: set[str] = set()
    for item in hits:
        if not isinstance(item, dict):
            continue
        short_code = item.get("shortcode")
        if not isinstance(short_code, str) or not short_code or short_code in seen:
            continue
        seen.add(short_code)
        timestamp = _iso_from_taken_at(item.get("taken_at"))
        age_hours = None
        if timestamp:
            try:
                posted = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                age_hours = round(
                    max((now - posted).total_seconds() / 3600.0, 0.0), 3
                )
            except ValueError:
                age_hours = None
        owner = item.get("owner")
        likes = item.get("like_count")
        comments = item.get("comment_count")
        out.append(
            {
                "shortCode": short_code,
                "url": item.get("url")
                or f"https://www.instagram.com/p/{short_code}/",
                "thumbnailUrl": item.get("display_url") or item.get("thumbnail_src"),
                "caption": _caption_text(item.get("caption")),
                "ownerUsername": owner.get("username")
                if isinstance(owner, dict)
                else None,
                "likes": likes if isinstance(likes, int) and likes >= 0 else 0,
                "comments": comments
                if isinstance(comments, int) and comments >= 0
                else 0,
                "views": item.get("video_view_count")
                or item.get("video_play_count"),
                "timestamp": timestamp,
                "ageHours": age_hours if age_hours is not None else 0.0,
            }
        )
    return out


# --- Single post info -------------------------------------------------------


def fetch_post_info(api_key: str, url: str) -> dict | None:
    """Fresh numbers for one post/reel URL. 1 credit (0 within cache_max_age).

    Instagram publishes no share or save counts, so likes/comments/views is
    the complete public picture. Returns None when the post can't be resolved.
    """
    body = _get(
        api_key,
        "/v1/instagram/post",
        {"url": url, "trim": "true", "cache_max_age": "1d"},
        f"url={url}",
    )
    if body is None:
        return None
    # Measured 2026-07-23: `xdt_shortcode_media` sits at the TOP level of the
    # response, not under `data` as the docs show. Accept both.
    media = body.get("xdt_shortcode_media")
    if not isinstance(media, dict):
        media = (body.get("data") or {}).get("xdt_shortcode_media")
    if not isinstance(media, dict) or not media:
        return None

    def _edge_count(key: str):
        edge = media.get(key)
        return edge.get("count") if isinstance(edge, dict) else None

    caption = ""
    caption_edges = (media.get("edge_media_to_caption") or {}).get("edges")
    if isinstance(caption_edges, list) and caption_edges:
        node = caption_edges[0].get("node") if isinstance(caption_edges[0], dict) else None
        if isinstance(node, dict) and isinstance(node.get("text"), str):
            caption = node["text"]

    owner = media.get("owner")
    return {
        "likes": _edge_count("edge_media_preview_like"),
        "comments": _edge_count("edge_media_to_parent_comment"),
        "views": media.get("video_play_count") or media.get("video_view_count"),
        "caption": caption,
        "ownerUsername": owner.get("username") if isinstance(owner, dict) else None,
        "isVideo": bool(media.get("is_video")),
        "displayUrl": media.get("display_url"),
        "takenAt": _iso_from_taken_at(media.get("taken_at_timestamp")),
    }


# --- Posts ------------------------------------------------------------------


def _display_url(item: dict) -> str | None:
    url = _first_candidate_url(item.get("image_versions2"))
    if url:
        return url
    # Carousels sometimes carry their cover only on the first slide.
    carousel = item.get("carousel_media")
    if isinstance(carousel, list) and carousel and isinstance(carousel[0], dict):
        return _first_candidate_url(carousel[0].get("image_versions2"))
    return None


def _map_post(item: dict) -> dict:
    return {
        "type": _MEDIA_TYPES.get(item.get("media_type")),
        "productType": item.get("product_type"),
        "likesCount": item.get("like_count"),
        "commentsCount": item.get("comment_count"),
        "shortCode": item.get("code"),
        "videoPlayCount": item.get("play_count") or item.get("ig_play_count"),
        "displayUrl": _display_url(item),
        "caption": _caption_text(item.get("caption")),
        "timestamp": _iso_from_taken_at(item.get("taken_at")),
    }


def fetch_posts(api_key: str, handle: str, limit: int = 20) -> list[dict]:
    """Fetch the most recent posts for a single handle. 1 credit per page.

    Pages through /v2/instagram/user/posts until `limit` items are collected,
    capped at MAX_POST_PAGES pages. Items come back shaped like Apify post
    items ("Image"/"Video"/"Sidecar" types, likesCount, shortCode, ...).
    """
    posts: list[dict] = []
    cursor: str | None = None
    for page in range(1, MAX_POST_PAGES + 1):
        params: dict = {"handle": handle, "trim": "true"}
        if cursor:
            params["next_max_id"] = cursor
        body = _get(
            api_key,
            "/v2/instagram/user/posts",
            params,
            f"handle={handle} page={page}",
        )
        if body is None:
            break
        items = body.get("items")
        if isinstance(items, list):
            posts.extend(_map_post(item) for item in items if isinstance(item, dict))
        if len(posts) >= limit or not body.get("more_available"):
            break
        cursor = body.get("next_max_id")
        if not cursor:
            break
    return posts[:limit]


# --- Trending reels ---------------------------------------------------------


def _map_trending_reel(reel: dict) -> dict | None:
    """One reel to the pre-normalize Apify hashtag-post shape.

    trending.normalize drops items without a shortcode or a parseable
    timestamp anyway; dropping them here too keeps the raw-vs-normalized
    numbers in the refresh log honest about usable volume.
    """
    short_code = reel.get("shortcode") or reel.get("code")
    timestamp = _iso_from_taken_at(reel.get("taken_at"))
    if not isinstance(short_code, str) or not short_code or timestamp is None:
        return None
    user = reel.get("user")
    return {
        "shortCode": short_code,
        "timestamp": timestamp,
        "likesCount": reel.get("like_count"),
        "commentsCount": reel.get("comment_count"),
        "url": reel.get("url") or f"https://www.instagram.com/p/{short_code}/",
        "displayUrl": reel.get("image_url")
        or _first_candidate_url(reel.get("image_versions2")),
        "caption": _caption_text(reel.get("caption")),
        "ownerUsername": user.get("username") if isinstance(user, dict) else None,
        "videoPlayCount": reel.get("play_count") or reel.get("ig_play_count"),
        # No inputUrl on purpose: these are not hashtag results, so the stored
        # `hashtag` field becomes null, which the client type allows and the
        # panel never renders.
    }


def fetch_trending_reels(api_key: str) -> list[dict]:
    """Fetch Instagram's public trending reels. 1 credit for the whole batch,
    against the 10-URL Apify hashtag run it replaces.

    The endpoint can return duplicates (it scrapes instagram.com/reels);
    trending.normalize already dedupes on shortCode.
    """
    body = _get(api_key, "/v1/instagram/reels/trending", {}, "trending")
    if body is None:
        return []
    # Measured 2026-07-23: `reels` sits at the TOP level of the response, not
    # under `data` as the docs show. Accept both in case the docs win later.
    reels = body.get("reels")
    if not isinstance(reels, list):
        reels = (body.get("data") or {}).get("reels")
    if not isinstance(reels, list):
        return []
    out: list[dict] = []
    for reel in reels:
        if not isinstance(reel, dict):
            continue
        mapped = _map_trending_reel(reel)
        if mapped is not None:
            out.append(mapped)
    return out
