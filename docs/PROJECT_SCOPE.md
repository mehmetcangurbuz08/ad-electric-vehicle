# Proje kapsamı

## Araştırma soruları

- Washington'da kayıtlı elektrikli araçlar hangi bölgelerde yoğunlaşıyor?
- Aktif ve kamuya açık şarj portları EV kayıtlarına göre nasıl dağılıyor?
- Gelir, konut tipi ve işe gidiş göstergeleri EV yoğunluğuyla nasıl ilişkili?

## Kullanılan kaynaklar

- Washington DOL Electric Vehicle Population Data
- AFDC Alternative Fuel Stations 2024 snapshot
- Census ACS 2024 5-Year B19013, B25024 ve S0801 tabloları

Şarj toplamlarında yalnız `WA + ELEC + aktif + public` kayıtları kullanılır.

## Hesaplanan göstergeler

- ZIP başına kayıtlı EV, BEV oranı ve bilinen elektrikli menzil
- Aktif kamu şarj sahası, Level 2 ve DC hızlı port sayısı
- 1.000 EV başına kamu portu
- 1.000 konut başına kayıtlı EV
- Çok birimli konut payı
- Medyan hane geliri
- Evden çalışma, uzun işe gidiş ve ortalama işe gidiş süresi

Şarj kapsaması keyfi bir puanla değil, doğrudan `1.000 EV başına port` değeri ve
eyalet ortalamasıyla karşılaştırılır. Kamuya açık portu olmayan ZIP'ler ayrıca
gösterilir.

## Korelasyon analizi

ZIP/ZCTA düzeyindeki ilişkiler Spearman sıra korelasyonuyla hesaplanır. Çok küçük
coğrafyalardaki aşırı oranların sonucu bozmasını azaltmak için 1.000 konut başına
EV metriğinin üst yüzde 1'i korelasyon hesabından çıkarılır.

Korelasyon bir neden-sonuç kanıtı değildir. Örneğin gelir ile EV yoğunluğu aynı
yönde hareket etse bile gelirin tek başına EV alımına neden olduğu söylenemez.

## Sınırlar

- `Model Year`, kayıt tarihi değildir.
- `Electric Range = 0` bilinmeyen kabul edilir.
- EV ve AFDC dosyaları aynı tarihin snapshot'ı değildir.
- Posta ZIP kodu ile Census ZCTA aynı coğrafya değildir; yalnız eşleşen kodlar
  birlikte analiz edilir.
- Trafik, elektrik şebekesi kapasitesi, parsel uygunluğu ve maliyet verisi yoktur.
- Bir ZIP'te port bulunması, portun bütün kullanıcılar için erişilebilir olduğu
  anlamına gelmez.
