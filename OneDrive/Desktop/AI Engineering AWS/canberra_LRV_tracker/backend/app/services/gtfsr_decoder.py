"""Decode CMET GTFS-R protobuf feed into dicts."""
import httpx
from google.transit import gtfs_realtime_pb2
from app.config import CMET_GTFSR_URL

STATUS_MAP = {0: "INCOMING", 1: "STOPPED_AT", 2: "IN_TRANSIT"}

async def fetch_tram_positions() -> list[dict]:
    """Fetch and decode live tram positions from Transport ACT."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(CMET_GTFSR_URL)
            if resp.status_code != 200:
                return []
    except httpx.RequestError:
        return []

    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(resp.content)

    trams = []
    for entity in feed.entity:
        if entity.HasField("vehicle"):
            v = entity.vehicle
            trams.append({
                "id": entity.id,
                "trip_id": v.trip.trip_id or None,
                "route_id": v.trip.route_id or None,
                "latitude": v.position.latitude,
                "longitude": v.position.longitude,
                "bearing": v.position.bearing,
                "speed": v.position.speed,
                "vehicle_label": v.vehicle.label,
                "license_plate": v.vehicle.license_plate,
                "stop_id": v.stop_id,
                "current_status": STATUS_MAP.get(v.current_status, "UNKNOWN"),
                "timestamp": v.timestamp,
                "congestion_level": v.congestion_level,
            })
    return trams
