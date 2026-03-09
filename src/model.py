"""ModelService — load, predict, and explain using the trained CatBoost model.

This class is fully standalone:

    service = ModelService()
    service.load()
    preds = service.predict(df)
"""

from __future__ import annotations

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
        model_path: Filesystem path to the ``.cbm`` model artifact.
            Defaults to the value in ``config.MODEL_PATH``.
    """

    def __init__(self, model_path: Path | None = None) -> None:
        if model_path is None:
            import config  # noqa: E402  — deferred to avoid circular at import time
            model_path = config.MODEL_PATH

        self._model_path = model_path
        self._model: CatBoostClassifier | None = None

    # ── public API ────────────────────────────────────────────────────────

    def load(self) -> None:
        """Load the CatBoost model from disk.

        Raises:
            FileNotFoundError: If the model file does not exist.
        """
        if not self._model_path.exists():
            raise FileNotFoundError(
                f"Model file not found: {self._model_path}"
            )

        self._model = CatBoostClassifier()
        self._model.load_model(str(self._model_path))
        logger.info("Loaded model from %s", self._model_path)

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
        predictions = self._model.predict(features)
        return predictions.flatten()

    def predict_proba(self, features: pd.DataFrame) -> np.ndarray:
        """Return the probability matrix for each class.

        Args:
            features: DataFrame with columns matching the model training schema.

        Returns:
            2-D array of shape ``(n_samples, n_classes)`` with class
            probabilities.

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

        # shap_values shape for multi-class: list of arrays (one per class)
        # or 3-D array. We use the predicted class's SHAP values per row.
        predictions = self.predict(features)
        class_labels = self.get_class_labels()
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

    def get_class_labels(self) -> list[str]:
        """Return the ordered class labels from the loaded model.

        Returns:
            List of class label strings, e.g. ``['High', 'Low', 'Medium']``.

        Raises:
            ModelNotLoadedError: If ``load()`` has not been called.
        """
        self._ensure_loaded()
        return [str(c) for c in self._model.classes_]

    # ── private helpers ───────────────────────────────────────────────────

    def _ensure_loaded(self) -> None:
        """Raise ``ModelNotLoadedError`` if the model is not yet loaded."""
        if self._model is None:
            raise ModelNotLoadedError(
                "Model has not been loaded. Call load() first."
            )
