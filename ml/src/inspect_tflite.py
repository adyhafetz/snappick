"""Inspect a TFLite FlatBuffer without requiring the TensorFlow runtime."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import tflite

from .contract import sha256_file


DTYPES = {
    0: "float32",
    1: "uint8",
    2: "int32",
    3: "int64",
    4: "string",
    5: "bool",
    6: "int16",
    7: "complex64",
    8: "int8",
    9: "float16",
}


def inspect_model(path: Path) -> dict[str, Any]:
    model = tflite.Model.GetRootAsModel(path.read_bytes(), 0)
    if model.SubgraphsLength() < 1:
        raise ValueError("TFLite model has no subgraphs")
    graph = model.Subgraphs(0)

    def tensor(index: int) -> dict[str, Any]:
        item = graph.Tensors(index)
        shape = [item.Shape(i) for i in range(item.ShapeLength())]
        quant = item.Quantization()
        scales = []
        zero_points = []
        if quant and quant.ScaleLength():
            scales = [quant.Scale(i) for i in range(quant.ScaleLength())]
        if quant and quant.ZeroPointLength():
            zero_points = [quant.ZeroPoint(i) for i in range(quant.ZeroPointLength())]
        name = item.Name().decode("utf-8", errors="replace") if item.Name() else ""
        return {
            "index": index,
            "name": name,
            "shape": shape,
            "dtype": DTYPES.get(item.Type(), f"tflite_type_{item.Type()}"),
            "quantization": {"scale": scales, "zero_point": zero_points},
        }

    inputs = [tensor(graph.Inputs(i)) for i in range(graph.InputsLength())]
    outputs = [tensor(graph.Outputs(i)) for i in range(graph.OutputsLength())]
    return {
        "sha256": sha256_file(path),
        "size_bytes": path.stat().st_size,
        "schema_version": model.Version(),
        "subgraphs": model.SubgraphsLength(),
        "inputs": inputs,
        "outputs": outputs,
        "input": inputs[0] if inputs else {},
        "output": outputs[0] if outputs else {},
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("model", type=Path)
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
    report = inspect_model(args.model)
    text = json.dumps(report, indent=2) + "\n"
    if args.json:
        args.json.write_text(text, encoding="utf-8")
    print(text, end="")


if __name__ == "__main__":
    main()
