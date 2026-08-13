# Dashboard veri sözleşmesi

`data/processed/dashboard.json`, veri katmanı ile backend arasındaki versiyonlu
sözleşmedir. Backend açılışta dosyayı doğrular; uyumsuz çıktı sessizce sunulmaz.

Üst alanlar:

- `schemaVersion`: Bu sözleşmenin sürümü.
- `metadata`: Üretim zamanı, veri modu ve kaynak açıklamaları.
- `summary`: Dashboard KPI'ları.
- `vehicleTrend`: Mevcut filonun model yılı dağılımı.
- `powertrain`: BEV/PHEV adetleri.
- `brands`: En yaygın üreticiler.
- `regions`: ZIP düzeyinde özellikler, küme ve öncelik skoru.

`metadata.mode` değeri `demo` ise ekrandaki rakamlar sunum tasarımı içindir ve
analitik sonuç olarak kullanılamaz. Pipeline çalışınca değer `live` olur.

