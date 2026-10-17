import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from import_perak_districts import CRS_NAME, segments_intersect, validate_and_filter


def feature(name="Kinta", geometry=None, source_id="8_7"):
    return {
        "type": "Feature",
        "properties": {"state": "Perak", "district": name, "code_state_district": source_id},
        "geometry": geometry or {
            "type": "Polygon",
            "coordinates": [[[100, 4], [101, 4], [101, 5], [100, 5], [100, 4]]],
        },
    }


def collection(features, crs=CRS_NAME):
    return {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": crs}},
        "features": features,
    }


class DistrictImportTests(unittest.TestCase):
    def test_normalizes_polygon_to_multipolygon_and_preserves_coordinates(self):
        result = validate_and_filter(collection([feature()]))
        self.assertEqual(result["features"][0]["properties"]["id"], "kinta")
        self.assertEqual(result["features"][0]["geometry"]["type"], "MultiPolygon")
        self.assertEqual(result["features"][0]["geometry"]["coordinates"][0][0][0], [100, 4])

    def test_rejects_wrong_crs(self):
        with self.assertRaisesRegex(ValueError, "expected source CRS"):
            validate_and_filter(collection([feature()], "EPSG:3857"))

    def test_rejects_missing_district_identifier(self):
        with self.assertRaisesRegex(ValueError, "district name and identifier"):
            validate_and_filter(collection([feature(source_id=None)]))

    def test_rejects_invalid_coordinate_and_open_ring(self):
        invalid = feature(geometry={"type": "Polygon", "coordinates": [[[190, 4], [101, 4], [101, 5], [190, 4]]]})
        with self.assertRaisesRegex(ValueError, "outside WGS84"):
            validate_and_filter(collection([invalid]))
        open_ring = feature(geometry={"type": "Polygon", "coordinates": [[[100, 4], [101, 4], [101, 5], [100, 5]]]})
        with self.assertRaisesRegex(ValueError, "closed"):
            validate_and_filter(collection([open_ring]))

    def test_detects_non_adjacent_segment_intersection(self):
        bow_tie = [[0, 0], [2, 2], [0, 2], [2, 0], [0, 0]]
        self.assertTrue(any(
            segments_intersect(*ring_segment, *other_segment)
            for first, ring_segment in enumerate(zip(bow_tie, bow_tie[1:]))
            for second, other_segment in enumerate(zip(bow_tie, bow_tie[1:]))
            if second > first + 1 and not (first == 0 and second == len(bow_tie) - 2)
        ))
        with self.assertRaisesRegex(ValueError, "self-intersects"):
            validate_and_filter(collection([feature(geometry={"type": "Polygon", "coordinates": [bow_tie]})]))


if __name__ == "__main__":
    unittest.main()
