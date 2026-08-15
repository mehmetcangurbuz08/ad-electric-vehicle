from __future__ import annotations

import json
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from data.pipeline.config import PipelineSettings
from data.pipeline.excel_export import export_model_workbooks
from data.pipeline.modeling import build_models


BEV_LABEL = "Battery Electric Vehicle (BEV)"
ACTIVE_STATUS = "E"
PUBLIC_ACCESS = "public"


def _zip(series: pd.Series) -> pd.Series:
    return series.astype("string").str.extract(r"(\d{5})", expand=False)


def _numeric(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce")


def _coordinates(series: pd.Series) -> tuple[pd.Series, pd.Series]:
    points = series.astype("string").str.extract(
        r"POINT \((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)"
    )
    return _numeric(points[0]), _numeric(points[1])


def _mode(values: pd.Series) -> str:
    modes = values.dropna().mode()
    return str(modes.iat[0]) if not modes.empty else "Unknown"


def _load_sources(settings: PipelineSettings) -> tuple[pd.DataFrame, ...]:
    ev_path = settings.raw_dir / "wa_ev_population.csv"
    station_path = settings.raw_dir / "wa_fuel_station.csv"
    income_path = settings.raw_dir / "wa_income.csv"
    units_path = settings.raw_dir / "wa_units.csv"
    commuting_path = settings.raw_dir / "wa_commuting.csv"
    paths = (ev_path, station_path, income_path, units_path, commuting_path)
    missing = [str(path) for path in paths if not path.exists()]
    if missing:
        raise FileNotFoundError("Missing raw sources: " + ", ".join(missing))
    return (
        pd.read_csv(ev_path, low_memory=False),
        pd.read_csv(station_path, low_memory=False),
        pd.read_csv(income_path, skiprows=[1], low_memory=False),
        pd.read_csv(units_path, skiprows=[1], low_memory=False),
        pd.read_csv(commuting_path, skiprows=[1], low_memory=False),
    )


def _aggregate_ev(
    ev: pd.DataFrame,
) -> tuple[
    pd.DataFrame, list[dict], list[dict], list[dict], list[dict],
    list[dict], list[dict], list[dict], dict,
]:
    ev = ev.loc[ev["State"].eq("WA")].copy()
    ev["zipCode"] = _zip(ev["Postal Code"])
    ev["isBev"] = ev["Electric Vehicle Type"].eq(BEV_LABEL)
    ev["rangeKnown"] = _numeric(ev["Electric Range"]).where(lambda value: value > 0)
    ev["modelYear"] = _numeric(ev["Model Year"])
    ev["longitude"], ev["latitude"] = _coordinates(ev["Vehicle Location"])

    grouped = ev.dropna(subset=["zipCode"]).groupby("zipCode", observed=True)
    regions = grouped.agg(
        vehicles=("zipCode", "size"),
        bevVehicles=("isBev", "sum"),
        bevShare=("isBev", lambda values: values.mean() * 100),
        avgRange=("rangeKnown", "mean"),
        knownRangeShare=("rangeKnown", lambda values: values.notna().mean() * 100),
        city=("City", _mode),
        county=("County", _mode),
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
        for make, count in ev["Make"].value_counts().head(10).items()
    ]
    models = [
        {"model": f"{make} {model}", "count": int(count)}
        for (make, model), count in (
            ev.groupby(["Make", "Model"], observed=True)
            .size()
            .sort_values(ascending=False)
            .head(10)
            .items()
        )
    ]
    ev["rangeBand"] = pd.cut(
        _numeric(ev["Electric Range"]).fillna(0),
        bins=[-np.inf, 0, 50, 100, 200, 300, np.inf],
        labels=["Bilinmiyor", "1–50", "51–100", "101–200", "201–300", "301+"],
    )
    range_bands = [
        {"band": str(band), "count": int(count)}
        for band, count in ev["rangeBand"].value_counts(sort=False).items()
    ]
    ev["powertrain"] = np.where(ev["isBev"], "BEV", "PHEV")
    range_by_powertrain = [
        {
            "type": str(row.powertrain),
            "knownCount": int(row.knownCount),
            "knownShare": round(float(row.knownCount / row.totalCount * 100), 1),
            "medianRange": round(float(row.medianRange), 1),
            "averageRange": round(float(row.averageRange), 1),
        }
        for row in (
            ev.groupby("powertrain", observed=True)
            .agg(
                totalCount=("powertrain", "size"),
                knownCount=("rangeKnown", "count"),
                medianRange=("rangeKnown", "median"),
                averageRange=("rangeKnown", "mean"),
            )
            .reset_index()
            .itertuples()
        )
    ]
    range_by_brand_frame = (
        ev.groupby("Make", observed=True)
        .agg(
            totalCount=("Make", "size"),
            knownCount=("rangeKnown", "count"),
            medianRange=("rangeKnown", "median"),
        )
        .reset_index()
    )
    range_by_brand_frame = range_by_brand_frame.loc[
        range_by_brand_frame["knownCount"].ge(100)
    ].sort_values("totalCount", ascending=False).head(10)
    range_by_brand = [
        {
            "make": str(row.Make),
            "knownCount": int(row.knownCount),
            "knownShare": round(float(row.knownCount / row.totalCount * 100), 1),
            "medianRange": round(float(row.medianRange), 1),
        }
        for row in range_by_brand_frame.itertuples()
    ]
    quality = {
        "totalRows": int(len(ev)),
        "knownRangeRows": int(ev["rangeKnown"].notna().sum()),
        "knownRangeShare": round(float(ev["rangeKnown"].notna().mean() * 100), 1),
        "medianKnownRange": round(float(ev["rangeKnown"].median()), 1),
        "missingLocationRows": int(ev["Vehicle Location"].isna().sum()),
        "zipCount": int(ev["zipCode"].nunique()),
        "cityCount": int(ev["City"].nunique()),
        "countyCount": int(ev["County"].nunique()),
    }
    regions["bevVehicles"] = regions["bevVehicles"].astype(int)
    regions["phevVehicles"] = regions["vehicles"] - regions["bevVehicles"]
    return (
        regions, trend, powertrain, brands, models, range_bands,
        range_by_powertrain, range_by_brand, quality,
    )


def _prepare_stations(stations: pd.DataFrame) -> pd.DataFrame:
    stations = stations.loc[
        stations["State"].eq("WA")
        & stations["Fuel Type Code"].eq("ELEC")
        & stations["Status Code"].eq(ACTIVE_STATUS)
        & stations["Access Code"].eq(PUBLIC_ACCESS)
    ].copy()
    stations["zipCode"] = _zip(stations["ZIP"])
    stations["level2Ports"] = _numeric(stations["EV Level2 EVSE Num"]).fillna(0)
    stations["dcFastPorts"] = _numeric(stations["EV DC Fast Count"]).fillna(0)
    stations["publicPorts"] = stations["level2Ports"] + stations["dcFastPorts"]
    stations["network"] = stations["EV Network"].fillna("Unknown")
    return stations


def _aggregate_stations(stations: pd.DataFrame) -> pd.DataFrame:
    stations = _prepare_stations(stations)
    return (
        stations.dropna(subset=["zipCode"])
        .groupby("zipCode", observed=True)
        .agg(
            chargingSites=("ID", "nunique"),
            level2Ports=("level2Ports", "sum"),
            dcFastPorts=("dcFastPorts", "sum"),
            publicPorts=("publicPorts", "sum"),
        )
        .reset_index()
    )


def _prepare_census(
    income: pd.DataFrame, units: pd.DataFrame, commuting: pd.DataFrame
) -> pd.DataFrame:
    for frame in (income, units, commuting):
        frame["zipCode"] = _zip(frame["NAME"])

    income = income[["zipCode", "B19013_001E"]].rename(
        columns={"B19013_001E": "medianIncome"}
    )
    income["medianIncome"] = _numeric(income["medianIncome"]).where(
        lambda values: values >= 0
    )

    multiunit_columns = [f"B25024_{number:03d}E" for number in range(4, 10)]
    units["housingUnits"] = _numeric(units["B25024_001E"])
    units["multiunitHousing"] = units[multiunit_columns].apply(
        pd.to_numeric, errors="coerce"
    ).sum(axis=1)
    units["multifamilyShare"] = (
        units["multiunitHousing"] / units["housingUnits"].replace(0, np.nan) * 100
    )
    units = units[["zipCode", "housingUnits", "multifamilyShare"]]

    commuting = commuting[
        ["zipCode", "S0801_C01_013E", "S0801_C01_045E", "S0801_C01_046E"]
    ].rename(
        columns={
            "S0801_C01_013E": "workFromHomeShare",
            "S0801_C01_045E": "longCommuteShare",
            "S0801_C01_046E": "avgCommuteMinutes",
        }
    )
    for column in ["workFromHomeShare", "longCommuteShare", "avgCommuteMinutes"]:
        commuting[column] = _numeric(commuting[column]).where(lambda values: values >= 0)

    return income.merge(units, on="zipCode", how="outer").merge(
        commuting, on="zipCode", how="outer"
    )


def _coverage(regions: pd.DataFrame) -> pd.DataFrame:
    regions = regions.copy()
    regions["portsPer1kVehicles"] = (
        regions["publicPorts"] / regions["vehicles"] * 1000
    )
    regions["evPerPort"] = regions["vehicles"] / regions["publicPorts"].replace(0, np.nan)

    statewide_ports_per_1k = regions["publicPorts"].sum() / regions["vehicles"].sum() * 1000
    regions["coverageStatus"] = "Eyalet ortalamasının altında"
    regions.loc[
        regions["portsPer1kVehicles"].ge(statewide_ports_per_1k), "coverageStatus"
    ] = (
        "Eyalet ortalamasının üzerinde"
    )
    regions.loc[regions["publicPorts"].eq(0), "coverageStatus"] = "Kamuya açık port yok"

    def note(row: pd.Series) -> str:
        if row["publicPorts"] == 0:
            return "Bu ZIP içinde aktif ve kamuya açık Level 2 veya DC hızlı port bulunmuyor."
        if row["dcFastPorts"] == 0:
            return "Kamuya açık şarj var, ancak DC hızlı port bulunmuyor."
        return "Bu ZIP içinde hem Level 2 hem de DC hızlı şarj kapasitesi bulunuyor."

    regions["coverageNote"] = regions.apply(note, axis=1)
    regions["evPer1kHousing"] = (
        regions["vehicles"] / regions["housingUnits"].replace(0, np.nan) * 1000
    )
    regions["coverageOrder"] = regions["coverageStatus"].map(
        {
            "Kamuya açık port yok": 2,
            "Eyalet ortalamasının altında": 1,
            "Eyalet ortalamasının üzerinde": 0,
        }
    )
    return regions


def _correlation_rows(regions: pd.DataFrame) -> tuple[list[dict], list[dict], list[dict]]:
    definitions = [
        ("Medyan gelir", "medianIncome", "1.000 konut başına EV", "evPer1kHousing"),
        ("Çok birimli konut oranı", "multifamilyShare", "1.000 konut başına EV", "evPer1kHousing"),
        ("Evden çalışma oranı", "workFromHomeShare", "1.000 konut başına EV", "evPer1kHousing"),
        ("Ortalama işe gidiş süresi", "avgCommuteMinutes", "1.000 konut başına EV", "evPer1kHousing"),
    ]
    correlations: list[dict] = []
    for left_label, left, right_label, right in definitions:
        sample = regions[[left, right]].dropna().copy()
        sample = sample.loc[sample[right] <= sample[right].quantile(0.99)]
        correlations.append(
            {
                "left": left_label,
                "right": right_label,
                "value": round(float(sample[left].corr(sample[right], method="spearman")), 2),
                "sampleSize": int(len(sample)),
            }
        )

    income_sample = regions.dropna(subset=["medianIncome", "evPer1kHousing"]).copy()
    income_sample = income_sample.loc[
        income_sample["evPer1kHousing"] <= income_sample["evPer1kHousing"].quantile(0.99)
    ]
    income_sample["group"] = pd.qcut(
        income_sample["medianIncome"],
        4,
        labels=["Düşük", "Orta-alt", "Orta-üst", "Yüksek"],
    )
    income_groups = [
        {
            "group": str(row.group),
            "zipCount": int(row.zipCount),
            "medianIncome": round(float(row.medianIncome)),
            "medianEvPer1kHousing": round(float(row.medianEvPer1kHousing), 1),
        }
        for row in (
            income_sample.groupby("group", observed=True)
            .agg(
                zipCount=("zipCode", "size"),
                medianIncome=("medianIncome", "median"),
                medianEvPer1kHousing=("evPer1kHousing", "median"),
            )
            .reset_index()
            .itertuples()
        )
    ]
    scatter = [
        {
            "zipCode": str(row.zipCode),
            "city": str(row.city),
            "medianIncome": round(float(row.medianIncome)),
            "evPer1kHousing": round(float(row.evPer1kHousing), 1),
        }
        for row in income_sample.itertuples()
    ]
    return correlations, income_groups, scatter


def _station_charts(stations: pd.DataFrame) -> tuple[list[dict], list[dict], dict]:
    active = _prepare_stations(stations)
    charging_mix = [
        {"type": "Level 2", "count": int(active["level2Ports"].sum())},
        {"type": "DC Fast", "count": int(active["dcFastPorts"].sum())},
    ]
    network_frame = (
        active.groupby("network", observed=True)
        .agg(sites=("ID", "nunique"), ports=("publicPorts", "sum"))
        .reset_index()
        .sort_values(["sites", "ports"], ascending=False)
        .head(10)
    )
    networks = [
        {"network": str(row.network), "sites": int(row.sites), "ports": int(row.ports)}
        for row in network_frame.itertuples()
    ]
    updated = pd.to_datetime(active["Updated At"], errors="coerce", utc=True)
    station_quality = {
        "activePublicSites": int(active["ID"].nunique()),
        "stationZipCount": int(active["zipCode"].nunique()),
        "missingZipRows": int(active["zipCode"].isna().sum()),
        "missingCoordinateRows": int(
            (active["Latitude"].isna() | active["Longitude"].isna()).sum()
        ),
        "latestStationUpdate": updated.max().isoformat(),
    }
    return charging_mix, networks, station_quality


def _county_rows(regions: pd.DataFrame) -> list[dict]:
    counties = (
        regions.groupby("county", observed=True)
        .agg(
            vehicles=("vehicles", "sum"),
            chargingSites=("chargingSites", "sum"),
            publicPorts=("publicPorts", "sum"),
            dcFastPorts=("dcFastPorts", "sum"),
            medianIncome=("medianIncome", "median"),
            evPer1kHousing=("evPer1kHousing", "median"),
        )
        .reset_index()
    )
    counties["evPerPort"] = counties["vehicles"] / counties["publicPorts"].replace(0, np.nan)
    counties = counties.sort_values("vehicles", ascending=False).head(15)
    return [
        {
            "county": str(row.county),
            "vehicles": int(row.vehicles),
            "chargingSites": int(row.chargingSites),
            "publicPorts": int(row.publicPorts),
            "dcFastPorts": int(row.dcFastPorts),
            "evPerPort": None if pd.isna(row.evPerPort) else round(float(row.evPerPort), 1),
            "medianIncome": None if pd.isna(row.medianIncome) else round(float(row.medianIncome)),
            "evPer1kHousing": None if pd.isna(row.evPer1kHousing) else round(float(row.evPer1kHousing), 1),
        }
        for row in counties.itertuples()
    ]


def build_dashboard(settings: PipelineSettings) -> str:
    ev, stations, income, units, commuting = _load_sources(settings)
    (
        regions, trend, powertrain, brands, models, range_bands,
        range_by_powertrain, range_by_brand, ev_quality,
    ) = _aggregate_ev(ev)
    supply = _aggregate_stations(stations)
    census = _prepare_census(income, units, commuting)
    active_stations = _prepare_stations(stations)
    regions = regions.merge(supply, on="zipCode", how="left").merge(
        census, on="zipCode", how="left"
    )
    regions = regions.dropna(subset=["latitude", "longitude"]).copy()
    for column in ["chargingSites", "level2Ports", "dcFastPorts", "publicPorts"]:
        regions[column] = regions[column].fillna(0)
    regions = _coverage(regions)
    analysis, model_tables = build_models(regions)

    charging_mix, networks, station_quality = _station_charts(stations)
    counties = _county_rows(regions)
    correlations, income_groups, income_scatter = _correlation_rows(regions)
    total_vehicles = sum(item["count"] for item in powertrain)
    bev_count = next(item["count"] for item in powertrain if item["type"] == "BEV")
    level2_ports = int(active_stations["level2Ports"].sum())
    dc_fast_ports = int(active_stations["dcFastPorts"].sum())
    public_ports = level2_ports + dc_fast_ports

    region_fields = [
        "zipCode", "city", "county", "latitude", "longitude", "vehicles",
        "bevVehicles", "phevVehicles",
        "bevShare", "avgRange", "knownRangeShare", "chargingSites",
        "level2Ports", "dcFastPorts", "publicPorts", "portsPer1kVehicles",
        "evPerPort", "coverageStatus", "coverageNote", "medianIncome",
        "housingUnits", "multifamilyShare", "workFromHomeShare",
        "longCommuteShare", "avgCommuteMinutes", "evPer1kHousing",
    ]
    integer_fields = {
        "vehicles", "bevVehicles", "phevVehicles", "chargingSites",
        "level2Ports", "dcFastPorts", "publicPorts"
    }
    regions = regions.sort_values(
        ["coverageOrder", "vehicles", "evPerPort"],
        ascending=[False, False, False],
        na_position="last",
    )
    # Rebuild records in the same plain, rule-based order used in the table.
    region_records = []
    for record in regions[region_fields].to_dict("records"):
        clean = {}
        for key, value in record.items():
            if pd.isna(value):
                clean[key] = None
            elif key in integer_fields | {"housingUnits"}:
                clean[key] = int(value)
            elif isinstance(value, (float, np.floating)):
                clean[key] = round(float(value), 1)
            else:
                clean[key] = value
        region_records.append(clean)

    output = {
        "schemaVersion": "5.0",
        "metadata": {
            "mode": "live",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "geography": "Washington, ABD — ZIP düzeyi",
            "trendDefinition": "Mevcut EV kayıtlarının model yılına göre dağılımı",
            "stationDefinition": "2024 AFDC dosyasındaki aktif ve kamuya açık elektrik istasyonları",
            "caveats": [
                "Model yılı kayıt yılı değildir; grafik geçmiş yıllardaki EV kayıt sayısını göstermez.",
                "Electric Range değeri 0 olan kayıtlar menzil ortalamasına katılmadı.",
                "EV ve istasyon dosyaları farklı tarihlere ait olduğu için karşılaştırmalar betimseldir.",
                "Census ZCTA sınırları ile posta ZIP kodları birebir aynı değildir.",
                "Korelasyon neden-sonuç göstermez; oranlardaki üst yüzde 1 aykırı değer çıkarıldı.",
                "Trafik, şebeke kapasitesi, arsa uygunluğu ve kurulum maliyeti bu analizde yoktur.",
            ],
        },
        "summary": {
            "totalVehicles": total_vehicles,
            "bevShare": round(bev_count / total_vehicles * 100, 1),
            "chargingSites": int(active_stations["ID"].nunique()),
            "level2Ports": level2_ports,
            "dcFastPorts": dc_fast_ports,
            "publicPorts": public_ports,
            "evPerPort": round(total_vehicles / public_ports, 1),
            "zipsWithoutCharging": int(regions["publicPorts"].eq(0).sum()),
            "belowAverageChargingZips": int(
                regions["coverageStatus"].eq("Eyalet ortalamasının altında").sum()
            ),
            "censusMatchedZips": int(regions["housingUnits"].notna().sum()),
            "knownRangeShare": ev_quality["knownRangeShare"],
        },
        "vehicleTrend": trend,
        "powertrain": powertrain,
        "brands": brands,
        "models": models,
        "rangeBands": range_bands,
        "rangeByPowertrain": range_by_powertrain,
        "rangeByBrand": range_by_brand,
        "chargingMix": charging_mix,
        "networks": networks,
        "counties": counties,
        "correlations": correlations,
        "incomeGroups": income_groups,
        "incomeScatter": income_scatter,
        "analysis": analysis,
        "dataQuality": {
            **ev_quality,
            **station_quality,
            "censusMatchedZips": int(regions["housingUnits"].notna().sum()),
            "completeCensusZips": int(
                regions[["medianIncome", "housingUnits", "avgCommuteMinutes"]]
                .dropna()
                .shape[0]
            ),
        },
        "sources": [
            {
                "name": "Washington DOL Electric Vehicle Population Data",
                "period": "16 Temmuz 2026",
                "usage": "Araç kayıtları, marka/model, model yılı, menzil ve ZIP",
                "url": "https://data.wa.gov/Transportation/Electric-Vehicle-Population-Data/f6w7-q2d2/about_data",
            },
            {
                "name": "AFDC Alternative Fuel Stations",
                "period": pd.to_datetime(
                    active_stations["Updated At"], errors="coerce", utc=True
                ).max().date().isoformat(),
                "usage": "Aktif kamuya açık Level 2 ve DC hızlı portlar",
                "url": "https://developer.nrel.gov/docs/transportation/alt-fuel-stations-v1/all/",
            },
            {
                "name": "Census ACS 2024 5-Year",
                "period": "2024",
                "usage": "Gelir, konut yapısı ve işe gidiş göstergeleri",
                "url": "https://www.census.gov/data/developers/data-sets/acs-5year/2024.html",
            },
            {
                "name": "Census 2020 ZCTA Cartographic Boundary",
                "period": "2020 sınırları",
                "usage": "ZIP/ZCTA harita geometrileri",
                "url": "https://www.census.gov/geographies/mapping-files/2020/geo/carto-boundary-file.html",
            },
        ],
        "regions": region_records,
    }
    settings.processed_dir.mkdir(parents=True, exist_ok=True)
    destination = settings.processed_dir / "dashboard.json"
    with destination.open("w", encoding="utf-8") as target:
        json.dump(output, target, ensure_ascii=False, indent=2)
    export_model_workbooks(analysis, model_tables, settings.exports_dir)
    return str(destination)
