import { Card, Statistic } from "antd";

interface Props {
  label: string;
  value: number | string;
  precision?: number;
}

export function StatCard({ label, value, precision }: Props) {
  return (
    <Card size="small" className="h-full">
      <Statistic title={label} value={value} precision={precision} />
    </Card>
  );
}
