"""POST /leads/ask — RAG chat endpoint for lead Q&A using Gemini.

Gives non-technical sales/marketing teams a natural-language interface
over the most recently scored batch of leads.
"""

from __future__ import annotations

import logging
import os
from collections import Counter
from typing import Any

from google import genai
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Module-level cache ────────────────────────────────────────────────────────
_last_scored_results: list[dict] | None = None


def set_last_scored_results(results: list[dict]) -> None:
    """Called by supabase.py after a successful score to cache leads."""
    global _last_scored_results
    _last_scored_results = results
    logger.info("Chat cache updated with %d scored leads", len(results))


def get_scored_count() -> int:
    """Return the number of cached scored leads (for the frontend badge)."""
    return len(_last_scored_results) if _last_scored_results else 0


# ── Request / Response schemas ────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AskRequest(BaseModel):
    question: str
    conversation_history: list[ChatMessage] = []


class AskResponse(BaseModel):
    answer: str
    sources_used: int


# ── Context builder ───────────────────────────────────────────────────────────
def build_lead_context(results: list[dict]) -> str:
    """Compress scored leads into a structured text summary (~2000 tokens).

    Avoids dumping raw JSON — instead produces an analyst-friendly summary.
    """
    df = pd.DataFrame(results)
    parts: list[str] = []

    # 1. Overview
    total = len(df)
    band_counts = df["profit_band"].value_counts().to_dict()
    score_col = "priority_score"
    parts.append(
        f"OVERVIEW: {total} leads scored. "
        f"High: {band_counts.get('High', 0)}, "
        f"Medium: {band_counts.get('Medium', 0)}, "
        f"Low: {band_counts.get('Low', 0)}. "
        f"Score range: {df[score_col].min()}–{df[score_col].max()}, "
        f"Average: {df[score_col].mean():.1f}."
    )

    # 2. Top 10 leads
    top = df.nlargest(10, score_col)
    top_lines = []
    for rank, (_, r) in enumerate(top.iterrows(), 1):
        summary = r.get("input_summary", {}) or {}
        reasons = r.get("top_reasons", []) or []
        reason_str = ", ".join(
            f"{x.get('feature', '?')} ({x.get('direction', '?')})" for x in reasons[:3]
        )
        top_lines.append(
            f"  #{rank}: Score {r[score_col]}, {r['profit_band']}, "
            f"{summary.get('neighbourhood', '?')} · "
            f"{summary.get('property_type', '?')} · "
            f"{summary.get('estimated_job_size_sqft', '?')} sqft · "
            f"{summary.get('requested_timeline', '?')} · "
            f"{summary.get('referral_source', '?')} · "
            f"Reasons: {reason_str}"
        )
    parts.append("TOP 10 LEADS:\n" + "\n".join(top_lines))

    # 3. Bottom 10 leads
    bottom = df.nsmallest(10, score_col)
    bottom_lines = []
    for rank, (_, r) in enumerate(bottom.iterrows(), 1):
        summary = r.get("input_summary", {}) or {}
        reasons = r.get("top_reasons", []) or []
        reason_str = ", ".join(
            f"{x.get('feature', '?')} ({x.get('direction', '?')})" for x in reasons[:3]
        )
        bottom_lines.append(
            f"  #{rank}: Score {r[score_col]}, {r['profit_band']}, "
            f"{summary.get('neighbourhood', '?')} · "
            f"{summary.get('property_type', '?')} · "
            f"{summary.get('estimated_job_size_sqft', '?')} sqft · "
            f"{summary.get('referral_source', '?')} · "
            f"Reasons: {reason_str}"
        )
    parts.append("BOTTOM 10 LEADS:\n" + "\n".join(bottom_lines))

    # 4. Aggregated stats
    agg_parts = []
    for field in [
        "neighbourhood",
        "referral_source",
        "homeowner_status",
        "requested_timeline",
        "property_type",
        "customer_age_bracket",
    ]:
        col_data = df["input_summary"].apply(
            lambda s: s.get(field) if isinstance(s, dict) else None
        )
        if col_data.notna().sum() > 0:
            temp = pd.DataFrame({field: col_data, "score": df[score_col]})
            avg = temp.groupby(field)["score"].agg(["mean", "count"]).sort_values("mean", ascending=False)
            lines = [f"  {idx}: avg {row['mean']:.1f} (n={int(row['count'])})" for idx, row in avg.iterrows()]
            agg_parts.append(f"By {field}:\n" + "\n".join(lines))
    parts.append("AGGREGATED STATS:\n" + "\n\n".join(agg_parts))

    # 5. Feature importance (most common SHAP features)
    all_reasons: list[str] = []
    for reasons in df["top_reasons"]:
        if isinstance(reasons, list):
            for r in reasons:
                if isinstance(r, dict):
                    all_reasons.append(r.get("feature", "unknown"))
    freq = Counter(all_reasons).most_common(10)
    freq_str = ", ".join(f"{f[0]} ({f[1]}x)" for f in freq)
    parts.append(f"MOST IMPORTANT FEATURES (by frequency in SHAP): {freq_str}")

    return "\n\n".join(parts)


# ── Gemini call ───────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a lead analyst for a Kingston-based residential painting company. \
You help the sales and marketing team understand their scored leads and decide which to prioritize.

Rules:
- Answer in plain English. No jargon. The team is non-technical.
- When referencing specific leads, mention their rank, score, neighbourhood, and size.
- When asked about patterns, give specific actionable advice (e.g., "Invest more in Facebook Ads for the Downtown area").
- Keep answers concise — 2-3 paragraphs max unless they ask for detail.
- If asked something the data can't answer, say so honestly.
- Use the lead data below to ground every answer. Do not make up numbers."""


def _ask_gemini(question: str, conversation_history: list[ChatMessage], context: str) -> str:
    """Send question + context to Gemini and return the response text."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "<your_key_here>":
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not configured in .env",
        )

    client = genai.Client(api_key=api_key)

    # Build Gemini conversation history (uses "model" not "assistant")
    history = []
    for msg in conversation_history:
        role = "model" if msg.role == "assistant" else "user"
        history.append(
            genai.types.Content(role=role, parts=[genai.types.Part.from_text(text=msg.content)])
        )

    chat = client.chats.create(
        model="gemini-2.5-flash",
        config=genai.types.GenerateContentConfig(
            system_instruction=f"{SYSTEM_PROMPT}\n\nCURRENT SCORED LEADS DATA:\n{context}",
        ),
        history=history
    )

    response = chat.send_message(question)
    return response.text


# ── Endpoint ──────────────────────────────────────────────────────────────────
@router.post("/leads/ask", response_model=AskResponse)
async def ask_about_leads(req: AskRequest) -> AskResponse:
    """Answer a natural language question about the most recently scored leads."""

    if _last_scored_results is None:
        return AskResponse(
            answer=(
                "No leads have been scored yet. Go to 'Score New Leads' and "
                "pull from Supabase first, then come back and ask me anything."
            ),
            sources_used=0,
        )

    context = build_lead_context(_last_scored_results)

    try:
        answer = _ask_gemini(req.question, req.conversation_history, context)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Gemini API call failed")
        raise HTTPException(status_code=502, detail=f"AI service error: {e}") from e

    return AskResponse(answer=answer, sources_used=len(_last_scored_results))
