"""Deterministic analysis of scraped Instagram posts (P1 — no Claude yet).

Given the raw post list from apify/instagram-scraper, compute:
  - post-type breakdown: % of posts that are image / carousel / reel
  - engagement-by-type: average (likes + comments) per post type

The AI Content DNA step (vibe / themes / score over captions) is a later
milestone (F3). `ai_content_dna` is a clearly-marked stub returning None so
the wiring exists but no Anthropic call is made yet.
"""

from typing import Any

# apify/instagram-scraper post "type" values → our normalized buckets.
#   "Image"   -> image
#   "Sidecar" -> carousel (multi-image/video album)
#   "Video"   -> reel (short-form video)
POST_TYPES = ("image", "carousel", "reel")


def _classify(post: dict[str, Any]) -> str | None:
    """Map one raw post to 'image' | 'carousel' | 'reel', or None if unknown."""
    raw = (post.get("type") or "").strip().lower()
    if raw == "image":
        return "image"
    if raw == "sidecar":
        return "carousel"
    if raw == "video":
        return "reel"
    # Fallbacks for shape drift: a productType of "clips" is a reel.
    if (post.get("productType") or "").strip().lower() == "clips":
        return "reel"
    return None


def _engagement(post: dict[str, Any]) -> int:
    likes = post.get("likesCount") or 0
    comments = post.get("commentsCount") or 0
    # Apify sometimes returns -1 for hidden like counts; treat as 0.
    likes = likes if isinstance(likes, int) and likes > 0 else 0
    comments = comments if isinstance(comments, int) and comments > 0 else 0
    return likes + comments


def post_type_breakdown(posts: list[dict[str, Any]]) -> dict[str, Any]:
    """Return counts + percentages of posts per type.

    Shape:
        {
          "counts":   {"image": n, "carousel": n, "reel": n},
          "percentages": {"image": pct, "carousel": pct, "reel": pct},
          "total": total_classified,
        }
    Percentages are rounded to 1 decimal and sum to ~100 over classified posts.
    """
    counts = {t: 0 for t in POST_TYPES}
    for post in posts or []:
        kind = _classify(post)
        if kind is not None:
            counts[kind] += 1

    total = sum(counts.values())
    if total == 0:
        percentages = {t: 0.0 for t in POST_TYPES}
    else:
        percentages = {t: round(counts[t] / total * 100, 1) for t in POST_TYPES}

    return {"counts": counts, "percentages": percentages, "total": total}


def engagement_by_type(posts: list[dict[str, Any]]) -> dict[str, Any]:
    """Return average engagement (likes + comments) per post type.

    Shape:
        {
          "avgEngagement": {"image": avg, "carousel": avg, "reel": avg},
          "bestType": "reel" | ... | None,   # highest avg, None if no data
        }
    A type with no posts gets an average of 0.
    """
    totals = {t: 0 for t in POST_TYPES}
    counts = {t: 0 for t in POST_TYPES}
    for post in posts or []:
        kind = _classify(post)
        if kind is not None:
            totals[kind] += _engagement(post)
            counts[kind] += 1

    avg = {
        t: round(totals[t] / counts[t], 1) if counts[t] else 0.0
        for t in POST_TYPES
    }

    best = None
    if any(counts[t] for t in POST_TYPES):
        best = max(
            (t for t in POST_TYPES if counts[t]),
            key=lambda t: avg[t],
        )

    return {"avgEngagement": avg, "bestType": best}


def ai_content_dna(captions: list[str]) -> None:
    """TODO (F3): call Claude over post captions to derive Content DNA
    ({vibe, topThemes, profileScore, scoreLabel, scoreExplanation}).

    Deliberately returns None for P1 — no Anthropic call is made yet. F3 will
    fill this in and the /scan response's `dna` / `score` fields will start
    carrying real values.
    """
    return None
