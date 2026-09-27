import { useEffect, useMemo, useState } from "react";
import { Empty, Skeleton } from "antd";
import { useSearchParams } from "react-router-dom";
import { useStorms } from "@/data/queries.hooks";
import { classifyQueryError } from "@/data/query-error";
import type { StormsQuery, StormsSort, StormsTab } from "@/domain/storm";
import {
  ErrorEmpty,
  OfflineEmpty,
} from "@/global_components/StatusEmpty/StatusEmpty";
import { StormsFilters } from "../StormsFilters/StormsFilters";
import { StormsFilterDrawer } from "../StormFilterDrawer/StormFilterDrawer";
import { StormsAppliedFilters } from "../StormsAppliedFilters/StormsAppliedFilters";
import { StormList } from "../StormList/StormList";

const DEBOUNCE_MS = 250;
const DEFAULT_TAB: StormsTab = "active";
const DEFAULT_SORT: StormsSort = "newest";
const MIN_YEAR = 2000;
const MAX_YEAR = new Date().getFullYear();

function isValidTab(value: string | null): value is StormsTab {
  return value === "active" || value === "past";
}

function isValidSort(value: string | null): value is StormsSort {
  return (
    value === "newest" ||
    value === "oldest" ||
    value === "name_asc" ||
    value === "name_desc"
  );
}

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseCatCsv(value: string | null): number[] {
  return parseCsv(value)
    .map((c) => Number(c))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 5);
}

export function StormsDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Read from URL ───────────────────────────────────────────────────
  const tabParam = searchParams.get("tab");
  const sortParam = searchParams.get("sort");
  const qParam = searchParams.get("q") ?? "";
  const basinParam = searchParams.get("basin");
  const catParam = searchParams.get("cat");
  const yearFromParam = searchParams.get("yearFrom");
  const yearToParam = searchParams.get("yearTo");

  const tab: StormsTab = isValidTab(tabParam) ? tabParam : DEFAULT_TAB;
  const sort: StormsSort = isValidSort(sortParam) ? sortParam : DEFAULT_SORT;
  const basins = parseCsv(basinParam);
  const categories = parseCatCsv(catParam);
  const yearFrom = yearFromParam ? Number(yearFromParam) : MIN_YEAR;
  const yearTo = yearToParam ? Number(yearToParam) : MAX_YEAR;

  // ── Search debounce ─────────────────────────────────────────────────
  const [qLocal, setQLocal] = useState(qParam);

  useEffect(() => {
    setQLocal(qParam);
  }, [qParam]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (qLocal !== qParam) {
        updateParams({ q: qLocal || null });
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal]);

  // ── Params helpers ──────────────────────────────────────────────────
  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    setSearchParams(next, { replace: true });
  }

  const setTab = (next: StormsTab) => updateParams({ tab: next });

  // ── Applied filter handlers ─────────────────────────────────────────
  const removeBasin = (code: string) => {
    const next = basins.filter((b) => b !== code);
    updateParams({ basin: next.length > 0 ? next.join(",") : null });
  };

  const removeCategory = (value: number) => {
    const next = categories.filter((c) => c !== value);
    updateParams({ cat: next.length > 0 ? next.join(",") : null });
  };

  const removeYear = () => {
    updateParams({ yearFrom: null, yearTo: null });
  };

  const removeSort = () => {
    updateParams({ sort: null });
  };

  const clearAllFilters = () => {
    updateParams({
      basin: null,
      cat: null,
      yearFrom: null,
      yearTo: null,
      sort: null,
    });
  };

  // ── Derived query ───────────────────────────────────────────────────
  const query: StormsQuery = useMemo(
    () => ({
      tab,
      sort,
      q: qParam.trim() || undefined,
      basin: basins.length > 0 ? basins.join(",") : undefined,
      cat: categories.length > 0 ? categories.join(",") : undefined,
      yearFrom: tab === "past" && yearFrom !== MIN_YEAR ? yearFrom : undefined,
      yearTo: tab === "past" && yearTo !== MAX_YEAR ? yearTo : undefined,
    }),
    [tab, sort, qParam, basins, categories, yearFrom, yearTo],
  );

  const { data, error, isPending, refetch } = useStorms(query);

  const retry = () => {
    void refetch();
  };

  // The query lives here, so its pending state renders here. This used to be
  // a <Suspense> fallback in StormsPage, back when the component read a
  // promise through `use()` and suspended instead of reporting isPending.
  if (isPending) {
    return (
      <div aria-busy="true">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (error) {
    const failure = classifyQueryError(error);

    if (failure.kind === "offline") {
      return <OfflineEmpty onRetry={retry} />;
    }

    if (failure.kind === "not-found") {
      return <ErrorEmpty message="Storms unavailable." onRetry={retry} />;
    }

    return <ErrorEmpty message={failure.message} onRetry={retry} />;
  }

  const storms = data;

  const latestAdvisoryIssuedAtMap: Record<string, string | null> = {};
  for (const s of storms) {
    latestAdvisoryIssuedAtMap[s.atcfId] = s.latestAdvisoryIssuedAt ?? null;
  }

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-2xl font-semibold" style={{ marginBottom: 4 }}>
          Storms
        </h2>
        <p className="text-sm text-(--ant-color-text-secondary)">
          {storms.length === 0
            ? `No ${tab} storms stored yet.`
            : `${storms.length} ${tab} ${storms.length === 1 ? "storm" : "storms"}.`}
        </p>
      </header>

      <StormsFilters
        tab={tab}
        onTabChange={setTab}
        q={qLocal}
        onQChange={setQLocal}
        onFilterClick={() => setDrawerOpen(true)}
      />

      <StormsAppliedFilters
        basins={basins}
        categories={categories}
        yearFrom={yearFrom}
        yearTo={yearTo}
        sort={sort}
        defaultSort={DEFAULT_SORT}
        minYear={MIN_YEAR}
        maxYear={MAX_YEAR}
        onRemoveBasin={removeBasin}
        onRemoveCategory={removeCategory}
        onRemoveYear={removeYear}
        onRemoveSort={removeSort}
        onClearAll={clearAllFilters}
      />

      <StormsFilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tab={tab}
        basins={basins}
        categories={categories}
        yearFrom={yearFrom}
        yearTo={yearTo}
        sort={sort}
        onApply={(next) => {
          updateParams({
            basin: next.basins.length > 0 ? next.basins.join(",") : null,
            cat: next.categories.length > 0 ? next.categories.join(",") : null,
            yearFrom: next.yearFrom !== MIN_YEAR ? String(next.yearFrom) : null,
            yearTo: next.yearTo !== MAX_YEAR ? String(next.yearTo) : null,
            sort: next.sort !== DEFAULT_SORT ? next.sort : null,
          });
        }}
      />

      <div className="mt-4">
        {storms.length === 0 ? (
          <Empty description={`No ${tab} storms.`} />
        ) : (
          <StormList
            storms={storms}
            latestAdvisoryIssuedAtMap={latestAdvisoryIssuedAtMap}
          />
        )}
      </div>
    </div>
  );
}
