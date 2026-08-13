import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getDashboard } from "./api";
import type { Dashboard, Region } from "./types";

const compact = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("tr-TR");
const decimal = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="kpi card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function TrendChart({ data }: { data: Dashboard["vehicleTrend"] }) {
  const width = 760;
  const height = 250;
  const inset = 28;
  const max = Math.max(...data.map((point) => point.count));
  const points = data.map((point, index) => ({
    ...point,
    x: inset + (index / Math.max(data.length - 1, 1)) * (width - inset * 2),
    y: height - inset - (point.count / max) * (height - inset * 2),
  }));
  const path = points
    .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
    .join(" ");
  const area = `${path} L${points.at(-1)?.x},${height - inset} L${points[0]?.x},${height - inset} Z`;

  return (
    <div className="chart-wrap">
      <svg className="trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Model yılı dağılımı">
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#66f2ad" stopOpacity=".34" />
            <stop offset="1" stopColor="#66f2ad" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((line) => (
          <line
            key={line}
            x1={inset}
            x2={width - inset}
            y1={height - inset - line * (height - inset * 2)}
            y2={height - inset - line * (height - inset * 2)}
            className="grid-line"
          />
        ))}
        <path d={area} fill="url(#area)" />
        <path d={path} className="trend-line" />
        {points.map((point) => (
          <g key={point.modelYear}>
            <circle cx={point.x} cy={point.y} r="4" />
            <text x={point.x} y={height - 5} textAnchor="middle">
              {String(point.modelYear).slice(2)}
            </text>
            <title>{point.modelYear}: {integer.format(point.count)} araç</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function WashingtonMap({
  regions,
  selected,
  onSelect,
}: {
  regions: Region[];
  selected: Region;
  onSelect: (region: Region) => void;
}) {
  const visible = regions.filter((region) => region.vehicles >= 100);
  const project = (longitude: number, latitude: number) => ({
    x: 32 + ((longitude + 125) / 8.3) * 576,
    y: 24 + ((49.1 - latitude) / 3.7) * 262,
  });

  return (
    <div className="map-wrap">
      <svg viewBox="0 0 640 320" role="img" aria-label="Washington EV ve şarj kapsama haritası">
        <path className="state" d="M33 30 L606 31 L598 238 L550 244 L505 278 L439 266 L394 288 L344 269 L288 286 L240 263 L192 279 L150 250 L100 258 L69 217 L56 165 L31 127 Z" />
        <path className="map-line" d="M55 184 C180 150 265 174 375 149 S520 148 594 116" />
        {visible.map((region) => {
          const point = project(region.longitude, region.latitude);
          const radius = 3 + Math.sqrt(region.vehicles) / 11;
          const className = region.publicPorts === 0
            ? "no-station"
            : region.coverageStatus === "Eyalet ortalamasının altında"
              ? "gap"
              : "covered";
          return (
            <g
              key={region.zipCode}
              className="map-point"
              onClick={() => onSelect(region)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => event.key === "Enter" && onSelect(region)}
            >
              <circle cx={point.x} cy={point.y} r={radius + 4} className="pulse" />
              <circle
                cx={point.x}
                cy={point.y}
                r={radius}
                className={`${className} ${selected.zipCode === region.zipCode ? "selected" : ""}`}
              />
              <title>{region.city} {region.zipCode} · {integer.format(region.vehicles)} EV · {region.publicPorts} port</title>
            </g>
          );
        })}
      </svg>
      <div className="map-legend multi">
        <span className="legend-dot no-station" /> Kamuya açık port yok
        <span className="legend-dot gap" /> Eyalet ortalamasının altında
        <span className="legend-dot covered" /> Eyalet ortalamasının üzerinde
      </div>
    </div>
  );
}

function RegionDetail({ region }: { region: Region }) {
  return (
    <aside className="region-detail">
      <div className="region-count"><strong>{compact.format(region.vehicles)}</strong><span>kayıtlı EV</span></div>
      <div>
        <span className="eyebrow">{region.zipCode} · {region.county} County</span>
        <h3>{region.city}</h3>
        <p>{region.coverageNote}</p>
      </div>
      <dl>
        <div><dt>Kayıtlı EV</dt><dd>{integer.format(region.vehicles)}</dd></div>
        <div><dt>Şarj sahası</dt><dd>{integer.format(region.chargingSites)}</dd></div>
        <div><dt>Level 2 port</dt><dd>{integer.format(region.level2Ports)}</dd></div>
        <div><dt>DC hızlı port</dt><dd>{integer.format(region.dcFastPorts)}</dd></div>
        <div><dt>1.000 EV başına port</dt><dd>{decimal.format(region.portsPer1kVehicles)}</dd></div>
        <div><dt>Port başına EV</dt><dd>{region.evPerPort === null ? "Port yok" : decimal.format(region.evPerPort)}</dd></div>
        <div><dt>1.000 konut başına EV</dt><dd>{region.evPer1kHousing === null ? "—" : decimal.format(region.evPer1kHousing)}</dd></div>
        <div><dt>Medyan gelir</dt><dd>{region.medianIncome === null ? "—" : dollars.format(region.medianIncome)}</dd></div>
        <div><dt>Çok birimli konut</dt><dd>{region.multifamilyShare === null ? "—" : `%${decimal.format(region.multifamilyShare)}`}</dd></div>
        <div><dt>Ortalama işe gidiş</dt><dd>{region.avgCommuteMinutes === null ? "—" : `${decimal.format(region.avgCommuteMinutes)} dk`}</dd></div>
      </dl>
      <span className="segment">{region.coverageStatus}</span>
    </aside>
  );
}

function Bars({
  rows,
  label,
  value,
}: {
  rows: Array<Record<string, string | number>>;
  label: string;
  value: string;
}) {
  const maximum = Math.max(...rows.map((row) => Number(row[value])));
  return (
    <div className="brand-bars">
      {rows.map((row) => (
        <div key={String(row[label])}>
          <span title={String(row[label])}>{String(row[label])}</span>
          <div><i style={{ width: `${(Number(row[value]) / maximum) * 100}%` }} /></div>
          <strong>{compact.format(Number(row[value]))}</strong>
        </div>
      ))}
    </div>
  );
}

function IncomeScatter({ points }: { points: Dashboard["incomeScatter"] }) {
  const width = 640;
  const height = 290;
  const left = 48;
  const bottom = 34;
  const maxIncome = Math.max(...points.map((point) => point.medianIncome));
  const maxEv = Math.max(...points.map((point) => point.evPer1kHousing));
  const x = (value: number) => left + (value / maxIncome) * (width - left - 18);
  const y = (value: number) => height - bottom - (value / maxEv) * (height - bottom - 18);
  return (
    <div className="scatter-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gelir ve konut başına EV dağılımı">
        <line x1={left} x2={left} y1="12" y2={height - bottom} className="axis" />
        <line x1={left} x2={width - 12} y1={height - bottom} y2={height - bottom} className="axis" />
        {points.map((point) => (
          <circle key={point.zipCode} cx={x(point.medianIncome)} cy={y(point.evPer1kHousing)} r="3.2" className="scatter-point">
            <title>{point.city} {point.zipCode}: {dollars.format(point.medianIncome)} · {point.evPer1kHousing} EV/1K konut</title>
          </circle>
        ))}
        <text x={width / 2} y={height - 4} textAnchor="middle">Medyan hane geliri</text>
        <text transform={`translate(12 ${height / 2}) rotate(-90)`} textAnchor="middle">1.000 konut başına EV</text>
      </svg>
    </div>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [selectedZip, setSelectedZip] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getDashboard(controller.signal)
      .then((result) => {
        setDashboard(result);
        setSelectedZip(result.regions[0]?.zipCode ?? "");
      })
      .catch((reason: Error) => reason.name !== "AbortError" && setError(reason.message));
    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => dashboard?.regions.find((region) => region.zipCode === selectedZip) ?? dashboard?.regions[0],
    [dashboard, selectedZip],
  );

  if (error) {
    return <main className="status"><div><span>API bağlantısı yok</span><h1>Dashboard yüklenemedi</h1><p>{error}</p><code>uvicorn backend.app.main:app --reload</code></div></main>;
  }
  if (!dashboard || !selected) {
    return <main className="status"><div className="loader" /><p>Gerçek veri hazırlanıyor…</p></main>;
  }

  const totalPowertrain = dashboard.powertrain.reduce((sum, item) => sum + item.count, 0);
  const level2Share = dashboard.summary.level2Ports / dashboard.summary.publicPorts * 100;

  return (
    <div className="app-shell">
      <header>
        <div className="brand-mark"><span>EV</span><div>Washington<strong>Veri Analizi</strong></div></div>
        <div className="header-meta">
          <span className="mode live">Gerçek veri</span>
          <span>{dashboard.metadata.geography}</span>
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <span className="eyebrow">Washington eyaleti</span>
            <h1>Elektrikli araçlar ve<br /><em>şarj istasyonları</em></h1>
          </div>
          <p>DOL araç kayıtları, 2024 AFDC şarj istasyonları ve 2024 Census göstergelerinin ZIP düzeyindeki özeti.</p>
        </section>

        <div className="demo-banner source-banner">
          <strong>Kapsam</strong> Şarj toplamlarında yalnız Washington’daki aktif, kamuya açık elektrik istasyonları kullanıldı. Census sonuçları ilişki gösterir; neden-sonuç göstermez.
        </div>

        <section className="kpi-grid six">
          <Kpi label="Washington EV filosu" value={compact.format(dashboard.summary.totalVehicles)} note="BEV + PHEV kayıtları" />
          <Kpi label="BEV payı" value={`%${decimal.format(dashboard.summary.bevShare)}`} note="Tam elektrikli araç oranı" />
          <Kpi label="Aktif kamu şarj sahası" value={compact.format(dashboard.summary.chargingSites)} note="2024 AFDC anlık görüntüsü" />
          <Kpi label="Kamuya açık port" value={compact.format(dashboard.summary.publicPorts)} note={`${integer.format(dashboard.summary.dcFastPorts)} DC hızlı`} />
          <Kpi label="Port başına EV" value={decimal.format(dashboard.summary.evPerPort)} note="Eyalet geneli gösterge" />
          <Kpi label="Kamu portu olmayan ZIP" value={integer.format(dashboard.summary.zipsWithoutCharging)} note={`${dashboard.summary.belowAverageChargingZips} ZIP eyalet ortalamasının altında`} />
        </section>

        <section className="dashboard-grid">
          <article className="card map-card">
            <div className="section-head">
              <div><span className="eyebrow">Coğrafi dağılım</span><h2>EV sayısı ve şarj kapsaması</h2></div>
              <span className="live-dot">Daire büyüklüğü = EV sayısı</span>
            </div>
            <div className="map-layout">
              <WashingtonMap regions={dashboard.regions} selected={selected} onSelect={(region) => setSelectedZip(region.zipCode)} />
              <RegionDetail region={selected} />
            </div>
          </article>

          <article className="card trend-card">
            <div className="section-head">
              <div><span className="eyebrow">Mevcut filo</span><h2>Model yılı dağılımı</h2></div>
              <span className="method-tag">Kayıt trendi değildir</span>
            </div>
            <TrendChart data={dashboard.vehicleTrend} />
            <p className="chart-note">Mevcut kayıtlı filonun model yıllarıdır; geçmiş yıllardaki kayıt sayısını göstermez.</p>
          </article>

          <article className="card mix-card">
            <div className="section-head"><div><span className="eyebrow">Araç teknolojisi</span><h2>BEV / PHEV karması</h2></div></div>
            <div className="donut" style={{ "--bev": `${dashboard.summary.bevShare * 3.6}deg` } as CSSProperties}>
              <div><strong>%{decimal.format(dashboard.summary.bevShare)}</strong><span>BEV</span></div>
            </div>
            <div className="mix-legend">
              {dashboard.powertrain.map((item) => (
                <div key={item.type}>
                  <span className={item.type.toLowerCase()} />
                  <b>{item.type}</b>
                  <small>{integer.format(item.count)} · %{((item.count / totalPowertrain) * 100).toFixed(1)}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="card brands-card">
            <div className="section-head"><div><span className="eyebrow">Araç pazarı</span><h2>Öne çıkan markalar</h2></div></div>
            <Bars rows={dashboard.brands} label="make" value="count" />
          </article>

          <article className="card brands-card">
            <div className="section-head"><div><span className="eyebrow">Araç pazarı</span><h2>Öne çıkan modeller</h2></div></div>
            <Bars rows={dashboard.models} label="model" value="count" />
          </article>

          <article className="card mix-card charging-card">
            <div className="section-head"><div><span className="eyebrow">Şarj teknolojisi</span><h2>Level 2 / DC Fast</h2></div></div>
            <div className="donut charging" style={{ "--bev": `${level2Share * 3.6}deg` } as CSSProperties}>
              <div><strong>{compact.format(dashboard.summary.publicPorts)}</strong><span>toplam port</span></div>
            </div>
            <div className="mix-legend">
              {dashboard.chargingMix.map((item) => (
                <div key={item.type}>
                  <span className={item.type === "DC Fast" ? "dc" : "level2"} />
                  <b>{item.type}</b>
                  <small>{integer.format(item.count)} port</small>
                </div>
              ))}
            </div>
          </article>

          <article className="card brands-card">
            <div className="section-head"><div><span className="eyebrow">Şarj ağı</span><h2>En yaygın operatörler</h2></div><span>Saha sayısı</span></div>
            <Bars rows={dashboard.networks} label="network" value="sites" />
          </article>
        </section>

        <section className="census-grid">
          <article className="card scatter-card">
            <div className="section-head">
              <div><span className="eyebrow">2024 Census</span><h2>Gelir ve konut başına EV</h2></div>
              <span>Üst %1 aykırı değer hariç</span>
            </div>
            <IncomeScatter points={dashboard.incomeScatter} />
            <p className="chart-note">Her nokta bir ZIP/ZCTA eşleşmesidir. Gelir yükseldikçe 1.000 konut başına kayıtlı EV sayısı da genel olarak yükseliyor.</p>
          </article>

          <article className="card correlation-card">
            <div className="section-head"><div><span className="eyebrow">Spearman korelasyonu</span><h2>Değişkenler arasındaki ilişki</h2></div></div>
            <div className="correlation-list">
              {dashboard.correlations.map((item) => (
                <div key={item.left}>
                  <div><strong>{item.left}</strong><span>{item.right} · n={item.sampleSize}</span></div>
                  <b className={item.value >= 0.5 ? "strong" : item.value >= 0.3 ? "medium" : "weak"}>{item.value.toFixed(2)}</b>
                </div>
              ))}
            </div>
            <p className="chart-note">Pozitif değerler iki değişkenin birlikte artma eğilimini gösterir. Korelasyon nedensellik değildir.</p>
          </article>

          <article className="card income-card">
            <div className="section-head"><div><span className="eyebrow">Gelir grupları</span><h2>EV yoğunluğu karşılaştırması</h2></div></div>
            <div className="income-groups">
              {dashboard.incomeGroups.map((group) => (
                <div key={group.group}>
                  <span>{group.group}</span>
                  <strong>{group.medianEvPer1kHousing}</strong>
                  <small>1.000 konut başına EV</small>
                  <i>Medyan gelir {dollars.format(group.medianIncome)}</i>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="card table-card">
          <div className="section-head">
            <div><span className="eyebrow">Şarj kapsaması</span><h2>Kamuya açık port bulunmayan büyük EV bölgeleri</h2></div>
            <span>EV sayısına göre sıralı</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Bölge</th><th>Durum</th><th>EV</th><th>Saha</th><th>Level 2</th><th>DC Fast</th><th>EV / 1K konut</th><th>Medyan gelir</th></tr></thead>
              <tbody>
                {dashboard.regions.slice(0, 12).map((region) => (
                  <tr key={region.zipCode} onClick={() => setSelectedZip(region.zipCode)}>
                    <td><strong>{region.city}</strong><span>{region.zipCode} · {region.county}</span></td>
                    <td>{region.coverageStatus}</td>
                    <td>{integer.format(region.vehicles)}</td>
                    <td>{integer.format(region.chargingSites)}</td>
                    <td>{integer.format(region.level2Ports)}</td>
                    <td>{integer.format(region.dcFastPorts)}</td>
                    <td>{region.evPer1kHousing === null ? "—" : decimal.format(region.evPer1kHousing)}</td>
                    <td>{region.medianIncome === null ? "—" : dollars.format(region.medianIncome)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card table-card county-card">
          <div className="section-head">
            <div><span className="eyebrow">County karşılaştırması</span><h2>En büyük 15 EV pazarı</h2></div>
            <span>EV sayısına göre sıralı</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>County</th><th>EV</th><th>Şarj sahası</th><th>Toplam port</th><th>DC Fast</th><th>Port başına EV</th><th>Medyan gelir</th></tr></thead>
              <tbody>
                {dashboard.counties.map((county) => (
                  <tr key={county.county}>
                    <td><strong>{county.county}</strong></td>
                    <td>{integer.format(county.vehicles)}</td>
                    <td>{integer.format(county.chargingSites)}</td>
                    <td>{integer.format(county.publicPorts)}</td>
                    <td>{integer.format(county.dcFastPorts)}</td>
                    <td>{county.evPerPort === null ? "—" : decimal.format(county.evPerPort)}</td>
                    <td>{county.medianIncome === null ? "—" : dollars.format(county.medianIncome)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="quality-grid">
          <article className="card quality-card">
            <span className="eyebrow">Veri kalitesi</span><h2>Analizin sınırları görünür</h2>
            <div className="quality-stats">
              <div><strong>%{dashboard.dataQuality.knownRangeShare}</strong><span>Menzili bilinen EV kaydı</span></div>
              <div><strong>{dashboard.dataQuality.medianKnownRange} mil</strong><span>Bilinen menzillerin medyanı</span></div>
              <div><strong>{dashboard.dataQuality.zipCount}</strong><span>EV bulunan ZIP</span></div>
              <div><strong>{dashboard.dataQuality.stationZipCount}</strong><span>Aktif kamu şarjı bulunan ZIP</span></div>
              <div><strong>{dashboard.dataQuality.censusMatchedZips}</strong><span>Census ile eşleşen ZIP/ZCTA</span></div>
              <div><strong>{dashboard.dataQuality.completeCensusZips}</strong><span>Temel Census alanları tam bölge</span></div>
            </div>
          </article>
          <article className="card caveat-card">
            <span className="eyebrow">Notlar</span><h2>Sonuçları nasıl okumalıyız?</h2>
            <ul>{dashboard.metadata.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul>
          </article>
        </section>
      </main>

      <footer>
        <span>Washington Elektrikli Araç Analizi · Veri sözleşmesi v{dashboard.schemaVersion}</span>
        <span>AFDC son güncelleme: {new Date(dashboard.dataQuality.latestStationUpdate).toLocaleDateString("tr-TR")}</span>
      </footer>
    </div>
  );
}
