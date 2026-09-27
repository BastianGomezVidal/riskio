import { Suspense } from "react";
import { Skeleton } from "antd";
import { StormsDirectory } from "@/layout/protected/storms/StormsDirectory/StormsDirectory";

export function StormsPage() {
  return (
    <Suspense fallback={<Skeleton active paragraph={{ rows: 10 }} />}>
      <StormsDirectory />
    </Suspense>
  );
}