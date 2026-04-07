# CMET WorldView — Canberra Light Rail Tactical Operations Dashboard

## What This Is

A WorldView-inspired real-time tactical operations dashboard for Canberra's light rail (CMET) network. Military-grade satellite HUD aesthetic with live data feeds from ACT Government open data APIs. Built by Jovi (Jovilisi Draunimasi) from Mawson, ACT.

## Tech Stack

- **Backend**: FastAPI + Python 3.11+ (uvicorn, httpx, apscheduler, feedparser, beautifulsoup4, gtfs-realtime-bindings)
- **Frontend**: Next.js 14 + TypeScript + CesiumJS + Tailwind + Zustand
- **Database**: Supabase (AU region) for historical data + in-memory cache for live
- **Deployment**: Vercel (frontend) + Railway or Fly.io (backend)

## Architecture

```
Browser (Next.js + CesiumJS 3D globe)
    |
    | WebSocket + REST
    v
FastAPI Backend (Python)
    |-- /api/trams         -> GTFS-R protobuf decoder
    |-- /api/road-closures -> SODA API (data.act.gov.au)
    |-- /api/streetlights  -> SODA API + ArcGIS (actmapi)
    |-- /api/incidents     -> ESA GeoRSS parser
    |-- /api/cameras       -> Transport ACT feeds
    |-- /api/weather       -> OpenWeatherMap
    |-- /ws/live           -> WebSocket hub
    |
    v
Supabase (AU region) — tram_positions, road_events, esa_incidents, streetlight_faults
```

## Data Sources (All Free, No Auth Required Unless Noted)

| Feed | URL | Format | Poll Rate |
|------|-----|--------|-----------|
| Tram positions | `http://files.transport.act.gov.au/feeds/lightrail.pb` | Protobuf GTFS-R | 15s |
| Road closures | `https://www.data.act.gov.au/resource/2sn6-ma2c.json` | SODA JSON | 60s |
| Streetlights | `https://www.data.act.gov.au/resource/cfpr-4tpw.json` | SODA JSON | 1hr |
| Streetlight map | `https://data.actmapi.act.gov.au/arcgis/rest/services/actmapi/Publiclighting/MapServer` | ArcGIS | 1hr |
| ESA incidents | `https://esa.act.gov.au/feed` (GeoRSS) | XML | 60s |
| SL faults | `https://www.cityservices.act.gov.au/.../streetlighting` | HTML scrape | 30min |
| Construction | `https://www.act.gov.au/builtforcbr/travel-impacts` | HTML | 1hr |
| Weather | OpenWeatherMap API | JSON | 5min |
| GTFS static | `https://www.transport.act.gov.au/googletransit/google_transit_lr.zip` | GTFS ZIP | daily |

## Corridor Bounding Box

```python
CORRIDOR = {
    "min_lat": -35.285,  # Civic (south)
    "max_lat": -35.180,  # Gungahlin (north)
    "min_lng": 149.125,
    "max_lng": 149.148,
}
```

## Key Rules

- Plan before coding. Use plan mode first for any new feature.
- North is UP on the map. Gungahlin (lat -35.18) at top, Civic (lat -35.28) at bottom.
- All 15 stops use real WGS84 coordinates.
- Three interchange stops: Gungahlin Place, Dickson, Alinga St (City).
- The Y-axis must be inverted: `y = pad + (1 - progress) * height`
- Backend polls external APIs on schedule; frontend reads from backend only.
- WebSocket for real-time push (tram positions, ESA incidents).
- REST for slower-changing data (road closures, streetlights, weather).
- Supabase for persistence; in-memory dict for live cache.
- ESA incidents include fire, ambulance, SES. Police (AFP) has no public feed.
- Commit hourly. Manual /compact at 50% context.

## Commands

```bash
# Backend
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

## Phases

- Phase 0: Project scaffold, CLAUDE.md, git init ← CURRENT
- Phase 1: FastAPI backend with GTFS-R decoder + SODA client + ESA parser
- Phase 2: Next.js frontend with tactical map (port the v4-fixed.jsx artifact)
- Phase 3: CesiumJS 3D globe upgrade with satellite tiles
- Phase 4: Supabase persistence + WebSocket live push
- Phase 5: Docker Compose + deployment
