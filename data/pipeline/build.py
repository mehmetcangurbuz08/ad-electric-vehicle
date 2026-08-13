from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from data.pipeline.config import PipelineSettings


BEV_LABEL = "Battery Electric Vehicle (BEV)"


def _zip(series: pd.Series) -> pd.Series:
    return series.astype("string").str.extract(r"(\d{5})", expand=False)


def _numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def _minmax(series: pd.Series) -> pd.Series:
    values = series.fillna(series.median()).astype(float)
    spread = values.max() - values.min()
    return (values - values.min()) / spread if spread else values * 0


def _coordinates(series: pd.Series) -> tuple[pd.Series, pd.Series]:
    points = series.astype("string").str.extract(
        r"POINT \((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)"
    )
    return _numeric(points[0]), _numeric(points[1])


def _load_sources(settings: PipelineSettings) -> tuple[pd.DataFrame, ...]:
    paths = [
        settings.raw_dir / "wa_ev_population.csv",
        settings.raw_dir / "wa_charging_stations.csv",
        settings.raw_dir / "acs_zcta.csv",
    ]
    missing = [str(path) for path in paths if not path.exists()]
    if missing:
        raise FileNotFoundError(
            "Missing raw sources: " + ", ".join(missing) + ". Run the fetch command first."
        )
    return tuple(pd.read_csv(path, low_memory=False) for path in paths)


def _aggregate_ev(ev: pd.DataFrame) -> tuple[pd.DataFrame, list[dict], list[dict], list[dict]]:
    ev = ev.loc[ev["State"].eq("WA")].copy()
    ev["zipCode"] = _zip(ev["Postal Code"])
    ev["isBev"] = ev["Electric Vehicle Type"].eq(BEV_LABEL)
    ev["rangeKnown"] = _numeric(ev["Electric Range"]).where(lambda value: value > 0)
    ev["modelYear"] = _numeric(ev["Model Year"])
    ev["recentVehicle"] = ev["modelYear"].ge(ev["modelYear"].max() - 2)
    ev["longitude"], ev["latitude"] = _coordinates(ev["Vehicle Location"])

    grouped = ev.dropna(subset=["zipCode"]).groupby("zipCode", observed=True)
    regions = grouped.agg(
        vehicles=("zipCode", "size"),
        bevShare=("isBev", lambda values: values.mean() * 100),
        avgRange=("rangeKnown", "mean"),
        recentShare=("recentVehicle", lambda values: values.mean() * 100),
        city=("City", lambda values: values.mode().iat[0] if not values.mode().empty else "Unknown"),
        county=("County", lambda values: values.mode().iat[0] if not values.mode().empty else "Unknown"),
        latitude=("latitude", "median"),
        longitude=("longitude", "median"),
    ).reset_index()

    trend_frame = (
        ev.dropna(subset=["modelYear"])
        .groupby("modelYear")
        .agg(count=("modelYear", "size"), avgRange=("rangeKnown", "mean"))
        .reset_index()
        .sort_values("modelYear")
    )
    trend = [
        {
            "modelYear": int(row.modelYear),
            "count": int(row.count),
            "avgRange": None if pd.isna(row.avgRange) else round(float(row.avgRange), 1),
        }
        for row in trend_frame.itertuples()
        if row.modelYear >= 2010
    ]
    bev_count = int(ev["isBev"].sum())
    powertrain = [
        {"type": "BEV", "count": bev_count},
        {"type": "PHEV", "count": int(len(ev) - bev_count)},
    ]
    brands = [
        {"make": str(make), "count": int(count)}
        for make, count in ev["Make"].value_counts().head(8).items()
    ]
    return regions, trend, powertrain, brands


def _aggregate_stations(stations: pd.DataFrame) -> pd.DataFrame:
    stations = stations.copy()
    stations["zipCode"] = _zip(stations["ZIP"])
    stations["level2"] = _numeric(stations["EV Level2 EVSE Num"]).fillna(0)
    stations["dcFastPorts"] = _numeric(stations["EV DC Fast Count"]).fillna(0)
    stations["publicPorts"] = stations["level2"] + stations["dcFastPorts"]
    return (
        stations.dropna(subset=["zipCode"])
        .groupby("zipCode", observed=True)
        .agg(
            chargingSites=("ID", "nunique"),
            publicPorts=("publicPorts", "sum"),
            dcFastPorts=("dcFastPorts", "sum"),
        )
        .reset_index()
    )


def _prepare_census(census: pd.DataFrame) -> pd.DataFrame:
    census = census.copy()
    census["zipCode"] = _zip(census["zip code tabulation area"])
    total_structures = _numeric(census["B25024_001E"])
    multiunit = sum(_numeric(census[f"B25024_{number:03d}E"]) for number in range(4, 10))
    occupied = _numeric(census["B25003_001E"])
    census["medianIncome"] = _numeric(census["B19013_001E"]).where(lambda value: value >= 0)
    census["multifamilyShare"] = (multiunit / total_structures.replace(0, np.nan)) * 100
    census["ownerOccupiedShare"] = (
        _numeric(census["B25003_002E"]) / occupied.replace(0, np.nan)
    ) * 100
    census["avgCommuteMinutes"] = _numeric(census["S0801_C01_046E"]).where(
        lambda value: value >= 0
    )
    return census[
        [
            "zipCode",
            "medianIncome",
            "multifamilyShare",
            "ownerOccupiedShare",
            "avgCommuteMinutes",
        ]
    ]


