/**
 * Imported by path, not through the feature barrel.
 *
 * The barrel re-exports StormAdvisories, which imports AdvisoryContent, which
 * imports StormMap — so a page that only wants the directory list drags
 * react-leaflet into its chunk graph: 172 kB, ~43 kB gzipped, of a map this
 * route never renders. Rollup then hoists that shared chunk into the graph and
 * /storms pays for it. The dashboard already avoids this, because its barrel
 * only exports DashboardContent.
 */
import { StormsDirectory } from "@/components/features/weather/storms/StormsDirectory/StormsDirectory";

export function StormsPage() {
  return <StormsDirectory />;
}
