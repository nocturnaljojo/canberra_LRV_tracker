# Canberra LRV Tracker — CMET WorldView

A real-time tactical operations dashboard for Canberra's light rail network, inspired by [WorldView OSS](https://github.com/jedijamez567/worldview_oss).

Military-grade satellite HUD aesthetic with live data from ACT Government open data APIs — tram positions, ESA emergency incidents, road closures, streetlight faults, and camera feeds.

## Stack

- **Backend**: FastAPI + Python (protobuf decoder, SODA API client, GeoRSS parser)
- **Frontend**: Next.js 14 + CesiumJS + Tailwind CSS + Zustand
- **Database**: Supabase (AU region)
- **Data**: ACT Open Data, Transport ACT GTFS-R, ACT ESA, ACTmapi ArcGIS

## Quick Start

```bash
# Backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # add your keys
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
cp .env.example .env.local  # add Cesium token
npm run dev
```

## Data Sources

All feeds are public ACT Government open data — no authentication required for core feeds.

| Layer | Source | Update |
|-------|--------|--------|
| Tram positions | Transport ACT GTFS-R (protobuf) | 15s |
| ESA incidents | ACT ESA GeoRSS feed | 60s |
| Road closures | data.act.gov.au SODA API | 60s |
| Streetlight faults | TCCS City Services (scrape) | 30min |
| Cameras | Transport ACT | 30s |

## Features

- 4 view modes: Satellite, Night Vision, FLIR Thermal, CRT
- Spy telescope viewport with crosshairs, range rings, radar sweep
- 9 toggleable data layers
- Real-time operations log
- Interchange detail with bus route connections (R1-R10)
- Emergency services overlay (Fire, Ambulance, SES)

## License

MIT

## Author

Jovi (Jovilisi Draunimasi) — Mawson, ACT
