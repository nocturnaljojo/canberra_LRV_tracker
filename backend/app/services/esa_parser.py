"""Parse ACT ESA GeoRSS feed for active emergency incidents."""
import httpx
import feedparser
from app.config import ESA_FEED_URL, CORRIDOR

SERVICE_KEYWORDS = {
    "FIRE": ["fire", "structure fire", "vehicle fire", "grass fire", "bushfire"],
    "AMBO": ["ambulance", "medical", "cardiac", "trauma", "patient"],
    "SES": ["ses", "storm", "flood", "tree down", "tree fallen"],
    "HAZMAT": ["hazmat", "chemical", "gas leak", "spill"],
    "POLICE": ["police", "afp", "pursuit"],
}

def classify_incident(title: str) -> dict:
    """Classify ESA incident by service type."""
    lower = title.lower()
    for service, keywords in SERVICE_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return {"service": service}
    return {"service": "OTHER"}

def in_corridor(lat: float, lng: float) -> bool:
    """Check if coordinates fall within the LR corridor bounding box."""
    return (
        CORRIDOR["min_lat"] <= lat <= CORRIDOR["max_lat"]
        and CORRIDOR["min_lng"] <= lng <= CORRIDOR["max_lng"]
    )

async def fetch_esa_incidents(corridor_only: bool = False) -> list[dict]:
    """Fetch current ESA incidents from GeoRSS feed."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(ESA_FEED_URL)
            if resp.status_code != 200:
                return []
    except httpx.RequestError:
        return []

    feed = feedparser.parse(resp.text)
    incidents = []

    for entry in feed.entries:
        lat = getattr(entry, "geo_lat", None)
        lng = getattr(entry, "geo_long", None)

        if lat and lng:
            lat, lng = float(lat), float(lng)
            if corridor_only and not in_corridor(lat, lng):
                continue

            classification = classify_incident(entry.get("title", ""))
            incidents.append({
                "id": entry.get("id", ""),
                "title": entry.get("title", ""),
                "summary": entry.get("summary", ""),
                "service": classification["service"],
                "latitude": lat,
                "longitude": lng,
                "published": entry.get("published", ""),
                "updated": entry.get("updated", ""),
                "link": entry.get("link", ""),
            })

    return incidents
