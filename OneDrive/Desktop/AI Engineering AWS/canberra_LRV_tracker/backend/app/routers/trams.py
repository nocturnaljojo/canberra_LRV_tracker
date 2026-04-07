"""Tram positions API endpoint."""
from fastapi import APIRouter
from app.scheduler import cache
from app.services.gtfsr_decoder import fetch_tram_positions

router = APIRouter()

@router.get("/trams")
async def get_trams():
    """Return cached tram positions, or fetch fresh if cache empty."""
    positions = cache.get("trams", [])
    if not positions:
        positions = await fetch_tram_positions()
        cache["trams"] = positions
    return {"count": len(positions), "trams": positions}
