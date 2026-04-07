# CMET WorldView — Full Stack Project Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    YOUR BROWSER                          │
│  Next.js 14 + CesiumJS/MapLibre + React + Tailwind      │
│  (or the .jsx artifact evolved into a full app)          │
└──────────────────────┬──────────────────────────────────┘
                       │ WebSocket + REST
┌──────────────────────▼──────────────────────────────────┐
│              FastAPI BACKEND (Python)                     │
│                                                          │
│  /api/trams          → GTFS-R protobuf decoder           │
│  /api/road-closures  → SODA API poller                   │
│  /api/streetlights   → SODA API + ArcGIS query           │
│  /api/incidents      → ESA GeoRSS parser                 │
│  /api/congestion     → Waze/TomTom proxy                 │
│  /api/cameras        → Transport ACT GTFS-R cameras      │
│  /api/weather        → BoM / OpenWeatherMap              │
│  /ws/live            → WebSocket hub (pushes all feeds)   │
│                                                          │
│  Background tasks:   APScheduler polling every 15-60s     │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              SUPABASE (AU Region)                         │
│                                                          │
│  Tables:                                                 │
│  - tram_positions     (latest + historical)              │
│  - road_events        (closures, construction, events)   │
│  - streetlight_faults (active faults along corridor)     │
│  - esa_incidents      (fire/ambo/police near corridor)   │
│  - camera_status      (feed health tracking)             │
│  - congestion_segments(corridor traffic flow)            │
│  - ops_log            (system alerts + audit trail)      │
└─────────────────────────────────────────────────────────┘
```

---

## Step-by-Step VS Code Setup

### 1. Create the Project

```bash
mkdir cmet-worldview && cd cmet-worldview

# Backend
mkdir -p backend/app/{routers,services,models}
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install fastapi uvicorn httpx apscheduler supabase \
    gtfs-realtime-bindings feedparser python-dotenv \
    websockets beautifulsoup4 lxml

# Frontend (separate terminal)
cd ../
npx create-next-app@14 frontend --typescript --tailwind --app
cd frontend
npm install cesium resium zustand
```

### 2. Project Structure

```
cmet-worldview/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + WebSocket hub
│   │   ├── config.py            # Environment vars
│   │   ├── scheduler.py         # APScheduler background jobs
│   │   ├── routers/
│   │   │   ├── trams.py         # GET /api/trams
│   │   │   ├── road_events.py   # GET /api/road-closures
│   │   │   ├── streetlights.py  # GET /api/streetlights/faults
│   │   │   ├── incidents.py     # GET /api/incidents (ESA)
│   │   │   ├── cameras.py       # GET /api/cameras
│   │   │   └── weather.py       # GET /api/weather
│   │   ├── services/
│   │   │   ├── gtfsr_decoder.py # Protobuf decode for CMET
│   │   │   ├── soda_client.py   # ACT Open Data SODA queries
│   │   │   ├── esa_parser.py    # GeoRSS feed parser
│   │   │   ├── arcgis_client.py # ACTmapi ArcGIS queries
│   │   │   └── websocket_hub.py # Push updates to frontend
│   │   └── models/
│   │       └── schemas.py       # Pydantic models
│   ├── .env                     # API keys
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Main dashboard
│   │   └── api/                 # Next.js API proxy routes
│   ├── components/
│   │   ├── Globe.tsx            # CesiumJS or MapLibre globe
│   │   ├── layers/              # Each data layer
│   │   └── hud/                 # HUD overlay components
│   ├── stores/
│   │   └── worldview-store.ts   # Zustand state
│   ├── .env.local
│   └── package.json
├── docker-compose.yml
├── CLAUDE.md
└── README.md
```

### 3. VS Code Extensions to Install

- Python (ms-python.python)
- Pylance
- REST Client (humao.rest-client)
- Thunder Client (API testing)
- ESLint + Prettier
- Docker (optional)

### 4. Run in VS Code

Open two integrated terminals:

**Terminal 1 — Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# Opens at localhost:3000
```

---

## Data Sources — Complete Reference

### LIVE FEEDS (poll every 15-60 seconds)

