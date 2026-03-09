"""Single source of truth for paths, business-logic constants, and maps.

Data-derived values (feature lists, bin edges, class labels) live in
``models/model_metadata.json`` and are loaded by ``ModelService`` at
startup.  Only business-logic constants and paths belong here.
"""

from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent
MODEL_PATH = PROJECT_ROOT / "models" / "catboost_lead_profitability.cbm"
MODEL_METADATA_PATH = PROJECT_ROOT / "models" / "model_metadata.json"
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DATA_DIR = PROJECT_ROOT / "data" / "processed"

# ── Target ────────────────────────────────────────────────────────────────────
TARGET_COLUMN = "expected_profit_band"

# ── Raw-data columns (before any engineering) ─────────────────────────────────
RAW_COLUMNS: list[str] = [
    "lead_id",
    "lead_date",
    "property_type",
    "neighbourhood",
    "estimated_job_size_sqft",
    "requested_timeline",
    "referral_source",
    "homeowner_status",
    "preferred_contact",
    "lead_capture_weather",
    "distance_to_queens_km",
    "customer_age_bracket",
    "has_pets",
    "lead_weekday",
    "expected_profit_band",
]

# ── Cleaning constants ────────────────────────────────────────────────────────
REFERRAL_SOURCE_MAP: dict[str, str] = {
    "FaceBook": "Facebook Ads",
    "Door 2 Door": "Door-to-Door",
    "LawnSign": "Lawn Signs",
    "Word-of-mouth": "Word of Mouth/Referral",
}

NEIGHBOURHOOD_MAP: dict[str, str] = {
    "Down Town": "Downtown",
    "Westend": "West End",
    "Sydenhamm Ward": "Sydenham Ward",
    "Portsmoth Village": "Portsmouth Village",
    "Strathcona Prk": "Strathcona Park",
}

SQFT_OUTLIER_FLOOR = 0
SQFT_OUTLIER_CEILING = 5000

# ── Feature engineering constants (business logic) ────────────────────────────

# Season transform: replace lead_month with a categorical season.
MONTH_TO_SEASON: dict[int, str] = {
    12: "Winter", 1: "Winter", 2: "Winter",
     3: "Spring", 4: "Spring", 5: "Spring",
     6: "Summer", 7: "Summer", 8: "Summer",
     9: "Fall",  10: "Fall",  11: "Fall",
}

# Weather binary transform: collapse lead_capture_weather to Good/Bad.
WEATHER_MAP: dict[str, str] = {
    "Sunny": "Good",
    "Cloudy": "Bad",
    "Rain": "Bad",
    "Snow": "Bad",
    "Windy": "Bad",
}

# ── Fallback values (used if model_metadata.json is missing) ──────────────────
# These match Model 8 from notebook 09 and are only used during transition.
FALLBACK_DIST_BINS: list[float] = [0.1990, 2.7600, 4.4500, 9.0810]
FALLBACK_DIST_LABELS: list[str] = ["Near", "Mid", "Far"]
FALLBACK_DROP_RAW_DISTANCE: bool = False
FALLBACK_MODEL_FEATURES: list[str] = [
    "property_type", "neighbourhood", "estimated_job_size_sqft",
    "requested_timeline", "referral_source", "homeowner_status",
    "distance_to_queens_km", "customer_age_bracket", "has_pets",
    "lead_weekday", "season", "distance_band", "weather_binary",
]
FALLBACK_CATEGORICAL_FEATURES: list[str] = [
    "property_type", "neighbourhood", "requested_timeline",
    "referral_source", "homeowner_status", "customer_age_bracket",
    "lead_weekday", "season", "distance_band", "weather_binary",
]
FALLBACK_CLASS_LABELS: list[str] = ["High", "Low", "Medium"]

# ── Scoring ───────────────────────────────────────────────────────────────────
PROFIT_BANDS: dict[str, str] = {
    "High": "High",
    "Medium": "Medium",
    "Low": "Low",
}

PRIORITY_WEIGHTS: dict[str, int] = {"High": 3, "Medium": 2, "Low": 1}

PRIORITY_SCORE_RANGE: tuple[int, int] = (0, 100)

RANDOM_STATE = 42
