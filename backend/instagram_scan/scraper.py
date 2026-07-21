"""Apify Instagram scraping: profile + posts only.

Copied and trimmed from the AI-Social-Content-Generator ingestion module:
we keep only the PROFILE half (profile details + recent posts) and drop the
viral-reels / Excel / media-download machinery. Uses the official
`apify/instagram-scraper` actor via apify-client.
"""

import os

from apify_client import ApifyClient
from dotenv import find_dotenv, load_dotenv


def load_apify_api_key() -> str | None:
    """Load APIFY_API_KEY from the environment (.env is loaded by the caller
    / run.sh, but we also best-effort find one here)."""
    load_dotenv(find_dotenv())
    return os.getenv("APIFY_API_KEY")


def fetch_profile(apify_api_key: str, handle: str) -> list[dict]:
    """Fetch profile details for a single handle.

    Runs apify/instagram-scraper with resultsType 'details'. Returns the raw
    dataset item list (usually a single profile dict) or None on actor
    failure.
    """
    client = ApifyClient(apify_api_key)
    actor_client = client.actor("apify/instagram-scraper")
    result = actor_client.call(
        run_input={
            "directUrls": [f"https://www.instagram.com/{handle}/"],
            "resultsType": "details",
            "resultsLimit": 1,
        }
    )

    if result is None:
        return None

    data = client.dataset(result["defaultDatasetId"])
    return data.list_items().items


def fetch_profiles(apify_api_key: str, handles: list[str]) -> list[dict] | None:
    """Fetch profile details for many handles in ONE actor run.

    Batching every handle into a single `directUrls` list is what holds peer
    verification to one Apify run per niche instead of one run per candidate.
    Returns the raw dataset item list (one profile dict per resolved handle,
    in no guaranteed order) or None on actor failure.
    """
    client = ApifyClient(apify_api_key)
    actor_client = client.actor("apify/instagram-scraper")
    result = actor_client.call(
        run_input={
            "directUrls": [f"https://www.instagram.com/{h}/" for h in handles],
            "resultsType": "details",
            "resultsLimit": 1,
        }
    )

    if result is None:
        return None

    data = client.dataset(result["defaultDatasetId"])
    return data.list_items().items


def fetch_posts(apify_api_key: str, handle: str, limit: int = 20) -> list[dict]:
    """Fetch the most recent posts for a single handle.

    Runs apify/instagram-scraper with resultsType 'posts'. Returns the raw
    dataset item list or None on actor failure.
    """
    client = ApifyClient(apify_api_key)
    actor_client = client.actor("apify/instagram-scraper")
    result = actor_client.call(
        run_input={
            "directUrls": [f"https://www.instagram.com/{handle}/"],
            "resultsType": "posts",
            "resultsLimit": limit,
        }
    )

    if result is None:
        return None

    data = client.dataset(result["defaultDatasetId"])
    return data.list_items().items
