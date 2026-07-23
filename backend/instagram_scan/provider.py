"""Scrape provider toggle: ScrapeCreators by default, Apify as the fallback.

SCRAPER_PROVIDER=apify flips the whole service (profile scans, peer
verification, trending) back to the Apify actor without a code change; any
other value, including unset, selects ScrapeCreators. main.py and trending.py
route through this module so neither cares which provider is live. Signatures
mirror scraper.py: api key first, then the arguments.
"""

import os

import scrapecreators
import scraper


def provider_name() -> str:
    raw = (os.getenv("SCRAPER_PROVIDER") or "").strip().lower()
    return "apify" if raw == "apify" else "scrapecreators"


def _is_apify() -> bool:
    return provider_name() == "apify"


def load_api_key() -> str | None:
    if _is_apify():
        return scraper.load_apify_api_key()
    return scrapecreators.load_api_key()


def fetch_profile(api_key: str, handle: str) -> list[dict] | None:
    if _is_apify():
        return scraper.fetch_profile(api_key, handle)
    return scrapecreators.fetch_profile(api_key, handle)


def fetch_profiles(api_key: str, handles: list[str]) -> list[dict] | None:
    if _is_apify():
        return scraper.fetch_profiles(api_key, handles)
    return scrapecreators.fetch_profiles(api_key, handles)


def fetch_posts(api_key: str, handle: str, limit: int = 20) -> list[dict] | None:
    if _is_apify():
        return scraper.fetch_posts(api_key, handle, limit)
    return scrapecreators.fetch_posts(api_key, handle, limit)
