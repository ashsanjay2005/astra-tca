"""FastAPI application factory for the ASTRA TCA Lead Scoring API.

Run with::

    uvicorn api.main:app --reload
"""

from __future__ import annotations

from dotenv import load_dotenv

load_dotenv()  # Load .env before anything reads os.getenv

import logging
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure project root is importable (needed when running via uvicorn)
_project_root = str(Path(__file__).resolve().parent.parent)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from api.routes import single, batch, supabase, chat  # noqa: E402
from src.scorer import LeadScorer  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="ASTRA TCA Lead Scoring API",
    description="Score painting-company leads and rank them by priority.",
    version="1.0.0",
)

# CORS — allow the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount route modules
app.include_router(single.router)
app.include_router(batch.router)
app.include_router(supabase.router)
app.include_router(chat.router)


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event() -> None:
    """Instantiate LeadScorer once at startup (not per request)."""
    logger.info("Initialising LeadScorer…")
    app.state.scorer = LeadScorer()
    logger.info("LeadScorer ready — API is live")


@app.get("/health")
async def health() -> dict[str, str]:
    """Simple liveness probe."""
    return {"status": "ok"}
