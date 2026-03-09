"""GET /leads/unscored and POST /leads/score-supabase — Supabase lead endpoints."""

from __future__ import annotations

import logging
import os

import httpx
import pandas as pd
from fastapi import APIRouter, HTTPException, Request

from api.schemas import (
    BatchScoreResponse,
    LeadScoreResponse,
    SummaryStats,
    TopReason,
)

logger = logging.getLogger(__name__)

router = APIRouter()

PAGE_SIZE = 500


async def _fetch_unscored_leads() -> list[dict]:
    """Paginate through Supabase inbound_leads where expected_profit_band IS NULL.

    Returns:
        List of row dicts from the Supabase table.

    Raises:
        HTTPException: If environment variables are missing or the request fails.
    """
    base_url = os.getenv("BASE_URL")
    api_key = os.getenv("API_KEY")

    if not base_url or not api_key:
        raise HTTPException(
            status_code=500,
            detail="Missing BASE_URL or API_KEY in environment variables.",
        )

    headers = {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    all_rows: list[dict] = []
    offset = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            params = {
                "expected_profit_band": "is.null",
                "limit": str(PAGE_SIZE),
                "offset": str(offset),
            }

            response = await client.get(base_url, headers=headers, params=params)

            # Supabase returns 200 or 206 (Partial Content) for paginated results
            if response.status_code not in (200, 206):
                logger.error(
                    "Supabase request failed: %d %s",
                    response.status_code,
                    response.text[:500],
                )
                raise HTTPException(
                    status_code=502,
                    detail=f"Supabase request failed ({response.status_code}).",
                )

            rows = response.json()
            if not rows:
                break

            all_rows.extend(rows)
            logger.info(
                "Fetched %d rows (offset=%d, total so far=%d)",
                len(rows),
                offset,
                len(all_rows),
            )

            if len(rows) < PAGE_SIZE:
                break

            offset += PAGE_SIZE

    return all_rows


@router.get("/leads/unscored")
async def get_unscored_leads() -> dict:
    """Return unscored leads from Supabase without scoring them.

    Returns:
        Dict with ``count`` and ``leads`` keys.
    """
    rows = await _fetch_unscored_leads()
    return {"count": len(rows), "leads": rows}


@router.post("/leads/score-supabase", response_model=BatchScoreResponse)
async def score_supabase_leads(request: Request) -> BatchScoreResponse:
    """Fetch unscored leads from Supabase, clean, score, and return results.

    The full pipeline is:
    1. Fetch all rows where ``expected_profit_band IS NULL``
    2. Build a DataFrame and extract ``lead_month`` from ``lead_date``
    3. Pipe through ``scorer.score_batch()`` (clean → engineer → predict)
    4. Return the same ``BatchScoreResponse`` used by ``/score/batch``

    Returns:
        Scored leads with summary statistics.

    Raises:
        HTTPException: 404 if no unscored leads found.
    """
    rows = await _fetch_unscored_leads()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="No unscored leads found in Supabase.",
        )

    logger.info("Fetched %d unscored leads from Supabase", len(rows))

    # Build DataFrame
    df = pd.DataFrame(rows)

    # Extract lead_month from lead_date (the cleaning pipeline parses dates,
    # but the model needs lead_month before cleaning drops lead_date)
    if "lead_date" in df.columns:
        df["lead_date"] = pd.to_datetime(
            df["lead_date"], format="mixed", dayfirst=False, errors="coerce"
        )
        df["lead_month"] = df["lead_date"].dt.month

    # Extract lead_weekday from lead_date if not present
    if "lead_weekday" not in df.columns and "lead_date" in df.columns:
        df["lead_weekday"] = df["lead_date"].dt.day_name()

    # Ensure has_pets is boolean
    if "has_pets" in df.columns:
        df["has_pets"] = df["has_pets"].map(
            {True: True, False: False, "Yes": True, "No": False, 1: True, 0: False}
        )

    # Score using the existing pipeline
    scorer = request.app.state.scorer
    scored_df, dropped_rows = scorer.score_batch(df)

    # Build response (same logic as batch.py)
    leads: list[LeadScoreResponse] = []
    for _, row in scored_df.iterrows():
        top_reasons = row.get("top_reasons", [])
        leads.append(
            LeadScoreResponse(
                profit_band=row["profit_band"],
                priority_score=int(row["priority_score"]),
                confidence=float(row["confidence"]),
                top_reasons=[TopReason(**r) for r in top_reasons],
                input_summary={
                    col: (
                        row[col].isoformat()
                        if hasattr(row[col], "isoformat")
                        else row[col]
                    )
                    for col in scored_df.columns
                    if col
                    not in (
                        "profit_band",
                        "priority_score",
                        "confidence",
                        "top_reasons",
                    )
                },
            )
        )

    summary = SummaryStats(
        high=sum(1 for lead in leads if lead.profit_band == "High"),
        medium=sum(1 for lead in leads if lead.profit_band == "Medium"),
        low=sum(1 for lead in leads if lead.profit_band == "Low"),
        total=len(leads),
        dropped_rows=dropped_rows,
    )

    return BatchScoreResponse(leads=leads, summary=summary)
