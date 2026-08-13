import { useEffect, useMemo, useState } from "react";
import { getDashboard } from "./api";
import type { Dashboard, Region } from "./types";

const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("tr-TR");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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
  const inset = 26;
  const max = Math.max(...data.map((point) => point.count));
  const points = data.map((point, index) => ({
    ...point,
    x: inset + (index / Math.max(data.length - 1, 1)) * (width - inset * 2),
    y: height - inset - (point.count / max) * (height - inset * 2),
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
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
          <line key={line} x1={inset} x2={width - inset} y1={height - inset - line * (height - inset * 2)} y2={height - inset - line * (height - inset * 2)} className="grid-line" />
        ))}
        <path d={area} fill="url(#area)" />
        <path d={path} className="trend-line" />
        {points.map((point) => (
          <g key={point.modelYear}>
            <circle cx={point.x} cy={point.y} r="4" />
            <text x={point.x} y={height - 5} textAnchor="middle">{String(point.modelYear).slice(2)}</text>
            <title>{point.modelYear}: {integer.format(point.count)} araç</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function WashingtonMap({ regions, selected, onSelect }: { regions: Region[]; selected: Region; onSelect: (region: Region) => void }) {
  const project = (longitude: number, latitude: number) => ({
    x: 32 + ((longitude + 125) / 8.3) * 576,
    y: 24 + ((49.1 - latitude) / 3.7) * 262,
  });
  return (
    <div className="map-wrap">
      <svg viewBox="0 0 640 320" role="img" aria-label="Washington öncelik haritası">
        <path className="state" d="M33 30 L606 31 L598 238 L550 244 L505 278 L439 266 L394 288 L344 269 L288 286 L240 263 L192 279 L150 250 L100 258 L69 217 L56 165 L31 127 Z" />
        <path className="map-line" d="M55 184 C180 150 265 174 375 149 S520 148 594 116" />
        {regions.map((region) => {
          const point = project(region.longitude, region.latitude);
          const radius = 7 + (region.priorityScore / 100) * 12;
          return (
            <g key={region.zipCode} className="map-point" onClick={() => onSelect(region)} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && onSelect(region)}>
              <circle cx={point.x} cy={point.y} r={radius + 5} className="pulse" />
              <circle cx={point.x} cy={point.y} r={radius} className={selected.zipCode === region.zipCode ? "selected" : ""} />
              <title>{region.city} · {region.priorityScore} öncelik</title>
            </g>
          );
        })}
      </svg>
      <div className="map-legend"><span /> Daire büyüklüğü yatırım önceliğini gösterir</div>
    </div>
  );
}

function RegionDetail({ region }: { region: Region }) {
  return (
    <aside className="region-detail">
      <div className="score-ring" style={{ "--score": `${region.priorityScore * 3.6}deg` } as React.CSSProperties}>
        <div><strong>{region.priorityScore}</strong><span>/100</span></div>
      </div>
      <div>
        <span className="eyebrow">{region.zipCode} · {region.county} County</span>
        <h3>{region.city}</h3>
        <p>{region.recommendation}</p>
      </div>
      <dl>
        <div><dt>EV</dt><dd>{integer.format(region.vehicles)}</dd></div>
        <div><dt>Kamu portu</dt><dd>{integer.format(region.publicPorts)}</dd></div>
        <div><dt>DC hızlı</dt><dd>{integer.format(region.dcFastPorts)}</dd></div>
        <div><dt>Medyan gelir</dt><dd>{region.medianIncome ? money.format(region.medianIncome) : "—"}</dd></div>
      </dl>
      <span className="segment">Küme {region.cluster + 1} · {region.segment}</span>
    </aside>
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

  if (error) return <main className="status"><div><span>API bağlantısı yok</span><h1>Dashboard yüklenemedi</h1><p>{error}</p><code>uvicorn backend.app.main:app --reload</code></div></main>;
  if (!dashboard || !selected) return <main className="status"><div className="loader" /><p>Karar modeli yükleniyor…</p></main>;

  const totalPowertrain = dashboard.powertrain.reduce((sum, item) => sum + item.count, 0);
  const maxBrand = Math.max(...dashboard.brands.map((brand) => brand.count));

  return (
    <div className="app-shell">
      <header>
        <div className="brand-mark"><span>EV</span><div>Infrastructure<strong>Intelligence</strong></div></div>
        <div className="header-meta">
          <span className={`mode ${dashboard.metadata.mode}`}>{dashboard.metadata.mode === "demo" ? "Demo veri" : "Canlı veri"}</span>
          <span>{dashboard.metadata.geography}</span>
        </div>
      </header>

      <main>
        <section className="hero">
          <div><span className="eyebrow">Washington · yatırım karar destek sistemi</span><h1>Şarj altyapısını<br /><em>talebin önüne</em> taşı.</h1></div>
          <p>EV yoğunluğu, şarj arzı, konut tipi ve ulaşım verilerini bir araya getirerek yatırım için en kritik bölgeleri sıralıyoruz.</p>
        </section>

        {dashboard.metadata.mode === "demo" && <div className="demo-banner"><strong>Gösterim modu</strong> Rakamlar arayüz ve veri sözleşmesini doğrulamak içindir; analitik bulgu değildir.</div>}

        <section className="kpi-grid">
          <Kpi label="Kayıtlı elektrikli araç" value={compact.format(dashboard.summary.totalVehicles)} note="BEV + PHEV mevcut filo" />
          <Kpi label="BEV payı" value={`%${dashboard.summary.bevShare}`} note="Tam elektrikli araç oranı" />
          <Kpi label="Kamuya açık port" value={compact.format(dashboard.summary.publicPorts)} note={`${integer.format(dashboard.summary.dcFastPorts)} DC hızlı port`} />
          <Kpi label="Yüksek öncelikli ZIP" value={String(dashboard.summary.priorityRegions)} note="Skoru 75 ve üzeri" />
        </section>

        <section className="dashboard-grid">
          <article className="card map-card">
            <div className="section-head"><div><span className="eyebrow">Coğrafi fırsat</span><h2>Talep / altyapı açığı</h2></div><span className="live-dot">Öncelik skoru</span></div>
            <div className="map-layout">
              <WashingtonMap regions={dashboard.regions} selected={selected} onSelect={(region) => setSelectedZip(region.zipCode)} />
              <RegionDetail region={selected} />
            </div>
          </article>

          <article className="card trend-card">
            <div className="section-head"><div><span className="eyebrow">Mevcut filo</span><h2>Model yılı dağılımı</h2></div><span className="method-tag">Kayıt trendi değildir</span></div>
            <TrendChart data={dashboard.vehicleTrend} />
            <p className="chart-note">DOL anlık görüntüsündeki araçların model yılları. Tarihsel benimsenme için aylık snapshot gerekir.</p>
          </article>

          <article className="card mix-card">
            <div className="section-head"><div><span className="eyebrow">Teknoloji karması</span><h2>BEV / PHEV</h2></div></div>
            <div className="donut" style={{ "--bev": `${dashboard.summary.bevShare * 3.6}deg` } as React.CSSProperties}>
              <div><strong>%{dashboard.summary.bevShare}</strong><span>BEV</span></div>
            </div>
            <div className="mix-legend">
              {dashboard.powertrain.map((item) => <div key={item.type}><span className={item.type.toLowerCase()} /><b>{item.type}</b><small>{integer.format(item.count)} · %{((item.count / totalPowertrain) * 100).toFixed(1)}</small></div>)}
            </div>
          </article>

          <article className="card brands-card">
            <div className="section-head"><div><span className="eyebrow">Pazar görünümü</span><h2>Öne çıkan markalar</h2></div></div>
            <div className="brand-bars">
              {dashboard.brands.map((brand) => <div key={brand.make}><span>{brand.make}</span><div><i style={{ width: `${(brand.count / maxBrand) * 100}%` }} /></div><strong>{compact.format(brand.count)}</strong></div>)}
            </div>
          </article>
        </section>

        <section className="card table-card">
          <div className="section-head"><div><span className="eyebrow">Eylem listesi</span><h2>Öncelikli yatırım bölgeleri</h2></div><span>En yüksek skordan sıralı</span></div>
          <div className="table-scroll"><table><thead><tr><th>Bölge</th><th>Segment</th><th>EV</th><th>Port / 1K EV</th><th>Çok birimli konut</th><th>İşe gidiş</th><th>Öncelik</th></tr></thead><tbody>
            {dashboard.regions.slice(0, 6).map((region) => <tr key={region.zipCode} onClick={() => setSelectedZip(region.zipCode)}><td><strong>{region.city}</strong><span>{region.zipCode}</span></td><td>{region.segment}</td><td>{integer.format(region.vehicles)}</td><td>{((region.publicPorts / region.vehicles) * 1000).toFixed(1)}</td><td>%{region.multifamilyShare?.toFixed(1) ?? "—"}</td><td>{region.avgCommuteMinutes?.toFixed(1) ?? "—"} dk</td><td><b className="score-pill">{region.priorityScore}</b></td></tr>)}
          </tbody></table></div>
        </section>
      </main>
      <footer><span>EV Infrastructure Intelligence · Schema v{dashboard.schemaVersion}</span><span>Üretim: {new Date(dashboard.metadata.generatedAt).toLocaleDateString("tr-TR")}</span></footer>
    </div>
  );
}

