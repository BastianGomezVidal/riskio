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

          No `flex-wrap`, so the two cannot end up on separate lines. The width
          lives on a plain wrapper rather than on the `Input` because antd sets
          `.ant-input-affix-wrapper { width: 100% }` from CSS-in-JS, unlayered,
          and unlayered declarations outrank every Tailwind utility — so
          `sm:w-72` on the `Input` compiled, shipped, and was silently discarded,
          leaving a 971px bar. Measured, not assumed. The inner `w-full` is
          redundant with antd's own rule and harmless. */}
      <div className="flex items-center justify-end gap-3">
        <div className="w-full min-w-0 sm:w-72">
          <Input
            allowClear
            value={q}
            onChange={(e) => onQChange(e.target.value)}
            prefix={<SearchOutlined aria-hidden />}
            placeholder="Search by name or ATCF id"
            size="large"
          />
        </div>
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
