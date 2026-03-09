"""Single source of truth for paths, constants, and feature lists.

Every module in the project imports configuration from here.
No magic numbers or hardcoded paths should exist anywhere else.
"""

from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent
MODEL_PATH = PROJECT_ROOT / "models" / "catboost_lead_profitability.cbm"
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DATA_DIR = PROJECT_ROOT / "data" / "processed"

# ── Target ────────────────────────────────────────────────────────────────────
TARGET_COLUMN = "expected_profit_band"

# ── Feature schema — Model 8 (notebook 09) ───────────────────────────────────
# Model 8 applies: season + distance_band + weather_binary.
# These replace cyclical month encoding and the raw lead_capture_weather column.
CATEGORICAL_FEATURES: list[str] = [
    "property_type",
    "neighbourhood",
    "requested_timeline",
    "referral_source",
    "homeowner_status",
    "customer_age_bracket",
    "lead_weekday",
    "season",
    "distance_band",
    "weather_binary",
]

NUMERICAL_FEATURES: list[str] = [
    "estimated_job_size_sqft",
    "distance_to_queens_km",
    "has_pets",
]

# Ordered feature list the model was trained on (must match model input exactly).
# This is the column order after add_season → add_distance_band → add_weather_binary.
MODEL_FEATURES: list[str] = [
    "property_type",
    "neighbourhood",
    "estimated_job_size_sqft",
    "requested_timeline",
    "referral_source",
    "homeowner_status",
    "distance_to_queens_km",
    "customer_age_bracket",
    "has_pets",
    "lead_weekday",
    "season",
    "distance_band",
    "weather_binary",
]

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

SQFT_OUTLIER_FLOOR = 0
SQFT_OUTLIER_CEILING = 5000

# ── Feature engineering constants — Model 8 (notebook 09) ─────────────────────

# Season transform: replace lead_month with a categorical season.
MONTH_TO_SEASON: dict[int, str] = {
    12: "Winter", 1: "Winter", 2: "Winter",
     3: "Spring", 4: "Spring", 5: "Spring",
     6: "Summer", 7: "Summer", 8: "Summer",
     9: "Fall",  10: "Fall",  11: "Fall",
}

# Distance band transform: bin distance_to_queens_km into terciles.
# Computed on the full labeled dataset (576 rows) before train/test split.
DIST_BINS: list[float] = [0.1990, 2.7600, 4.4500, 9.0810]
DIST_LABELS: list[str] = ["Near", "Mid", "Far"]
DROP_RAW_DISTANCE: bool = False  # Model 8 keeps the raw distance column

# Weather binary transform: collapse lead_capture_weather to Good/Bad.
WEATHER_MAP: dict[str, str] = {
    "Sunny": "Good",
    "Cloudy": "Bad",
    "Rain": "Bad",
    "Snow": "Bad",
    "Windy": "Bad",
}

NEIGHBOURHOOD_MAP: dict[str, str] = {
    "Down Town": "Downtown",
    "Westend": "West End",
    "Sydenhamm Ward": "Sydenham Ward",
    "Portsmoth Village": "Portsmouth Village",
    "Strathcona Prk": "Strathcona Park",
}

# ── Scoring ───────────────────────────────────────────────────────────────────
PROFIT_BANDS: dict[str, str] = {
    "High": "High",
    "Medium": "Medium",
    "Low": "Low",
}

CLASS_LABELS: list[str] = ["High", "Low", "Medium"]

PRIORITY_SCORE_RANGE: tuple[int, int] = (0, 100)

RANDOM_STATE = 42
