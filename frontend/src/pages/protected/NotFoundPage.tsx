import { Button, Empty } from "antd";
import { FileSearchOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";

/**
 * Catch-all page for URLs that don't match any route.
 *
 * Rendered inside AppLayout, so the header, nav, and back button remain
 * available — the user is not stranded on a blank screen.
 *
 * Distinct from "resource not found" (e.g. a storm that doesn't exist in
 * the database), which each page handles through `classifyQueryError`.
 */
export function NotFoundPage() {
  return (
    <Empty
      image={
        <FileSearchOutlined
          style={{
            fontSize: 60,
            color: "var(--ant-color-text-quaternary)",
          }}
        />
      }
      description={
        <div>
          <p className="font-medium">Page not found.</p>
          <p className="mt-1 text-sm text-(--ant-color-text-secondary)">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
      }
    >
      <Link to="/dashboard">
        <Button type="primary">Go to dashboard</Button>
      </Link>
    </Empty>
  );
}
