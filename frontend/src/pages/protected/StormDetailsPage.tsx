import { Suspense } from "react";
import { Skeleton } from "antd";
import { Navigate, useParams } from "react-router-dom";
import { StormAdvisories } from "@/layout/protected/storms/StormAdvisories/StormAdvisories";

export function StormDetailPage() {
  const { atcfId, n } = useParams<{ atcfId: string; n?: string }>();

  if (!atcfId) {
    return (
      <p role="alert" className="mt-6 text-sm text-red-600">
        Missing storm identifier.
      </p>
    );
  }

  // /storms/:atcfId is equivalent to the latest advisory of the storm.
  if (!n) {
    return <Navigate to={`/storms/${atcfId}/advisories/latest`} replace />;
  }

  return (
    <Suspense fallback={<Skeleton active paragraph={{ rows: 12 }} />}>
      <StormAdvisories atcfId={atcfId} advisoryNumber={n} />
    </Suspense>
  );
}