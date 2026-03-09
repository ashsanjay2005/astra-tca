"""POST /score/batch — score a CSV of leads."""

from __future__ import annotations

import io
import logging

import pandas as pd
from fastapi import APIRouter, HTTPException, Request, UploadFile

from api.schemas import (
    BatchScoreResponse,
    LeadScoreResponse,
    SummaryStats,
    TopReason,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/score/batch", response_model=BatchScoreResponse)
async def score_batch(file: UploadFile, request: Request) -> BatchScoreResponse:
    """Score a batch of leads uploaded as a CSV file.

    Args:
        file: Uploaded CSV file.
        request: FastAPI request (used to access app-level scorer).

    Returns:
        List of scored leads with summary statistics.

    Raises:
        HTTPException: 400 if the file is not a CSV or is empty.
    """
    # Validate file type
    if file.content_type not in ("text/csv", "application/vnd.ms-excel"):
        if not (file.filename and file.filename.endswith(".csv")):
            raise HTTPException(
                status_code=400,
                detail="Only CSV files are accepted.",
            )

    # Read file content
    contents = await file.read()
    if not contents.strip():
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to parse CSV: {exc}",
        ) from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="CSV contains no data rows.")

    logger.info("Batch upload: %d rows, %d columns", len(df), len(df.columns))

    # Score
    scorer = request.app.state.scorer
    scored_df, dropped_rows = scorer.score_batch(df)

    # Build response
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
                    col: row[col]
                    for col in scored_df.columns
                    if col not in ("profit_band", "priority_score", "confidence", "top_reasons")
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
