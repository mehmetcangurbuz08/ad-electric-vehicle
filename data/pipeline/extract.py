from __future__ import annotations

import csv
from pathlib import Path

import pandas as pd
import requests

from data.pipeline.config import PipelineSettings


def _download(url: str, destination: Path, *, params: dict[str, str]) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, params=params, stream=True, timeout=180) as response:
        response.raise_for_status()
        with destination.open("wb") as output:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                output.write(chunk)


def _census_rows(
    url: str, variables: list[str], api_key: str
) -> pd.DataFrame:
    response = requests.get(
        url,
        params={
            "get": ",".join(["NAME", *variables]),
            "for": "zip code tabulation area:*",
            "key": api_key,
        },
        timeout=180,
    )
    response.raise_for_status()
    rows = response.json()
    return pd.DataFrame(rows[1:], columns=rows[0])


def fetch_sources(settings: PipelineSettings) -> list[Path]:
    if not settings.nrel_api_key:
        raise RuntimeError("NREL_API_KEY is required to fetch AFDC station data.")
    if not settings.census_api_key:
        raise RuntimeError("CENSUS_API_KEY is required to fetch ACS data.")

    ev_path = settings.raw_dir / "wa_ev_population.csv"
    stations_path = settings.raw_dir / "wa_charging_stations.csv"
    census_path = settings.raw_dir / "acs_zcta.csv"

    _download(settings.wa_ev_url, ev_path, params={})
    _download(
        settings.nrel_url,
        stations_path,
        params={
            "api_key": settings.nrel_api_key,
            "fuel_type": "ELEC",
            "state": "WA",
            "status": "E",
            "access": "public",
            "limit": "all",
        },
    )

    core_variables = [
        "B19013_001E",  # median household income
        "B25003_001E",  # occupied housing total
        "B25003_002E",  # owner occupied
        "B25024_001E",  # housing structures total
        *[f"B25024_{number:03d}E" for number in range(4, 10)],  # 2+ units
    ]
    core = _census_rows(
        settings.census_core_url, core_variables, settings.census_api_key
    )
    commute = _census_rows(
        settings.census_commute_url,
        ["S0801_C01_046E"],  # mean travel time to work
        settings.census_api_key,
    )
    zcta_column = "zip code tabulation area"
    core.merge(
        commute[[zcta_column, "S0801_C01_046E"]],
        on=zcta_column,
        how="left",
    ).to_csv(census_path, index=False, quoting=csv.QUOTE_MINIMAL)
    return [ev_path, stations_path, census_path]

