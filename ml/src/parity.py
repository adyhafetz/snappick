"""Numerical output comparison used by the Phase 4 PyTorch/TFLite parity gate."""

from __future__ import annotations

from typing import Any

import numpy as np


def compare_outputs(reference: Any, actual: Any, atol: float = 1e-4, rtol: float = 1e-3) -> dict[str, Any]:
    expected = np.asarray(reference, dtype=np.float32)
    observed = np.asarray(actual, dtype=np.float32)
    if expected.shape != observed.shape:
        return {"passed": False, "reason": "shape_mismatch", "reference_shape": list(expected.shape), "actual_shape": list(observed.shape)}
    delta = np.abs(expected - observed)
    tolerance = atol + rtol * np.abs(expected)
    return {
        "passed": bool(np.all(delta <= tolerance)),
        "max_abs_error": float(delta.max(initial=0.0)),
        "mean_abs_error": float(delta.mean()),
        "atol": atol,
        "rtol": rtol,
        "shape": list(expected.shape),
    }
