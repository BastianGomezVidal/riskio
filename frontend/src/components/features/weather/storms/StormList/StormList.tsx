import { StormCard } from "../StormCard/StormCard";
import type { DashboardStorm, StormAggregate } from "@/domain/storm";

type StormListItem = StormAggregate | DashboardStorm;

interface Props {
  storms: StormListItem[];
  latestAdvisoryIssuedAtMap: Record<string, string | null>;
  /** Show the risk chip at the top of each card (dashboard only). */
  showRisk?: boolean;
}

export function StormList({
  storms,
  latestAdvisoryIssuedAtMap,
  showRisk = false,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      {storms.map((storm) => (
        <StormCard.Root key={storm.atcfId} storm={storm}>
          {showRisk && "riskLevel" in storm && storm.riskLevel && (
            <StormCard.Header level={storm.riskLevel} />
          )}
          <StormCard.Body storm={storm} />
          <StormCard.Footer
            storm={storm}
            updatedAt={latestAdvisoryIssuedAtMap[storm.atcfId] ?? null}
          />
        </StormCard.Root>
      ))}
    </div>
  );
}
