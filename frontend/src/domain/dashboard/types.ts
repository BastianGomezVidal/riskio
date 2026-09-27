import type { ForecastPoint, StormDto, StormRiskLevel } from "@/domain/storm";

export interface DashboardTotals {
  events: number;
  named: number;
  hurricanes: number;
  ace: number;
  pacific: number;
  atlantic: number;
}

export interface LatestAdvisory {
  id: string;
  advisoryNumber: number;
  issuedAt: string;
  forecastPoints: ForecastPoint[];
}

export interface StormSummary {
  storm: StormDto;
  riskLevel: StormRiskLevel;
  latestAdvisory: LatestAdvisory | null;
}

export interface DashboardSummary {
  generatedAt: string;
  totals: DashboardTotals;
  storms: StormSummary[];
}
