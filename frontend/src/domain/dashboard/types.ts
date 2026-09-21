import type { Storm, ForecastPoint } from "@/domain/storm";

export interface DashboardTotals {
  events: number;
  named: number;
  hurricanes: number;
  ace: number;
}

export interface LatestAdvisory {
  id: string;
  advisoryNumber: number;
  issuedAt: string;
  forecastPoints: ForecastPoint[];
}

export interface StormSummary {
  storm: Storm;
  advisoryCount: number;
  latestAdvisory: LatestAdvisory | null;
}

export interface DashboardSummary {
  generatedAt: string;
  totals: DashboardTotals;
  storms: StormSummary[];
}

export interface StormHistoryItem {
  storm: Storm;
  advisoryCount: number;
  lastSeenInFeedAt: string | null;
}
