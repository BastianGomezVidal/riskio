import { useEffect, useState } from "react";
import { Button, Drawer, Slider, Tag, Typography } from "antd";
import type { StormsSort, StormsTab } from "@/domain/storm";

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  tab: StormsTab;
  /** Current applied filters, sourced from the URL. */
  basins: string[];
  categories: number[];
  yearFrom: number;
  yearTo: number;
  sort: StormsSort;
  /** Called only when the user clicks Apply. */
  onApply: (next: {
    basins: string[];
    categories: number[];
    yearFrom: number;
    yearTo: number;
    sort: StormsSort;
  }) => void;
}

const BASINS = [
  { code: "EP", label: "East Pacific" },
  { code: "CP", label: "Central Pacific" },
  { code: "AL", label: "Atlantic" },
];

const CATEGORIES = [
  { value: 0, label: "TS" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

const SORT_OPTIONS: { value: StormsSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A→Z" },
  { value: "name_desc", label: "Name Z→A" },
];

const MIN_YEAR = 2000;
const MAX_YEAR = new Date().getFullYear();

export function StormsFilterDrawer({
  open,
  onClose,
  tab,
  basins,
  categories,
  yearFrom,
  yearTo,
  sort,
  onApply,
}: Props) {
  // ── Draft state ─────────────────────────────────────────────────────
  const [draftBasins, setDraftBasins] = useState(basins);
  const [draftCategories, setDraftCategories] = useState(categories);
  const [draftYear, setDraftYear] = useState<[number, number]>([
    yearFrom,
    yearTo,
  ]);
  const [draftSort, setDraftSort] = useState<StormsSort>(sort);

  // Re-sync draft from applied values whenever the drawer opens.
  useEffect(() => {
    if (open) {
      setDraftBasins(basins);
      setDraftCategories(categories);
      setDraftYear([yearFrom, yearTo]);
      setDraftSort(sort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Handlers ────────────────────────────────────────────────────────
  const toggleBasin = (code: string) => {
    setDraftBasins((prev) =>
      prev.includes(code) ? prev.filter((b) => b !== code) : [...prev, code],
    );
  };

  const toggleCategory = (value: number) => {
    setDraftCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value],
    );
  };

  const handleCancel = () => {
    onClose();
  };

  const handleApply = () => {
    onApply({
      basins: draftBasins,
      categories: draftCategories,
      yearFrom: draftYear[0],
      yearTo: draftYear[1],
      sort: draftSort,
    });
    onClose();
  };

  const isPast = tab === "past";

  return (
    <Drawer
      open={open}
      onClose={handleCancel}
      placement="right"
      width={400}
      title={null}
      closeIcon={null}
      styles={{
        body: { padding: 0 },
        header: { display: "none" },
      }}
      footer={null}
      maskClosable
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <button
          type="button"
          onClick={handleCancel}
          aria-label="Close filters"
          className="rounded p-1 text-(--ant-color-text-secondary) transition-colors hover:bg-(--ant-color-fill-quaternary)"
        >
          <CloseIcon />
        </button>
        <span className="text-base font-semibold">Filter</span>
        <span className="w-6" aria-hidden />
      </div>

      {/* Body */}
      <div
        className="space-y-6 overflow-y-auto p-4"
        style={{ maxHeight: "calc(100vh - 160px)" }}
      >
        {/* Basin */}
        <Section title="Basin">
          <div className="flex flex-wrap gap-2">
            {BASINS.map((b) => (
              <Tag.CheckableTag
                key={b.code}
                checked={draftBasins.includes(b.code)}
                onChange={() => toggleBasin(b.code)}
              >
                {b.label}
              </Tag.CheckableTag>
            ))}
          </div>
        </Section>

        {/* Category */}
        <Section title="Category">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Tag.CheckableTag
                key={c.value}
                checked={draftCategories.includes(c.value)}
                onChange={() => toggleCategory(c.value)}
              >
                {c.label}
              </Tag.CheckableTag>
            ))}
          </div>
        </Section>

        {/* Year (only in Past) */}
        {isPast && (
          <Section title="Year">
            <Slider
              range
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={draftYear}
              onChange={(v) => setDraftYear(v as [number, number])}
              marks={{
                [MIN_YEAR]: String(MIN_YEAR),
                [MAX_YEAR]: String(MAX_YEAR),
              }}
            />
            <Text type="secondary" className="text-xs">
              {draftYear[0]} – {draftYear[1]}
            </Text>
          </Section>
        )}

        {/* Sort */}
        <Section title="Sort">
          <div className="flex flex-col gap-2">
            {SORT_OPTIONS.map((opt) => (
              <Tag.CheckableTag
                key={opt.value}
                checked={draftSort === opt.value}
                onChange={() => setDraftSort(opt.value)}
              >
                {opt.label}
              </Tag.CheckableTag>
            ))}
          </div>
        </Section>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
        <Button onClick={handleCancel}>Cancel</Button>
        <Button type="primary" onClick={handleApply}>
          Apply
        </Button>
      </div>
    </Drawer>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide uppercase text-(--ant-color-text-secondary)">
        {title}
      </h3>
      {children}
    </section>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 4L12 12M12 4L4 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
