"""POST /score — score a single lead."""

from __future__ import annotations

from fastapi import APIRouter, Request

from api.schemas import LeadScoreResponse, LeadInput, TopReason

router = APIRouter()


@router.post("/score", response_model=LeadScoreResponse)
async def score_lead(lead: LeadInput, request: Request) -> LeadScoreResponse:
    """Score a single lead and return the prediction with explanations.

    Args:
        lead: Validated lead input from the request body.
        request: FastAPI request (used to access app-level scorer).

    Returns:
        Scored lead with profit band, priority score, confidence,
        and top SHAP reasons.
    """
    scorer = request.app.state.scorer
    result = scorer.score_single(lead.model_dump())

    return LeadScoreResponse(
        profit_band=result["profit_band"],
        priority_score=result["priority_score"],
        confidence=result["confidence"],
        top_reasons=[TopReason(**r) for r in result["top_reasons"]],
        input_summary=result["input_summary"],
    )
