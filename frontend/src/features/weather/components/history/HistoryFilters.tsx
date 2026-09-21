import { Input, Select, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { HistoryFilters, HistorySort } from "@/domain/storm/history";

interface Props {
  filters: HistoryFilters;
  onFiltersChange: (f: HistoryFilters) => void;
  sort: HistorySort;
  onSortChange: (s: HistorySort) => void;
  availableBasins: string[];
  availableYears: number[];
}

const SORT_OPTIONS: { value: HistorySort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name-asc", label: "Name A→Z" },
  { value: "name-desc", label: "Name Z→A" },
];

const BASIN_LABELS: Record<string, string> = {
  AL: "Atlantic",
  EP: "East Pacific",
  CP: "Central Pacific",
};

function labelForBasin(code: string): string {
  return BASIN_LABELS[code] ?? code;
}

export function HistoryFilters({
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  availableBasins,
  availableYears,
}: Props) {
  const toggleBasin = (basin: string) => {
    const has = filters.basins.includes(basin);
    onFiltersChange({
      ...filters,
      basins: has
        ? filters.basins.filter((b) => b !== basin)
        : [...filters.basins, basin],
    });
  };

  const toggleYear = (year: number) => {
    const has = filters.years.includes(year);
    onFiltersChange({
      ...filters,
      years: has
        ? filters.years.filter((y) => y !== year)
        : [...filters.years, year],
    });
  };

  const clearAll = () => onFiltersChange({ query: "", basins: [], years: [] });

  const hasActiveFilters =
    filters.query !== "" ||
    filters.basins.length > 0 ||
    filters.years.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          allowClear
          value={filters.query}
          onChange={(e) =>
            onFiltersChange({ ...filters, query: e.target.value })
          }
          prefix={<SearchOutlined aria-hidden />}
          placeholder="Search by name or ATCF id"
          className="max-w-md flex-1"
          size="large"
        />
        <Select<HistorySort>
          value={sort}
          onChange={onSortChange}
          options={SORT_OPTIONS}
          size="large"
          style={{ minWidth: 180 }}
        />
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="text-sm text-blue-600 underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {availableBasins.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-(--ant-color-text-secondary)">Basin:</span>
          {availableBasins.map((basin) => (
            <Tag.CheckableTag
              key={basin}
              checked={filters.basins.includes(basin)}
              onChange={() => toggleBasin(basin)}
            >
              {labelForBasin(basin)}
            </Tag.CheckableTag>
          ))}
        </div>
      )}

      {availableYears.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-(--ant-color-text-secondary)">Year:</span>
          {availableYears.map((y) => (
            <Tag.CheckableTag
              key={y}
              checked={filters.years.includes(y)}
              onChange={() => toggleYear(y)}
            >
              {y}
            </Tag.CheckableTag>
          ))}
        </div>
      )}
    </div>
  );
}
