"""Global Instagram trending: one hashtag scrape, ranked into two lists.

Trending is identical for every user, so this runs on a schedule and writes ONE
shared row that every client reads. Nothing here is per-user, and the client
never calls Apify: see supabase/migrations/0008_trending_cache.sql.

Reuses the same `apify/instagram-scraper` actor and the same APIFY_API_KEY as
scraper.py. The only difference is the input: hashtag explore URLs instead of a
profile URL.
"""

import os
from datetime import datetime, timedelta, timezone

from apify_client import ApifyClient
from supabase import Client, create_client

# --- The single swap point -------------------------------------------------
# Generic high-volume tags, deliberately not niche-specific: the MVP shows ONE
# global trending feed to everybody, which is what makes a single shared scrape
# correct. Changing this list is the only change needed to retarget the feed.
#
# TODO: a future feature derives these per user / per niche. That work replaces
# this constant and the call site in refresh(); nothing else here assumes the
# list is global.
TRENDING_HASHTAGS = [
    "reels",
    "viral",
    "explore",
    "fyp",
    "trending",
    "explorepage",
    "reelsinstagram",
    "contentcreator",
    "instagood",
    "creatorlife",
]

# Posts requested per tag. 10 tags x 15 is ~150 results per refresh (~600/day at
# a 6h window), before dedupe. Raise this if Biggest and Rising start to look
# like the same list: a bigger pool is the only real fix for that.
POSTS_PER_TAG = 15

# --- Ranking ---------------------------------------------------------------
# Two lists from ONE scrape:
#
#   Biggest = raw engagement. Skews to mega-accounts by design.
#   Rising  = engagement per hour since posting.
#
# Rising is NOT the engagement-to-follower ratio originally specced. Hashtag
# scrapes return ownerUsername/ownerId/ownerFullName but no follower count: only
# a separate resultsType='details' run per owner exposes followersCount, which
# would roughly double the credit spend per refresh. Velocity uses only fields
# the hashtag scrape already returns.
#
# Known weakness, stated plainly: velocity is a weaker "punching above their
# weight" signal than a follower ratio, because a mega-account's fresh post still
# scores highly. `rising_score` below is the single swap point if that pass is
# ever bought.

# Divide-by-zero guard AND noise guard. Without the floor a post published five
# minutes ago with 40 likes scores 480/hour and tops the list on nothing.
MIN_AGE_HOURS = 1.0
# Older than this is not "rising" by any reading. Applies to the Rising list
# only; Biggest still considers the whole batch.
MAX_AGE_HOURS = 48.0
# Absolute floor so a 3-like post cannot win on a technicality. This replaces the
# minimum-follower floor from the original spec, which is not computable without
# follower data.
MIN_ENGAGEMENT = 50

# How old the newest batch may be before a refresh is allowed to run. The client
# uses the same window; this copy is what actually enforces it, because the
# client is not trusted to decide when we spend Apify credits.
REFRESH_AFTER = timedelta(hours=6)


def _tag_url(tag: str) -> str:
    return f"https://www.instagram.com/explore/tags/{tag}/"


def fetch_hashtag_posts(apify_api_key: str) -> list[dict]:
    """Scrape recent posts for every tag in TRENDING_HASHTAGS.

    One actor run for all tags: `directUrls` takes an array, and `resultsLimit`
    applies per URL. Mirrors the run_input shape in scraper.fetch_posts.
    """
    client = ApifyClient(apify_api_key)
    actor_client = client.actor("apify/instagram-scraper")
    result = actor_client.call(
        run_input={
            "directUrls": [_tag_url(tag) for tag in TRENDING_HASHTAGS],
            "resultsType": "posts",
            "resultsLimit": POSTS_PER_TAG,
        }
    )

    if result is None:
        return []

    data = client.dataset(result["defaultDatasetId"])
    return data.list_items().items or []


def _int(value) -> int:
    """Apify omits counts rather than sending 0, and sends null for hidden ones."""
    return value if isinstance(value, int) and value >= 0 else 0


def _parse_timestamp(raw) -> datetime | None:
    """Apify sends ISO-8601 with a trailing Z, which fromisoformat rejects."""
    if not isinstance(raw, str) or not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _tag_from_input_url(raw) -> str | None:
    """Recover which tag produced an item, for display and debugging."""
    if not isinstance(raw, str) or "/explore/tags/" not in raw:
        return None
    return raw.rstrip("/").rsplit("/", 1)[-1] or None


