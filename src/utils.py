"""Small, generic helper functions.

Only truly generic utilities belong here. Stage-specific logic belongs
in the corresponding stage module (preprocessing, feature_engineering, etc.).
"""

from __future__ import annotations

import numpy as np


def numpy_to_native(obj: object) -> object:
    """Convert numpy scalar types to Python-native types for JSON serialization.

    Args:
        obj: Any object. Numpy scalars are converted; everything else passes through.

    Returns:
        A Python-native equivalent if the input was a numpy type, otherwise
        the original object unchanged.
    """
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj
