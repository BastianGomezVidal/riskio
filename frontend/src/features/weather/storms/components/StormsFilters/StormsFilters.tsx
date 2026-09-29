import { Button, Input, Tag } from "antd";
import { SearchOutlined, FilterOutlined } from "@ant-design/icons";
import type { StormsTab } from "@/domain/storm";

interface Props {
  tab: StormsTab;
  onTabChange: (tab: StormsTab) => void;
  q: string;
  onQChange: (q: string) => void;
  onFilterClick: () => void;
}

export function StormsFilters({
  tab,
  onTabChange,
  q,
  onQChange,
  onFilterClick,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Row 1: search + filter button, right-aligned to the cards below.

          `justify-end` plus a fixed input width rather than `flex-1`: a flexible
          input grows to fill whatever width is left over, so the row's alignment
          depended on the viewport and the button drifted around. The cards below
          are a full-width flex column, so the container's right edge is also the
          cards' right edge and `justify-end` lines the pair up with it.

          No `flex-wrap`, and `w-full min-w-0` on the input with `shrink-0` on
          the button. `w-full` alone is what broke this: it asks for the full row
          width, so wrapping moved the button onto its own line. Letting the input
          shrink and pinning the button is what keeps them on one line at every
          width, and `min-w-0` is what lets it actually shrink rather than
          overflow. The width is held at 18rem because "Search by name or ATCF
          id" needs roughly that at `size="large"` before it starts clipping. */}
      <div className="flex items-center justify-end gap-3">
        <Input
          allowClear
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          prefix={<SearchOutlined aria-hidden />}
          placeholder="Search by name or ATCF id"
          className="w-full min-w-0 sm:w-72"
          size="large"
        />
        <Button
          size="large"
          className="shrink-0"
          icon={<FilterOutlined aria-hidden />}
          onClick={onFilterClick}
        >
          Filter
        </Button>
      </div>

      {/* Row 2: tab chips (mutually exclusive) */}
      <div className="flex items-center gap-2">
        <TabChip
          label="Active"
          active={tab === "active"}
          onClick={() => onTabChange("active")}
        />
        <TabChip
          label="Past"
          active={tab === "past"}
          onClick={() => onTabChange("past")}
        />
      </div>
    </div>
  );
}

function TabChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tag.CheckableTag
      checked={active}
      onChange={onClick}
      style={{ paddingInline: 12, paddingBlock: 4, fontSize: 14 }}
    >
      {label}
    </Tag.CheckableTag>
  );
}
