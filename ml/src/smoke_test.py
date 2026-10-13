"""Run the model-level Phase 4 smoke/contract checks."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .contract import ContractError, LABELS, load_manifest, validate_tensor_contract
from .inspect_tflite import inspect_model


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("model", type=Path)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--labels", type=Path)
    args = parser.parse_args()
    manifest = load_manifest(args.manifest)
    if args.labels:
        labels = json.loads(args.labels.read_text(encoding="utf-8"))
        if labels != LABELS:
            print(json.dumps({"status": "failed", "error": "labels.json does not match fixed order"}, indent=2))
            return 1
    inspected = inspect_model(args.model)
    try:
        validate_tensor_contract(
            manifest,
            {"input": inspected["input"], "output": inspected["output"]},
        )
    except ContractError as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}, indent=2))
        return 1
    if inspected["sha256"] != manifest["sha256"]:
        print(json.dumps({"status": "failed", "error": "SHA-256 does not match manifest"}, indent=2))
        return 1
    print(json.dumps({"status": "passed", "checks": ["manifest", "sha256", "input_tensor", "output_tensor"], "runtime_inference": "unverified: TensorFlow/TFLite interpreter not installed"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
