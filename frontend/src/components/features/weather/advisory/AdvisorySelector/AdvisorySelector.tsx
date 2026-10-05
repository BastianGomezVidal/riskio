import { Dropdown, Button, type MenuProps } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import type { StormAggregate } from "@/domain/storm";

interface Props {
  storm: StormAggregate;
  current: number;
}

export function AdvisorySelector({ storm, current }: Props) {
  const navigate = useNavigate();
  const latest = storm.latestAdvisoryNumber ?? 0;
  const isLatest = current === latest;

  // Generate [latest, latest-1, ..., 1].
  // In production the ingestion runs continuously, so advisory numbers
  // are contiguous. In dev they may have gaps; a click on a missing
  // number lands on a 404 page.
  const numbers = Array.from({ length: latest }, (_, i) => latest - i);

  const items: MenuProps["items"] = numbers.map((n) => ({
    key: String(n),
    disabled: n === current,
    label: (
      <span>
        Advisory #{n}
        {n === latest && (
          <span className="ml-2 text-xs text-(--ant-color-text-tertiary)">
            latest
          </span>
        )}
      </span>
    ),
  }));

  const handleClick: MenuProps["onClick"] = ({ key }) => {
    navigate(`/storms/${storm.atcfId}/advisories/${key}`);
  };

  return (
    <div className="mb-6">
      <Dropdown
        menu={{ items, onClick: handleClick }}
        trigger={["click"]}
        placement="bottomLeft"
        styles={{ root: { minWidth: 220 } }}
      >
        <Button
          className="bg-(--surface-raised)
                font-semibold
                 text-(--color-gray-900) 
                hover:bg-(--surface-raised-hover)"
        >
          Advisory #{current}
          {isLatest && " · latest"}
          <DownOutlined />
        </Button>
      </Dropdown>
    </div>
  );
}
