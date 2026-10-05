import { DashboardContent } from "@/components/features/weather/dashboard";

export function DashboardPage() {
  // No <main> here — AppLayout owns the main landmark.
  // The route-level <Suspense> in AppLayout covers this chunk being lazy;
  // the summary query renders its own skeleton inside DashboardContent.
  return (
    <div className="mx-auto w-full max-w-4xl">
      <DashboardContent />
    </div>
  );
}