| Feed | URL / Endpoint | Format | Auth | Poll Rate |
|------|---------------|--------|------|-----------|
| **Tram Positions** | `http://files.transport.act.gov.au/feeds/lightrail.pb` | Protobuf (GTFS-R) | None | 15s |
| **Bus Positions** | `https://nxtbus.act.gov.au/nxtbus/rest/publicapi/v1/vehiclePositions` | SIRI XML | None | 30s |
| **ESA Incidents** | `https://esa.act.gov.au/` (GeoRSS feed, dataset `59jb-5aq2`) | GeoRSS XML | None | 60s |
| **Road Closures** | `https://www.data.act.gov.au/resource/2sn6-ma2c.json` | SODA JSON | None (app token optional) | 60s |
| **Weather** | `https://api.openweathermap.org/data/2.5/weather?lat=-35.28&lon=149.13` | JSON | Free API key | 300s |

### STATIC / SLOW-CHANGING (poll every 1-24 hours)

| Feed | URL / Endpoint | Format | Auth |
|------|---------------|--------|------|
| **Streetlight Locations** | `https://www.data.act.gov.au/resource/cfpr-4tpw.json` | SODA JSON | None |
| **Streetlight Columns** | `https://www.data.act.gov.au/resource/edxa-hxhs.json` | SODA JSON | None |
| **Streetlight ArcGIS** | `https://data.actmapi.act.gov.au/arcgis/rest/services/actmapi/Publiclighting/MapServer` | ArcGIS REST | None |
| **GTFS Static Schedule** | `https://www.transport.act.gov.au/googletransit/google_transit_lr.zip` | GTFS ZIP | None |
| **Streetlight Faults** | `https://www.cityservices.act.gov.au/roads-and-paths/road-infrastructure-and-maintenance/streetlighting` | HTML (scrape) | None |
| **Construction Closures** | `https://www.act.gov.au/builtforcbr/travel-impacts` | HTML (scrape) | None |
| **Emergency Facilities** | Geoscience Australia EMSINA dataset | GeoJSON | None |

### EMERGENCY SERVICES — What's Actually Available

**YES — you CAN see incidents:**
- The **ACT ESA GeoRSS feed** shows current active incidents (fire, SES, structure fire, vehicle fire, hazmat, rescue)
- Ambulance incidents are included but hidden by default on the public map — the feed itself contains them
- Each incident has: type, location (lat/lng), suburb, status, description, timestamp
- The ESA Live Incidents Map at `esa.act.gov.au/?fullmap=true` is the public-facing version

**PARTIALLY — vehicle locations:**
- Historical ESA vehicle locations (2004-2016) are on data.act.gov.au
- Real-time vehicle GPS positions are NOT publicly available (internal CAD system)
- You can infer response by tracking when incidents appear and clear

**NO — police incidents:**
- ACT Policing (AFP) does NOT publish a real-time incident feed
- You'd need to scrape AFP media releases or use ACLED/GDELT for significant events
- The AFP publishes annual crime statistics but not live locations

**WORKAROUND for emergency vehicle tracking:**
- ADS-B data captures helicopter movements (Southcare helicopter, police helicopter)
- You can filter OpenSky/adsb.fi for aircraft around Canberra with specific ICAO codes
- Emergency vehicle sirens sometimes trigger Waze incident reports

---

## FastAPI Backend — Core Code

### backend/app/main.py

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.scheduler import start_scheduler, stop_scheduler
from app.routers import trams, road_events, streetlights, incidents, cameras

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()

app = FastAPI(title="CMET WorldView API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(trams.router, prefix="/api")
app.include_router(road_events.router, prefix="/api")
app.include_router(streetlights.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(cameras.router, prefix="/api")

# WebSocket hub for real-time push
clients: list[WebSocket] = []

@app.websocket("/ws/live")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.append(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive
    except WebSocketDisconnect:
        clients.remove(ws)

@app.get("/health")
async def health():
    return {"status": "operational", "feeds": 7, "version": "2.0"}
```

### backend/app/services/gtfsr_decoder.py

```python
"""Decode CMET GTFS-R protobuf feed into JSON."""
import httpx
from google.transit import gtfs_realtime_pb2

CMET_FEED_URL = "http://files.transport.act.gov.au/feeds/lightrail.pb"

async def fetch_tram_positions() -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(CMET_FEED_URL)
        if resp.status_code != 200:
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
                "current_status": v.current_status,  # 0=INCOMING, 1=STOPPED_AT, 2=IN_TRANSIT
                "timestamp": v.timestamp,
                "congestion_level": v.congestion_level,
            })
    return trams
```

### backend/app/services/soda_client.py

```python
"""Query ACT Open Data SODA API."""
import httpx

BASE = "https://www.data.act.gov.au/resource"

async def get_road_closures() -> list[dict]:
    """Fetch unplanned road closures — dataset 2sn6-ma2c."""
    url = f"{BASE}/2sn6-ma2c.json"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params={"$limit": 50})
        return resp.json() if resp.status_code == 200 else []

