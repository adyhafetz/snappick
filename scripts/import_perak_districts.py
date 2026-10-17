"""Fetch, validate, and deterministically seed DOSM Perak district boundaries."""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path
from typing import Any

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
DATASET_COMMIT = "b057365ccbf26cbe3db1c043668f6a0efe811cb2"
DATASET_VERSION_DATE = "2026-10-16"
SOURCE_URL = (
    "https://raw.githubusercontent.com/dosm-malaysia/data-open/"
    f"{DATASET_COMMIT}/datasets/geodata/administrative_2_district.geojson"
)
CRS_NAME = "urn:ogc:def:crs:OGC:1.3:CRS84"
SOURCE_LICENSE = "DOSM Open Data License (repository LICENSE.md)"
ATTRIBUTION = "Department of Statistics Malaysia (DOSM), data-open administrative district boundaries"
OUTPUT_GEOJSON = REPOSITORY_ROOT / "supabase/seed/perak_districts.geojson"
OUTPUT_METADATA = REPOSITORY_ROOT / "supabase/seed/perak_districts.metadata.json"
OUTPUT_SQL = REPOSITORY_ROOT / "supabase/seed/perak_districts.sql"
OUTPUT_ROOT_SEED = REPOSITORY_ROOT / "supabase/seed.sql"


def slugify(name: str) -> str:
    return "-".join("".join(c.lower() if c.isalnum() else " " for c in name).split())


def segments_intersect(a: list[float], b: list[float], c: list[float], d: list[float]) -> bool:
    def orient(p: list[float], q: list[float], r: list[float]) -> float:
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

    def on_segment(p: list[float], q: list[float], r: list[float]) -> bool:
        return min(p[0], r[0]) <= q[0] <= max(p[0], r[0]) and min(p[1], r[1]) <= q[1] <= max(p[1], r[1])

    o1, o2, o3, o4 = orient(a, b, c), orient(a, b, d), orient(c, d, a), orient(c, d, b)
    if o1 * o2 < 0 and o3 * o4 < 0:
        return True
    return (o1 == 0 and on_segment(a, c, b)) or (o2 == 0 and on_segment(a, d, b)) or (
        o3 == 0 and on_segment(c, a, d)
    ) or (o4 == 0 and on_segment(c, b, d))


def validate_ring(ring: Any) -> None:
    if not isinstance(ring, list) or len(ring) < 4 or ring[0] != ring[-1]:
        raise ValueError("polygon rings must be closed and contain at least four coordinates")
    for point in ring:
        if not isinstance(point, list) or len(point) < 2:
            raise ValueError("each coordinate must contain longitude and latitude")
        lon, lat = point[0], point[1]
        if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
            raise ValueError("coordinates must be numeric")
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            raise ValueError("coordinate is outside WGS84 longitude/latitude bounds")
    segments = list(zip(ring, ring[1:]))
    for first in range(len(segments)):
        for second in range(first + 1, len(segments)):
            if second == first + 1 or (first == 0 and second == len(segments) - 1):
                continue
            if segments_intersect(*segments[first], *segments[second]):
                raise ValueError("polygon ring self-intersects")


def normalize_geometry(geometry: Any) -> dict[str, Any]:
    if not isinstance(geometry, dict):
        raise ValueError("feature geometry is required")
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if geometry_type == "Polygon":
        coordinates = [coordinates]
    elif geometry_type != "MultiPolygon":
        raise ValueError("district geometry must be Polygon or MultiPolygon")
    if not isinstance(coordinates, list) or not coordinates:
        raise ValueError("district geometry must contain polygon coordinates")
    for polygon in coordinates:
        if not isinstance(polygon, list) or not polygon:
            raise ValueError("each polygon must have an outer ring")
        for ring in polygon:
            validate_ring(ring)
    return {"type": "MultiPolygon", "coordinates": coordinates}


