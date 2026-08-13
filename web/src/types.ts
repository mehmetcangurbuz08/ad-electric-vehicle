export type Region = {
  zipCode: string;
  city: string;
  county: string;
  latitude: number;
  longitude: number;
  vehicles: number;
  bevShare: number;
  avgRange: number | null;
  medianIncome: number | null;
  avgCommuteMinutes: number | null;
  multifamilyShare: number | null;
  publicPorts: number;
  dcFastPorts: number;
  cluster: number;
  segment: string;
  priorityScore: number;
  recommendation: string;
};

export type Dashboard = {
  schemaVersion: string;
  metadata: {
    mode: "demo" | "live";
    generatedAt: string;
    geography: string;
    trendDefinition: string;
    caveats: string[];
  };
  summary: {
    totalVehicles: number;
    bevShare: number;
    chargingSites: number;
    publicPorts: number;
    dcFastPorts: number;
    priorityRegions: number;
  };
  vehicleTrend: Array<{ modelYear: number; count: number; avgRange: number | null }>;
  powertrain: Array<{ type: "BEV" | "PHEV" | "Other"; count: number }>;
  brands: Array<{ make: string; count: number }>;
  regions: Region[];
};

