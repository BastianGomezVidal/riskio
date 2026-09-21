import { use, useDeferredValue, useMemo, useState } from "react";
import { Empty } from "antd";
import { preloadHistory, resetHistory } from "@/data/promises";
import {
  applyHistoryView,
  availableBasins,
  availableYears,
  defaultFilters,
  type HistoryFilters as Filters,
  type HistorySort,
} from "@/domain/storm/history";
import {
  ErrorEmpty,
  OfflineEmpty,
} from "@/global_components/StatusEmpty/StatusEmpty";
import { HistoryFilters } from "./HistoryFilters";
import { HistoryList } from "./HistoryList";

export function HistoryContent() {
  const result = use(preloadHistory());
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [sort, setSort] = useState<HistorySort>("newest");
  const [retryToken, setRetryToken] = useState(0);
  const deferred = useDeferredValue(filters);

  const retry = () => {
    resetHistory();
    setRetryToken((n) => n + 1);
  };

  const items = result.status === "ok" ? result.data.data : [];

  const years = useMemo(() => availableYears(items), [items]);
  const basins = useMemo(() => availableBasins(items), [items]);

  const visible = useMemo(
    () => applyHistoryView(items, deferred, sort),
    [items, deferred, sort],
  );

  if (result.status === "offline") return <OfflineEmpty onRetry={retry} />;
  if (result.status === "error") {
    return <ErrorEmpty message={result.message} onRetry={retry} />;
  }
  if (result.status === "not-found") {
    return <ErrorEmpty message="History unavailable." onRetry={retry} />;
  }

  const page = result.data;

  return (
    <div key={retryToken}>
      <header className="mb-6">
        <h2 className="text-2xl font-semibold" style={{ marginBottom: 4 }}>
          History
        </h2>
        <p className="text-sm text-(--ant-color-text-secondary)">
          {items.length === 0
            ? "No historical storms stored yet."
            : `${page.meta.total} past ${
                page.meta.total === 1 ? "storm" : "storms"
              }.`}
        </p>
      </header>

      {items.length > 0 && (
        <HistoryFilters
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          availableBasins={basins}
          availableYears={years}
        />
      )}

      <div className="mt-4">
        {items.length === 0 ? (
          <Empty description="No historical storms." />
        ) : visible.length === 0 ? (
          <Empty description="No storms match your filters." />
        ) : (
          <HistoryList storms={visible} />
        )}
      </div>
    </div>
  );
}
