import { Link } from "react-router-dom";
import { RightOutlined } from "@ant-design/icons";
import type { StormAggregate } from "@/domain/storm";
import { stormDisplayName, stormTab } from "@/domain/storm";

interface Props {
  storm: StormAggregate;
  advisoryNumber: number;
}

export function StormBreadcrumb({ storm, advisoryNumber }: Props) {
  const stormName = stormDisplayName(storm);
  const tab = stormTab(storm);

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-3 flex items-center gap-1 text-xs text-(--ant-color-text-secondary)"
    >
      <Link
        to={`/storms?tab=${tab}`}
        className="underline-offset-2 hover:text-(--ant-color-text) hover:underline"
      >
        Storms
      </Link>
      <RightOutlined aria-hidden style={{ fontSize: 10 }} />
      <Link
        to={`/storms/${storm.atcfId}/advisories/latest`}
        className="underline-offset-2 hover:text-(--ant-color-text) hover:underline"
      >
        {stormName}
      </Link>
      <RightOutlined aria-hidden style={{ fontSize: 10 }} />
      <span className="text-(--ant-color-text)">
        Advisory #{advisoryNumber}
      </span>
    </nav>
  );
}
