import { Suspense } from "react";
import { Skeleton } from "antd";
import { DashboardData } from "../DashboardData";

export function DashboardPage() {
  // No <main> here — AppLayout owns the main landmark.
  return (
    <div className="mx-auto w-full max-w-4xl">
      <Suspense fallback={<DashboardFallback />}>
        <DashboardData />
      </Suspense>
    </div>
  );
}

function DashboardFallback() {
  return (
    <div aria-busy="true" className="mt-6">
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );
}
