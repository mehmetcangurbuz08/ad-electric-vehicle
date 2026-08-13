# Dashboard veri sözleşmesi

`data/processed/dashboard.json`, veri pipeline'ı ile FastAPI arasındaki
versiyonlu sözleşmedir. Güncel sürüm `4.0`dır.

Ana bölümler:

- `metadata`: Üretim zamanı, veri tanımları ve metodoloji uyarıları.
- `summary`: EV, şarj sahası, port ve kapsama KPI'ları.
- `vehicleTrend`: Mevcut filonun model yılı dağılımı.
- `powertrain`, `brands`, `models`: Araç pazarı kırılımları.
- `rangeBands`, `rangeByPowertrain`, `rangeByBrand`: Dolu menzil alanlarından üretilen dağılımlar.
- `chargingMix`, `networks`: Şarj teknolojisi ve operatör kırılımları.
- `counties`: En büyük EV pazarlarında port kapsaması.
- `regions`: ZIP bazında EV, port ve Census göstergeleri.
- `correlations`, `incomeGroups`, `incomeScatter`: Census ilişki analizi.
- `dataQuality`: Eksik/kapalı alanlar ve kaynak kapsamı.
- `sources`: Her veri setinin adı, dönemi ve kullanım alanı.

Backend açılışta bu yapıyı Pydantic ile doğrular; sözleşmeye uymayan dosya
sessizce servis edilmez.
