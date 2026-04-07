"""Weather endpoint — OpenWeatherMap for Canberra corridor."""
import httpx
from fastapi import APIRouter
from app.config import OPENWEATHER_KEY

router = APIRouter()

# Lazy import to avoid circular dependency with scheduler
def _cache():
    from app.scheduler import cache
    return cache

CONDITION_MAP = {
    "Clear":       "CLEAR",
    "Clouds":      "CLOUDY",
    "Rain":        "RAIN",
    "Drizzle":     "RAIN",
    "Thunderstorm":"STORM",
    "Snow":        "SNOW",
    "Mist":        "FOG",
    "Fog":         "FOG",
    "Haze":        "FOG",
    "Smoke":       "FOG",
    "Dust":        "FOG",
    "Sand":        "FOG",
    "Ash":         "FOG",
    "Squall":      "STORM",
    "Tornado":     "STORM",
}

CONDITION_SYMBOL = {
    "CLEAR":  "CLEAR",
    "CLOUDY": "CLOUDY",
    "RAIN":   "RAIN",
    "STORM":  "STORM",
    "SNOW":   "SNOW",
    "FOG":    "FOG",
}

FALLBACK = {
    "temp": 12,
    "condition": "CLEAR",
    "description": "clear sky",
    "wind": 15,
    "humidity": 45,
    "source": "fallback",
}


@router.get("/weather")
async def get_weather():
    """Return current weather for Canberra corridor (-35.28, 149.13)."""
    cached = _cache().get("weather")
    if cached:
        return cached

    if not OPENWEATHER_KEY:
        return FALLBACK

    url = (
        "https://api.openweathermap.org/data/2.5/weather"
        "?lat=-35.28&lon=149.13&units=metric"
        f"&appid={OPENWEATHER_KEY}"
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
        if resp.status_code == 200:
            d = resp.json()
            raw_condition = d["weather"][0]["main"]
            condition = CONDITION_MAP.get(raw_condition, "CLEAR")
            return {
                "temp":        round(d["main"]["temp"]),
                "feels_like":  round(d["main"]["feels_like"]),
                "condition":   condition,
                "description": d["weather"][0]["description"],
                "wind":        round(d["wind"]["speed"] * 3.6),
                "humidity":    d["main"]["humidity"],
                "source":      "openweathermap",
            }
    except Exception:
        pass

    return FALLBACK
