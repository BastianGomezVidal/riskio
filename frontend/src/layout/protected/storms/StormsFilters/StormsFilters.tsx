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
      {/* Row 1: search + filter button */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          allowClear
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          prefix={<SearchOutlined aria-hidden />}
          placeholder="Search by name or ATCF id"
          className="max-w-md flex-1"
          size="large"
        />
        <Button
          size="large"
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
