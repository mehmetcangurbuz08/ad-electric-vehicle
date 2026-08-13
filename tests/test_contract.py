from __future__ import annotations

import unittest
from pathlib import Path

from backend.app.models import Dashboard
from backend.app.repository import DashboardRepository


PROJECT_ROOT = Path(__file__).resolve().parents[1]


class DashboardContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.dashboard = DashboardRepository(
            PROJECT_ROOT / "data" / "processed" / "dashboard.json"
        ).load()

    def test_demo_artifact_matches_contract(self) -> None:
        self.assertIsInstance(self.dashboard, Dashboard)
        self.assertEqual(self.dashboard.schema_version, "1.0")
        self.assertEqual(self.dashboard.metadata.mode, "demo")

    def test_summary_and_detail_are_consistent(self) -> None:
        powertrain_total = sum(item.count for item in self.dashboard.powertrain)
        self.assertEqual(powertrain_total, self.dashboard.summary.total_vehicles)
        self.assertGreater(len(self.dashboard.regions), 0)

    def test_regions_are_sorted_by_priority(self) -> None:
        scores = [region.priority_score for region in self.dashboard.regions]
        self.assertEqual(scores, sorted(scores, reverse=True))


if __name__ == "__main__":
    unittest.main()

