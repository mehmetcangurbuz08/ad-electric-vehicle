import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getDashboard } from "./api";
import type { Dashboard, Region, ZctaFeatureCollection } from "./types";

type VehicleFilter = "ALL" | "BEV" | "PHEV";
type DashboardView = "map" | "vehicles" | "charging" | "census" | "tables" | "notes" | "regression" | "clustering";

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const integer = new Intl.NumberFormat("en-US");
const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const dashboardNavItems: Array<{ id: DashboardView; label: string; title: string; description: string }> = [
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
    label: "Charging",
    title: "Charging network and capacity",
    description: "Level 2 and DC fast port mix, operators, and coverage differences.",
  },
  {
    id: "census",
    label: "Census",
    title: "Income, housing, and EV density",
    description: "Relationship between American Community Survey indicators and ZIP-level EV ownership.",
  },
  {
    id: "tables",
    label: "Tables",
    title: "ZIP and county comparisons",
    description: "Presentation-ready tables for filtered areas and county market sizes.",
  },
  {
    id: "notes",
    label: "Sources",
    title: "Sources",
    description: "Datasets used in the dashboard.",
  },
];

const analysisNavItems: Array<{ id: DashboardView; label: string; title: string; description: string }> = [
  {
    id: "regression",
    label: "Regression",
    title: "Multiple linear regression",
    description: "Relationship between income, housing structure, commute indicators, and ZIP-level EV density.",
  },
  {
    id: "clustering",
    label: "Clusters",
    title: "K-Means area profiles",
    description: "Similar ZIP areas by EV density, public charging port density, and income.",
  },
];

const navItems = [...dashboardNavItems, ...analysisNavItems];

