"""News aggregator — ACT Govt + ESA RSS feeds."""
import httpx
import feedparser
from fastapi import APIRouter

router = APIRouter()

def _cache():
    from app.scheduler import cache
    return cache

FEEDS = [
    {
        "url":   "https://www.cmtedd.act.gov.au/open_government/inform/act_government_media_releases/rss",
        "label": "ACT GOVT",
    },
    {
        "url":   "https://esa.act.gov.au/feed",
        "label": "ESA",
    },
]


@router.get("/news")
async def get_news():
    """Aggregate latest headlines from ACT Government and ESA RSS feeds."""
    cached = _cache().get("news")
    if cached:
        return {"count": len(cached), "items": cached}

    items = []

    async with httpx.AsyncClient(timeout=10) as client:
        for feed_cfg in FEEDS:
            try:
                resp = await client.get(feed_cfg["url"])
                if resp.status_code != 200:
                    continue
                feed = feedparser.parse(resp.text)
                for entry in feed.entries[:6]:
                    title = entry.get("title", "").strip()
                    if not title:
                        continue
                    items.append({
                        "title":     title,
                        "link":      entry.get("link", ""),
                        "published": entry.get("published", ""),
                        "source":    feed_cfg["label"],
                    })
            except Exception:
                # Dead feed — skip silently, don't kill the endpoint
                continue

    return {"count": len(items), "items": items}
