"""CMET WorldView — FastAPI backend."""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from app.scheduler import start_scheduler, stop_scheduler, cache
from app.routers import trams, road_events, streetlights, incidents, weather, news

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(
    title="CMET WorldView API",
    description="Tactical operations dashboard for Canberra Light Rail",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(trams.router,       prefix="/api", tags=["trams"])
app.include_router(road_events.router, prefix="/api", tags=["road-events"])
app.include_router(streetlights.router,prefix="/api", tags=["streetlights"])
app.include_router(incidents.router,   prefix="/api", tags=["incidents"])
app.include_router(weather.router,     prefix="/api", tags=["weather"])
app.include_router(news.router,        prefix="/api", tags=["news"])

# WebSocket hub for real-time push
clients: list[WebSocket] = []

@app.websocket("/ws/live")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        clients.remove(ws)

@app.get("/health")
async def health():
    trams_cache = cache.get("trams", [])
    latest_ts = max((t["timestamp"] for t in trams_cache if t.get("timestamp")), default=None)
    last_updated = (
        datetime.fromtimestamp(latest_ts, tz=timezone.utc).isoformat()
        if latest_ts else None
    )
    return {
        "status": "operational",
        "feeds": {
            "trams": len(trams_cache),
            "road_closures": len(cache.get("road_closures", [])),
            "incidents": len(cache.get("incidents", [])),
        },
        "last_updated": last_updated,
        "version": "0.1.0",
    }