const initialView = (): DashboardView => {
  const requested = new URLSearchParams(window.location.search).get("view") as DashboardView | null;
  return requested && navItems.some((item) => item.id === requested) ? requested : "map";
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
  return (
    <div className="map-wrap">
      <svg viewBox="0 0 640 320" role="img" aria-label="Washington electric vehicle and charging coverage map">
        {boundaries.features.map((feature) => {
          const region = byZip.get(feature.properties.zipCode);
          if (!region) return null;
          const active = activeZips.has(region.zipCode);
          const className = region.publicPorts === 0
            ? "no-station"
            : region.coverageStatus === "Below state average"
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
    : region.coverageStatus === "Below state average"
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
          <span>{row.band === "Unknown" ? "Unknown" : `${row.band} miles`}</span>
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
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Income and EVs per housing unit distribution">
        <line x1={left} x2={left} y1="12" y2={height - bottom} className="axis" />
        <line x1={left} x2={width - 12} y1={height - bottom} y2={height - bottom} className="axis" />
        {points.map((point) => (
          <circle key={point.zipCode} cx={x(point.medianIncome)} cy={y(point.evPer1kHousing)} r="3.2" className="scatter-point">
            <title>{point.city} {point.zipCode}: {dollars.format(point.medianIncome)} · {point.evPer1kHousing} EVs / 1,000 housing units</title>
          </circle>
        ))}
        <text x={width / 2} y={height - 4} textAnchor="middle">Median household income</text>
        <text transform={`translate(12 ${height / 2}) rotate(-90)`} textAnchor="middle">EVs per 1,000 housing units</text>
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
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Actual and predicted EV density">
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
            <title>{row.city} {row.zipCode} · Actual {decimal.format(row.actual)} · Predicted {decimal.format(row.predicted)}</title>
          </circle>
        ))}
        <text x={width / 2} y={height - 2} textAnchor="middle">Actual EV / 1,000 housing units</text>
        <text transform={`translate(13 ${height / 2}) rotate(-90)`} textAnchor="middle">Predicted EV / 1,000 housing units</text>
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
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Silhouette score by K value">
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
      <svg viewBox="0 0 640 320" role="img" aria-label="Washington ZIP map by K-Means clusters">
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
              <title>{assignment ? `${assignment.city} ${assignment.zipCode} · ${assignment.clusterLabel} · ${assignment.evPer1kHousing} EV/1K housing units` : `${feature.properties.zipCode} · Not in model sample`}</title>
            </path>
          );
        })}
      </svg>
      <div className="cluster-legend">
        {analysis.clusters.map((cluster) => (
          <span key={cluster.clusterId}><i style={{ background: cluster.color }} />{cluster.label}</span>
        ))}
        <span><i className="unassigned" />Outside model</span>
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
        if (!response.ok) throw new Error("Could not load ZIP boundary file.");
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
    const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
    return dashboard.regions.filter((region) => {
      const count = vehicleFilter === "BEV"
        ? region.bevVehicles
        : vehicleFilter === "PHEV"
          ? region.phevVehicles
          : region.vehicles;
      const matchesText = !normalizedQuery || [region.zipCode, region.city, region.county]
        .some((value) => value.toLocaleLowerCase("en-US").includes(normalizedQuery));
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
    return <main className="status"><div><span>No API connection</span><h1>Dashboard could not be loaded</h1><p>{error}</p><code>uvicorn backend.app.main:app --reload</code></div></main>;
  }
  if (!dashboard || !selected || !boundaries) {
    return <main className="status"><div className="loader" /><p>Preparing real data...</p></main>;
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
        <div className="sidebar-title">Dashboard</div>
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
          <span className="nav-section analysis-label">Analysis</span>
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
          <span className="eyebrow">Washington state</span>
          <h1>{activeNav.title}</h1>
          <p>{activeNav.description}</p>
        </section>
        <section className="hero">
          <div>
            <span className="eyebrow">Washington state</span>
            <h1>Electric vehicles and<br /><em>charging stations</em></h1>
          </div>
          <p>ZIP-level summary of Washington Department of Licensing vehicle registrations, 2024 Alternative Fuels Data Center charging stations, and 2024 Census indicators.</p>
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
            <div className="section-head"><div><span className="eyebrow">Charging technology</span><h2>Level 2 / DC fast charging ports</h2></div></div>
            <div className="donut charging" style={{ "--bev": `${level2Share * 3.6}deg` } as CSSProperties}>
              <div><strong>{compact.format(dashboard.summary.publicPorts)}</strong><span>total ports</span></div>
            </div>
            <div className="mix-legend">
              {dashboard.chargingMix.map((item) => (
                <div key={item.type}>
                  <span className={item.type === "DC Fast" ? "dc" : "level2"} />
                  <b>{item.type === "DC Fast" ? "DC fast charging" : "Level 2 charging"}</b>
                  <small>{integer.format(item.count)} port</small>
                </div>
              ))}
            </div>
          </article>

          <article className="card brands-card">
            <div className="section-head"><div><span className="eyebrow">Charging network</span><h2>Most common operators</h2></div><span>Site count</span></div>
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
              <div><span className="eyebrow">2024 Census</span><h2>Income and EVs per housing unit</h2></div>
              <span>Top 1% outliers excluded</span>
            </div>
            <IncomeScatter points={dashboard.incomeScatter} />
          </article>

          <article className="card correlation-card">
            <div className="section-head"><div><span className="eyebrow">Spearman correlation</span><h2>Relationship between variables</h2></div></div>
            <div className="correlation-list">
              {dashboard.correlations.map((item) => (
                <div key={item.left}>
                  <div><strong>{item.left}</strong><span>{item.right} · n={item.sampleSize}</span></div>
                  <b className={item.value >= 0.5 ? "strong" : item.value >= 0.3 ? "medium" : "weak"}>{item.value.toFixed(2)}</b>
                </div>
              ))}
            </div>
          </article>

          <article className="card income-card">
            <div className="section-head"><div><span className="eyebrow">Income groups</span><h2>EV density comparison</h2></div></div>
            <div className="income-groups">
              {dashboard.incomeGroups.map((group) => (
                <div key={group.group}>
                  <span>{group.group}</span>
                  <strong>{group.medianEvPer1kHousing}</strong>
                  <small>EVs per 1,000 housing units</small>
                  <i>Median income {dollars.format(group.medianIncome)}</i>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="card table-card">
          <div className="section-head">
            <div><span className="eyebrow">Charging coverage</span><h2>Filtered ZIP areas</h2></div>
            <span>Areas without ports are shown first</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Area</th><th>Status</th><th>Electric vehicles</th><th>Charging sites</th><th>Level 2 ports</th><th>DC fast ports</th><th>Vehicles per 1,000 housing units</th><th>Median income</th></tr></thead>
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
                  <tr className="empty-row"><td colSpan={8}>No ZIP areas match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card table-card county-card">
          <div className="section-head">
            <div><span className="eyebrow">County comparison</span><h2>Top 15 electric vehicle markets</h2></div>
            <span>Sorted by electric vehicle count</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>County</th><th>Electric vehicles</th><th>Charging sites</th><th>Total ports</th><th>DC fast ports</th><th>Vehicles per port</th><th>Median income</th></tr></thead>
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
              <span className="eyebrow">Model result</span>
              <p>Results can be reproduced from the real data by the Python pipeline.</p>
            </div>
            <a className="export-button" href={regression.exportUrl} download>Regression Excel report</a>
          </div>

          <div className="analysis-metrics">
            <AnalysisMetric label="Cross-validated R²" value={regression.r2.toFixed(3)} note={`The model explains about ${decimal.format(regression.r2 * 100)}% of the variation`} />
            <AnalysisMetric label="MAE" value={decimal.format(regression.mae)} note="Mean absolute error in electric vehicles per 1,000 housing units" />
            <AnalysisMetric label="RMSE" value={decimal.format(regression.rmse)} note="Gives more weight to large errors" />
            <AnalysisMetric label="Sample" value={integer.format(regression.sampleSize)} note={`${regression.completeRows} complete records, excluding the top 1%`} />
          </div>

          <article className="card formula-card">
            <div><span className="eyebrow">Model equation</span><h2>How was EV density estimated?</h2></div>
            <code>{regression.formula}</code>
            <p><b>z(x)</b> shows how many standard deviations a variable is from its mean. Coefficients show how a one-standard-deviation change relates to the prediction while the other variables stay in the model.</p>
          </article>

          <div className="analysis-chart-grid">
            <article className="card analysis-chart-card">
              <div className="section-head">
                <div><span className="eyebrow">Standardized coefficients</span><h2>Direction of variables in the model</h2></div>
                <span>Positive values indicate variables rising together</span>
              </div>
              <CoefficientChart rows={regression.coefficients} />
            </article>
            <article className="card analysis-chart-card">
              <div className="section-head">
                <div><span className="eyebrow">5-fold predictions</span><h2>Actual value and model prediction</h2></div>
                <span>Dashed line is a perfect prediction</span>
              </div>
              <PredictionScatter rows={regression.predictions} />
            </article>
          </div>

          <div className="analysis-bottom-grid">
            <article className="card method-card">
              <span className="eyebrow">Reading the metrics</span>
              <h2>What do R² and MAE say?</h2>
              <dl>
                <div><dt>R² = 1 - sum(y-y_hat)^2 / sum(y-y_mean)^2</dt><dd>Measures how much of the difference between areas the model can explain. Values closer to 1 mean stronger explanatory power.</dd></div>
                <div><dt>MAE = sum(|y-y_hat|) / n</dt><dd>Shows how many EVs per 1,000 housing units the model misses by on average. Lower is better.</dd></div>
                <div><dt>5-fold cross-validation</dt><dd>Each ZIP was predicted once while left out of the training data; metrics were calculated from those unseen predictions.</dd></div>
              </dl>
            </article>
            <article className="card compact-table-card">
              <div className="section-head"><div><span className="eyebrow">Largest residuals</span><h2>ZIPs where the model struggled most</h2></div></div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>ZIP</th><th>Actual</th><th>Predicted</th><th>Difference</th></tr></thead>
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
              <span className="eyebrow">Model result</span>
              <p>Clusters show similar area profiles; names were assigned after reviewing cluster averages.</p>
            </div>
            <a className="export-button" href={clustering.exportUrl} download>Clustering Excel report</a>
          </div>

          <div className="analysis-metrics">
            <AnalysisMetric label="Selected cluster count" value={String(clustering.selectedK)} note="K=2-6 silhouette comparison" />
            <AnalysisMetric label="Silhouette score" value={clustering.silhouetteScore.toFixed(3)} note="Closer to 1 means stronger separation" />
            <AnalysisMetric label="Sample" value={integer.format(clustering.sampleSize)} note="Complete ZIP records after outlier filtering" />
            <AnalysisMetric label="Features used" value={String(clustering.features.length)} note="EV density, port density, and income" />
          </div>

          <article className="card formula-card">
            <div><span className="eyebrow">K-Means objective function</span><h2>How were similar areas grouped?</h2></div>
            <code>{clustering.formula}</code>
            <p>The model minimizes the sum of squared distances between each ZIP and its assigned cluster center. Densities use <b>log(1+x)</b>, then all inputs are standardized with a <b>z-score</b>.</p>
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
                  <div><dt>EV / 1K housing units</dt><dd>{decimal.format(cluster.evPer1kHousing)}</dd></div>
                  <div><dt>Ports / 1K housing units</dt><dd>{decimal.format(cluster.portsPer1kHousing)}</dd></div>
                  <div><dt>Median income</dt><dd>{dollars.format(cluster.medianIncome)}</dd></div>
                  <div><dt>Multifamily housing</dt><dd>%{decimal.format(cluster.multifamilyShare)}</dd></div>
                  <div><dt>Commute</dt><dd>{decimal.format(cluster.avgCommuteMinutes)} min</dd></div>
                  <div><dt>Battery electric share</dt><dd>%{decimal.format(cluster.bevShare)}</dd></div>
                </dl>
              </article>
            ))}
          </div>

          <div className="analysis-chart-grid cluster-charts">
            <article className="card analysis-chart-card">
              <div className="section-head"><div><span className="eyebrow">Geographic distribution</span><h2>ZIP map by cluster</h2></div><span>Census ZCTA boundaries</span></div>
              <ClusterMap boundaries={boundaries} analysis={clustering} />
            </article>
            <article className="card analysis-chart-card">
              <div className="section-head"><div><span className="eyebrow">K selection</span><h2>Silhouette comparison</h2></div><span>Higher values mean clearer separation</span></div>
              <ClusterSelectionChart rows={clustering.kEvaluation} selectedK={clustering.selectedK} />
              <p className="chart-note">The highest silhouette score was obtained for K={clustering.selectedK}. Inertia and all K results are included in the Excel report.</p>
            </article>
          </div>

          <article className="card compact-table-card cluster-table">
            <div className="section-head"><div><span className="eyebrow">Area examples</span><h2>Largest EV areas in each cluster</h2></div><span>By total EV count</span></div>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Area</th><th>Cluster</th><th>EV</th><th>EV / 1K housing units</th><th>Ports / 1K housing units</th><th>Median income</th></tr></thead>
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
            <div><h2>Data Sources</h2></div>
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
