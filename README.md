# Washington Electric Vehicle Dashboard

This project analyzes electric vehicle adoption and public charging infrastructure in Washington State. It combines raw vehicle registration data, AFDC charging station data, and 2024 Census ACS indicators at the ZIP/ZCTA level, then presents the results in a simple dashboard for project presentation and decision support.

The main question is:

```text
Where is EV demand concentrated, how well is public charging distributed,
and which regional factors are associated with EV adoption?
```

## Data Flow

```text
data/raw/*.csv
  -> Python pipeline
  -> data/processed/dashboard.json
  -> FastAPI backend
  -> React dashboard
```

The raw data includes:

- Washington EV registration records: vehicle type, make, model, model year, range, city, county, and ZIP code.
- AFDC charging station records: public charging locations, networks, Level 2 ports, and DC fast ports.
- Census ACS 2024 income data: median household income by ZIP/ZCTA.
- Census ACS 2024 housing data: housing units and multifamily housing share.
- Census ACS 2024 commuting data: work-from-home share, long commute share, and average commute time.

## Dashboard

The dashboard converts separate CSV files into readable ZIP-level views:

- Map: EV count and public charging coverage by ZIP/ZCTA.
- Vehicles: fleet composition, model year distribution, makes, models, and range indicators.
- Charging: Level 2 vs. DC fast charging capacity and major charging networks.
- Census: relationships between EV density and income, housing, and commute indicators.
- Tables: ZIP and county comparison tables.
- Regression: multiple linear regression analysis.
- Clusters: K-Means regional profiles.
- Conclusion: summarized findings and investment signals.

## Regression Analysis

The regression model estimates regional EV density using Census indicators.

The dependent variable is:

```text
Y = registered EVs per 1,000 housing units
```

This normalization is used because ZIP areas have different population and housing sizes. Total EV count alone would make large ZIP areas dominate the analysis.

The independent variables are:

```text
median household income
multifamily housing share
work-from-home share
average commute time
```

The model is a multiple linear regression with standardized inputs:

```text
Y_hat = beta_0
      + beta_1 * z(median income)
      + beta_2 * z(multifamily housing share)
      + beta_3 * z(work-from-home share)
      + beta_4 * z(average commute time)
```

where:

```text
z(x) = (x - mean(x)) / standard_deviation(x)
```

Standardization puts all input variables on the same scale, so the coefficients can be compared more fairly.

Before modeling, the pipeline:

- removes rows with missing required fields,
- removes the top 1% EV-density outliers,
- standardizes input variables with `StandardScaler`,
- evaluates the model with 5-fold cross-validation.

The validation process uses out-of-fold predictions: each ZIP/ZCTA is predicted once while it is outside the training fold. The dashboard reports R2, MAE, RMSE, standardized coefficients, prediction scatter, and largest residuals.

Important interpretation:

```text
Regression shows statistical relationships, not causation.
```

For example, a positive income coefficient means higher-income areas tend to have higher EV density in this dataset. It does not prove that income alone causes EV adoption.

## Clustering Analysis

The clustering model groups ZIP/ZCTA regions into similar profiles.

The K-Means inputs are:

```text
EVs per 1,000 housing units
public charging ports per 1,000 housing units
median household income
```

EV density and charging density are transformed with:

```text
log(1 + x)
```

This reduces the effect of extremely large density values. After that, all inputs are standardized with z-scores.

K-Means assigns each ZIP/ZCTA to the nearest cluster center by minimizing:

```text
min sum_k sum_{x_i in C_k} || x_i - mu_k ||^2
```

where:

- `C_k` is cluster `k`,
- `mu_k` is the center of cluster `k`,
- `x_i` is a standardized ZIP/ZCTA feature vector.

The pipeline tests K values from 2 to 6 and selects the K with the highest silhouette score. The final dashboard shows the selected cluster count, silhouette score, cluster profiles, cluster map, and example ZIP areas in each cluster.

The clusters are used as infrastructure screening profiles, not final investment decisions. A final site decision would also require traffic volume, grid capacity, charger utilization, reliability, land cost, and local planning constraints.

## Run Locally

Backend:

```powershell
python -m uvicorn backend.app.main:app --reload
```

Frontend:

```powershell
cd web
npm.cmd run dev
```

Open:

```text
http://localhost:5173
```

If frontend packages are missing, run this once inside `web`:

```powershell
npm.cmd install
```

If Python packages are missing, install them with:

```powershell
pip install -r data/requirements.txt
```

## Refresh Data

```powershell
python -m data.pipeline.cli build
python -m data.pipeline.build_map
```

The build command refreshes:

```text
data/processed/dashboard.json
web/public/exports/regression_analysis.xlsx
web/public/exports/clustering_analysis.xlsx
```
