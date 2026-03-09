"""ModelService — load, predict, and explain using the trained CatBoost model.

Also loads ``model_metadata.json`` (produced by
``scripts/save_model_metadata.py``) to expose data-derived values
such as feature lists, bin edges, and class labels.

Standalone usage::

    service = ModelService()
    service.load()
    preds = service.predict(df)
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import shap
from catboost import CatBoostClassifier

from . import utils

logger = logging.getLogger(__name__)


class ModelNotLoadedError(Exception):
    """Raised when prediction is attempted before the model has been loaded."""


class ModelService:
    """Thin wrapper around a CatBoost classifier for inference and explainability.

    Args:
        model_path: Path to the ``.cbm`` model artifact.
        metadata_path: Path to the companion ``model_metadata.json``.
            If ``None``, defaults to ``<model_dir>/model_metadata.json``.
    """

    def __init__(
        self,
        model_path: Path | None = None,
        metadata_path: Path | None = None,
    ) -> None:
        import config  # noqa: E402

        self._model_path = model_path or config.MODEL_PATH
        self._metadata_path = metadata_path or config.MODEL_METADATA_PATH
        self._model: CatBoostClassifier | None = None
        self._metadata: dict[str, Any] | None = None

    # ── loading ───────────────────────────────────────────────────────────

    def load(self) -> None:
        """Load the CatBoost model and its companion metadata.

        Raises:
            FileNotFoundError: If the ``.cbm`` file does not exist.
        """
        if not self._model_path.exists():
            raise FileNotFoundError(
                f"Model file not found: {self._model_path}"
            )

        self._model = CatBoostClassifier()
        self._model.load_model(str(self._model_path))
        logger.info("Loaded model from %s", self._model_path)

        self._load_metadata()

    def _load_metadata(self) -> None:
        """Load model_metadata.json or fall back to config defaults."""
        import config  # noqa: E402

        if self._metadata_path.exists():
            with open(self._metadata_path) as f:
                self._metadata = json.load(f)
            logger.info("Loaded metadata from %s", self._metadata_path)
        else:
            logger.warning(
                "model_metadata.json not found at %s — using fallback values "
                "from config.py. Run scripts/save_model_metadata.py to fix.",
                self._metadata_path,
            )
            self._metadata = {
                "model_features": config.FALLBACK_MODEL_FEATURES,
                "categorical_features": config.FALLBACK_CATEGORICAL_FEATURES,
                "class_labels": config.FALLBACK_CLASS_LABELS,
                "dist_bins": config.FALLBACK_DIST_BINS,
                "dist_labels": config.FALLBACK_DIST_LABELS,
                "drop_raw_distance": config.FALLBACK_DROP_RAW_DISTANCE,
            }

    # ── metadata properties ───────────────────────────────────────────────

    @property
    def metadata(self) -> dict[str, Any]:
        """Full metadata dict from ``model_metadata.json``."""
        self._ensure_loaded()
        return self._metadata

    @property
    def model_features(self) -> list[str]:
        """Ordered feature list the model was trained on."""
        self._ensure_loaded()
        return self._metadata["model_features"]

    @property
    def categorical_features(self) -> list[str]:
        """Categorical feature names expected by the model."""
        self._ensure_loaded()
        return self._metadata["categorical_features"]

    @property
    def class_labels(self) -> list[str]:
        """Ordered class labels from the model (e.g. ``['High', 'Low', 'Medium']``)."""
        self._ensure_loaded()
        return self._metadata["class_labels"]

    # ── inference ─────────────────────────────────────────────────────────

    def predict(self, features: pd.DataFrame) -> np.ndarray:
        """Generate profit-band predictions for input features.

        Args:
            features: DataFrame with columns matching the model training schema.

        Returns:
            Array of predicted class labels (e.g. ``['High', 'Low', 'Medium']``).

        Raises:
            ModelNotLoadedError: If ``load()`` has not been called.
        """
        self._ensure_loaded()
        return self._model.predict(features).flatten()

    def predict_proba(self, features: pd.DataFrame) -> np.ndarray:
        """Return the probability matrix for each class.

        Args:
            features: DataFrame with columns matching the model training schema.

        Returns:
            2-D array of shape ``(n_samples, n_classes)``.

        Raises:
            ModelNotLoadedError: If ``load()`` has not been called.
        """
        self._ensure_loaded()
        return self._model.predict_proba(features)

    def explain(
        self,
        features: pd.DataFrame,
        top_n: int = 3,
    ) -> list[list[dict[str, Any]]]:
        """Return top-N SHAP feature contributions per row.

        Args:
            features: DataFrame with columns matching the model training schema.
            top_n: Number of top contributing features to return per row.

        Returns:
            A list (one entry per row) of lists containing dicts
            ``{"feature": str, "impact": float, "direction": str}``.

        Raises:
            ModelNotLoadedError: If ``load()`` has not been called.
        """
        self._ensure_loaded()

        explainer = shap.TreeExplainer(self._model)
        shap_values = explainer.shap_values(features)

        predictions = self.predict(features)
        class_labels = self.class_labels
        feature_names = list(features.columns)

        results: list[list[dict[str, Any]]] = []
        for row_idx in range(len(features)):
            pred_label = predictions[row_idx]
            class_idx = class_labels.index(str(pred_label))

            if isinstance(shap_values, list):
                row_shap = shap_values[class_idx][row_idx]
            else:
                row_shap = shap_values[row_idx, :, class_idx]

            abs_shap = np.abs(row_shap)
            top_indices = np.argsort(abs_shap)[::-1][:top_n]

            row_explanations: list[dict[str, Any]] = []
            for idx in top_indices:
                impact = float(utils.numpy_to_native(row_shap[idx]))
                row_explanations.append(
                    {
                        "feature": feature_names[idx],
                        "impact": round(abs(impact), 4),
                        "direction": "positive" if impact >= 0 else "negative",
                    }
                )
            results.append(row_explanations)

        return results

    # ── private helpers ───────────────────────────────────────────────────

    def _ensure_loaded(self) -> None:
        """Raise ``ModelNotLoadedError`` if the model is not yet loaded."""
        if self._model is None:
            raise ModelNotLoadedError(
                "Model has not been loaded. Call load() first."
            )
