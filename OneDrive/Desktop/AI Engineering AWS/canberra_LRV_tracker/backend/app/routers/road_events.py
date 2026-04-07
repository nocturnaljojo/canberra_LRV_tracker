"""Road closures and events API endpoint."""
from fastapi import APIRouter
from app.scheduler import cache
from app.services.soda_client import get_road_closures

router = APIRouter()

@router.get("/road-closures")
async def get_closures():
    """Return cached road closures."""
    closures = cache.get("road_closures", [])
    if not closures:
        closures = await get_road_closures()
        cache["road_closures"] = closures
    return {"count": len(closures), "closures": closures}
