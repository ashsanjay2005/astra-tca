# ASTRA TCA — Lead Scoring & Ranking Tool

A lead prioritization system for a painting company in Kingston, Ontario. Takes raw lead data from Supabase or manual input, runs it through a trained CatBoost classifier with Python/FastAPI, and returns profit-band predictions, priority scores, and SHAP-based feature explanations. Served via a React dashboard built for non-technical sales staff with a natural language AI chat layer.

## Key Features

- **Batch Lead Scoring from Supabase**: Automatically fetch unscored leads from Supabase, clean data, predict profitability classification (High/Medium/Low), calculate priority scores (0-100), and extract feature importance via SHAP.
- **Single Lead Prediction**: A clean UI form to input customer details and immediately see profitability classification and actionable explanations.
- **Conversational RAG Chat (Gemini 2.5)**: Deep insights into scored lead batches allowing salespeople to ask natural language questions (e.g. "Which neighborhoods produce the best leads?" or "Why was this lead marked as Low?").
- **Production-Grade Analytics UI**: Clean layout built with React & Tailwind CSS mimicking premium enterprise SaaS style.

## Tech Stack

- **Language**: Python 3.10+, Node.js 20+
- **Backend Framework**: FastAPI + Uvicorn
- **Frontend**: React (Vite) + Tailwind CSS v4
- **Machine Learning**: CatBoost Classifier, SHAP (TreeExplainer)
- **Database / Data Source**: Supabase (PostgreSQL)
- **AI Chat**: Google Gemini 2.5 Flash (via `google-genai` SDK)
- **Data Engineering**: Pandas, Numpy

## Prerequisites

- Python 3.10 or higher
- Node.js 20 or higher
- npm (or pnpm/yarn)
- A Google Gemini API key
- A Supabase Project configured with an `inbound_leads` table

## Getting Started

### 1. Clone the Repository

```bash
git clone <repo-url>
cd TCA
```

### 2. Set Up the Python Environment

Create a virtual environment and install backend dependencies:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 4. Environment Setup

Create `.env` inside the `TCA` root folder:

```bash
touch .env
```

Configure your sensitive credentials in `.env`:

| Variable | Description | Example |
| -------- | ----------- | ------- |
| `BASE_URL` | Supabase REST URL | `https://your-project.supabase.co/rest/v1/inbound_leads` |
| `API_KEY` | Supabase Publishable Key | `sb_publishable_your_key...` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSyYourGeminiKeyHere...` |

### 5. Start Development Servers

You need to run both the FastAPI backend and Vite frontend separately.

```bash
# Terminal 1: Start FastAPI backend from the TCA root directory
source venv/bin/activate
uvicorn api.main:app --reload --port 8000

# Terminal 2: Start Vite frontend from the TCA/frontend directory
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. You should see the ASTRA app start up and the Connected status indicator show green.

## Architecture

### Directory Structure

```
TCA/
├── api/                           # FastAPI Backend
│   ├── main.py                    # FastAPI app factory, CORS, router inclusion
│   ├── schemas.py                 # Pydantic request/response models
│   └── routes/                    
│       ├── single.py              # POST /score logic
│       ├── batch.py               # POST /score/batch logic (file upload)
│       ├── supabase.py            # POST /leads/score-supabase logic
│       └── chat.py                # POST /leads/ask (Gemini RAG)
├── frontend/                      # React (Vite) Frontend
│   └── src/
│       ├── App.jsx                # Layout shell, state mgmt
│       ├── index.css              # Custom CSS and token vars
│       ├── services/api.js        # fetch() wrappers to communicate with backend
│       └── components/            # React UI components (Dashboard, Chat Drawer, Forms)
├── models/
│   ├── catboost_lead_profitability.cbm  # Frozen binary model
│   └── model_metadata.json        # Dynamic constants, bin thresholds, feature rules
├── src/                           # ML Pipeline & Utils
│   ├── preprocessing.py           # DataCleaner handles missing data, mapping
│   ├── feature_engineering.py     # FeatureEngineer handles seasonal mapping, distances
│   ├── model.py                   # ModelService loads model, returns SHAP
│   └── scorer.py                  # Orchestrates Pipeline (Cleaner -> Engineer -> Model)
├── requirements.txt               # Python package dependencies
└── .env                           # Environment variables (not in git)
```

### Request Lifecycle

