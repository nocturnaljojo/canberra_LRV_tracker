"""Query ACT Open Data portal via SODA API."""
import httpx
from app.config import ACT_SODA_BASE, CORRIDOR

async def get_road_closures() -> list[dict]:
    """Fetch unplanned road closures - dataset 2sn6-ma2c."""
    url = f"{ACT_SODA_BASE}/2sn6-ma2c.json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params={"$limit": 50})
            return resp.json() if resp.status_code == 200 else []
    except httpx.RequestError:
        return []

async def get_streetlights_corridor() -> list[dict]:
    """Fetch streetlight assets within the LR corridor bounding box."""
    url = f"{ACT_SODA_BASE}/cfpr-4tpw.json"
    where = (
        f"latitude > {CORRIDOR['min_lat']} AND latitude < {CORRIDOR['max_lat']} "
        f"AND longitude > {CORRIDOR['min_lng']} AND longitude < {CORRIDOR['max_lng']}"
    )
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params={"$where": where, "$limit": 500})
            return resp.json() if resp.status_code == 200 else []
    except httpx.RequestError:
        return []
