"""DataCleaner — clean raw lead data before feature engineering.

Cleaning steps mirror the decisions made in ``02_cleaning.ipynb``:

1. Parse ``lead_date`` from mixed formats.
2. Standardize ``referral_source`` and ``neighbourhood`` text values.
3. Replace sqft outliers (0 or >5000) with ``NaN``, then drop those rows.
4. Impute missing ``distance_to_queens_km`` with per-neighbourhood median
   (global median fallback).
5. Drop the ``preferred_contact`` column (noise — spread ≤ 5pp).
6. Drop rows missing ``customer_age_bracket``.
7. Remove exact-duplicate rows.
"""

from __future__ import annotations

import logging
from typing import Any

import numpy as np
import pandas as pd

import config

logger = logging.getLogger(__name__)


class InvalidFeatureError(ValueError):
    """Raised when input features don't match the expected schema."""


class DataCleaner:
    """Stateless cleaning pipeline for raw lead data.

    Usage::

        cleaner = DataCleaner()
        df_clean = cleaner.clean(raw_df)
    """

    # ── public orchestrator ───────────────────────────────────────────────

    def clean(self, df: pd.DataFrame) -> pd.DataFrame:
        """Run the full cleaning pipeline in the correct order.

        Args:
            df: Raw lead DataFrame (e.g. read straight from CSV).

        Returns:
            Cleaned DataFrame ready for feature engineering.
        """
        original_rows = len(df)
        logger.info("Starting cleaning pipeline (%d rows)", original_rows)

        df = self.parse_dates(df)
        df = self.standardize_referral_source(df)
        df = self.standardize_neighbourhood(df)
        df = self.handle_sqft_outliers(df)
        df = self.handle_missing(df)
        df = self.remove_duplicates(df)

        logger.info(
            "Cleaning complete: %d → %d rows (dropped %d)",
            original_rows,
            len(df),
            original_rows - len(df),
        )
        return df.reset_index(drop=True)

    # ── individual steps ──────────────────────────────────────────────────

    def parse_dates(self, df: pd.DataFrame) -> pd.DataFrame:
        """Parse ``lead_date`` from mixed date formats.

        Args:
            df: DataFrame containing a ``lead_date`` column.

        Returns:
            DataFrame with ``lead_date`` as ``datetime64``.
        """
        df = df.copy()
        if "lead_date" in df.columns:
            df["lead_date"] = pd.to_datetime(
                df["lead_date"], format="mixed", dayfirst=False
            )
            logger.debug("Parsed lead_date to datetime")
        return df

    def standardize_referral_source(self, df: pd.DataFrame) -> pd.DataFrame:
        """Map inconsistent referral-source labels to canonical values.

        Args:
            df: DataFrame containing a ``referral_source`` column.

        Returns:
            DataFrame with standardized referral source values.
        """
        df = df.copy()
        if "referral_source" in df.columns:
            df["referral_source"] = df["referral_source"].replace(
                config.REFERRAL_SOURCE_MAP
            )
            logger.debug("Standardized referral_source values")
        return df

    def standardize_neighbourhood(self, df: pd.DataFrame) -> pd.DataFrame:
        """Strip whitespace and fix known misspellings in ``neighbourhood``.

        Args:
            df: DataFrame containing a ``neighbourhood`` column.

        Returns:
            DataFrame with clean neighbourhood names.
        """
        df = df.copy()
        if "neighbourhood" in df.columns:
            df["neighbourhood"] = df["neighbourhood"].str.strip()
            df["neighbourhood"] = df["neighbourhood"].replace(
                config.NEIGHBOURHOOD_MAP
            )
            logger.debug("Standardized neighbourhood values")
        return df

    def handle_sqft_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        """Replace invalid sqft values with ``NaN`` (they will be dropped later).

        Values at or below ``SQFT_OUTLIER_FLOOR`` (0) and above
        ``SQFT_OUTLIER_CEILING`` (5000) are treated as outliers.

        Args:
            df: DataFrame containing an ``estimated_job_size_sqft`` column.

        Returns:
            DataFrame with outlier sqft values set to ``NaN``.
        """
        col = "estimated_job_size_sqft"
        df = df.copy()
        if col in df.columns:
            bad_mask = (
                (df[col] <= config.SQFT_OUTLIER_FLOOR)
                | (df[col] > config.SQFT_OUTLIER_CEILING)
            )
            n_outliers = bad_mask.sum()
            df.loc[bad_mask, col] = np.nan
            logger.debug("Replaced %d sqft outliers with NaN", n_outliers)
        return df

    def handle_missing(self, df: pd.DataFrame) -> pd.DataFrame:
        """Drop rows with missing critical columns, impute distance, drop noise.

        Strategy (from notebook 02):
        - ``estimated_job_size_sqft``: Drop rows (no meaningful correlation
          with neighbourhood for imputation).
        - ``distance_to_queens_km``: Fill with per-neighbourhood median,
          falling back to global median for neighbourhoods with all nulls.
        - ``preferred_contact``: Drop the entire column (noise — High-profit
          spread was ≤ 5 pp across contact types).
        - ``customer_age_bracket``: Drop rows with missing values.

        Args:
            df: DataFrame after outlier handling.

        Returns:
            DataFrame with no missing values in critical columns.
        """
        df = df.copy()

        # Drop rows missing sqft (outliers already set to NaN)
        before = len(df)
        df = df.dropna(subset=["estimated_job_size_sqft"])
        logger.debug("Dropped %d rows with missing sqft", before - len(df))

        # Impute distance with per-neighbourhood median, global median fallback
        if "distance_to_queens_km" in df.columns:
            n_missing = df["distance_to_queens_km"].isna().sum()
            if n_missing > 0:
                neighbourhood_medians = df.groupby("neighbourhood")[
                    "distance_to_queens_km"
                ].transform("median")
                df["distance_to_queens_km"] = df[
                    "distance_to_queens_km"
                ].fillna(neighbourhood_medians)

                # Global median fallback for neighbourhoods with all nulls
                remaining = df["distance_to_queens_km"].isna().sum()
                if remaining > 0:
                    global_median = df["distance_to_queens_km"].median()
                    df["distance_to_queens_km"] = df[
                        "distance_to_queens_km"
                    ].fillna(global_median)

                logger.debug(
                    "Filled %d missing distances with neighbourhood medians",
                    n_missing,
                )

        # Fill missing preferred_contact with default value (model requires it)
        if "preferred_contact" in df.columns:
            n_missing = df["preferred_contact"].isna().sum()
            if n_missing > 0:
                df["preferred_contact"] = df["preferred_contact"].fillna("Email")
                logger.debug(
                    "Filled %d missing preferred_contact with 'Email'", n_missing
                )
        else:
            df["preferred_contact"] = "Email"
            logger.debug("Added preferred_contact column with default 'Email'")

        # Drop rows missing customer_age_bracket
        if "customer_age_bracket" in df.columns:
            before = len(df)
            df = df.dropna(subset=["customer_age_bracket"])
            logger.debug(
                "Dropped %d rows with missing customer_age_bracket",
                before - len(df),
            )

        return df

    def remove_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        """Remove exact-duplicate rows.

        Args:
            df: DataFrame to deduplicate.

        Returns:
            DataFrame without duplicate rows.
        """
        before = len(df)
        df = df.drop_duplicates()
        n_dupes = before - len(df)
        if n_dupes > 0:
            logger.debug("Removed %d duplicate rows", n_dupes)
        return df

    def validate_schema(self, df: pd.DataFrame) -> pd.DataFrame:
        """Verify that expected columns are present.

        Args:
            df: DataFrame to validate.

        Returns:
            The same DataFrame if validation passes.

        Raises:
            InvalidFeatureError: If any expected columns are missing.
        """
        # We only validate against the raw columns that cleaning expects
        # (minus lead_id and target, which may not be present for new leads).
        # preferred_contact is intentionally excluded — it gets dropped
        # during cleaning as noise.
        required = {
            "property_type",
            "neighbourhood",
            "estimated_job_size_sqft",
            "requested_timeline",
            "referral_source",
            "homeowner_status",
            "lead_capture_weather",
            "distance_to_queens_km",
            "customer_age_bracket",
            "has_pets",
            "lead_weekday",
        }
        missing = required - set(df.columns)
        if missing:
            raise InvalidFeatureError(
                f"Missing required columns: {sorted(missing)}"
            )
        return df

    def normalize_text_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """Lowercase and strip whitespace on all string columns.

        Args:
            df: DataFrame with string columns.

        Returns:
            DataFrame with normalized text values.
        """
        df = df.copy()
        str_cols = df.select_dtypes(include=["object"]).columns
        for col in str_cols:
            df[col] = df[col].str.strip()
        return df
