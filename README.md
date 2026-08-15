# Washington EV Dashboard

A simple dashboard interface prepared for presentation use.

Data flow:

```text
data/raw/*.csv -> data/processed/dashboard.json -> FastAPI -> React
```

The pipeline also produces two analysis views:

- Multiple linear regression: explains EV density per 1,000 housing units using Census indicators.
- K-Means clustering: groups ZIP profiles by EV density, public charging density, and income.

The sidebar separates the dashboard into focused pages. Excel reports for the regression and clustering analyses are generated under `web/public/exports/`.

## Refresh Data

```powershell
python -m data.pipeline.cli build
python -m data.pipeline.build_map
```

The `build` command refreshes `data/processed/dashboard.json` and these export files:

```text
web/public/exports/regression_analysis.xlsx
web/public/exports/clustering_analysis.xlsx
```

## Run Locally

Backend:

```powershell
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8001
```

Frontend:

```powershell
cd web
$env:VITE_API_BASE_URL="http://127.0.0.1:8001/api/v1"
npm.cmd run dev
```

Open:

```text
http://localhost:5173
```

If frontend packages are missing, run `npm.cmd install` once inside `web`.
