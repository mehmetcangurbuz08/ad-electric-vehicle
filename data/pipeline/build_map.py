from __future__ import annotations

import json
import math
import zipfile
from pathlib import Path

import shapefile


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE = PROJECT_ROOT / "data" / "raw" / "cb_2020_us_zcta520_500k.zip"
DASHBOARD = PROJECT_ROOT / "data" / "processed" / "dashboard.json"
DESTINATION = PROJECT_ROOT / "web" / "public" / "data" / "wa_zcta.geojson"
TOLERANCE = 0.003


def _distance(point: list[float], start: list[float], end: list[float]) -> float:
    if start == end:
        return math.dist(point, start)
    dx, dy = end[0] - start[0], end[1] - start[1]
    return abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / math.hypot(dx, dy)


def _simplify(points: list[list[float]], tolerance: float = TOLERANCE) -> list[list[float]]:
    if len(points) <= 4:
        return [[round(x, 4), round(y, 4)] for x, y in points]
    closed = points[0] == points[-1]
    working = points[:-1] if closed else points

    def reduce_line(line: list[list[float]]) -> list[list[float]]:
        if len(line) <= 2:
            return line
        distances = [_distance(point, line[0], line[-1]) for point in line[1:-1]]
        maximum = max(distances, default=0)
        if maximum <= tolerance:
            return [line[0], line[-1]]
        index = distances.index(maximum) + 1
        return reduce_line(line[: index + 1])[:-1] + reduce_line(line[index:])

    result = reduce_line(working)
    if closed:
        result.append(result[0])
    return [[round(x, 4), round(y, 4)] for x, y in result]


def _geometry_coordinates(geometry: dict) -> list:
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        return [_simplify(ring) for ring in coordinates]
    if geometry["type"] == "MultiPolygon":
        return [[_simplify(ring) for ring in polygon] for polygon in coordinates]
    raise ValueError(f"Unsupported geometry: {geometry['type']}")


def build_map() -> Path:
    dashboard = json.loads(DASHBOARD.read_text(encoding="utf-8"))
    wanted = {region["zipCode"] for region in dashboard["regions"]}

    with zipfile.ZipFile(SOURCE) as archive:
        names = archive.namelist()
        stem = next(name[:-4] for name in names if name.endswith(".shp"))
        reader = shapefile.Reader(
            shp=archive.open(f"{stem}.shp"),
            shx=archive.open(f"{stem}.shx"),
            dbf=archive.open(f"{stem}.dbf"),
        )
        fields = [field[0] for field in reader.fields[1:]]
        zip_field = fields.index("ZCTA5CE20")
        features = []
        for shape_record in reader.iterShapeRecords():
            zip_code = str(shape_record.record[zip_field])
            if zip_code not in wanted:
                continue
            geometry = shape_record.shape.__geo_interface__
            features.append(
                {
                    "type": "Feature",
                    "properties": {"zipCode": zip_code},
                    "geometry": {
                        "type": geometry["type"],
                        "coordinates": _geometry_coordinates(geometry),
                    },
                }
            )

    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    DESTINATION.write_text(
        json.dumps(
            {"type": "FeatureCollection", "features": features},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"Built {DESTINATION} with {len(features)} ZCTA boundaries")
    return DESTINATION


if __name__ == "__main__":
    build_map()
