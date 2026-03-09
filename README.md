# ASTRA TCA — Lead Scoring & Ranking Tool

A lead prioritization system for a painting company in Kingston, Ontario. Takes raw lead data, runs it through a trained CatBoost classifier, and returns profit-band predictions, priority scores, and SHAP-based explanations — all served via a FastAPI backend and a React dashboard built for non-technical sales staff.

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 20+
- npm

### 1. Clone and install Python dependencies

```bash
git clone <repo-url>
cd TCA
pip install -r requirements.txt
```

### 2. Start the API

```bash
uvicorn api.main:app --reload
```

The API runs at [http://localhost:8000](http://localhost:8000). Verify with:

```bash
curl http://localhost:8000/health
# → {"status": "ok"}
```

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Project Structure

```
TCA/
├── config.py                          # Paths, constants, business-logic maps
├── requirements.txt
│
├── models/
│   ├── catboost_lead_profitability.cbm  # Trained model artifact (frozen)
│   └── model_metadata.json              # Data-derived values (bins, features, labels)
│
├── scripts/
│   └── save_model_metadata.py         # Run after retraining to regenerate metadata
│
├── src/
│   ├── __init__.py
│   ├── preprocessing.py               # DataCleaner — clean raw data
│   ├── feature_engineering.py         # FeatureEngineer — season, distance_band, weather_binary
│   ├── model.py                       # ModelService — load, predict, explain (SHAP)
│   ├── scorer.py                      # LeadScorer — orchestrates the full pipeline
│   └── utils.py                       # numpy_to_native JSON helper
│
├── api/
│   ├── __init__.py
│   ├── main.py                        # FastAPI app factory, CORS, startup
│   ├── schemas.py                     # Pydantic request/response models
│   └── routes/
│       ├── __init__.py
│       ├── single.py                  # POST /score
│       └── batch.py                   # POST /score/batch
│
├── frontend/                          # React (Vite) + Tailwind CSS
│   └── src/
│       ├── App.jsx                    # Tab shell + health check
│       ├── index.css                  # Tailwind theme (brand, high/medium/low colours)
│       ├── services/api.js            # fetch wrappers
│       └── components/
│           ├── SingleLeadForm.jsx     # 12-field form → LeadCard result
│           ├── BatchUploader.jsx      # Drag-drop CSV → scored list
│           ├── LeadCard.jsx           # Score + band badge + SHAP reasons
│           ├── SummaryBar.jsx         # High / Medium / Low / Total counts
│           └── FilterPanel.jsx        # Client-side filter + sort + CSV export
│
└── data/
    ├── raw/leads.csv                  # Original dataset (never modified)
    └── processed/                     # Cleaned splits from notebook pipeline
```

---

## API Reference

| Endpoint        | Method | Description                  | Request Body                      | Response                          |
|-----------------|--------|------------------------------|-----------------------------------|-----------------------------------|
| `/health`       | GET    | Liveness probe               | —                                 | `{"status": "ok"}`                |
| `/score`        | POST   | Score a single lead          | JSON matching `LeadInput` schema  | `LeadScoreResponse`               |
| `/score/batch`  | POST   | Score a CSV of leads         | `multipart/form-data` with `.csv` | `BatchScoreResponse` with summary |

### POST /score — Example

**Request:**
```json
{
  "property_type": "Detached",
  "neighbourhood": "Downtown",
  "estimated_job_size_sqft": 1200,
  "requested_timeline": "1 month",
  "referral_source": "Google Ads",
  "homeowner_status": "Own",
  "lead_capture_weather": "Sunny",
  "distance_to_queens_km": 3.2,
  "customer_age_bracket": "35-44",
  "has_pets": false,
  "lead_weekday": "Tuesday",
  "lead_month": 6
}
```

**Response:**
```json
{
  "profit_band": "High",
  "priority_score": 87,
  "confidence": 0.9231,
  "top_reasons": [
    {"feature": "estimated_job_size_sqft", "impact": 0.34, "direction": "positive"},
    {"feature": "referral_source", "impact": 0.21, "direction": "positive"},
    {"feature": "neighbourhood", "impact": 0.15, "direction": "negative"}
  ],
  "input_summary": {"property_type": "Detached", "neighbourhood": "Downtown", "...": "..."}
}
```

### POST /score/batch — Example

```bash
curl -X POST http://localhost:8000/score/batch \
  -F "file=@data/raw/leads.csv"
```

Response includes a `summary` with `high`, `medium`, `low`, `total`, and `dropped_rows` counts.

---

## Pipeline Architecture

```
Raw lead data
   │
   ▼
DataCleaner (src/preprocessing.py)
   ├── remove_duplicates
   ├── parse_lead_date → extract lead_month
   ├── standardize referral_source, neighbourhood
   ├── handle missing values (per-neighbourhood median for distance)
   └── drop preferred_contact column, sqft outliers, missing age brackets
   │
   ▼
FeatureEngineer (src/feature_engineering.py)
   ├── add_season       — lead_month → Winter/Spring/Summer/Fall
   ├── add_distance_band — distance_to_queens_km → Near/Mid/Far (tercile bins)
   ├── add_weather_binary — lead_capture_weather → Good/Bad
   ├── ensure_cat_dtypes — cast categoricals to str for CatBoost
   └── select_features   — keep only model columns, in training order
   │
   ▼
ModelService (src/model.py)
   ├── predict      — profit band class label
   ├── predict_proba — probability matrix
   └── explain       — SHAP TreeExplainer → top-N feature impacts
   │
   ▼
LeadScorer (src/scorer.py)
   ├── score_single  — dict in → dict out (skips batch cleaner)
   └── score_batch   — DataFrame in → ranked DataFrame + dropped_rows count
```

### Priority Score Calculation

```
raw = P(High) × 3 + P(Medium) × 2 + P(Low) × 1
normalised = (raw − 1) / (3 − 1) × 100   →   0–100 scale
```

### Model Metadata

Data-derived values (feature lists, bin edges, class labels) are stored in `models/model_metadata.json`, not hardcoded in config. `ModelService` loads this file at startup and exposes the values as properties. If the file is missing, it falls back to `config.FALLBACK_*` values.

To regenerate after retraining:

```bash
python scripts/save_model_metadata.py
```

This script computes bin edges fresh from `data/processed/leads_cleaned.csv`.

---

## Configuration

All paths, business-logic constants, and mapping tables live in `config.py`. Data-derived values live in `model_metadata.json`.

| Constant              | Location                 | Purpose                                        |
|-----------------------|--------------------------|-------------------------------------------------|
| `MODEL_PATH`          | `config.py`              | Path to `.cbm` artifact                        |
| `MODEL_METADATA_PATH` | `config.py`              | Path to `model_metadata.json`                  |
| `MONTH_TO_SEASON`     | `config.py`              | Month → season mapping (business logic)        |
| `WEATHER_MAP`         | `config.py`              | Weather → Good/Bad mapping (business logic)    |
| `PRIORITY_WEIGHTS`    | `config.py`              | Per-band weights for priority score            |
| `NEIGHBOURHOOD_MAP`   | `config.py`              | Typo corrections for raw data                  |
| `model_features`      | `model_metadata.json`    | Ordered feature list the model expects         |
| `categorical_features`| `model_metadata.json`    | Which features are categorical                 |
| `dist_bins`           | `model_metadata.json`    | Tercile bin edges for distance banding         |
| `class_labels`        | `model_metadata.json`    | Model class order (e.g. High, Low, Medium)     |

To swap in a new model: replace the `.cbm` file, run `save_model_metadata.py`, and restart the API.

---

## Testing

```bash
pytest tests/ -v
```

Test files mirror `src/` modules:

| File                           | What it tests                                      |
|--------------------------------|----------------------------------------------------|
| `tests/test_preprocessing.py`  | Missing values, duplicates, schema validation      |
| `tests/test_feature_engineering.py` | Output schema matches model expectations      |
| `tests/test_model.py`          | Load, predict shape, explain output format         |
| `tests/test_scorer.py`         | `score_single` and `score_batch` end-to-end        |
| `tests/test_api.py`            | FastAPI TestClient against both endpoints           |

---

## Tech Stack

| Layer     | Technology                                    |
|-----------|-----------------------------------------------|
| Model     | CatBoost (frozen `.cbm` artifact)             |
| Explain   | SHAP (TreeExplainer)                          |
| API       | FastAPI + Uvicorn                             |
| Validation| Pydantic v2                                   |
| Frontend  | React (Vite) + Tailwind CSS v4               |
| Data      | pandas, numpy                                 |
| Testing   | pytest                                        |
