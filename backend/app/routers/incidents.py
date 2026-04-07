"""ESA emergency incidents API endpoint."""
from fastapi import APIRouter, Query
from app.scheduler import cache
from app.services.esa_parser import fetch_esa_incidents

router = APIRouter()

@router.get("/incidents")
async def get_incidents(corridor_only: bool = Query(False)):
    """Return ESA incidents. Optionally filter to corridor bounding box."""
    incidents = cache.get("incidents", [])
    if not incidents:
        incidents = await fetch_esa_incidents(corridor_only=corridor_only)
        cache["incidents"] = incidents
    return {"count": len(incidents), "incidents": incidents}
