# Washington Elektrikli Araç Analizi

Washington eyaletindeki kayıtlı elektrikli araç talebi ile aktif, kamuya açık
şarj altyapısını ZIP seviyesinde karşılaştıran veri ürünü.

## Aktif kapsam

- Washington DOL EV Population: araç tipi, marka/model, model yılı, menzil ve ZIP.
- AFDC Alternative Fuel Stations 2024 snapshot: aktif, kamuya açık, elektrikli
  istasyonlar ile Level 2/DC hızlı port sayıları.
- 2024 Census ACS: medyan gelir, konut tipi ve işe gidiş göstergeleri.
- Census 2020 ZCTA sınırları: gerçek ZIP/ZCTA harita geometrileri.

Akış:

```text
data/raw/*.csv → data/pipeline → data/processed/dashboard.json → FastAPI → React
```

## Repo yapısı

```text
backend/          FastAPI ve versiyonlu veri sözleşmesi
data/pipeline/     Temizleme, filtreleme ve ZIP birleştirmesi
data/raw/          Kaynaktan indirilen, değiştirilmeyen CSV dosyaları
data/processed/    Dashboard'un okuduğu gerçek analitik çıktı
docs/              Kapsam ve metodoloji
tests/             Pipeline ve API sözleşme testleri
web/               React + TypeScript dashboard
```

## Gerçek çıktıyı yenileme

Beklenen dosyalar:

```text
data/raw/wa_ev_population.csv
data/raw/wa_fuel_station.csv
data/raw/wa_income.csv
data/raw/wa_units.csv
data/raw/wa_commuting.csv
data/raw/cb_2020_us_zcta520_500k.zip
```

```powershell
python -m pip install -r backend/requirements.txt -r data/requirements.txt
python -m data.pipeline.cli build
python -m data.pipeline.build_map
```

Pipeline, şarj dosyasına şu filtreyi uygular:

```text
State = WA
Fuel Type Code = ELEC
Status Code = E
Access Code = public
```

## Uygulamayı çalıştırma

```powershell
uvicorn backend.app.main:app --reload
```

İkinci terminalde:

```powershell
cd web
npm install
npm run dev
```

- Dashboard: <http://localhost:5173>
- API: <http://localhost:8000/api/v1/dashboard>
- API belgeleri: <http://localhost:8000/docs>

## Kontroller

```powershell
python -m unittest discover -s tests -v
python -m compileall backend data tests
cd web
npm run build
```

Hesaplamalar ve veri sınırları için [proje kapsamına](docs/PROJECT_SCOPE.md) bakın.
