import { Tooltip } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";

interface Props {
  label: string;
  value: number | string;
  precision?: number;
  tooltip?: string;
}

export function StatCard({ label, value, precision, tooltip }: Props) {
  const display =
    typeof value === "number" && precision != null
      ? value.toFixed(precision)
      : value;

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-(--ant-color-border) bg-(--ant-color-bg-container) px-4 py-6 text-center">
      <div className="text-3xl font-semibold tabular-nums">{display}</div>
      <div className="mt-2 inline-flex items-center gap-1 text-xs text-(--ant-color-text-secondary)">
        {label}
        {tooltip && (
          <Tooltip title={tooltip}>
            <InfoCircleOutlined
              aria-label="More information"
              className="cursor-help text-(--ant-color-text-tertiary)"
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
}
