import { Link } from "react-router-dom";
import { Skeleton } from "antd";
import {
  ErrorEmpty,
  NotFoundEmpty,
  OfflineEmpty,
} from "@/components/layout/StatusEmpty/StatusEmpty";
import { useStormAdvisory } from "@/data/queries.hooks";
import { classifyQueryError } from "@/data/query-error";
import { StormHeader } from "../StormHeader/StormHeader";
import { AdvisorySelector } from "@/components/features/weather/advisory/AdvisorySelector/AdvisorySelector";
import { AdvisoryContent } from "@/components/features/weather/advisory/AdvisoryContent/AdvisoryContent";

export function StormAdvisories({
  atcfId,
  advisoryNumber,
}: {
  atcfId: string;
  advisoryNumber: string;
}) {
  const { data, error, isPending, refetch } = useStormAdvisory(
    atcfId,
    advisoryNumber,
  );

  // The query lives here, so its pending state renders here. This used to be
  // a <Suspense> fallback in StormDetailsPage, back when the component read a
  // promise through `use()` and suspended instead of reporting isPending.
  if (isPending) return <Skeleton active paragraph={{ rows: 12 }} />;

  if (error) {
    const failure = classifyQueryError(error);

    if (failure.kind === "not-found") {
      return (
        <NotFoundEmpty
          message="Storm or advisory not found."
          action={<Link to="/storms">Back to storms</Link>}
        />
      );
    }

    if (failure.kind === "offline") {
      return <OfflineEmpty onRetry={() => void refetch()} />;
    }

    return (
      <ErrorEmpty message={failure.message} onRetry={() => void refetch()} />
    );
  }

  const { storm, advisory } = data;

  return (
    <div>
      <StormHeader storm={storm} advisoryIssuedAt={advisory.issuedAt} />
      <AdvisorySelector storm={storm} current={advisory.advisoryNumber} />
      <AdvisoryContent advisory={advisory} />
    </div>
  );
}