def validate_and_filter(source: Any) -> dict[str, Any]:
    if not isinstance(source, dict) or source.get("type") != "FeatureCollection":
        raise ValueError("source must be a GeoJSON FeatureCollection")
    if (source.get("crs") or {}).get("properties", {}).get("name") != CRS_NAME:
        raise ValueError(f"expected source CRS {CRS_NAME}")
    features = source.get("features")
    if not isinstance(features, list):
        raise ValueError("FeatureCollection features must be an array")

    selected = []
    for feature in features:
        properties = feature.get("properties") if isinstance(feature, dict) else None
        if not isinstance(properties, dict) or properties.get("state") != "Perak":
            continue
        name = properties.get("district")
        source_code = properties.get("code_state_district")
        if not isinstance(name, str) or not name.strip() or source_code is None:
            raise ValueError("each Perak feature must include a district name and identifier")
        geometry = normalize_geometry(feature.get("geometry"))
        selected.append({
            "type": "Feature",
            "properties": {"id": slugify(name), "name": name.strip(), "source_id": str(source_code)},
            "geometry": geometry,
        })
    selected.sort(key=lambda feature: feature["properties"]["id"])
    if not selected:
        raise ValueError("the source contains no Perak district features")
    ids = [feature["properties"]["id"] for feature in selected]
    if len(ids) != len(set(ids)):
        raise ValueError("district identifiers must be unique")
    return {"type": "FeatureCollection", "features": selected}


def sql_quote(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def write_outputs(collection: dict[str, Any]) -> None:
    OUTPUT_GEOJSON.write_text(json.dumps(collection, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    metadata = {
        "source": "Department of Statistics Malaysia, dosm-malaysia/data-open administrative_2_district.geojson",
        "source_url": SOURCE_URL,
        "source_commit": DATASET_COMMIT,
        "source_commit_date": "2022-06-22",
        "downloaded_date": DATASET_VERSION_DATE,
        "license": SOURCE_LICENSE,
        "license_url": f"https://github.com/dosm-malaysia/data-open/blob/{DATASET_COMMIT}/LICENSE.md",
        "attribution": ATTRIBUTION,
        "attribution_requirement": "No specific credit wording stated in the repository license; retain this source credit and do not imply DOSM endorsement.",
        "coordinate_reference_system": "CRS84 (WGS84 longitude, latitude; GeoJSON coordinates are [longitude, latitude]).",
        "district_count": len(collection["features"]),
    }
    OUTPUT_METADATA.write_text(json.dumps(metadata, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    values = []
    for feature in collection["features"]:
        properties = feature["properties"]
        geometry = json.dumps(feature["geometry"], separators=(",", ":"))
        values.append(
            f"  ({sql_quote(properties['name'])}, {sql_quote(properties['id'])}, "
            f"extensions.st_multi(extensions.st_geomfromgeojson({sql_quote(geometry)})::extensions.geometry(MultiPolygon, 4326)), false)"
        )
    sql = """-- Generated by scripts/import_perak_districts.py. Do not edit by hand.
insert into public.perak_districts (name, slug, boundary, is_placeholder)
values
""" + ",\n".join(values) + """
on conflict (slug) do update set name = excluded.name, boundary = excluded.boundary, is_placeholder = false;

do $$
begin
  if exists (select 1 from public.perak_districts where not is_placeholder and not extensions.st_isvalid(boundary)) then
    raise exception 'Perak district seed includes an invalid polygon';
  end if;
end;
$$;
"""
    OUTPUT_SQL.write_text(sql, encoding="utf-8", newline="\n")
    OUTPUT_ROOT_SEED.write_text(sql, encoding="utf-8", newline="\n")


def main() -> None:
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "SnapPick-Phase7-boundary-import"})
    with urllib.request.urlopen(request, timeout=60) as response:
        source = json.loads(response.read())
    collection = validate_and_filter(source)
    write_outputs(collection)
    print(f"Validated and wrote {len(collection['features'])} Perak district boundaries.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Boundary import failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
