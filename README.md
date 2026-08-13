# EV Infrastructure Intelligence

Washington eyaletindeki elektrikli araç talebini, mevcut şarj altyapısını ve
sosyoekonomik göstergeleri ZIP Code düzeyinde birleştiren karar destek projesi.
Ana çıktı, yeni şarj yatırımları için açıklanabilir bir öncelik skoru ve bunu
sunan bir web dashboard'udur.

## Mimari

```text
ad-electric-vehicle/
├── backend/              # FastAPI: işlenmiş analitik çıktıyı sunar
├── data/                 # Kaynak indirme, temizleme, özellik üretimi, model
│   ├── raw/              # Git'e girmez; indirilen kaynak dosyalar
│   ├── interim/          # Ara çıktılar
│   ├── processed/        # Backend'in okuduğu sözleşmeli JSON
│   ├── models/           # Eğitilmiş model çıktıları
│   └── pipeline/         # Python veri hattı
├── web/                  # React + TypeScript dashboard
├── docs/                 # Kapsam, kararlar ve veri sözlüğü
└── tests/                # Katmanlar arası sözleşme testleri
```

Akış: **resmî kaynaklar → `data` pipeline → `dashboard.json` → FastAPI → web UI**.
Backend ham CSV okumaz; web de doğrudan veri kaynaklarına bağlanmaz.

## Hızlı başlangıç

Python 3.11+ ve Node.js 20.19+ (veya 22.12+) önerilir.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt -r data/requirements.txt
Copy-Item .env.example .env
uvicorn backend.app.main:app --reload
```

İkinci terminalde:

```powershell
cd web
npm install
npm run dev
```

- Dashboard: <http://localhost:5173>
- API dokümantasyonu: <http://localhost:8000/docs>
- Sağlık kontrolü: <http://localhost:8000/api/v1/health>

Repo, API anahtarları olmadan `data/processed/dashboard.json` içindeki açıkça
etiketlenmiş demo veriyle çalışır.

## Gerçek veriyi üretme

`.env` içine `NREL_API_KEY` ve `CENSUS_API_KEY` ekledikten sonra:

```powershell
python -m data.pipeline.cli fetch
python -m data.pipeline.cli build
```

İlk komut Washington DOL, AFDC/NLR ve ACS 2024 5-year kaynaklarını `data/raw/`
altına indirir. İkinci komut ZIP düzeyinde birleştirme, K-Means segmentasyonu ve
yatırım öncelik skorunu üretir.

## Kalite kontrolleri

```powershell
python -m unittest discover -s tests -v
python -m compileall backend data
cd web
npm run build
```

Analitik kararlar, veri kısıtları ve MVP kapsamı için [proje kapsamına](docs/PROJECT_SCOPE.md)
bakın.
