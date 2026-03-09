"""LeadScorer — orchestrates clean → engineer → predict → explain.

Single entry point for scoring leads through the full pipeline.

Usage::

    scorer = LeadScorer()
    result = scorer.score_single({"property_type": "Detached", ...})
    batch  = scorer.score_batch(raw_df)
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

import config
from .model import ModelService
from .preprocessing import DataCleaner
from .feature_engineering import FeatureEngineer
from .utils import numpy_to_native

logger = logging.getLogger(__name__)


class LeadScorer:
    """Orchestrates clean → engineer → predict → explain.

    Instantiate once at application startup.  The model is loaded
    eagerly in ``__init__`` so that the first prediction is fast.
    """

    def __init__(self) -> None:
        self._cleaner = DataCleaner()
        self._model = ModelService()
        self._model.load()
        self._engineer = FeatureEngineer(self._model)

        logger.info("LeadScorer initialised and model loaded")

    # ── public API ────────────────────────────────────────────────────────

    def score_single(self, lead_data: dict[str, Any]) -> dict[str, Any]:
        """Score one lead from a raw input dict.

        Single leads arrive pre-validated by Pydantic, so we skip the
        batch-oriented cleaner (which does groupby imputation, row
        dropping, etc.) and go straight to feature engineering.

        Args:
            lead_data: Dictionary of raw lead fields matching the input
                schema (must include ``lead_month``, not ``lead_date``).

        Returns:
            Dict with keys ``profit_band``, ``priority_score``,
            ``confidence``, ``top_reasons``, and ``input_summary``.
        """
        input_summary = {k: numpy_to_native(v) for k, v in lead_data.items()}

        # Build a one-row DataFrame — data is already clean from Pydantic
        # validation, so only run standardization (no row-dropping steps).
        df = pd.DataFrame([lead_data])
        df = self._cleaner.standardize_referral_source(df)
        df = self._cleaner.standardize_neighbourhood(df)

        features = self._engineer.transform(df)

        # Predict
        predictions = self._model.predict(features)
        probabilities = self._model.predict_proba(features)
        explanations = self._model.explain(features, top_n=10)

        # Assemble result
        pred_label = str(predictions[0])
        proba_row = probabilities[0]
        priority_scores = self._compute_priority_score(probabilities)

        # Confidence = probability of the predicted class
        class_labels = self._model.class_labels
        pred_idx = class_labels.index(pred_label)
        confidence = float(numpy_to_native(proba_row[pred_idx]))

        return {
            "profit_band": pred_label,
            "priority_score": int(round(priority_scores[0])),
            "confidence": round(confidence, 4),
            "top_reasons": explanations[0],
            "input_summary": input_summary,
        }

    def score_batch(self, df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
        """Score and rank a batch of leads.

        Args:
            df: Raw DataFrame (e.g. read from a CSV upload).

        Returns:
            A tuple of ``(result_df, dropped_rows)`` where:

            - ``result_df`` contains all cleaned columns plus
              ``profit_band``, ``priority_score``, ``confidence``,
              and ``top_reasons`` — sorted descending by priority.
            - ``dropped_rows`` is the number of input rows that were
              removed during cleaning (missing sqft, age bracket, etc.).
        """
        rows_before = len(df)

        # Pipeline
        cleaned = self._cleaner.clean(df)
        dropped_rows = rows_before - len(cleaned)
        if dropped_rows > 0:
            logger.warning(
                "Batch cleaning dropped %d of %d rows",
                dropped_rows,
                rows_before,
            )

        features = self._engineer.transform(cleaned)

        # Predict
        predictions = self._model.predict(features)
        probabilities = self._model.predict_proba(features)
        explanations = self._model.explain(features, top_n=10)
        priority_scores = self._compute_priority_score(probabilities)

        # Compute per-row confidence (prob of predicted class)
        class_labels = self._model.class_labels
        confidences: list[float] = []
        for i, pred in enumerate(predictions):
            pred_idx = class_labels.index(str(pred))
            confidences.append(
                round(float(numpy_to_native(probabilities[i][pred_idx])), 4)
            )

        # Attach results to the CLEANED dataframe (same row count)
        result = cleaned.copy()
        result["profit_band"] = [str(p) for p in predictions]
        result["priority_score"] = [
            int(round(s)) for s in priority_scores
        ]
        result["confidence"] = confidences
        result["top_reasons"] = explanations

        # Sort by priority descending
        result = result.sort_values("priority_score", ascending=False)
        result = result.reset_index(drop=True)

        logger.info("Batch scored: %d leads (%d dropped)", len(result), dropped_rows)
        return result, dropped_rows

    # ── private helpers ───────────────────────────────────────────────────

    def _compute_priority_score(self, probabilities: np.ndarray) -> np.ndarray:
        """Convert probability distributions to 0-100 priority scores.

        Uses a weighted sum::

            raw = (P_High × 3) + (P_Medium × 2) + (P_Low × 1)
            normalised = (raw - 1.0) / (3.0 - 1.0) × 100

        The weight for each class is looked up by label name (not
        positional index) to handle any class ordering.

        Args:
            probabilities: 2-D array of shape ``(n_samples, n_classes)``.

        Returns:
            1-D array of scores in ``[0, 100]``.
        """
        class_labels = self._model.class_labels
        weights = np.array(
            [config.PRIORITY_WEIGHTS[label] for label in class_labels],
            dtype=float,
        )

        raw = probabilities @ weights  # shape (n_samples,)

        # Normalise: raw ranges from min_weight (1) to max_weight (3)
        min_w = min(config.PRIORITY_WEIGHTS.values())
        max_w = max(config.PRIORITY_WEIGHTS.values())
        normalised = ((raw - min_w) / (max_w - min_w)) * 100

        return np.clip(normalised, 0, 100)
