from __future__ import annotations

import json
from pathlib import Path

from backend.app.models import Dashboard


class DashboardRepository:
    def __init__(self, data_path: Path) -> None:
        self._data_path = data_path

    def load(self) -> Dashboard:
        if not self._data_path.exists():
            raise FileNotFoundError(
                f"Dashboard data not found: {self._data_path}. "
                "Run `python -m data.pipeline.cli build`."
            )
        with self._data_path.open(encoding="utf-8") as source:
            return Dashboard.model_validate(json.load(source))

