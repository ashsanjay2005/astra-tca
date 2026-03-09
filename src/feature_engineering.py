"""FeatureEngineer — produce the 20-feature schema the trained model expects.

The CatBoost model (notebook 05, Optuna-tuned) was trained with these transforms:

1. **Cyclical month** — ``lead_month`` → ``lead_month_sin`` / ``lead_month_cos``.
2. **Age ordinal** — ``customer_age_bracket`` → ``age_ordinal`` (0-5 ordinal).
3. **Timeline urgency** — ``requested_timeline`` → ``timeline_urgency`` (0-3 ordinal).
4. **Job-size tier** — ``estimated_job_size_sqft`` → ``job_size_tier``
   (Small/Medium/Large/XLarge based on training-data quartiles).
5. **Sqft per km** — ratio of sqft to distance.
6. **Is large & close** — boolean composite.
7. **Is homeowner detached** — boolean composite.

Data-derived values (quartiles, distance median) come from ``model_metadata.json``.
"""

from __future__ import annotations

import logging
import math
from typing import TYPE_CHECKING

import numpy as np
import pandas as pd

import config

if TYPE_CHECKING:
    from .model import ModelService

logger = logging.getLogger(__name__)

# ── static mappings (business logic, not data-derived) ─────────────────────

AGE_ORDER: dict[str, int] = {
    "Under 25": 0, "18-24": 0,
    "25-34": 1,
    "35-44": 2,
    "45-54": 3,
    "55-64": 4,
    "65+": 5,
}

TIMELINE_URGENCY: dict[str, int] = {
    "Flexible": 0,
    "1 month": 1,
    "1-2 weeks": 2,
    "ASAP": 3,
}

HIGH_VALUE_PROPERTY: set[str] = {"Detached", "Semi-Detached", "Heritage", "Heritage Home"}


