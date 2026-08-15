from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class PipelineSettings:
    raw_dir: Path = PROJECT_ROOT / "data" / "raw"
    processed_dir: Path = PROJECT_ROOT / "data" / "processed"
    models_dir: Path = PROJECT_ROOT / "data" / "models"
    exports_dir: Path = PROJECT_ROOT / "web" / "public" / "exports"
    wa_ev_url: str = (
        "https://data.wa.gov/api/v3/views/f6w7-q2d2/export.csv?accessType=DOWNLOAD"
    )
    nrel_url: str = "https://developer.nrel.gov/api/alt-fuel-stations/v1.csv"
    census_core_url: str = "https://api.census.gov/data/2024/acs/acs5"
    census_commute_url: str = (
        "https://api.census.gov/data/2024/acs/acs5/subject"
    )
    nrel_api_key: str | None = os.getenv("NREL_API_KEY")
    census_api_key: str | None = os.getenv("CENSUS_API_KEY")


settings = PipelineSettings()
