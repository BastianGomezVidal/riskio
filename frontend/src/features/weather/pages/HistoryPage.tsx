import { Suspense } from "react";
import { Skeleton } from "antd";
import { HistoryContent } from "../components/history/HistoryContent";

export function HistoryPage() {
  return (
    <Suspense fallback={<HistoryFallback />}>
      <HistoryContent />
    </Suspense>
  );
}

function HistoryFallback() {
  return (
    <div aria-busy="true">
      <Skeleton active paragraph={{ rows: 10 }} />
    </div>
  );
}
