# Project Scope

## Research Questions

- Where are registered electric vehicles concentrated in Washington?
- How are active public charging ports distributed relative to EV registrations?
- How are income, housing type, and commute indicators related to EV density?

## Data Sources

- Washington DOL Electric Vehicle Population Data
- AFDC Alternative Fuel Stations 2024 snapshot
- Census ACS 2024 5-Year B19013, B25024, and S0801 tables

Charging totals use only `WA + ELEC + active + public` records.

## Calculated Indicators

- Registered EVs, battery electric share, and known electric range by ZIP
- Active public charging sites, Level 2 ports, and DC fast ports
- Public ports per 1,000 EVs
- Registered EVs per 1,000 housing units
- Multifamily housing share
- Median household income
- Work-from-home share, long-commute share, and average commute time

Charging coverage is not an arbitrary score. It uses `ports per 1,000 EVs` and compares each ZIP to the statewide average. ZIPs with no public ports are shown separately.

## Correlation Analysis

ZIP/ZCTA-level relationships are calculated with Spearman rank correlation. To reduce distortion from very small geographies, the top 1% outliers in EVs per 1,000 housing units are removed from the correlation sample.

Correlation is not proof of causation. For example, even if income and EV density move in the same direction, this does not prove that income alone causes EV adoption.

## Limits

- `Model Year` is not a registration date.
- `Electric Range = 0` is treated as unknown.
- EV and AFDC files are not snapshots from the same date.
- Postal ZIP codes and Census ZCTAs are not identical geographies; only matching codes are analyzed together.
- Traffic, grid capacity, parcel suitability, and cost data are not included.
- Having ports in a ZIP does not guarantee that every user can access them.
