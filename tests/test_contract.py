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

    def test_live_artifact_matches_contract(self) -> None:
        self.assertIsInstance(self.dashboard, Dashboard)
        self.assertEqual(self.dashboard.schema_version, "3.0")
        self.assertEqual(self.dashboard.metadata.mode, "live")

    def test_summary_and_detail_are_consistent(self) -> None:
        powertrain_total = sum(item.count for item in self.dashboard.powertrain)
        self.assertEqual(powertrain_total, self.dashboard.summary.total_vehicles)
        self.assertGreater(len(self.dashboard.regions), 0)

    def test_uncovered_regions_are_listed_first_by_vehicle_count(self) -> None:
        uncovered = [
            region for region in self.dashboard.regions if region.public_ports == 0
        ]
        self.assertGreater(len(uncovered), 0)
        vehicles = [region.vehicles for region in uncovered]
        self.assertEqual(vehicles, sorted(vehicles, reverse=True))

    def test_census_analysis_is_present(self) -> None:
        self.assertGreater(self.dashboard.summary.census_matched_zips, 500)
        self.assertEqual(len(self.dashboard.income_groups), 4)
        self.assertEqual(len(self.dashboard.correlations), 4)

    def test_charging_summary_is_consistent(self) -> None:
        self.assertEqual(
            self.dashboard.summary.public_ports,
            self.dashboard.summary.level2_ports + self.dashboard.summary.dc_fast_ports,
        )


if __name__ == "__main__":
    unittest.main()
