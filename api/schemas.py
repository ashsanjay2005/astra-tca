"""Pydantic request / response models for the lead scoring API."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class LeadInput(BaseModel):
    """Raw lead data from the form or a single CSV row."""

    property_type: str
    neighbourhood: str
    estimated_job_size_sqft: float = Field(gt=0, le=5000)
    requested_timeline: str
    referral_source: str
    homeowner_status: str
    preferred_contact: str = "Email"
    lead_capture_weather: str
    distance_to_queens_km: float = Field(ge=0)
    customer_age_bracket: str
    has_pets: bool
    lead_weekday: str
    lead_month: int = Field(ge=1, le=12)


class TopReason(BaseModel):
    """One SHAP-based explanation for a prediction."""

    feature: str
    impact: float
    direction: str  # "positive" or "negative"


class LeadScoreResponse(BaseModel):
    """Result of scoring a single lead."""

    profit_band: str
    priority_score: int
    confidence: float
    top_reasons: list[TopReason]
    input_summary: dict[str, Any]


class SummaryStats(BaseModel):
    """Aggregate counts by profit band for a batch."""

    high: int
    medium: int
    low: int
    total: int
    dropped_rows: int = 0


class BatchScoreResponse(BaseModel):
    """Result of scoring a CSV batch."""

    leads: list[LeadScoreResponse]
    summary: SummaryStats
