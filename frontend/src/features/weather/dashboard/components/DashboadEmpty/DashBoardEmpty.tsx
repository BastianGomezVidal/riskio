import { Empty } from "antd";
import { CloudOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";

export function DashboardEmpty() {
  return (
    <Empty
      image={
        <CloudOutlined
          style={{
            fontSize: 80,
            color: "var(--ant-color-text-quaternary)",
          }}
        />
      }
      description={
        <div>
          <p className="font-medium">No active storms right now.</p>
          <p className="mt-1 text-sm text-(--ant-color-text-secondary)">
            Check{" "}
            <Link
              to="/storms"
              className="text-blue-600 underline-offset-2 hover:underline"
            >
              Storms
            </Link>{" "}
            for past storms.
          </p>
        </div>
      }
    />
  );
}