def _recommend(row: pd.Series) -> str:
    if row["priorityScore"] >= 75:
        return "DC hızlı şarj için saha ve şebeke fizibilitesini başlat."
    if row["priorityScore"] >= 55:
        return "Talep artışını izle; Level 2 ve seçili DC hızlı kapasiteyi değerlendir."
    return "Mevcut kapasiteyi izle; kısa vadede yatırım önceliği düşük."


def build_dashboard(settings: PipelineSettings) -> Path:
    ev, stations, census = _load_sources(settings)
    regions, trend, powertrain, brands = _aggregate_ev(ev)
    supply = _aggregate_stations(stations)
    demographics = _prepare_census(census)
    regions = regions.merge(supply, on="zipCode", how="left").merge(
        demographics, on="zipCode", how="left"
    )
    # The dashboard map contract requires a usable point for every published ZIP.
    regions = regions.dropna(subset=["latitude", "longitude"]).copy()
    for column in ["chargingSites", "publicPorts", "dcFastPorts"]:
        regions[column] = regions[column].fillna(0)

    regions["chargingGap"] = regions["vehicles"] / (regions["publicPorts"] + 1)
    regions["priorityScore"] = 100 * (
        0.35 * _minmax(regions["vehicles"])
        + 0.25 * _minmax(regions["chargingGap"])
        + 0.15 * _minmax(regions["multifamilyShare"])
        + 0.15 * _minmax(regions["avgCommuteMinutes"])
        + 0.10 * _minmax(regions["recentShare"])
    )

    features = [
        "vehicles",
        "avgRange",
        "bevShare",
        "medianIncome",
        "avgCommuteMinutes",
        "multifamilyShare",
        "chargingGap",
    ]
    cluster_pipeline = Pipeline(
        [
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
            ("cluster", KMeans(n_clusters=3, random_state=42, n_init=20)),
        ]
    )
    regions["cluster"] = cluster_pipeline.fit_predict(regions[features])
    cluster_rank = (
        regions.groupby("cluster")["priorityScore"].mean().sort_values().index.tolist()
    )
    segment_by_cluster = {
        cluster_rank[0]: "Mevcut kapasitesi dengeli",
        cluster_rank[1]: "Gelişen talep bölgesi",
        cluster_rank[2]: "Yüksek talep / altyapı açığı",
    }
    regions["segment"] = regions["cluster"].map(segment_by_cluster)
    regions["recommendation"] = regions.apply(_recommend, axis=1)

    settings.models_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(cluster_pipeline, settings.models_dir / "kmeans.joblib")

    region_fields = [
        "zipCode", "city", "county", "latitude", "longitude", "vehicles",
        "bevShare", "avgRange", "medianIncome", "avgCommuteMinutes",
        "multifamilyShare", "publicPorts", "dcFastPorts", "cluster", "segment",
        "priorityScore", "recommendation",
    ]
    region_records = []
    for record in regions.sort_values("priorityScore", ascending=False)[region_fields].to_dict("records"):
        clean = {}
        for key, value in record.items():
            if pd.isna(value):
                clean[key] = None
            elif key in {"vehicles", "publicPorts", "dcFastPorts", "cluster"}:
                clean[key] = int(value)
            elif isinstance(value, (float, np.floating)):
                clean[key] = round(float(value), 1)
            else:
                clean[key] = value
        region_records.append(clean)

    total_vehicles = sum(item["count"] for item in powertrain)
    bev_count = next(item["count"] for item in powertrain if item["type"] == "BEV")
    output = {
        "schemaVersion": "1.0",
        "metadata": {
            "mode": "live",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "geography": "Washington, USA — ZIP/ZCTA level",
            "trendDefinition": "Current registered fleet grouped by vehicle model year",
            "caveats": [
                "Model year is not registration year.",
                "Zero electric-range and MSRP values are treated as unknown.",
                "ZIP Code and Census ZCTA joins may not match perfectly.",
            ],
        },
        "summary": {
            "totalVehicles": total_vehicles,
            "bevShare": round(bev_count / total_vehicles * 100, 1),
            "chargingSites": int(regions["chargingSites"].sum()),
            "publicPorts": int(regions["publicPorts"].sum()),
            "dcFastPorts": int(regions["dcFastPorts"].sum()),
            "priorityRegions": int(regions["priorityScore"].ge(75).sum()),
        },
        "vehicleTrend": trend,
        "powertrain": powertrain,
        "brands": brands,
        "regions": region_records,
    }
    settings.processed_dir.mkdir(parents=True, exist_ok=True)
    destination = settings.processed_dir / "dashboard.json"
    with destination.open("w", encoding="utf-8") as target:
        json.dump(output, target, ensure_ascii=False, indent=2)
    return destination
