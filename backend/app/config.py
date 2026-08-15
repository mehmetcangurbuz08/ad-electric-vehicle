from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    app_name: str = "Washington Electric Vehicle Analysis API"
    api_prefix: str = "/api/v1"
    data_path: Path = PROJECT_ROOT / os.getenv(
        "EV_DATA_PATH", "data/processed/dashboard.json"
    )
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv(
            "BACKEND_CORS_ORIGINS", "http://localhost:5173"
        ).split(",")
        if origin.strip()
    )


settings = Settings()
