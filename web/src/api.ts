import type { Dashboard } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export async function getDashboard(signal?: AbortSignal): Promise<Dashboard> {
  const response = await fetch(`${API_BASE}/dashboard`, { signal });
  if (!response.ok) {
    throw new Error(`Could not fetch dashboard data (${response.status}).`);
  }
  return response.json() as Promise<Dashboard>;
}

