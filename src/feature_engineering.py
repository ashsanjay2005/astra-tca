"""FeatureEngineer — apply Model 8 feature transforms.

Model 8 (notebook 09) applies three transforms in order:

1. **Season** — map ``lead_month`` → ``season`` via ``config.MONTH_TO_SEASON``,
   then drop ``lead_month``.
2. **Distance band** — bin ``distance_to_queens_km`` into Near / Mid / Far
   using bin edges from model metadata.
3. **Weather binary** — map ``lead_capture_weather`` → ``weather_binary``
   (Good / Bad) via ``config.WEATHER_MAP``, then drop the original column.

After the transforms the class ensures categorical dtypes and selects
only the columns the model expects, in training order.

Data-derived values (bin edges, feature lists, categorical columns) come
from ``ModelService`` metadata — not from config.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import pandas as pd

import config

if TYPE_CHECKING:
    from .model import ModelService

logger = logging.getLogger(__name__)


class FeatureEngineer:
    """Stateless feature transformer for Model 8.

    Args:
        model_service: A loaded ``ModelService`` instance that provides
            data-derived metadata (bin edges, feature lists, etc.).

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
        """Run the full Model 8 feature pipeline.

        Args:
            df: Cleaned DataFrame (output of ``DataCleaner.clean``).
                Must contain ``lead_month``, ``distance_to_queens_km``,
                and ``lead_capture_weather``.

        Returns:
            DataFrame with only the columns the model expects, in the
            correct order, with categorical columns cast to ``str``.
        """
        logger.info("Starting feature engineering (%d rows)", len(df))

        df = self.add_season(df)
        df = self.add_distance_band(df)
        df = self.add_weather_binary(df)
        df = self.ensure_cat_dtypes(df)
        df = self.select_features(df)

        logger.info(
            "Feature engineering complete — %d columns: %s",
            df.shape[1],
            list(df.columns),
        )
        return df

    # ── individual transforms ─────────────────────────────────────────────

    def add_season(self, df: pd.DataFrame) -> pd.DataFrame:
        """Replace ``lead_month`` with a categorical ``season`` column.

        Maps each month to Winter / Spring / Summer / Fall using
        ``config.MONTH_TO_SEASON``, then drops ``lead_month``.

        Args:
            df: DataFrame containing a ``lead_month`` column.

        Returns:
            DataFrame with ``season`` added and ``lead_month`` removed.
        """
        df = df.copy()
        df["season"] = df["lead_month"].map(config.MONTH_TO_SEASON)
        df = df.drop(columns=["lead_month"])
        logger.debug("Added season, dropped lead_month")
        return df

    def add_distance_band(self, df: pd.DataFrame) -> pd.DataFrame:
        """Bin ``distance_to_queens_km`` into Near / Mid / Far terciles.

        Uses bin edges and labels from model metadata.  If the model was
        trained with the raw distance dropped, drops it here too.

        Args:
            df: DataFrame containing a ``distance_to_queens_km`` column.

        Returns:
            DataFrame with ``distance_band`` added (and optionally
            ``distance_to_queens_km`` removed).
        """
        df = df.copy()
        df["distance_band"] = pd.cut(
            df["distance_to_queens_km"],
            bins=self._model_service.dist_bins,
            labels=self._model_service.dist_labels,
        )
        if self._model_service.drop_raw_distance:
            df = df.drop(columns=["distance_to_queens_km"])
            logger.debug("Added distance_band, dropped raw distance")
        else:
            logger.debug("Added distance_band, kept raw distance")
        return df

    def add_weather_binary(self, df: pd.DataFrame) -> pd.DataFrame:
        """Replace ``lead_capture_weather`` with a binary ``weather_binary``.

        Maps Sunny → Good, everything else → Bad using
        ``config.WEATHER_MAP``, then drops the original column.

        Args:
            df: DataFrame containing a ``lead_capture_weather`` column.

        Returns:
            DataFrame with ``weather_binary`` added and
            ``lead_capture_weather`` removed.
        """
        df = df.copy()
        df["weather_binary"] = df["lead_capture_weather"].map(config.WEATHER_MAP)
        df = df.drop(columns=["lead_capture_weather"])
        logger.debug("Added weather_binary, dropped lead_capture_weather")
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

        Drops any extra columns (``lead_id``, ``expected_profit_band``,
        ``lead_date``, etc.) and reorders to match the model's training
        feature order from metadata.

        Args:
            df: DataFrame after all transforms.

        Returns:
            DataFrame with exactly the model's expected columns,
            in the correct order.

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
