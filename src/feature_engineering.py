"""FeatureEngineer — apply Model 8 feature transforms.

Model 8 (notebook 09) applies three transforms in order:

1. **Season** — map ``lead_month`` → ``season`` via ``config.MONTH_TO_SEASON``,
   then drop ``lead_month``.
2. **Distance band** — bin ``distance_to_queens_km`` into Near / Mid / Far
   using ``config.DIST_BINS`` and ``config.DIST_LABELS``.
3. **Weather binary** — map ``lead_capture_weather`` → ``weather_binary``
   (Good / Bad) via ``config.WEATHER_MAP``, then drop the original column.

After the transforms the class ensures categorical dtypes and selects
only the columns the model expects, in training order.
"""

from __future__ import annotations

import logging

import pandas as pd

import config

logger = logging.getLogger(__name__)


class FeatureEngineer:
    """Stateless feature transformer for Model 8.

    Usage::

        engineer = FeatureEngineer()
        df_ready = engineer.transform(cleaned_df)
    """

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

        Uses ``config.DIST_BINS`` (precomputed on the full labeled dataset)
        and ``config.DIST_LABELS``.  If ``config.DROP_RAW_DISTANCE`` is
        ``True``, the raw ``distance_to_queens_km`` column is dropped.

        Args:
            df: DataFrame containing a ``distance_to_queens_km`` column.

        Returns:
            DataFrame with ``distance_band`` added (and optionally
            ``distance_to_queens_km`` removed).
        """
        df = df.copy()
        df["distance_band"] = pd.cut(
            df["distance_to_queens_km"],
            bins=config.DIST_BINS,
            labels=config.DIST_LABELS,
        )
        if config.DROP_RAW_DISTANCE:
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

        CatBoost expects categorical features as strings. This method
        ensures every column in ``config.CATEGORICAL_FEATURES`` that is
        present in the DataFrame is cast to ``str``.

        Args:
            df: DataFrame after feature transforms.

        Returns:
            DataFrame with categorical columns as ``str``.
        """
        df = df.copy()
        for col in config.CATEGORICAL_FEATURES:
            if col in df.columns:
                df[col] = df[col].astype(str)
        logger.debug("Ensured categorical dtypes for %d columns", len(config.CATEGORICAL_FEATURES))
        return df

    def select_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Return only the columns the model expects, in training order.

        Drops any extra columns (``lead_id``, ``expected_profit_band``,
        ``lead_date``, etc.) and reorders to match
        ``config.MODEL_FEATURES``.

        Args:
            df: DataFrame after all transforms.

        Returns:
            DataFrame with exactly the columns in ``config.MODEL_FEATURES``,
            in the correct order.

        Raises:
            KeyError: If any expected model feature is missing from the
                DataFrame.
        """
        missing = set(config.MODEL_FEATURES) - set(df.columns)
        if missing:
            raise KeyError(
                f"Missing model features after transforms: {sorted(missing)}"
            )

        df = df[config.MODEL_FEATURES].copy()
        logger.debug("Selected %d model features", len(config.MODEL_FEATURES))
        return df
