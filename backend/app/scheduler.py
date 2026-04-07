"""APScheduler background jobs for polling external feeds."""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.gtfsr_decoder import fetch_tram_positions
from app.services.soda_client import get_road_closures
from app.services.esa_parser import fetch_esa_incidents

scheduler = AsyncIOScheduler()

# In-memory cache — replace with Supabase writes in Phase 4
cache: dict = {
    "trams":             [],
    "road_closures":     [],
    "incidents":         [],
    "streetlight_faults":[],
    "weather":           {},
    "news":              [],
}

async def poll_trams():
    cache["trams"] = await fetch_tram_positions()

async def poll_road_closures():
    cache["road_closures"] = await get_road_closures()

async def poll_incidents():
    cache["incidents"] = await fetch_esa_incidents(corridor_only=False)

async def poll_weather():
    from app.routers.weather import get_weather
    cache["weather"] = await get_weather()

async def poll_news():
    from app.routers.news import get_news
    result = await get_news()
    cache["news"] = result.get("items", [])

def start_scheduler():
    scheduler.add_job(poll_trams,         "interval", seconds=15,  id="trams",    misfire_grace_time=10)
    scheduler.add_job(poll_road_closures, "interval", seconds=60,  id="closures", misfire_grace_time=30)
    scheduler.add_job(poll_incidents,     "interval", seconds=60,  id="incidents",misfire_grace_time=30)
    scheduler.add_job(poll_weather,       "interval", seconds=300, id="weather",  misfire_grace_time=60)
    scheduler.add_job(poll_news,          "interval", seconds=120, id="news",     misfire_grace_time=60)
    scheduler.start()

def stop_scheduler():
    scheduler.shutdown(wait=False)
