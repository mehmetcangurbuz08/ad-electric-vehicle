export type Region = {
  zipCode: string;
  city: string;
  county: string;
  latitude: number;
  longitude: number;
  vehicles: number;
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
  regions: Region[];
};
