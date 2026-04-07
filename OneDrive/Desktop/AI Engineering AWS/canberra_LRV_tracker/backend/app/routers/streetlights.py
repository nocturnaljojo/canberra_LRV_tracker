"""Streetlight data API endpoint."""
from fastapi import APIRouter
from app.services.soda_client import get_streetlights_corridor

router = APIRouter()

@router.get("/streetlights")
async def get_streetlights():
    """Return streetlight assets within the LR corridor."""
    lights = await get_streetlights_corridor()
    return {"count": len(lights), "streetlights": lights}
