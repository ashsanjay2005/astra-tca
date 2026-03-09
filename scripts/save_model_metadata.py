"""Save model metadata alongside the .cbm artifact.

Run this script AFTER training to produce ``models/model_metadata.json``.
The metadata captures data-derived values so that downstream code
never hardcodes them.

This script is self-contained: it computes bin edges from the training
data rather than reading them from config, so retraining always produces
fresh values.

Usage::

    python scripts/save_model_metadata.py
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Ensure project root is importable
_project_root = str(Path(__file__).resolve().parent.parent)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

import config  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def _compute_dist_bins(data_path: Path) -> list[float]:
    """Compute distance tercile bin edges from the full labeled dataset.

    Replicates the logic from notebook 09::

        _dist_col = X['distance_to_queens_km']
        DIST_BINS = [
            _dist_col.min() - 0.001,
            _dist_col.quantile(1 / 3),
            _dist_col.quantile(2 / 3),
            _dist_col.max() + 0.001,
        ]

    Args:
        data_path: Path to ``leads_cleaned.csv``.

    Returns:
        Four-element list of bin edges.
    """
    df = pd.read_csv(data_path)

    # Replicate notebook 04: extract month, drop date + id
    df["lead_date"] = pd.to_datetime(df["lead_date"])
    df["lead_month"] = df["lead_date"].dt.month
    df = df.drop(columns=["lead_date", "lead_id"])

    # Labeled rows only
    labeled = df[df[config.TARGET_COLUMN].notna()]
    dist_col = labeled["distance_to_queens_km"]

    bins = [
        float(dist_col.min() - 0.001),
        float(dist_col.quantile(1 / 3)),
        float(dist_col.quantile(2 / 3)),
        float(dist_col.max() + 0.001),
    ]
    # Round to 4 decimal places for clean JSON
    return [round(b, 4) for b in bins]


def main() -> None:
    """Load the trained model, compute metadata, and write JSON."""
    from catboost import CatBoostClassifier

    model_path = config.MODEL_PATH
    if not model_path.exists():
        logger.error("Model file not found: %s", model_path)
        sys.exit(1)

    logger.info("Loading model from %s", model_path)
    model = CatBoostClassifier()
    model.load_model(str(model_path))

    # Extract from the trained model object
    feature_names: list[str] = model.feature_names_
    class_labels: list[str] = [str(c) for c in model.classes_]

    # Identify which features were categorical during training
    cat_feature_indices: list[int] = model.get_cat_feature_indices()
    categorical_features: list[str] = [
        feature_names[i] for i in cat_feature_indices
    ]

    # Compute distance bin edges fresh from the training data
    cleaned_csv = config.PROCESSED_DATA_DIR / "leads_cleaned.csv"
    if cleaned_csv.exists():
        dist_bins = _compute_dist_bins(cleaned_csv)
        logger.info("Computed dist_bins from %s: %s", cleaned_csv, dist_bins)
    else:
        logger.warning(
            "leads_cleaned.csv not found at %s — using fallback bins",
            cleaned_csv,
        )
        dist_bins = config.FALLBACK_DIST_BINS

    metadata: dict = {
        "model_features": feature_names,
        "categorical_features": categorical_features,
        "class_labels": class_labels,
        "dist_bins": dist_bins,
        "dist_labels": ["Near", "Mid", "Far"],
        "drop_raw_distance": False,
    }

    metadata_path = config.MODEL_METADATA_PATH
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info("Saved metadata to %s", metadata_path)
    logger.info("  model_features (%d): %s", len(feature_names), feature_names)
    logger.info("  categorical_features (%d): %s", len(categorical_features), categorical_features)
    logger.info("  class_labels: %s", class_labels)
    logger.info("  dist_bins: %s", dist_bins)
    logger.info("  drop_raw_distance: %s", metadata["drop_raw_distance"])


if __name__ == "__main__":
    main()
