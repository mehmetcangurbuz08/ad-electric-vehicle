import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getDashboard } from "./api";
import type { Dashboard, Region, ZctaFeatureCollection } from "./types";

type VehicleFilter = "ALL" | "BEV" | "PHEV";
type DashboardView = "overview" | "map" | "vehicles" | "charging" | "census" | "tables" | "notes" | "regression" | "clustering";

const compact = new Intl.NumberFormat("tr-TR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("tr-TR");
const decimal = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const dashboardNavItems: Array<{ id: DashboardView; label: string; title: string; description: string }> = [
  {
    id: "overview",
    label: "Özet",
    title: "Genel Özet",
    description: "DOL araç kayıtları, AFDC şarj istasyonları ve 2024 Census göstergelerinin ZIP düzeyindeki özeti.",
  },
  {
    id: "map",
    label: "Harita",
    title: "EV sayısı ve şarj kapsaması",
    description: "ZIP/ZCTA sınırları üzerinde araç yoğunluğu, port varlığı ve seçili bölge detayları.",
  },
  {
    id: "vehicles",
    label: "Araçlar",
    title: "Araç filosu ve menzil dağılımı",
    description: "Model yılı, BEV/PHEV karması, marka-model kırılımı ve bilinen elektrikli menzil göstergeleri.",
  },
  {
    id: "charging",
    label: "Şarj",
    title: "Şarj ağı ve kapasite",
    description: "Level 2/DC Fast port karması, operatörler ve kapsama farkları.",
  },
  {
    id: "census",
    label: "Census",
    title: "Gelir, konut ve EV yoğunluğu",
    description: "ACS göstergeleri ile ZIP düzeyinde EV sahipliği arasındaki ilişki.",
  },
  {
    id: "tables",
    label: "Tablolar",
    title: "ZIP ve county karşılaştırmaları",
    description: "Filtrelenen bölgeler ve county pazar büyüklükleri için sunuma uygun tablolar.",
  },
  {
    id: "notes",
    label: "Kaynakça",
    title: "Kaynakça",
    description: "Dashboard'da kullanılan veri setleri.",
  },
];

const analysisNavItems: Array<{ id: DashboardView; label: string; title: string; description: string }> = [
  {
    id: "regression",
    label: "Regresyon",
    title: "Çoklu doğrusal regresyon",
    description: "Gelir, konut yapısı ve işe gidiş göstergelerinin ZIP düzeyindeki EV yoğunluğuyla ilişkisi.",
  },
  {
    id: "clustering",
    label: "Kümeler",
    title: "K-Means bölge profilleri",
    description: "EV yoğunluğu, kamu şarj portu yoğunluğu ve gelire göre benzer ZIP bölgeleri.",
  },
];

const navItems = [...dashboardNavItems, ...analysisNavItems];

const initialView = (): DashboardView => {
  const requested = new URLSearchParams(window.location.search).get("view") as DashboardView | null;
  return requested && navItems.some((item) => item.id === requested) ? requested : "overview";
};

const projectPoint = ([longitude, latitude]: number[]) => [
  18 + ((longitude + 125) / 8.3) * 604,
  12 + ((49.1 - latitude) / 3.7) * 290,
];

const polygonPath = (polygon: number[][][]) => polygon
  .map((ring) => ring.map((point, index) => {
    const [x, y] = projectPoint(point);
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
  return (
    <div className="map-wrap">
      <svg viewBox="0 0 640 320" role="img" aria-label="Washington EV ve şarj kapsama haritası">
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
              <title>{region.city} {region.zipCode} · {integer.format(selectedVehicles(region))} EV · {region.publicPorts} port</title>
            </path>
          );
        })}
      </svg>
      <div className="map-legend multi">
        <span className="legend-dot no-station" /> Kamuya açık port yok
        <span className="legend-dot gap" /> Eyalet ortalamasının altında
        <span className="legend-dot covered" /> Eyalet ortalamasının üzerinde
        <span className="map-source">Census 2020 ZCTA · {boundaries.features.length}/{regions.length} ZIP eşleşti</span>
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
  return (
    <aside className="region-detail">
      <div className="region-count"><strong>{compact.format(vehicleCount)}</strong><span>{vehicleFilter === "ALL" ? "kayıtlı EV" : vehicleFilter}</span></div>
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

function RangeBands({ rows }: { rows: Dashboard["rangeBands"] }) {
  const maximum = Math.max(...rows.map((row) => row.count));
  return (
    <div className="range-bars">
      {rows.map((row) => (
        <div key={row.band}>
          <span>{row.band === "Bilinmiyor" ? row.band : `${row.band} mil`}</span>
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

function AnalysisMetric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="analysis-metric card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function CoefficientChart({ rows }: { rows: Dashboard["analysis"]["regression"]["coefficients"] }) {
  const maximum = Math.max(...rows.map((row) => Math.abs(row.coefficient)));
  return (
    <div className="coefficient-chart">
      {rows.map((row) => (
        <div key={row.key}>
          <span>{row.label}</span>
          <div className="coefficient-track">
            <i
              className={row.coefficient >= 0 ? "positive" : "negative"}
              style={{ width: `${Math.abs(row.coefficient) / maximum * 100}%` }}
            />
          </div>
          <strong className={row.coefficient >= 0 ? "positive" : "negative"}>
            {row.coefficient > 0 ? "+" : ""}{decimal.format(row.coefficient)}
          </strong>
          <small>{row.interpretation}</small>
        </div>
      ))}
    </div>
  );
}

function PredictionScatter({ rows }: { rows: Dashboard["analysis"]["regression"]["predictions"] }) {
  const width = 720;
  const height = 350;
  const left = 52;
  const bottom = 42;
  const minimum = Math.min(0, ...rows.map((row) => row.predicted));
  const maximum = Math.max(...rows.flatMap((row) => [row.actual, row.predicted]));
  const x = (value: number) => left + ((value - minimum) / (maximum - minimum)) * (width - left - 20);
  const y = (value: number) => height - bottom - ((value - minimum) / (maximum - minimum)) * (height - bottom - 18);
  return (
    <div className="model-scatter">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gerçek ve tahmin edilen EV yoğunluğu">
        {[0, .25, .5, .75, 1].map((tick) => {
          const value = minimum + tick * (maximum - minimum);
          return (
            <g key={tick}>
              <line x1={x(value)} x2={x(value)} y1="14" y2={height - bottom} className="grid-line" />
              <line x1={left} x2={width - 16} y1={y(value)} y2={y(value)} className="grid-line" />
              <text x={x(value)} y={height - 19} textAnchor="middle">{Math.round(value)}</text>
              <text x={left - 8} y={y(value) + 3} textAnchor="end">{Math.round(value)}</text>
            </g>
          );
        })}
        <line x1={x(minimum)} y1={y(minimum)} x2={x(maximum)} y2={y(maximum)} className="identity-line" />
        {rows.map((row) => (
          <circle key={row.zipCode} cx={x(row.actual)} cy={y(row.predicted)} r="3" className="prediction-point">
            <title>{row.city} {row.zipCode} · Gerçek {decimal.format(row.actual)} · Tahmin {decimal.format(row.predicted)}</title>
          </circle>
        ))}
        <text x={width / 2} y={height - 2} textAnchor="middle">Gerçek EV / 1.000 konut</text>
        <text transform={`translate(13 ${height / 2}) rotate(-90)`} textAnchor="middle">Tahmin EV / 1.000 konut</text>
      </svg>
    </div>
  );
}

function ClusterSelectionChart({ rows, selectedK }: { rows: Dashboard["analysis"]["clustering"]["kEvaluation"]; selectedK: number }) {
  const width = 520;
  const height = 230;
  const inset = 34;
  const minimum = Math.min(...rows.map((row) => row.silhouette)) - .02;
  const maximum = Math.max(...rows.map((row) => row.silhouette)) + .02;
  const x = (index: number) => inset + index / Math.max(rows.length - 1, 1) * (width - inset * 2);
  const y = (value: number) => height - inset - (value - minimum) / (maximum - minimum) * (height - inset * 2);
  const path = rows.map((row, index) => `${index ? "L" : "M"}${x(index)},${y(row.silhouette)}`).join(" ");
  return (
    <div className="selection-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="K değerlerine göre silhouette score">
        <line x1={inset} x2={width - inset} y1={height - inset} y2={height - inset} className="axis" />
        <path d={path} className="selection-line" />
        {rows.map((row, index) => (
          <g key={row.k}>
            <circle cx={x(index)} cy={y(row.silhouette)} r={row.k === selectedK ? 7 : 5} className={row.k === selectedK ? "selected" : ""} />
            <text x={x(index)} y={height - 11} textAnchor="middle">K={row.k}</text>
            <text x={x(index)} y={y(row.silhouette) - 11} textAnchor="middle">{row.silhouette.toFixed(3)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function ClusterMap({ boundaries, analysis }: { boundaries: ZctaFeatureCollection; analysis: Dashboard["analysis"]["clustering"] }) {
  const assignments = new Map(analysis.assignments.map((row) => [row.zipCode, row]));
  const colors = new Map(analysis.clusters.map((row) => [row.clusterId, row.color]));
  return (
    <div className="cluster-map">
      <svg viewBox="0 0 640 320" role="img" aria-label="K-Means kümelerine göre Washington ZIP haritası">
        {boundaries.features.map((feature) => {
          const assignment = assignments.get(feature.properties.zipCode);
          return (
            <path
              key={feature.properties.zipCode}
              d={geometryPath(feature)}
              fillRule="evenodd"
              style={{ fill: assignment ? colors.get(assignment.clusterId) : "#dfe6ec" }}
              className={assignment ? "cluster-zcta assigned" : "cluster-zcta"}
            >
              <title>{assignment ? `${assignment.city} ${assignment.zipCode} · ${assignment.clusterLabel} · ${assignment.evPer1kHousing} EV/1K konut` : `${feature.properties.zipCode} · Model örnekleminde yok`}</title>
            </path>
          );
        })}
      </svg>
      <div className="cluster-legend">
        {analysis.clusters.map((cluster) => (
          <span key={cluster.clusterId}><i style={{ background: cluster.color }} />{cluster.label}</span>
        ))}
        <span><i className="unassigned" />Model dışında</span>
      </div>
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
  const [activeView, setActiveView] = useState<DashboardView>(initialView);

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
  const regression = dashboard.analysis.regression;
  const clustering = dashboard.analysis.clustering;
  const selectView = (view: DashboardView) => {
    setActiveView(view);
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState({}, "", url);
  };

  return (
    <div className={`dashboard-shell view-${activeView}`}>
      <aside className="sidebar">
        <div className="sidebar-title">Washington EV</div>
        <nav>
          <span className="nav-section">Dashboard</span>
          {dashboardNavItems.map((item) => (
            <button
              key={item.id}
              className={activeView === item.id ? "active" : ""}
              type="button"
              onClick={() => selectView(item.id)}
            >
              {item.label}
            </button>
          ))}
          <span className="nav-section analysis-label">Analizler</span>
          {analysisNavItems.map((item) => (
            <button
              key={item.id}
              className={activeView === item.id ? "active" : ""}
              type="button"
              onClick={() => selectView(item.id)}
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
              <span className="live-dot">ZIP/ZCTA sınırları</span>
            </div>
            <div className="map-filters">
              <label>
                <span>County</span>
                <select value={county} onChange={(event) => setCounty(event.target.value)}>
                  <option value="ALL">Tümü</option>
                  {counties.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label>
                <span>Araç tipi</span>
                <select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value as VehicleFilter)}>
                  <option value="ALL">BEV + PHEV</option>
                  <option value="BEV">BEV</option>
                  <option value="PHEV">PHEV</option>
                </select>
              </label>
              <label className="search-field">
                <span>ZIP veya şehir</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Örn. 98038 veya Seattle" />
              </label>
              <div className="filter-count"><strong>{filteredRegions.length}</strong><span>bölge</span></div>
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

        <section className="range-grid">
          <article className="card range-card range-distribution">
            <div className="section-head">
              <div><span className="eyebrow">Kayıtlardaki menzil</span><h2>Elektrikli menzil dağılımı</h2></div>
              <span>0 değeri bilinmiyor sayıldı</span>
            </div>
            <RangeBands rows={dashboard.rangeBands} />
            <p className="chart-note">Karşılaştırmalar yalnız menzil alanı dolu kayıtlardan hesaplandı. Alanı 0 veya boş olan kayıtlar “Bilinmiyor” grubunda gösterildi.</p>
          </article>

          <article className="card range-card">
            <div className="section-head"><div><span className="eyebrow">Araç tipi</span><h2>BEV ve PHEV menzili</h2></div></div>
            <div className="range-summary">
              {dashboard.rangeByPowertrain.map((item) => (
                <div key={item.type}>
                  <span>{item.type}</span>
                  <strong>{decimal.format(item.medianRange)} mil</strong>
                  <small>Medyan · {integer.format(item.knownCount)} kayıt</small>
                  <i>Kayıtların %{decimal.format(item.knownShare)}’inde menzil var</i>
                </div>
              ))}
            </div>
          </article>

          <article className="card range-card range-brands">
            <div className="section-head">
              <div><span className="eyebrow">Marka karşılaştırması</span><h2>Bilinen medyan menzil</h2></div>
              <span>En az 100 dolu kayıt</span>
            </div>
            <div className="range-brand-list">
              {dashboard.rangeByBrand.map((item) => (
                <div key={item.make}>
                  <strong>{item.make}</strong>
                  <span>{decimal.format(item.medianRange)} mil</span>
                  <small>{integer.format(item.knownCount)} kayıt · %{decimal.format(item.knownShare)} doluluk</small>
                </div>
              ))}
            </div>
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
            <div><span className="eyebrow">Şarj kapsaması</span><h2>Filtrelenen ZIP bölgeleri</h2></div>
            <span>Portu olmayan bölgeler önce gösterilir</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Bölge</th><th>Durum</th><th>EV</th><th>Saha</th><th>Level 2</th><th>DC Fast</th><th>EV / 1K konut</th><th>Medyan gelir</th></tr></thead>
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
                  <tr className="empty-row"><td colSpan={8}>Bu filtrelerle eşleşen ZIP bulunamadı.</td></tr>
                )}
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

        <section className="analysis-page regression-analysis">
          <div className="analysis-toolbar">
            <div>
              <span className="eyebrow">Model sonucu</span>
              <p>Sonuçlar gerçek veriden Python pipeline’ı tarafından yeniden üretilebilir.</p>
            </div>
            <a className="export-button" href={regression.exportUrl} download>Regresyon Excel raporu</a>
          </div>

          <div className="analysis-metrics">
            <AnalysisMetric label="Çapraz doğrulanmış R²" value={regression.r2.toFixed(3)} note={`Model değişimin yaklaşık %${decimal.format(regression.r2 * 100)}’ini açıklıyor`} />
            <AnalysisMetric label="MAE" value={decimal.format(regression.mae)} note="EV / 1.000 konut ortalama mutlak hata" />
            <AnalysisMetric label="RMSE" value={decimal.format(regression.rmse)} note="Büyük hatalara daha fazla ağırlık verir" />
            <AnalysisMetric label="Örneklem" value={integer.format(regression.sampleSize)} note={`${regression.completeRows} tam kayıttan, üst %1 hariç`} />
          </div>

          <article className="card formula-card">
            <div><span className="eyebrow">Model denklemi</span><h2>EV yoğunluğu nasıl tahmin edildi?</h2></div>
            <code>{regression.formula}</code>
            <p><b>z(x)</b>, değişkenin ortalamadan kaç standart sapma uzakta olduğunu gösterir. Katsayılar, diğer değişkenler modelde tutulurken bir standart sapmalık değişimin tahminle ilişkisini verir.</p>
          </article>

          <div className="analysis-chart-grid">
            <article className="card analysis-chart-card">
              <div className="section-head">
                <div><span className="eyebrow">Standartlaştırılmış katsayılar</span><h2>Değişkenlerin modeldeki yönü</h2></div>
                <span>Pozitif değer birlikte artışı gösterir</span>
              </div>
              <CoefficientChart rows={regression.coefficients} />
            </article>
            <article className="card analysis-chart-card">
              <div className="section-head">
                <div><span className="eyebrow">5-fold tahminleri</span><h2>Gerçek değer ve model tahmini</h2></div>
                <span>Kesikli çizgi kusursuz tahmin</span>
              </div>
              <PredictionScatter rows={regression.predictions} />
            </article>
          </div>

          <div className="analysis-bottom-grid">
            <article className="card method-card">
              <span className="eyebrow">Ölçüleri okuma</span>
              <h2>R² ve MAE ne söylüyor?</h2>
              <dl>
                <div><dt>R² = 1 − Σ(y−ŷ)² / Σ(y−ȳ)²</dt><dd>Modelin bölgeler arasındaki farklılığın ne kadarını açıklayabildiğini ölçer. 1’e yaklaşması daha güçlü açıklama demektir.</dd></div>
                <div><dt>MAE = Σ|y−ŷ| / n</dt><dd>Modelin gerçek EV yoğunluğundan ortalama kaç EV/1.000 konut saptığını gösterir. Düşük olması iyidir.</dd></div>
                <div><dt>5-fold cross-validation</dt><dd>Her ZIP bir kez eğitim verisinin dışında bırakılarak tahmin edildi; metrikler bu görmediği tahminlerden hesaplandı.</dd></div>
              </dl>
            </article>
            <article className="card compact-table-card">
              <div className="section-head"><div><span className="eyebrow">En büyük artıklar</span><h2>Modelin en çok zorlandığı ZIP’ler</h2></div></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>ZIP</th><th>Gerçek</th><th>Tahmin</th><th>Fark</th></tr></thead>
                  <tbody>{regression.largestErrors.slice(0, 8).map((row) => (
                    <tr key={row.zipCode}>
                      <td><strong>{row.city}</strong><span>{row.zipCode} · {row.county}</span></td>
                      <td>{decimal.format(row.actual)}</td>
                      <td>{decimal.format(row.predicted)}</td>
                      <td className={row.residual >= 0 ? "positive-text" : "negative-text"}>{row.residual > 0 ? "+" : ""}{decimal.format(row.residual)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </article>
          </div>

        </section>

        <section className="analysis-page clustering-analysis">
          <div className="analysis-toolbar">
            <div>
              <span className="eyebrow">Model sonucu</span>
              <p>Kümeler benzer bölge profillerini gösterir; isimler küme ortalamaları görüldükten sonra verildi.</p>
            </div>
            <a className="export-button" href={clustering.exportUrl} download>Kümeleme Excel raporu</a>
          </div>

          <div className="analysis-metrics">
            <AnalysisMetric label="Seçilen küme sayısı" value={String(clustering.selectedK)} note="K=2–6 silhouette karşılaştırması" />
            <AnalysisMetric label="Silhouette score" value={clustering.silhouetteScore.toFixed(3)} note="1’e yaklaştıkça ayrışma güçlenir" />
            <AnalysisMetric label="Örneklem" value={integer.format(clustering.sampleSize)} note="Eksiksiz ve aykırı değerlerden temizlenmiş ZIP" />
            <AnalysisMetric label="Kullanılan özellik" value={String(clustering.features.length)} note="EV yoğunluğu, port yoğunluğu ve gelir" />
          </div>

          <article className="card formula-card">
            <div><span className="eyebrow">K-Means amaç fonksiyonu</span><h2>Benzer bölgeler nasıl bir araya getirildi?</h2></div>
            <code>{clustering.formula}</code>
            <p>Model, her ZIP ile ait olduğu küme merkezi arasındaki kareli uzaklıkların toplamını küçültür. Yoğunluklara <b>log(1+x)</b>, ardından bütün girdilere <b>z-skor</b> uygulandı.</p>
            <div className="feature-pills">{clustering.features.map((feature) => <span key={feature.key}><b>{feature.label}</b><small>{feature.transform}</small></span>)}</div>
          </article>

          <div className="cluster-profile-grid">
            {clustering.clusters.map((cluster) => (
              <article className="card cluster-profile" key={cluster.clusterId} style={{ "--cluster-color": cluster.color } as CSSProperties}>
                <div className="cluster-number">{cluster.clusterId}</div>
                <span className="eyebrow">{cluster.zipCount} ZIP</span>
                <h2>{cluster.label}</h2>
                <p>{cluster.description}</p>
                <dl>
                  <div><dt>EV / 1K konut</dt><dd>{decimal.format(cluster.evPer1kHousing)}</dd></div>
                  <div><dt>Port / 1K konut</dt><dd>{decimal.format(cluster.portsPer1kHousing)}</dd></div>
                  <div><dt>Medyan gelir</dt><dd>{dollars.format(cluster.medianIncome)}</dd></div>
                  <div><dt>Çok birimli konut</dt><dd>%{decimal.format(cluster.multifamilyShare)}</dd></div>
                  <div><dt>İşe gidiş</dt><dd>{decimal.format(cluster.avgCommuteMinutes)} dk</dd></div>
                  <div><dt>BEV payı</dt><dd>%{decimal.format(cluster.bevShare)}</dd></div>
                </dl>
              </article>
            ))}
          </div>

          <div className="analysis-chart-grid cluster-charts">
            <article className="card analysis-chart-card">
              <div className="section-head"><div><span className="eyebrow">Coğrafi dağılım</span><h2>Kümelere göre ZIP haritası</h2></div><span>Census ZCTA sınırları</span></div>
              <ClusterMap boundaries={boundaries} analysis={clustering} />
            </article>
            <article className="card analysis-chart-card">
              <div className="section-head"><div><span className="eyebrow">K seçimi</span><h2>Silhouette karşılaştırması</h2></div><span>Yüksek değer daha net ayrışma</span></div>
              <ClusterSelectionChart rows={clustering.kEvaluation} selectedK={clustering.selectedK} />
              <p className="chart-note">En yüksek silhouette değeri K={clustering.selectedK} için elde edildi. Inertia ve bütün K sonuçları Excel raporunda yer alıyor.</p>
            </article>
          </div>

          <article className="card compact-table-card cluster-table">
            <div className="section-head"><div><span className="eyebrow">Bölge örnekleri</span><h2>Her kümedeki en büyük EV bölgeleri</h2></div><span>Toplam EV sayısına göre</span></div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Bölge</th><th>Küme</th><th>EV</th><th>EV / 1K konut</th><th>Port / 1K konut</th><th>Medyan gelir</th></tr></thead>
                <tbody>{clustering.clusters.flatMap((cluster) => clustering.assignments.filter((row) => row.clusterId === cluster.clusterId).slice(0, 5)).map((row) => (
                  <tr key={row.zipCode}>
                    <td><strong>{row.city}</strong><span>{row.zipCode} · {row.county}</span></td>
                    <td><span className="cluster-table-label" style={{ "--cluster-color": clustering.clusters.find((cluster) => cluster.clusterId === row.clusterId)?.color } as CSSProperties}>{row.clusterLabel}</span></td>
                    <td>{integer.format(row.vehicles)}</td>
                    <td>{decimal.format(row.evPer1kHousing)}</td>
                    <td>{decimal.format(row.portsPer1kHousing)}</td>
                    <td>{dollars.format(row.medianIncome)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </article>

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
