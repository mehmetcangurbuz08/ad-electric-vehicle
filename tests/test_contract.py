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
        self.assertEqual(self.dashboard.schema_version, "4.0")
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

    def test_range_and_source_sections_are_present(self) -> None:
        self.assertEqual(sum(item.count for item in self.dashboard.range_bands), self.dashboard.summary.total_vehicles)
        self.assertEqual(len(self.dashboard.range_by_powertrain), 2)
        self.assertEqual(len(self.dashboard.sources), 4)

    def test_zcta_map_matches_dashboard_regions(self) -> None:
        import json

        map_path = PROJECT_ROOT / "web" / "public" / "data" / "wa_zcta.geojson"
        geometry = json.loads(map_path.read_text(encoding="utf-8"))
        mapped_zips = {feature["properties"]["zipCode"] for feature in geometry["features"]}
        dashboard_zips = {region.zip_code for region in self.dashboard.regions}
        self.assertGreater(len(mapped_zips), 500)
        self.assertTrue(mapped_zips.issubset(dashboard_zips))


if __name__ == "__main__":
    unittest.main()
