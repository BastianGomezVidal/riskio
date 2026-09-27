import { Tag } from "antd";

const BASIN_LABELS: Record<string, string> = {
  EP: "East Pacific",
  CP: "Central Pacific",
  AL: "Atlantic",
};

const CATEGORY_LABELS: Record<number, string> = {
  0: "TS",
  1: "Cat 1",
  2: "Cat 2",
  3: "Cat 3",
  4: "Cat 4",
  5: "Cat 5",
};

const SORT_LABELS: Record<string, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  name_asc: "Name A→Z",
  name_desc: "Name Z→A",
};

interface Props {
  basins: string[];
  categories: number[];
  yearFrom: number;
  yearTo: number;
  sort: string;
  defaultSort: string;
  minYear: number;
  maxYear: number;
  onRemoveBasin: (code: string) => void;
  onRemoveCategory: (value: number) => void;
  onRemoveYear: () => void;
  onRemoveSort: () => void;
  onClearAll: () => void;
}

export function StormsAppliedFilters({
  basins,
  categories,
  yearFrom,
  yearTo,
  sort,
  defaultSort,
  minYear,
  maxYear,
  onRemoveBasin,
  onRemoveCategory,
  onRemoveYear,
  onRemoveSort,
  onClearAll,
}: Props) {
  const hasYear = yearFrom !== minYear || yearTo !== maxYear;
  const hasSort = sort !== defaultSort;

  const hasAny =
    basins.length > 0 || categories.length > 0 || hasYear || hasSort;

  if (!hasAny) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-(--ant-color-text-secondary)">Applied:</span>

      {basins.map((code) => (
        <Tag
          key={`basin-${code}`}
          closable
          onClose={(e) => {
            e.preventDefault();
            onRemoveBasin(code);
          }}
        >
          {BASIN_LABELS[code] ?? code}
        </Tag>
      ))}

      {categories.map((value) => (
        <Tag
          key={`cat-${value}`}
          closable
          onClose={(e) => {
            e.preventDefault();
            onRemoveCategory(value);
          }}
        >
          {CATEGORY_LABELS[value] ?? `Cat ${value}`}
        </Tag>
      ))}

      {hasYear && (
        <Tag
          closable
          onClose={(e) => {
            e.preventDefault();
            onRemoveYear();
          }}
        >
          {yearFrom}–{yearTo}
        </Tag>
      )}

      {hasSort && (
        <Tag
          closable
          onClose={(e) => {
            e.preventDefault();
            onRemoveSort();
          }}
        >
          {SORT_LABELS[sort] ?? sort}
        </Tag>
      )}

      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 text-xs text-blue-600 underline-offset-2 hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