async def get_streetlights_near_corridor(
    min_lat: float = -35.285,
    max_lat: float = -35.180,
    min_lng: float = 149.125,
    max_lng: float = 149.145,
) -> list[dict]:
    """Fetch streetlight assets within the LR corridor bounding box."""
    url = f"{BASE}/cfpr-4tpw.json"
    # SODA supports within_box for geospatial queries
    where = (
        f"latitude > {min_lat} AND latitude < {max_lat} "
        f"AND longitude > {min_lng} AND longitude < {max_lng}"
    )
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, params={
            "$where": where,
            "$limit": 500,
        })
        return resp.json() if resp.status_code == 200 else []
```

### backend/app/services/esa_parser.py

```python
"""Parse ACT ESA GeoRSS feed for active incidents."""
import httpx
import feedparser
from typing import Optional

ESA_FEED_URL = "https://esa.act.gov.au/feed"  # GeoRSS feed
# Alternative: scrape the live map page which loads incidents via AJAX

# Corridor bounding box
CORRIDOR_BOUNDS = {
    "min_lat": -35.285, "max_lat": -35.180,
    "min_lng": 149.125, "max_lng": 149.148,
}

async def fetch_esa_incidents() -> list[dict]:
    """Fetch current ESA incidents and filter to corridor."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(ESA_FEED_URL)

    if resp.status_code != 200:
        return []

    feed = feedparser.parse(resp.text)
    incidents = []

    for entry in feed.entries:
        # GeoRSS includes georss:point with lat lng
        lat = getattr(entry, "geo_lat", None)
        lng = getattr(entry, "geo_long", None)

        if lat and lng:
            lat, lng = float(lat), float(lng)
            # Filter to corridor
            if (CORRIDOR_BOUNDS["min_lat"] <= lat <= CORRIDOR_BOUNDS["max_lat"]
                and CORRIDOR_BOUNDS["min_lng"] <= lng <= CORRIDOR_BOUNDS["max_lng"]):
                incidents.append({
                    "id": entry.get("id", ""),
                    "title": entry.get("title", ""),
                    "summary": entry.get("summary", ""),
                    "category": entry.get("category", "UNKNOWN"),
                    "latitude": lat,
                    "longitude": lng,
                    "published": entry.get("published", ""),
                    "updated": entry.get("updated", ""),
                    "link": entry.get("link", ""),
                })

    return incidents

def classify_incident(title: str) -> dict:
    """Classify ESA incident type for icon/color."""
    title_lower = title.lower()
    if any(w in title_lower for w in ["fire", "structure fire", "vehicle fire", "grass fire"]):
        return {"service": "FIRE", "icon": "🔥", "color": "#ff3333"}
    elif any(w in title_lower for w in ["ambulance", "medical", "cardiac", "trauma"]):
        return {"service": "AMBULANCE", "icon": "🚑", "color": "#00aaff"}
    elif any(w in title_lower for w in ["police", "afp", "incident"]):
        return {"service": "POLICE", "icon": "🚔", "color": "#4444ff"}
    elif any(w in title_lower for w in ["ses", "storm", "flood", "tree"]):
        return {"service": "SES", "icon": "🌊", "color": "#ff8800"}
    elif any(w in title_lower for w in ["hazmat", "chemical", "gas leak"]):
        return {"service": "HAZMAT", "icon": "☢️", "color": "#ffff00"}
    else:
        return {"service": "OTHER", "icon": "⚠️", "color": "#888888"}
```

### backend/app/services/streetlight_scraper.py

```python
"""Scrape active streetlight faults from City Services."""
import httpx
from bs4 import BeautifulSoup

FAULTS_URL = "https://www.cityservices.act.gov.au/roads-and-paths/road-infrastructure-and-maintenance/streetlighting"

# Suburbs along the light rail corridor
CORRIDOR_SUBURBS = {
    "gungahlin", "franklin", "harrison", "mitchell",
    "lyneham", "watson", "downer", "dickson",
    "braddon", "ainslie", "civic", "turner", "reid",
}

async def scrape_streetlight_faults() -> list[dict]:
    """Scrape the TCCS streetlighting page for current faults."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(FAULTS_URL)

    if resp.status_code != 200:
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    faults = []

    # Parse the fault listings (they follow a pattern of:
    # "Suburb: Location — Status")
    text_blocks = soup.get_text()
    lines = [l.strip() for l in text_blocks.split("\n") if "—" in l and ":" in l]

    for line in lines:
        try:
            parts = line.split(":")
            suburb = parts[0].strip().lower()
            detail = ":".join(parts[1:]).strip()
            location, status = detail.rsplit("—", 1)

            # Filter to corridor suburbs
            if suburb in CORRIDOR_SUBURBS:
                faults.append({
                    "suburb": suburb.title(),
                    "location": location.strip(),
                    "status": status.strip(),
                    "on_corridor": True,
                })
        except (ValueError, IndexError):
            continue

    return faults
