import { use, useState } from "react";
import { Link } from "react-router-dom";
import {
  ErrorEmpty,
  NotFoundEmpty,
  OfflineEmpty,
} from "@/global_components/StatusEmpty/StatusEmpty";
import { preloadStormAdvisory, resetStormAdvisory } from "@/data/promises";
import { StormHeader } from "../StormHeader/StormHeader";
import { AdvisorySelector } from "../../advisory/AdvisorySelector/AdvisorySelector";
import { AdvisoryContent } from "../../advisory/AdvisoryContent/AdvisoryContent";

export function StormAdvisories({
  atcfId,
  advisoryNumber,
}: {
  atcfId: string;
  advisoryNumber: string;
}) {
  const result = use(preloadStormAdvisory(atcfId, advisoryNumber));
  const [retryToken, setRetryToken] = useState(0);

  const retry = () => {
    resetStormAdvisory(atcfId, advisoryNumber);
    setRetryToken((t) => t + 1);
  };

  if (result.status === "not-found") {
    return (
      <NotFoundEmpty
        message="Storm or advisory not found."
        action={<Link to="/storms">Back to storms</Link>}
      />
    );
  }

  if (result.status === "offline") {
    return <OfflineEmpty onRetry={retry} />;
  }

  if (result.status === "error") {
    return <ErrorEmpty message={result.message} onRetry={retry} />;
  }

  const { storm, advisory } = result.data;

  return (
    <div key={retryToken}>
      <StormHeader storm={storm} advisoryIssuedAt={advisory.issuedAt} />
      <AdvisorySelector storm={storm} current={advisory.advisoryNumber} />
      <AdvisoryContent advisory={advisory} />
    </div>
  );
}
