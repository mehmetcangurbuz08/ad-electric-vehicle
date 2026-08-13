from __future__ import annotations

import unittest

import pandas as pd

from data.pipeline.build import _aggregate_ev, _aggregate_stations, _coverage


class PipelineTransformTests(unittest.TestCase):
    def test_source_frames_produce_zip_level_demand_and_supply(self) -> None:
        ev = pd.DataFrame(
            [
                {
                    "State": "WA", "Postal Code": "98115.0",
                    "Electric Vehicle Type": "Battery Electric Vehicle (BEV)",
                    "Electric Range": 220, "Model Year": 2025,
                    "Vehicle Location": "POINT (-122.292 47.685)",
                    "City": "Seattle", "County": "King", "Make": "TEST",
                    "Model": "ONE", "DOL Vehicle ID": 1,
                },
                {
                    "State": "WA", "Postal Code": "98115",
                    "Electric Vehicle Type": "Plug-in Hybrid Electric Vehicle (PHEV)",
                    "Electric Range": 0, "Model Year": 2024,
                    "Vehicle Location": "POINT (-122.290 47.680)",
                    "City": "Seattle", "County": "King", "Make": "TEST",
                    "Model": "TWO", "DOL Vehicle ID": 2,
                },
            ]
        )
        station = pd.DataFrame(
            [{
                "State": "WA", "Fuel Type Code": "ELEC", "Status Code": "E",
                "Access Code": "public", "ZIP": "98115", "EV Level2 EVSE Num": 3,
                "EV DC Fast Count": 2, "ID": 1, "EV Network": "Test Network",
                "Updated At": "2024-12-01", "Latitude": 47.68, "Longitude": -122.29,
            }]
        )

        regions, trend, powertrain, _, _, quality = _aggregate_ev(ev)
        supply = _aggregate_stations(station)
        combined = regions.merge(supply, on="zipCode", how="left")
        combined["housingUnits"] = 100
        combined = _coverage(combined)

        self.assertEqual(regions.iloc[0]["vehicles"], 2)
        self.assertEqual(regions.iloc[0]["bevShare"], 50)
        self.assertEqual(regions.iloc[0]["avgRange"], 220)
        self.assertEqual(supply.iloc[0]["publicPorts"], 5)
        self.assertEqual(combined.iloc[0]["portsPer1kVehicles"], 2500)
        self.assertEqual(sum(item["count"] for item in powertrain), 2)
        self.assertEqual(quality["knownRangeRows"], 1)
        self.assertEqual(len(trend), 2)


if __name__ == "__main__":
    unittest.main()
