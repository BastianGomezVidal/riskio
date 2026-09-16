import { Suspense } from "react";
import { Card, Empty, Skeleton } from "antd";
import { Storm } from "../../../api/client";
import { StormCard } from "../StormCard/StormCard";

export function StormList({ storms }: { storms: Storm[] }) {
  if (storms.length === 0) {
    return <Empty description="No storms stored yet." />;
  }

  return (
    <ul role="list" className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {storms.map((storm) => (
        <li key={storm.atcfId}>
          <Suspense fallback={<CardSkeleton />}>
            <StormCard storm={storm} />
          </Suspense>
        </li>
      ))}
    </ul>
  );
}

function CardSkeleton() {
  return (
    <Card size="small" aria-hidden>
      <Skeleton active paragraph={{ rows: 4 }} />
    </Card>
  );
}