1. User interacts with Frontend (e.g., clicks "Pull & Score").
2. React app (`frontend/src/services/api.js`) issues an HTTP request to FastAPI.
3. FastAPI endpoint (`api/routes/supabase.py` or similar) intercepts the request.
4. FastAPI pulls raw data directly from Supabase REST endpoint via `httpx`.
5. Raw data enters `src.scorer.LeadScorer` pipeline.
6. Pipeline applies cleaning, feature extraction, runs predictions, generates SHAP impacts.
7. Backend caches results for Chat Assistant context.
8. Backend returns JSON response to React app.
9. React visualizes leads showing SHAP score impacts and RAG stats.

### Model Metadata

Data-derived values (feature lists, bin edges, class labels) are stored in `models/model_metadata.json`, not hardcoded. `ModelService` loads this file at startup. If the file is missing, it falls back to `config.FALLBACK_*` default values.

To regenerate metadata after retraining models:
```bash
python scripts/save_model_metadata.py
```

## Environment Variables

### Required
| Variable | Description |
| -------- | ----------- |
| `BASE_URL` | Connects the scoring tool directly to your Supabase instance to pull `inbound_leads` |
| `API_KEY` | Supabase Anon/Publishable API Key |
| `GEMINI_API_KEY`| The API Key for RAG (Required for "Ask About Leads"). Recommended to use `gemini-2.5-flash` model. |

## Available Scripts

| Context | Command | Description |
| ------- | ------- | ----------- |
| Backend | `uvicorn api.main:app --reload --port 8000` | Start FastAPI dev server on port 8000 |
| Backend | `pytest tests/ -v` | Run all active python tests |
| Frontend| `npm run dev` | Start Vite React server (port 5173) |
| Frontend| `npm run build` | Build frontend assets for production |
| ML/Data | `python scripts/save_model_metadata.py` | Extract bin definitions after modifying notebooks |

## Testing

```bash
# Ensure you are in the python environment in the TCA directory
pytest tests/ -v
```

Test coverage applies to:
- `test_preprocessing.py`: Validation of data schema mappings and missing values.
- `test_feature_engineering.py`: Validation of output schema ensuring 100% model spec match.
- `test_model.py`: Validation of model shapes and tree explainer.
- `test_scorer.py`: Validation of batch logic end-to-end functionality.
- `test_api.py`: Verification of endpoints including error handling.

## Deployment

### Backend (Render/Fly.io/Heroku)

To deploy the FastAPI backend server:
1. Provide the Python environment with a `Start Command` of:
   ```bash
   uvicorn api.main:app --host 0.0.0.0 --port $PORT
   ```
2. Attach environment variables for `BASE_URL`, `API_KEY` and `GEMINI_API_KEY`.
3. Set Python version to 3.10+.

### Frontend (Vercel/Netlify)

To deploy the React application:
1. Ensure the framework preset is set to Vite.
2. Build command:
   ```bash
   npm run build
   ```
3. Set the `dist/` directory as the output target.
4. Note: ensure `frontend/src/services/api.js` points to your production backend URL, as it currently points to `http://localhost:8000`.

## Troubleshooting

### FastAPI cannot find model files

**Error**: `FileNotFoundError: [Errno 2] No such file or directory: 'models/catboost_...cbm'`

**Solution**: Ensure you are running `uvicorn` from the `TCA` root directory, not from inside the `api/` directory.

### Tailwind / Frontend Hangs Or Doesn't Build 

**Error**: `npm run dev` hangs or UI shows no styles.

**Solution**:
In Vite standard setup with this repo, do not use `@import "tailwindcss";` or `@theme` syntax if migrating from an older configuration, as they can sometimes lock the build step due to parser issues when complex root CSS variables apply. Check `frontend/src/index.css` to verify fallback structural designs are in place.

### 429 Quota Exceeded Error on Chat

**Error**: "You exceeded your current quota... gemini-2.0-flash"

**Solution**: 
The `gemini-2.0-flash` API models have strict request-per-minute limitations. Ensure you are using `gemini-2.5-flash` in the `/leads/ask` endpoint (checked correctly in `api/routes/chat.py`), and authenticate your `.env` properly.

### Supabase "No Unscored Leads"

**Solution**: 
If calling Score New Leads returns immediately empty, verify:
- You have leads in the `inbound_leads` table.
- They have a `NULL` value in the `expected_profit_band` column to signify they are unscored.
