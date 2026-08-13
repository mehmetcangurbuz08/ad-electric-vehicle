from __future__ import annotations

import unittest

import pandas as pd

from data.pipeline.build import _aggregate_ev, _aggregate_stations, _prepare_census


class PipelineTransformTests(unittest.TestCase):
    def test_source_frames_produce_zip_level_features(self) -> None:
        ev = pd.DataFrame(
            [
                {
                    "State": "WA",
                    "Postal Code": "98115.0",
                    "Electric Vehicle Type": "Battery Electric Vehicle (BEV)",
                    "Electric Range": 220,
                    "Model Year": 2025,
                    "Vehicle Location": "POINT (-122.292 47.685)",
                    "City": "Seattle",
                    "County": "King",
                    "Make": "TEST",
                },
                {
                    "State": "WA",
                    "Postal Code": "98115",
                    "Electric Vehicle Type": "Plug-in Hybrid Electric Vehicle (PHEV)",
                    "Electric Range": 0,
                    "Model Year": 2024,
                    "Vehicle Location": "POINT (-122.290 47.680)",
                    "City": "Seattle",
                    "County": "King",
                    "Make": "TEST",
                },
            ]
        )
        station = pd.DataFrame(
            [{"ZIP": "98115", "EV Level2 EVSE Num": 3, "EV DC Fast Count": 2, "ID": 1}]
        )
        census = pd.DataFrame(
            [
                {
                    "zip code tabulation area": "98115",
                    "B19013_001E": 120000,
                    "B25003_001E": 100,
                    "B25003_002E": 60,
                    "B25024_001E": 100,
                    "B25024_004E": 5,
                    "B25024_005E": 5,
                    "B25024_006E": 5,
                    "B25024_007E": 5,
                    "B25024_008E": 5,
                    "B25024_009E": 5,
                    "S0801_C01_046E": 28.5,
                }
            ]
        )

        regions, trend, powertrain, _ = _aggregate_ev(ev)
        supply = _aggregate_stations(station)
        demographics = _prepare_census(census)

        self.assertEqual(regions.iloc[0]["vehicles"], 2)
        self.assertEqual(regions.iloc[0]["bevShare"], 50)
        self.assertEqual(regions.iloc[0]["avgRange"], 220)
        self.assertEqual(supply.iloc[0]["publicPorts"], 5)
        self.assertEqual(demographics.iloc[0]["multifamilyShare"], 30)
        self.assertEqual(sum(item["count"] for item in powertrain), 2)
        self.assertEqual(len(trend), 2)


if __name__ == "__main__":
    unittest.main()

