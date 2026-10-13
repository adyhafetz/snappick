"""The model manifest contract and checks shared by audit scripts and tests."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Mapping, Sequence

LABELS = ["metal", "trash", "glass", "paper", "cardboard", "plastic", "biological"]


class ContractError(ValueError):
    """Raised when a manifest or inspected tensor contract is unsafe to use."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _require(mapping: Mapping[str, Any], key: str, context: str) -> Any:
    if key not in mapping:
        raise ContractError(f"{context} is missing required field '{key}'")
    return mapping[key]


def validate_manifest(manifest: Mapping[str, Any]) -> None:
    """Validate the stable fields needed before loading a model."""
    if _require(manifest, "version", "manifest") != "v0":
        raise ContractError("manifest.version must be v0 for the M0 fallback")
    if _require(manifest, "role", "manifest") != "bundled_fallback":
        raise ContractError("M0 manifest.role must be bundled_fallback")
    labels = _require(manifest, "labels", "manifest")
    if labels != LABELS:
        raise ContractError(f"labels must remain exactly {LABELS!r}")
    inp = _require(manifest, "input", "manifest")
    if inp.get("width") != 384 or inp.get("height") != 384:
        raise ContractError("M0 input must be 384x384")
    if inp.get("layout") not in {"NCHW", "NHWC"}:
        raise ContractError("input.layout must be NCHW or NHWC")
    if inp.get("dtype") != "float32" or inp.get("normalize") != "0-1":
        raise ContractError("M0 input must be float32 normalized to 0-1")
    if inp.get("resize") != "centre_crop":
        raise ContractError("M0 input.resize must be centre_crop")
    output = _require(manifest, "output", "manifest")
    shape = output.get("shape")
    if not isinstance(shape, list) or len(shape) != 3 or shape[0] != 1:
        raise ContractError("output.shape must be a rank-3 [1,...,...] shape")
    if output.get("layout") not in {"attributes_first", "attributes_last"}:
        raise ContractError("output.layout must be attributes_first or attributes_last")
    if output.get("format") != "yolo_raw" or output.get("box_format") != "cx,cy,w,h":
        raise ContractError("M0 output must be raw YOLO cx,cy,w,h")
    if output.get("box_units") != "normalised" or output.get("postprocess_in_model") is not False:
        raise ContractError("M0 output boxes must be normalized and post-processing must be app-side")
    nms = _require(manifest, "nms", "manifest")
    if nms.get("iou") != 0.5 or nms.get("max_boxes") != 30:
        raise ContractError("M0 NMS defaults must be IoU 0.5 and max_boxes 30")
    thresholds = _require(manifest, "thresholds", "manifest")
    if thresholds.get("default") != {"confident": 0.80, "uncertain": 0.40}:
        raise ContractError("M0 confidence defaults must be 0.80 and 0.40")
    if not isinstance(manifest.get("sha256"), str) or len(manifest["sha256"]) != 64:
        raise ContractError("manifest.sha256 must be a 64-character SHA-256")


def validate_tensor_contract(manifest: Mapping[str, Any], inspected: Mapping[str, Any]) -> None:
    """Compare interpreter metadata with the manifest; never infer silently."""
    validate_manifest(manifest)
    expected_input = [1, 3, 384, 384] if manifest["input"]["layout"] == "NCHW" else [1, 384, 384, 3]
    if list(inspected.get("input", {}).get("shape", [])) != expected_input:
        raise ContractError(f"input tensor shape mismatch: expected {expected_input}, got {inspected.get('input', {}).get('shape')}")
    if inspected.get("input", {}).get("dtype") != "float32":
        raise ContractError("input tensor dtype mismatch: expected float32")
    if list(inspected.get("output", {}).get("shape", [])) != manifest["output"]["shape"]:
        raise ContractError(f"output tensor shape mismatch: expected {manifest['output']['shape']}, got {inspected.get('output', {}).get('shape')}")
    if inspected.get("output", {}).get("dtype") != "float32":
        raise ContractError("output tensor dtype mismatch: expected float32")


def load_manifest(path: Path) -> dict[str, Any]:
    manifest = json.loads(path.read_text(encoding="utf-8"))
    validate_manifest(manifest)
    return manifest
