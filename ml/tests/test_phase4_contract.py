import unittest

from ml.src.contract import ContractError, LABELS, validate_manifest, validate_tensor_contract
from ml.src.parity import compare_outputs
from ml.src.dataset_audit import stable_split


def manifest():
    return {
        "version": "v0", "file": "snappick_det_v0.tflite", "sha256": "0" * 64,
        "framework": {"name": "ultralytics", "version": "unverified"},
        "role": "bundled_fallback",
        "input": {"width": 384, "height": 384, "layout": "NCHW", "dtype": "float32", "normalize": "0-1", "resize": "centre_crop"},
        "output": {"format": "yolo_raw", "shape": [1, 11, 3024], "layout": "attributes_first", "box_format": "cx,cy,w,h", "box_units": "normalised", "postprocess_in_model": False},
        "nms": {"iou": 0.5, "max_boxes": 30},
        "labels": LABELS, "thresholds": {"default": {"confident": 0.80, "uncertain": 0.40}, "per_class": {}},
        "min_app_version": "1.0.0", "dataset_version": "temporary-kaggle-unverified",
        "metrics": {"map50": None, "per_class_ap": {}, "fp_per_image_negatives": None},
    }


class ContractTests(unittest.TestCase):
    def test_exact_label_order_is_required(self):
        data = manifest()
        validate_manifest(data)
        data["labels"] = list(reversed(LABELS))
        with self.assertRaises(ContractError):
            validate_manifest(data)

    def test_tensor_shapes_and_dtype_are_checked(self):
        data = manifest()
        validate_tensor_contract(data, {"input": {"shape": [1, 3, 384, 384], "dtype": "float32"}, "output": {"shape": [1, 11, 3024], "dtype": "float32"}})
        with self.assertRaises(ContractError):
            validate_tensor_contract(data, {"input": {"shape": [1, 384, 384, 3], "dtype": "float32"}, "output": {"shape": [1, 11, 3024], "dtype": "float32"}})

    def test_manifest_rejects_candidate_role(self):
        data = manifest(); data["role"] = "candidate"
        with self.assertRaises(ContractError):
            validate_manifest(data)

    def test_parity_compares_shape_and_tolerance(self):
        self.assertTrue(compare_outputs([1.0, 2.0], [1.0, 2.0001])["passed"])
        self.assertFalse(compare_outputs([1.0, 2.0], [1.0])["passed"])

    def test_split_keeps_sessions_together(self):
        records = [{"id": i, "session_id": "a" if i < 2 else "b"} for i in range(4)]
        parts = stable_split(records, seed=42)
        locations = {}
        for part, rows in parts.items():
            for record in rows:
                locations.setdefault(record["session_id"], part)
                self.assertEqual(locations[record["session_id"]], part)


if __name__ == "__main__":
    unittest.main()