def rising_score(engagement: int, age_hours: float) -> float:
    """Engagement per hour, floored so very fresh posts cannot divide by ~0.

    THE swap point for a follower-relative score. If an owner-details pass is
    ever added, this becomes engagement / followers and nothing else changes.
    """
    return engagement / max(age_hours, MIN_AGE_HOURS)


def normalize(items: list[dict], now: datetime) -> list[dict]:
    """Raw Apify items to the stored post shape, deduped, scored.

    Scores are computed HERE, at scrape time, not on read. Velocity depends on
    `now`, and post ages grow at different relative rates, so scoring on read
    would quietly reshuffle the list between two reads of the same batch.
    """
    out: list[dict] = []
    seen: set[str] = set()

    for item in items or []:
        short_code = item.get("shortCode")
        if not isinstance(short_code, str) or not short_code:
            continue
        # Tags overlap heavily (a viral reel is on half of them), so the same
        # post arrives several times in one run.
        if short_code in seen:
            continue
        seen.add(short_code)

        posted_at = _parse_timestamp(item.get("timestamp"))
        if posted_at is None:
            continue

        likes = _int(item.get("likesCount"))
        comments = _int(item.get("commentsCount"))
        engagement = likes + comments
        age_hours = (now - posted_at).total_seconds() / 3600.0
        # A clock skew or a future-dated post would otherwise produce a negative
        # age and an enormous negative score.
        age_hours = max(age_hours, 0.0)

        out.append(
            {
                "shortCode": short_code,
                "url": item.get("url") or f"https://www.instagram.com/p/{short_code}/",
                "thumbnailUrl": item.get("displayUrl"),
                "caption": item.get("caption") or "",
                "ownerUsername": item.get("ownerUsername"),
                "likes": likes,
                "comments": comments,
                # Stills have no view count. Kept for display only: ranking never
                # mixes views with likes, because views run about two orders of
                # magnitude higher and every video would outrank every image.
                "views": item.get("videoViewCount") or item.get("videoPlayCount"),
                "timestamp": posted_at.astimezone(timezone.utc).isoformat(),
                "ageHours": round(age_hours, 3),
                "hashtag": _tag_from_input_url(item.get("inputUrl")),
                "engagement": engagement,
                "risingScore": round(rising_score(engagement, age_hours), 4),
                # Precomputed so the client filters without re-deriving the rules.
                "risingEligible": (
                    engagement >= MIN_ENGAGEMENT and age_hours <= MAX_AGE_HOURS
                ),
            }
        )

    return out


def _supabase() -> Client:
    """Service-role client. Bypasses RLS, so it is the only writer to the cache.

    Server-side only. This key must never reach the Expo app, which talks to
    Supabase with the anon key and is denied writes by 0008.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured.")
    return create_client(url, key)


def latest_fetched_at() -> datetime | None:
    """When the newest cached batch was scraped, or None if the cache is empty."""
    res = (
        _supabase()
        .table("trending_batches")
        .select("fetched_at")
        .order("fetched_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return _parse_timestamp(rows[0]["fetched_at"]) if rows else None


def cache_is_fresh(now: datetime | None = None) -> bool:
    """True if the newest batch is inside the refresh window.

    Checked again INSIDE the refresh lock, so a request that queued behind a
    running scrape returns instead of scraping the same data twice.
    """
    now = now or datetime.now(timezone.utc)
    fetched_at = latest_fetched_at()
    return fetched_at is not None and (now - fetched_at) < REFRESH_AFTER


def write_batch(posts: list[dict], now: datetime) -> None:
    _supabase().table("trending_batches").insert(
        {"posts": posts, "fetched_at": now.isoformat()}
    ).execute()


def refresh() -> int:
    """Scrape, rank and store one batch. Returns the number of posts stored.

    Fully blocking (Apify HTTP plus two Supabase calls). Callers run it off the
    event loop, the way main.py already does for /scan.
    """
    api_key = os.getenv("APIFY_API_KEY")
    if not api_key:
        raise RuntimeError("APIFY_API_KEY not configured.")

    now = datetime.now(timezone.utc)
    posts = normalize(fetch_hashtag_posts(api_key), now)
    # An empty scrape is a failed scrape. Storing it would blank the panel for
    # everyone and reset the 6h window, so leave the previous batch in place.
    if not posts:
        return 0

    write_batch(posts, now)
    return len(posts)