```

### backend/app/routers/trams.py

```python
from fastapi import APIRouter
from app.services.gtfsr_decoder import fetch_tram_positions

router = APIRouter(tags=["trams"])

@router.get("/trams")
async def get_trams():
    positions = await fetch_tram_positions()
    return {"timestamp": "now", "count": len(positions), "trams": positions}
```

### backend/app/routers/incidents.py

```python
from fastapi import APIRouter
from app.services.esa_parser import fetch_esa_incidents, classify_incident

router = APIRouter(tags=["incidents"])

@router.get("/incidents")
async def get_incidents():
    incidents = await fetch_esa_incidents()
    for inc in incidents:
        classification = classify_incident(inc["title"])
        inc.update(classification)
    return {"count": len(incidents), "incidents": incidents}
```

### backend/app/scheduler.py

```python
"""Background polling for all data feeds."""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.gtfsr_decoder import fetch_tram_positions
from app.services.soda_client import get_road_closures
from app.services.esa_parser import fetch_esa_incidents

scheduler = AsyncIOScheduler()

# In-memory cache (replace with Supabase writes for persistence)
cache = {
    "trams": [],
    "road_closures": [],
    "incidents": [],
}

async def poll_trams():
    cache["trams"] = await fetch_tram_positions()
    # TODO: push via WebSocket to connected clients

async def poll_road_closures():
    cache["road_closures"] = await get_road_closures()

async def poll_incidents():
    cache["incidents"] = await fetch_esa_incidents()

def start_scheduler():
    scheduler.add_job(poll_trams, "interval", seconds=15, id="trams")
    scheduler.add_job(poll_road_closures, "interval", seconds=60, id="closures")
    scheduler.add_job(poll_incidents, "interval", seconds=60, id="incidents")
    scheduler.start()

def stop_scheduler():
    scheduler.shutdown()
```

### backend/.env

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Optional API keys
OPENWEATHER_KEY=your-key
CESIUM_TOKEN=your-token

# CMET feeds
CMET_GTFSR_URL=http://files.transport.act.gov.au/feeds/lightrail.pb
ACT_SODA_DOMAIN=www.data.act.gov.au
ESA_FEED_URL=https://esa.act.gov.au/feed
```

---

## Supabase Schema

```sql
-- Tram position snapshots
CREATE TABLE tram_positions (
    id SERIAL PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    bearing DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    stop_id TEXT,
    status TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Road events (closures, construction, incidents)
CREATE TABLE road_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,  -- CLOSURE, CONSTRUCTION, EVENT, INCIDENT, UTILITIES
    title TEXT,
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    severity TEXT,       -- MAJOR, MODERATE, LOW
    lanes TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    source TEXT,         -- SODA, BuiltForCBR, Waze
    active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ESA incidents (fire, ambulance, SES)
CREATE TABLE esa_incidents (
    id TEXT PRIMARY KEY,
    title TEXT,
    service TEXT,        -- FIRE, AMBULANCE, SES, POLICE, HAZMAT
    category TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    suburb TEXT,
    status TEXT,
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Streetlight faults
CREATE TABLE streetlight_faults (
    id SERIAL PRIMARY KEY,
    asset_id TEXT,
    suburb TEXT,
    location TEXT,
    status TEXT,         -- INVESTIGATING, REPAIR_SCHEDULED, REPAIR_IN_PROGRESS
    severity TEXT,       -- HIGH, MED, LOW
    on_corridor BOOLEAN DEFAULT FALSE,
    reported_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Camera status tracking
CREATE TABLE camera_status (
    id TEXT PRIMARY KEY,
    name TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    type TEXT,           -- platform, traffic, crossing
    status TEXT,         -- ONLINE, DEGRADED, OFFLINE
    feed_url TEXT,
    last_checked TIMESTAMPTZ DEFAULT NOW()
);

-- Operations log
CREATE TABLE ops_log (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    severity TEXT,       -- info, warn, error, ok
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE tram_positions ENABLE ROW LEVEL SECURITY;
-- Add policies as needed for your access pattern

-- Create index for time-based queries
CREATE INDEX idx_tram_pos_time ON tram_positions(recorded_at DESC);
CREATE INDEX idx_esa_incidents_time ON esa_incidents(published_at DESC);
```

