# Instagram Scan Service

Backend proxy for the onboarding funnel's real Instagram scan. Holds the
scraper keys server-side, exposes Bearer-gated endpoints, and returns real
profile stats + deterministic post-type / engagement analysis.

## Scrape provider toggle

Scraping routes through `provider.py`. `SCRAPER_PROVIDER=apify` selects the
original `apify/instagram-scraper` actor; anything else (including unset)
selects ScrapeCreators (`scrapecreators.py`, flat 1 credit per HTTP request).
Trending also switches source: ScrapeCreators uses the dedicated trending-reels
endpoint (1 credit per refresh), Apify scrapes 10 hashtag explore pages.
Every ScrapeCreators call logs latency and `credits_remaining`, and each scan
prints a `[scan] provider=... credits_used=... total_elapsed=...` summary line,
so the two providers can be compared on speed, reliability and spend.

Peer suggestions on ScrapeCreators are search-first: 1-2 profile-search
requests (`/v1/instagram/search/profiles`, keyword = the classified subtopic)
find real accounts with follower counts inline, and one Claude call writes the
card blurbs. The older model-suggestion + verification path remains as the
fallback and as the Apify path.

**P1 scope:** Apify fetch + deterministic analysis only. No Claude/Anthropic
call yet: `dna` and `score` are always `null` (F3 fills them in via the
`ai_content_dna` stub in `analyze.py`).

## Endpoint

```
POST /scan
Authorization: Bearer <SCAN_TOKEN>
Content-Type: application/json

{"username": "nasa"}
```

Response `200`:

```json
{
  "stats": {"followers": 0, "following": 0, "posts": 0, "fullName": "...", "avatarUrl": "..."},
  "postTypeBreakdown": {
    "counts": {"image": 0, "carousel": 0, "reel": 0},
    "percentages": {"image": 0.0, "carousel": 0.0, "reel": 0.0},
    "total": 0
  },
  "engagementInsight": {
    "avgEngagement": {"image": 0.0, "carousel": 0.0, "reel": 0.0},
    "bestType": "reel"
  },
  "dna": null,
  "score": null
}
```

Typed errors (never a stack trace): `{"error": "<code>", "detail": "..."}`
- `400 bad_handle`: empty / too long / illegal characters.
- `401 unauthorized`: missing or wrong Bearer token.
- `404 not_found` / `404 private`: profile missing or private.
- `502 apify_error`: upstream scrape failure on whichever provider is active
  (the code name is kept for client compatibility).

## Setup & run

```bash
cd backend/instagram_scan
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # then fill SCRAPECREATORS_API_KEY (or APIFY_API_KEY) + SCAN_TOKEN
./run.sh               # serves 127.0.0.1:8010 only
```

The Apify actor run takes ~30–90s per scan; allow ~150s client timeout.
ScrapeCreators requests usually answer in seconds each; the summary log line
per scan is the authoritative comparison.

## Security

- Bound to `127.0.0.1:8010` **only**. This host has a public IP; never
  `0.0.0.0`. Reach it externally solely through cloudflared (below).
- Bearer token compared with `hmac.compare_digest` (constant-time).
- A leaked token only burns Apify credits: no code/shell/tool access.
- Keys (`APIFY_API_KEY`, `ANTHROPIC_API_KEY`) live in `.env` (gitignored).

## Exposing via cloudflared (F2, later)

The scan service is reached from the phone through the existing dashboard
tunnel on `dev.sean.build`. **Do not restart cloudflared now** (it serves the
other build's QR). When F2 wires the app to the live backend, add this ingress
rule to `~/.cloudflared/config.yml`, **above** the dashboard catch-all rule:

```yaml
  # Scan backend: must come BEFORE the dashboard catch-all.
  - hostname: dev.sean.build
    path: ^/scan(/.*)?$
    service: http://localhost:8010
  # ... existing dashboard catch-all stays last ...
```

Then reload cloudflared. The app posts to `https://dev.sean.build/scan` with
the `EXPO_PUBLIC_SCAN_TOKEN` Bearer header.
