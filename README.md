# Washington EV Dashboard

Sunumda gostermek icin hazirlanmis basit dashboard arayuzu.

Akis:

```text
data/raw/*.csv -> data/processed/dashboard.json -> FastAPI -> React
```

## Veriyi yenilemek gerekirse

```powershell
python -m data.pipeline.cli build
python -m data.pipeline.build_map
```

## Dashboard'u acmak

Birinci terminal:

```powershell
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8001
```

Ikinci terminal:

```powershell
cd web
$env:VITE_API_BASE_URL="http://127.0.0.1:8001/api/v1"
npm.cmd run dev
```

Tarayici:

```text
http://localhost:5173
```

Not: Paketler kurulu degilse `cd web` sonrasinda bir kere `npm.cmd install` calistirin.