---

## Where Does the Data Come From → Where Does It Go?

```
INTERNET (PUBLIC APIs)                    YOUR MACHINE
─────────────────────                    ──────────────

files.transport.act.gov.au ─── protobuf ──→ FastAPI ──→ decode ──→ Supabase tram_positions
                                                    └──→ WebSocket push to browser

data.act.gov.au/resource/2sn6-ma2c ─── JSON ──→ FastAPI ──→ Supabase road_events

data.act.gov.au/resource/cfpr-4tpw ─── JSON ──→ FastAPI ──→ filter corridor ──→ Supabase

esa.act.gov.au (GeoRSS) ─── XML ──→ FastAPI ──→ feedparser ──→ Supabase esa_incidents

cityservices.act.gov.au ─── HTML ──→ FastAPI ──→ BeautifulSoup ──→ Supabase faults

openweathermap.org ─── JSON ──→ FastAPI ──→ cache in memory

Waze CCP (if you register) ─── JSON ──→ FastAPI ──→ congestion overlay

                                           │
                                           ▼
                                     NEXT.JS FRONTEND
                                  (reads from FastAPI)
                                           │
                                           ▼
                                      YOUR BROWSER
                                   (CesiumJS 3D globe)
```

---

## Emergency Services Detail

### What You CAN Track

| Service | Data Source | Real-time? | Location? |
|---------|-----------|------------|-----------|
| **Fire & Rescue** | ESA GeoRSS + Live Map | Yes | Yes (lat/lng) |
| **SES** | ESA GeoRSS + Live Map | Yes | Yes (lat/lng) |
| **Ambulance** | ESA GeoRSS (hidden by default) | Yes | Yes (lat/lng) |
| **Police (AFP)** | Media releases only | No | Suburb only |
| **Rescue Helicopter** | ADS-B (OpenSky/adsb.fi) | Yes | Yes (ICAO filter) |

### How to Get ESA Incident Data

**Option 1: GeoRSS feed** (cleanest)
```
https://esa.act.gov.au/feed
```
Parse with `feedparser` — each entry has `georss:point` with coordinates.

**Option 2: Scrape the live map** 
The ESA live map at `esa.act.gov.au/?fullmap=true` loads incident data via an AJAX call. Inspect the network tab in DevTools to find the JSON endpoint — it typically returns all active incidents including ambulance.

**Option 3: data.gov.au dataset**
Dataset ID `59jb-5aq2` — "ACT ESA Current Incidents" as GeoRSS. This is the official open data listing of the same feed.

### Filtering to the Light Rail Corridor

All feeds return lat/lng. Filter with a bounding box or buffer around the route:
```python
CORRIDOR_BUFFER = {
    "min_lat": -35.285,
    "max_lat": -35.180,
    "min_lng": 149.125,
    "max_lng": 149.148,
}
```

For more precise filtering, calculate distance from each incident point to the nearest point on the route polyline (< 500m = "within corridor").

---

## Next Steps — Deployment Path

### Phase 1: Local Dev (This Week)
- Clone scaffold, get FastAPI running
- Wire up GTFS-R decoder (tram positions)
- Wire up SODA road closures
- Connect React frontend to backend
- Test with real data

### Phase 2: Real Feeds (Next Week)
- Add ESA incident parser
- Add streetlight fault scraper
- Add WebSocket push for live updates
- Store history in Supabase

### Phase 3: Enhanced Viz
- Upgrade from SVG to CesiumJS 3D globe
- Add Google Photorealistic 3D Tiles
- Implement view mode shaders (NV, FLIR, CRT)
- Add timeline scrubber for historical replay

### Phase 4: Production
- Docker Compose for full stack
- Deploy FastAPI to Railway/Fly.io
- Deploy frontend to Vercel
- Add Cloudflare Tunnel (you already know this from CareTrack)
- Add alerting via Telegram bot (reuse your n8n pipeline)
