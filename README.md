# Washington EV Dashboard

Sunumda gostermek icin hazirlanmis basit dashboard arayuzu.

Akis:

```text
data/raw/*.csv -> data/processed/dashboard.json -> FastAPI -> React
```

Pipeline ayrıca iki ders modeli üretir:

- Çoklu doğrusal regresyon: Census göstergeleriyle 1.000 konut başına EV yoğunluğu.
- K-Means: EV yoğunluğu, kamu port yoğunluğu ve gelire göre ZIP profilleri.

Sol menüde her modelin ayrı analiz ekranı bulunur. Excel raporları grafik, formül,
yöntem ve filtrelenebilir sonuç tablolarıyla `web/public/exports/` altında üretilir.

## Veriyi yenilemek gerekirse

```powershell
python -m data.pipeline.cli build
python -m data.pipeline.build_map
```

`build` komutu dashboard JSON dosyasıyla birlikte şu raporları yeniler:

```text
web/public/exports/regression_analysis.xlsx
web/public/exports/clustering_analysis.xlsx
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

## Kontrol

```powershell
python -m unittest discover -s tests -v
cd web
npm.cmd run build
```
