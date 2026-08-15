# Dashboard Data Contract

`data/processed/dashboard.json` is the versioned contract between the data pipeline and FastAPI. The current schema version is `5.0`.

Main sections:

- `metadata`: generation time, data definitions, and methodology caveats.
- `summary`: EV, charging site, port, and coverage KPIs.
- `vehicleTrend`: model year distribution of the current registered fleet.
- `powertrain`, `brands`, `models`: vehicle market breakdowns.
- `rangeBands`, `rangeByPowertrain`, `rangeByBrand`: range distributions from records with usable range values.
- `chargingMix`, `networks`: charging technology and operator breakdowns.
- `counties`: charging coverage for the largest county EV markets.
- `regions`: ZIP-level EV, charging, and Census indicators.
- `correlations`, `incomeGroups`, `incomeScatter`: Census relationship analysis.
- `analysis.regression`: cross-validated multiple linear regression metrics, coefficients, and ZIP predictions.
- `analysis.clustering`: K-Means selection, cluster profiles, and ZIP assignments.
- `dataQuality`: missing-field and source coverage counts.
- `sources`: data source names, periods, URLs, and usage descriptions.

The backend validates this structure with Pydantic at startup. A file that does not match the contract is not served silently.