class FeatureEngineer:
    """Stateless feature transformer matching the trained model's schema.

    Args:
        model_service: A loaded ``ModelService`` instance that provides
            data-derived metadata (quartiles, feature lists, etc.).

    Usage::

        service = ModelService()
        service.load()
        engineer = FeatureEngineer(service)
        df_ready = engineer.transform(cleaned_df)
    """

    def __init__(self, model_service: ModelService) -> None:
        self._model_service = model_service

    # ── public orchestrator ───────────────────────────────────────────────

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Run the full feature pipeline.

        Args:
            df: Cleaned DataFrame (output of ``DataCleaner.clean``).

        Returns:
            DataFrame with exactly the 20 columns the model expects,
            in the correct order, with categorical columns cast to ``str``.
        """
        logger.info("Starting feature engineering (%d rows)", len(df))

        df = self.add_cyclical_month(df)
        df = self.add_age_ordinal(df)
        df = self.add_timeline_urgency(df)
        df = self.add_job_size_tier(df)
        df = self.add_sqft_per_km(df)
        df = self.add_is_large_and_close(df)
        df = self.add_is_homeowner_detached(df)
        df = self.ensure_cat_dtypes(df)
        df = self.select_features(df)

        logger.info(
            "Feature engineering complete — %d columns: %s",
            df.shape[1],
            list(df.columns),
        )
        return df

    # ── individual transforms ─────────────────────────────────────────────

    def add_cyclical_month(self, df: pd.DataFrame) -> pd.DataFrame:
        """Encode ``lead_month`` as sin/cos pair, then drop the raw column.

        Args:
            df: DataFrame containing ``lead_month`` (1-12).

        Returns:
            DataFrame with ``lead_month_sin`` and ``lead_month_cos`` added.
        """
        df = df.copy()
        angle = 2 * math.pi * df["lead_month"] / 12
        df["lead_month_sin"] = np.sin(angle)
        df["lead_month_cos"] = np.cos(angle)
        df = df.drop(columns=["lead_month"])
        logger.debug("Added cyclical month encoding, dropped lead_month")
        return df

    def add_age_ordinal(self, df: pd.DataFrame) -> pd.DataFrame:
        """Map ``customer_age_bracket`` → ordinal integer ``age_ordinal``.

        Args:
            df: DataFrame containing ``customer_age_bracket``.

        Returns:
            DataFrame with ``age_ordinal`` added.
        """
        df = df.copy()
        df["age_ordinal"] = (
            df["customer_age_bracket"].map(AGE_ORDER).fillna(2).astype(int)
        )
        logger.debug("Added age_ordinal")
        return df

    def add_timeline_urgency(self, df: pd.DataFrame) -> pd.DataFrame:
        """Map ``requested_timeline`` → ordinal integer ``timeline_urgency``.

        Args:
            df: DataFrame containing ``requested_timeline``.

        Returns:
            DataFrame with ``timeline_urgency`` added.
        """
        df = df.copy()
        df["timeline_urgency"] = (
            df["requested_timeline"].map(TIMELINE_URGENCY).fillna(0).astype(int)
        )
        logger.debug("Added timeline_urgency")
        return df

    def add_job_size_tier(self, df: pd.DataFrame) -> pd.DataFrame:
        """Bin ``estimated_job_size_sqft`` into quartile-based tiers.

        Uses q25/q50/q75 from model metadata (training-data quartiles).

        Args:
            df: DataFrame containing ``estimated_job_size_sqft``.

        Returns:
            DataFrame with ``job_size_tier`` (Small/Medium/Large/XLarge).
        """
        df = df.copy()
        meta = self._model_service.metadata
        q25, q50, q75 = meta.get("sqft_quartiles", [859.0, 1295.0, 1817.5])

        def _tier(v: float) -> str:
            if v <= q25:
                return "Small"
            if v <= q50:
                return "Medium"
            if v <= q75:
                return "Large"
            return "XLarge"

        df["job_size_tier"] = df["estimated_job_size_sqft"].apply(_tier)
        logger.debug("Added job_size_tier (q25=%.0f, q50=%.0f, q75=%.0f)", q25, q50, q75)
        return df

    def add_sqft_per_km(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute sqft-to-distance ratio.

        Args:
            df: DataFrame containing ``estimated_job_size_sqft`` and
                ``distance_to_queens_km``.

        Returns:
            DataFrame with ``sqft_per_km`` added.
        """
        df = df.copy()
        df["sqft_per_km"] = df["estimated_job_size_sqft"] / (
            df["distance_to_queens_km"] + 0.1
        )
        logger.debug("Added sqft_per_km")
        return df

    def add_is_large_and_close(self, df: pd.DataFrame) -> pd.DataFrame:
        """Flag leads with above-median sqft AND below-median distance.

        Uses distance median from model metadata (training-data value).

        Args:
            df: DataFrame containing ``estimated_job_size_sqft`` and
                ``distance_to_queens_km``.

        Returns:
            DataFrame with ``is_large_and_close`` (0/1).
        """
        df = df.copy()
        meta = self._model_service.metadata
        q50 = meta.get("sqft_quartiles", [859.0, 1295.0, 1817.5])[1]
        dist_med = meta.get("distance_median", 3.685)

        df["is_large_and_close"] = (
            (df["estimated_job_size_sqft"] >= q50)
            & (df["distance_to_queens_km"] <= dist_med)
        ).astype(int)
        logger.debug("Added is_large_and_close")
        return df

    def add_is_homeowner_detached(self, df: pd.DataFrame) -> pd.DataFrame:
        """Flag leads that are homeowners with high-value property types.

        Args:
            df: DataFrame containing ``homeowner_status`` and ``property_type``.

        Returns:
            DataFrame with ``is_homeowner_detached`` (0/1).
        """
        df = df.copy()
        df["is_homeowner_detached"] = (
            (df["homeowner_status"] == "Own")
            & (df["property_type"].isin(HIGH_VALUE_PROPERTY))
        ).astype(int)
        logger.debug("Added is_homeowner_detached")
        return df

    def ensure_cat_dtypes(self, df: pd.DataFrame) -> pd.DataFrame:
        """Cast all categorical columns to ``str`` dtype.

        CatBoost expects categorical features as strings. Uses the
        categorical feature list from model metadata.

        Args:
            df: DataFrame after feature transforms.

        Returns:
            DataFrame with categorical columns as ``str``.
        """
        df = df.copy()
        for col in self._model_service.categorical_features:
            if col in df.columns:
                df[col] = df[col].astype(str)
        logger.debug(
            "Ensured categorical dtypes for %d columns",
            len(self._model_service.categorical_features),
        )
        return df

    def select_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Return only the columns the model expects, in training order.

        Args:
            df: DataFrame after all transforms.

        Returns:
            DataFrame with exactly the model's expected columns.

        Raises:
            KeyError: If any expected model feature is missing.
        """
        model_features = self._model_service.model_features
        missing = set(model_features) - set(df.columns)
        if missing:
            raise KeyError(
                f"Missing model features after transforms: {sorted(missing)}"
            )

        df = df[model_features].copy()
        logger.debug("Selected %d model features", len(model_features))
        return df
