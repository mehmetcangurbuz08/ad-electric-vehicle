import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getDashboard } from "./api";
import type { Dashboard, Region, ZctaFeatureCollection } from "./types";

type VehicleFilter = "ALL" | "BEV" | "PHEV";
type DashboardView = "map" | "vehicles" | "charging" | "census" | "tables" | "notes";

const compact = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("tr-TR");
const decimal = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const navItems: Array<{ id: DashboardView; label: string; title: string; description: string }> = [
  {
    id: "map",
    label: "Map",
    title: "Electric vehicle count and charging coverage",
    description: "Vehicle density, public charging port availability, and selected area details by ZIP code area.",
  },
  {
    id: "vehicles",
    label: "Vehicles",
    title: "Vehicle fleet and range distribution",
    description: "Model year distribution, battery electric / plug-in hybrid mix, make-model breakdown, and known electric range indicators.",
  },
  {
    id: "charging",
    label: "Şarj",
    title: "Şarj ağı ve kapasite",
    description: "Orta hızlı ve hızlı şarj portu karması, operatörler ve kapsama farkları.",
  },
  {
    id: "census",
    label: "Census",
    title: "Gelir, konut ve elektrikli araç yoğunluğu",
    description: "American Community Survey göstergeleri ile posta kodu düzeyinde elektrikli araç sahipliği arasındaki ilişki.",
  },
  {
    id: "tables",
    label: "Tablolar",
    title: "Posta kodu ve county karşılaştırmaları",
    description: "Filtrelenen bölgeler ve county pazar büyüklükleri için sunuma uygun tablolar.",
  },
  {
    id: "notes",
    label: "Kaynakça",
    title: "Kaynakça",
    description: "Dashboard'da kullanılan veri setleri.",
  },
];

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
      <svg className="trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Model year distribution">
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
            <title>{point.modelYear}: {integer.format(point.count)} vehicles</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function WashingtonMap({
  regions,
  boundaries,
  selected,
  activeZips,
  vehicleFilter,
  onSelect,
}: {
  regions: Region[];
  boundaries: ZctaFeatureCollection;
  selected: Region;
  activeZips: Set<string>;
  vehicleFilter: VehicleFilter;
  onSelect: (region: Region) => void;
}) {
  const byZip = new Map(regions.map((region) => [region.zipCode, region]));
  const selectedVehicles = (region: Region) => vehicleFilter === "BEV"
    ? region.bevVehicles
    : vehicleFilter === "PHEV"
      ? region.phevVehicles
      : region.vehicles;
  const project = ([longitude, latitude]: number[]) => [
    18 + ((longitude + 125) / 8.3) * 604,
    12 + ((49.1 - latitude) / 3.7) * 290,
  ];
  const polygonPath = (polygon: number[][][]) => polygon
    .map((ring) => ring.map((point, index) => {
      const [x, y] = project(point);
      return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ") + " Z")
    .join(" ");
  const geometryPath = (feature: ZctaFeatureCollection["features"][number]) => {
    if (feature.geometry.type === "Polygon") {
      return polygonPath(feature.geometry.coordinates as number[][][]);
    }
    return (feature.geometry.coordinates as number[][][][])
      .map((polygon) => polygonPath(polygon))
      .join(" ");
  };

  return (
    <div className="map-wrap">
      <svg viewBox="0 0 640 320" role="img" aria-label="Washington electric vehicle and charging coverage map">
        {boundaries.features.map((feature) => {
          const region = byZip.get(feature.properties.zipCode);
          if (!region) return null;
          const active = activeZips.has(region.zipCode);
          const className = region.publicPorts === 0
            ? "no-station"
            : region.coverageStatus === "Eyalet ortalamasının altında"
              ? "gap"
              : "covered";
          return (
            <path
              key={region.zipCode}
              d={geometryPath(feature)}
              fillRule="evenodd"
              className={`zcta ${className} ${active ? "active" : "muted"} ${selected.zipCode === region.zipCode ? "selected" : ""}`}
              onClick={() => onSelect(region)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => event.key === "Enter" && onSelect(region)}
            >
              <title>{region.city} {region.zipCode} · {integer.format(selectedVehicles(region))} electric vehicles · {region.publicPorts} ports</title>
            </path>
          );
        })}
      </svg>
      <div className="map-legend multi">
        <span className="legend-dot no-station" /> No public charging ports
        <span className="legend-dot gap" /> Below state average
        <span className="legend-dot covered" /> Above state average
        <span className="map-source">Census 2020 ZIP boundaries · {boundaries.features.length}/{regions.length} areas matched</span>
      </div>
    </div>
  );
}

function RegionDetail({ region, vehicleFilter }: { region: Region; vehicleFilter: VehicleFilter }) {
  const vehicleCount = vehicleFilter === "BEV"
    ? region.bevVehicles
    : vehicleFilter === "PHEV"
      ? region.phevVehicles
      : region.vehicles;
  const coverageStatus = region.publicPorts === 0
    ? "No public charging ports"
    : region.coverageStatus === "Eyalet ortalamasının altında"
      ? "Below state average"
      : "Above state average";
  return (
    <aside className="region-detail">
      <div className="region-count"><strong>{compact.format(vehicleCount)}</strong><span>{vehicleFilter === "ALL" ? "registered vehicles" : vehicleFilter === "BEV" ? "battery electric" : "plug-in hybrid"}</span></div>
      <div>
        <span className="eyebrow">{region.zipCode} · {region.county} County</span>
        <h3>{region.city}</h3>
        <p>{region.coverageNote}</p>
      </div>
      <dl>
        <div><dt>Registered electric vehicles</dt><dd>{integer.format(region.vehicles)}</dd></div>
        <div><dt>Charging sites</dt><dd>{integer.format(region.chargingSites)}</dd></div>
        <div><dt>Level 2 charging ports</dt><dd>{integer.format(region.level2Ports)}</dd></div>
        <div><dt>DC fast charging ports</dt><dd>{integer.format(region.dcFastPorts)}</dd></div>
        <div><dt>Ports per 1,000 vehicles</dt><dd>{decimal.format(region.portsPer1kVehicles)}</dd></div>
        <div><dt>Vehicles per port</dt><dd>{region.evPerPort === null ? "No ports" : decimal.format(region.evPerPort)}</dd></div>
        <div><dt>Vehicles per 1,000 housing units</dt><dd>{region.evPer1kHousing === null ? "—" : decimal.format(region.evPer1kHousing)}</dd></div>
        <div><dt>Median income</dt><dd>{region.medianIncome === null ? "—" : dollars.format(region.medianIncome)}</dd></div>
        <div><dt>Multifamily housing</dt><dd>{region.multifamilyShare === null ? "—" : `%${decimal.format(region.multifamilyShare)}`}</dd></div>
        <div><dt>Average commute</dt><dd>{region.avgCommuteMinutes === null ? "—" : `${decimal.format(region.avgCommuteMinutes)} min`}</dd></div>
      </dl>
      <span className="segment">{coverageStatus}</span>
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

function RangeBands({ rows }: { rows: Dashboard["rangeBands"] }) {
  const maximum = Math.max(...rows.map((row) => row.count));
  return (
    <div className="range-bars">
      {rows.map((row) => (
        <div key={row.band}>
          <span>{row.band === "Bilinmiyor" ? "Unknown" : `${row.band} miles`}</span>
          <div><i style={{ width: `${row.count / maximum * 100}%` }} /></div>
          <strong>{integer.format(row.count)}</strong>
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
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gelir ve konut başına elektrikli araç dağılımı">
        <line x1={left} x2={left} y1="12" y2={height - bottom} className="axis" />
        <line x1={left} x2={width - 12} y1={height - bottom} y2={height - bottom} className="axis" />
        {points.map((point) => (
          <circle key={point.zipCode} cx={x(point.medianIncome)} cy={y(point.evPer1kHousing)} r="3.2" className="scatter-point">
            <title>{point.city} {point.zipCode}: {dollars.format(point.medianIncome)} · {point.evPer1kHousing} elektrikli araç / 1.000 konut</title>
          </circle>
        ))}
        <text x={width / 2} y={height - 4} textAnchor="middle">Medyan hane geliri</text>
        <text transform={`translate(12 ${height / 2}) rotate(-90)`} textAnchor="middle">1.000 konut başına elektrikli araç</text>
      </svg>
    </div>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [boundaries, setBoundaries] = useState<ZctaFeatureCollection | null>(null);
  const [error, setError] = useState("");
  const [selectedZip, setSelectedZip] = useState("");
  const [county, setCounty] = useState("ALL");
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>("ALL");
  const [query, setQuery] = useState("");
  const [activeView, setActiveView] = useState<DashboardView>("map");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getDashboard(controller.signal),
      fetch("/data/wa_zcta.geojson", { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("ZIP sınır dosyası yüklenemedi.");
        return response.json() as Promise<ZctaFeatureCollection>;
      }),
    ])
      .then(([result, geojson]) => {
        setDashboard(result);
        setBoundaries(geojson);
        setSelectedZip(result.regions[0]?.zipCode ?? "");
      })
      .catch((reason: Error) => reason.name !== "AbortError" && setError(reason.message));
    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => dashboard?.regions.find((region) => region.zipCode === selectedZip) ?? dashboard?.regions[0],
    [dashboard, selectedZip],
  );
  const counties = useMemo(
    () => dashboard ? [...new Set(dashboard.regions.map((region) => region.county))].sort() : [],
    [dashboard],
  );
  const filteredRegions = useMemo(() => {
    if (!dashboard) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
    return dashboard.regions.filter((region) => {
      const count = vehicleFilter === "BEV"
        ? region.bevVehicles
        : vehicleFilter === "PHEV"
          ? region.phevVehicles
          : region.vehicles;
      const matchesText = !normalizedQuery || [region.zipCode, region.city, region.county]
        .some((value) => value.toLocaleLowerCase("tr-TR").includes(normalizedQuery));
      return count > 0 && (county === "ALL" || region.county === county) && matchesText;
    });
  }, [dashboard, county, query, vehicleFilter]);
  const activeZips = useMemo(
    () => new Set(filteredRegions.map((region) => region.zipCode)),
    [filteredRegions],
  );

  useEffect(() => {
    if (filteredRegions.length > 0 && !activeZips.has(selectedZip)) {
      setSelectedZip(filteredRegions[0].zipCode);
    }
  }, [activeZips, filteredRegions, selectedZip]);

  if (error) {
    return <main className="status"><div><span>API bağlantısı yok</span><h1>Dashboard yüklenemedi</h1><p>{error}</p><code>uvicorn backend.app.main:app --reload</code></div></main>;
  }
  if (!dashboard || !selected || !boundaries) {
    return <main className="status"><div className="loader" /><p>Gerçek veri hazırlanıyor…</p></main>;
  }

  const totalPowertrain = dashboard.powertrain.reduce((sum, item) => sum + item.count, 0);
  const level2Share = dashboard.summary.level2Ports / dashboard.summary.publicPorts * 100;
  const regionVehicleCount = (region: Region) => vehicleFilter === "BEV"
    ? region.bevVehicles
    : vehicleFilter === "PHEV"
      ? region.phevVehicles
      : region.vehicles;
  const activeNav = navItems.find((item) => item.id === activeView) ?? navItems[0];

  return (
    <div className={`dashboard-shell view-${activeView}`}>
      <aside className="sidebar">
        <div className="sidebar-title">Dashboard</div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={activeView === item.id ? "active" : ""}
              type="button"
              onClick={() => setActiveView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="app-shell">
      <main>
        <section className="page-title">
          <span className="eyebrow">Washington eyaleti</span>
          <h1>{activeNav.title}</h1>
          <p>{activeNav.description}</p>
        </section>
        <section className="hero">
          <div>
            <span className="eyebrow">Washington eyaleti</span>
            <h1>Elektrikli araçlar ve<br /><em>şarj istasyonları</em></h1>
          </div>
          <p>Washington Department of Licensing araç kayıtları, 2024 Alternative Fuels Data Center şarj istasyonları ve 2024 Census göstergelerinin posta kodu düzeyindeki özeti.</p>
        </section>

        <section className="dashboard-grid">
          <article className="card map-card">
            <div className="section-head">
              <div><span className="eyebrow">Geographic distribution</span><h2>Electric vehicle count and charging coverage</h2></div>
              <span className="live-dot">ZIP boundaries</span>
            </div>
            <div className="map-filters">
              <label>
                <span>County</span>
                <select value={county} onChange={(event) => setCounty(event.target.value)}>
                  <option value="ALL">All</option>
                  {counties.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>Vehicle type</span>
                <select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value as VehicleFilter)}>
                  <option value="ALL">All electric vehicles</option>
                  <option value="BEV">Battery electric vehicle</option>
                  <option value="PHEV">Plug-in hybrid electric vehicle</option>
                </select>
              </label>
              <label className="search-field">
                <span>ZIP or city</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. 98038 or Seattle" />
              </label>
              <div className="filter-count"><strong>{filteredRegions.length}</strong><span>areas</span></div>
            </div>
            <div className="map-layout">
              <WashingtonMap
                regions={dashboard.regions}
                boundaries={boundaries}
                selected={selected}
                activeZips={activeZips}
                vehicleFilter={vehicleFilter}
                onSelect={(region) => setSelectedZip(region.zipCode)}
              />
              <RegionDetail region={selected} vehicleFilter={vehicleFilter} />
            </div>
          </article>

          <article className="card trend-card">
            <div className="section-head">
              <div><span className="eyebrow">Current fleet</span><h2>Model year distribution</h2></div>
            </div>
            <TrendChart data={dashboard.vehicleTrend} />
            <p className="chart-note">This shows model years in the current registered fleet; it is not a historical registration trend.</p>
          </article>

          <article className="card mix-card">
            <div className="section-head"><div><span className="eyebrow">Vehicle technology</span><h2>Battery electric / plug-in hybrid mix</h2></div></div>
            <div className="donut" style={{ "--bev": `${dashboard.summary.bevShare * 3.6}deg` } as CSSProperties}>
              <div><strong>%{decimal.format(dashboard.summary.bevShare)}</strong><span>battery electric</span></div>
            </div>
            <div className="mix-legend">
              {dashboard.powertrain.map((item) => (
                <div key={item.type}>
                  <span className={item.type.toLowerCase()} />
                  <b>{item.type === "BEV" ? "Battery electric" : item.type === "PHEV" ? "Plug-in hybrid" : "Other"}</b>
                  <small>{integer.format(item.count)} · %{((item.count / totalPowertrain) * 100).toFixed(1)}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="card brands-card">
            <div className="section-head"><div><span className="eyebrow">Vehicle market</span><h2>Top makes</h2></div></div>
            <Bars rows={dashboard.brands} label="make" value="count" />
          </article>

          <article className="card brands-card">
            <div className="section-head"><div><span className="eyebrow">Vehicle market</span><h2>Top models</h2></div></div>
            <Bars rows={dashboard.models} label="model" value="count" />
          </article>

          <article className="card mix-card charging-card">
            <div className="section-head"><div><span className="eyebrow">Şarj teknolojisi</span><h2>Orta hızlı / hızlı şarj portları</h2></div></div>
            <div className="donut charging" style={{ "--bev": `${level2Share * 3.6}deg` } as CSSProperties}>
              <div><strong>{compact.format(dashboard.summary.publicPorts)}</strong><span>toplam port</span></div>
            </div>
            <div className="mix-legend">
              {dashboard.chargingMix.map((item) => (
                <div key={item.type}>
                  <span className={item.type === "DC Fast" ? "dc" : "level2"} />
                  <b>{item.type === "DC Fast" ? "Hızlı şarj" : "Orta hızlı şarj"}</b>
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

        <section className="range-grid">
          <article className="card range-card range-distribution">
            <div className="section-head">
              <div><span className="eyebrow">Recorded range</span><h2>Electric range distribution</h2></div>
            </div>
            <RangeBands rows={dashboard.rangeBands} />
            <p className="chart-note">Range comparisons use only records with a valid range value. Records with 0 or blank range are grouped as “Unknown”.</p>
          </article>

          <article className="card range-card">
            <div className="section-head"><div><span className="eyebrow">Vehicle type</span><h2>Battery electric and hybrid vehicle range</h2></div></div>
            <div className="range-summary">
              {dashboard.rangeByPowertrain.map((item) => (
                <div key={item.type}>
                  <span>{item.type === "BEV" ? "Battery electric" : "Plug-in hybrid"}</span>
                  <strong>{decimal.format(item.medianRange)} miles</strong>
                  <small>Median · {integer.format(item.knownCount)} records</small>
                </div>
              ))}
            </div>
          </article>

          <article className="card range-card range-brands">
            <div className="section-head">
              <div><span className="eyebrow">Make comparison</span><h2>Known median range</h2></div>
            </div>
            <div className="range-brand-list">
              {dashboard.rangeByBrand.map((item) => (
                <div key={item.make}>
                  <strong>{item.make}</strong>
                  <span>{decimal.format(item.medianRange)} miles</span>
                  <small>{integer.format(item.knownCount)} records</small>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="census-grid">
          <article className="card scatter-card">
            <div className="section-head">
              <div><span className="eyebrow">2024 Census</span><h2>Gelir ve konut başına elektrikli araç</h2></div>
              <span>Üst %1 aykırı değer hariç</span>
            </div>
            <IncomeScatter points={dashboard.incomeScatter} />
            <p className="chart-note">Her nokta bir posta kodu bölgesidir. Gelir yükseldikçe 1.000 konut başına kayıtlı elektrikli araç sayısı da genel olarak yükseliyor.</p>
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
            <div className="section-head"><div><span className="eyebrow">Gelir grupları</span><h2>Elektrikli araç yoğunluğu karşılaştırması</h2></div></div>
            <div className="income-groups">
              {dashboard.incomeGroups.map((group) => (
                <div key={group.group}>
                  <span>{group.group}</span>
                  <strong>{group.medianEvPer1kHousing}</strong>
                  <small>1.000 konut başına elektrikli araç</small>
                  <i>Medyan gelir {dollars.format(group.medianIncome)}</i>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="card table-card">
          <div className="section-head">
            <div><span className="eyebrow">Şarj kapsaması</span><h2>Filtrelenen posta kodu bölgeleri</h2></div>
            <span>Portu olmayan bölgeler önce gösterilir</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Bölge</th><th>Durum</th><th>Elektrikli araç</th><th>Şarj sahası</th><th>Orta hızlı port</th><th>Hızlı port</th><th>1.000 konut başına araç</th><th>Medyan gelir</th></tr></thead>
              <tbody>
                {filteredRegions.slice(0, 12).map((region) => (
                  <tr key={region.zipCode} onClick={() => setSelectedZip(region.zipCode)}>
                    <td><strong>{region.city}</strong><span>{region.zipCode} · {region.county}</span></td>
                    <td>{region.coverageStatus}</td>
                    <td>{integer.format(regionVehicleCount(region))}</td>
                    <td>{integer.format(region.chargingSites)}</td>
                    <td>{integer.format(region.level2Ports)}</td>
                    <td>{integer.format(region.dcFastPorts)}</td>
                    <td>{region.evPer1kHousing === null ? "—" : decimal.format(region.evPer1kHousing)}</td>
                    <td>{region.medianIncome === null ? "—" : dollars.format(region.medianIncome)}</td>
                  </tr>
                ))}
                {filteredRegions.length === 0 && (
                  <tr className="empty-row"><td colSpan={8}>Bu filtrelerle eşleşen posta kodu bölgesi bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card table-card county-card">
          <div className="section-head">
            <div><span className="eyebrow">County karşılaştırması</span><h2>En büyük 15 elektrikli araç pazarı</h2></div>
            <span>Elektrikli araç sayısına göre sıralı</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>County</th><th>Elektrikli araç</th><th>Şarj sahası</th><th>Toplam port</th><th>Hızlı port</th><th>Port başına araç</th><th>Medyan gelir</th></tr></thead>
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

        <section className="card sources-card">
          <div className="section-head">
            <div><h2>Kullanılan veri kaynakları</h2></div>
          </div>
          <div className="source-list">
            {dashboard.sources.map((source) => (
              <div key={source.name}>
                <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>
                <span>{source.period}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      </div>
    </div>
  );
}
