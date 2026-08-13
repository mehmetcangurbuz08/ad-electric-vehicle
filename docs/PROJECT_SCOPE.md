# Proje kapsamı ve analitik kararlar

## Yanıtlanacak iş sorusu

Washington'da yeni kamuya açık DC hızlı şarj kapasitesi için hangi ZIP Code'lar
önceliklendirilmeli ve bu önerinin temel nedenleri nelerdir?

Bir bölge yüksek araç talebine, yetersiz mevcut porta, uzun işe gidiş süresine
ve evde şarjı zorlaştıran çok birimli konut yoğunluğuna sahipse daha yüksek
öncelik alır. Sonuç bir “kesin yatırım kararı” değil, saha incelemesi için kısa
listedır.

## MVP çıktıları

1. Toplam EV, BEV/PHEV payı, kamuya açık port ve DC hızlı port KPI'ları.
2. Model yılı dağılımı ve pozitif menzil kayıtlarında ortalama menzil.
3. ZIP düzeyinde talep/arz haritası ve filtrelenebilir bölge tablosu.
4. K-Means ile bölge segmentleri.
5. 0–100 yatırım öncelik skoru ve her bölge için açıklanabilir öneri.

## Veri kaynakları

| Kaynak | Kullanım | Anahtar |
|---|---|---|
| Washington DOL Electric Vehicle Population Data | Araç, tip, model yılı, menzil ve ZIP | Gerekmiyor |
| NLR/AFDC Alternative Fuel Stations | İstasyon, Level 2 ve DC hızlı port arzı | `NREL_API_KEY` |
| Census ACS 2024 5-year B19013 | Medyan hane geliri | `CENSUS_API_KEY` |
| Census ACS 2024 5-year B25003/B25024 | Mülkiyet ve yapı tipi | `CENSUS_API_KEY` |
| Census ACS 2024 5-year S0801 | Ortalama işe gidiş süresi | `CENSUS_API_KEY` |

## Önemli metodoloji sınırları

- DOL dosyası mevcut kayıtların anlık görüntüsüdür. `Model Year`, kayıt tarihi
  değildir. Bu nedenle MVP grafiği “yıllara göre tarihsel EV benimsenmesi” diye
  sunulamaz; yalnızca mevcut filonun **model yılı dağılımı** olarak adlandırılır.
- Gerçek tarihsel büyüme ve üç yıllık tahmin için aylık DOL snapshot'ları veya
  kayıt tarihi içeren başka bir seri biriktirilmelidir.
- `Electric Range = 0` çoğunlukla bilinmeyen/değişen raporlama koşuludur; menzil
  ortalamasından dışlanır. Bu işlem dashboard'da belirtilir.
- `Base MSRP = 0` bilinmeyen değer kabul edilir. Gelir segmentini MSRP ile
  adlandırmak yerine ACS medyan geliri kullanılır.
- EV sayısı nüfusa bölünmeden yalnızca yoğunluk gösterir. Sonraki sürümde araç
  veya hane sayısına göre normalize edilmiş benimseme oranı eklenmelidir.
- Census ZCTA ile posta adresi ZIP Code aynı kavram değildir; birleşmeyen kayıtlar
  veri kalite metriği olarak raporlanmalıdır.
- K-Means kümeleri nedensellik göstermez. Öncelik skoru denetlenebilir bir
  sıralama aracıdır; elektrik şebekesi kapasitesi, trafik akışı, parsel uygunluğu
  ve maliyet verileri yatırım öncesi ayrıca incelenmelidir.

## Öncelik skoru (MVP)

Her bileşen ZIP'ler arasında 0–1 min-max ölçeklenir:

```text
priority = 100 × (
  0.35 × EV talebi
  + 0.25 × şarj açığı
  + 0.15 × çok birimli konut payı
  + 0.15 × işe gidiş süresi
  + 0.10 × son model araç payı
)
```

Şarj açığı, `EV / (kamuya açık port + 1)` üzerinden hesaplanır. Ağırlıklar ürün
kararıdır ve dashboard'da görünür tutulmalıdır; saha uzmanlarıyla kalibre edilir.

## Sonraki aşamalar

- Washington ZIP/ZCTA sınır GeoJSON'u ile gerçek choropleth harita.
- Aylık snapshot otomasyonu ve gerçek büyüme/forecast modeli.
- Trafik hacmi, şebeke kapasitesi, ticari parsel ve kurulum maliyeti katmanları.
- Model kartı, veri tazelik alarmı ve özellik katkısı açıklamaları.

