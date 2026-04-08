"""Configuration loaded from environment variables."""
import os
from dotenv import load_dotenv

load_dotenv()

OPENWEATHER_KEY = os.getenv("OPENWEATHER_KEY", "")

CMET_GTFSR_URL = os.getenv(
    "CMET_GTFSR_URL",
    "https://files.transport.act.gov.au/feeds/lightrail.pb",
)
ACT_SODA_BASE = os.getenv(
    "ACT_SODA_BASE",
    "https://www.data.act.gov.au/resource",
)
ESA_FEED_URL = os.getenv(
    "ESA_FEED_URL",
    "https://esa.act.gov.au/feed",
)

# Light rail corridor bounding box
CORRIDOR = {
    "min_lat": -35.285,
    "max_lat": -35.180,
    "min_lng": 149.125,
    "max_lng": 149.148,
}
