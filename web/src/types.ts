export type Region = {
  zipCode: string;
  city: string;
  county: string;
  latitude: number;
  longitude: number;
  vehicles: number;
  bevVehicles: number;
  phevVehicles: number;
  bevShare: number;
  avgRange: number | null;
  knownRangeShare: number;
  chargingSites: number;
  level2Ports: number;
  publicPorts: number;
  dcFastPorts: number;
  portsPer1kVehicles: number;
  evPerPort: number | null;
  coverageStatus: string;
  coverageNote: string;
  medianIncome: number | null;
  housingUnits: number | null;
  multifamilyShare: number | null;
  workFromHomeShare: number | null;
  longCommuteShare: number | null;
  avgCommuteMinutes: number | null;
  evPer1kHousing: number | null;
};

export type Dashboard = {
  schemaVersion: string;
  metadata: {
    mode: "demo" | "live";
    generatedAt: string;
    geography: string;
    trendDefinition: string;
    stationDefinition: string;
    caveats: string[];
  };
  summary: {
    totalVehicles: number;
    bevShare: number;
    chargingSites: number;
    level2Ports: number;
    dcFastPorts: number;
    publicPorts: number;
    evPerPort: number;
    zipsWithoutCharging: number;
    belowAverageChargingZips: number;
    censusMatchedZips: number;
    knownRangeShare: number;
  };
  vehicleTrend: Array<{ modelYear: number; count: number; avgRange: number | null }>;
  powertrain: Array<{ type: "BEV" | "PHEV" | "Other"; count: number }>;
  brands: Array<{ make: string; count: number }>;
  models: Array<{ model: string; count: number }>;
  rangeBands: Array<{ band: string; count: number }>;
  rangeByPowertrain: Array<{
    type: "BEV" | "PHEV";
    knownCount: number;
    knownShare: number;
    medianRange: number;
    averageRange: number;
  }>;
  rangeByBrand: Array<{
    make: string;
    knownCount: number;
    knownShare: number;
    medianRange: number;
  }>;
  chargingMix: Array<{ type: "Level 2" | "DC Fast"; count: number }>;
  networks: Array<{ network: string; sites: number; ports: number }>;
  counties: Array<{
    county: string;
    vehicles: number;
    chargingSites: number;
    publicPorts: number;
    dcFastPorts: number;
    evPerPort: number | null;
    medianIncome: number | null;
    evPer1kHousing: number | null;
  }>;
  correlations: Array<{
    left: string;
    right: string;
    value: number;
    sampleSize: number;
  }>;
  incomeGroups: Array<{
    group: string;
    zipCount: number;
    medianIncome: number;
    medianEvPer1kHousing: number;
  }>;
  incomeScatter: Array<{
    zipCode: string;
    city: string;
    medianIncome: number;
    evPer1kHousing: number;
  }>;
  analysis: {
    regression: {
      method: string;
      target: string;
      sampleSize: number;
      completeRows: number;
      outlierThreshold: number;
      r2: number;
      mae: number;
      rmse: number;
      cvR2Mean: number;
      cvR2Std: number;
      intercept: number;
      formula: string;
      coefficients: Array<{
        key: string;
        label: string;
        coefficient: number;
        direction: "Positive" | "Negative";
        mean: number;
        standardDeviation: number;
        interpretation: string;
      }>;
      predictions: Array<{
        zipCode: string;
        city: string;
        county: string;
        actual: number;
        predicted: number;
        residual: number;
      }>;
      largestErrors: Array<{
        zipCode: string;
        city: string;
        county: string;
        actual: number;
        predicted: number;
        residual: number;
      }>;
      notes: string[];
      exportUrl: string;
    };
    clustering: {
      method: string;
      sampleSize: number;
      completeRows: number;
      selectedK: number;
      silhouetteScore: number;
      evOutlierThreshold: number;
      portOutlierThreshold: number;
      formula: string;
      features: Array<{ key: string; label: string; transform: string }>;
      kEvaluation: Array<{ k: number; inertia: number; silhouette: number }>;
      clusters: Array<{
        clusterId: number;
        label: string;
        color: string;
        description: string;
        zipCount: number;
        evPer1kHousing: number;
        portsPer1kHousing: number;
        medianIncome: number;
        multifamilyShare: number;
        workFromHomeShare: number;
        avgCommuteMinutes: number;
        bevShare: number;
        vehicles: number;
        publicPorts: number;
      }>;
      assignments: Array<{
        zipCode: string;
        city: string;
        county: string;
        clusterId: number;
        clusterLabel: string;
        vehicles: number;
        publicPorts: number;
        evPer1kHousing: number;
        portsPer1kHousing: number;
        medianIncome: number;
        multifamilyShare: number;
        workFromHomeShare: number;
        avgCommuteMinutes: number;
        bevShare: number;
      }>;
      notes: string[];
      exportUrl: string;
    };
  };
  dataQuality: {
    totalRows: number;
    knownRangeRows: number;
    knownRangeShare: number;
    medianKnownRange: number;
    missingLocationRows: number;
    zipCount: number;
    cityCount: number;
    countyCount: number;
    activePublicSites: number;
    stationZipCount: number;
    missingZipRows: number;
    missingCoordinateRows: number;
    latestStationUpdate: string;
    censusMatchedZips: number;
    completeCensusZips: number;
  };
  sources: Array<{ name: string; period: string; usage: string; url: string }>;
  regions: Region[];
};

export type ZctaFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { zipCode: string };
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: number[][][] | number[][][][];
    };
  }>;
};
