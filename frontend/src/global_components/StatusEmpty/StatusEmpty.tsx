import { Button, Empty } from "antd";
import {
  DisconnectOutlined,
  CloudServerOutlined,
  FileSearchOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { CSSProperties, ReactNode } from "react";

/**
 * Shared icon styling for the three status empty states. Large, muted,
 * consistent across all three so the page never shifts between them.
 */
const ICON_STYLE: CSSProperties = {
  fontSize: 60,
  color: "var(--ant-color-text-quaternary)",
};

/**
 * Wrapper that reserves vertical space so the three status components
 * occupy the same height regardless of message length. Without this,
 * switching between states (for example, after a retry) causes the
 * surrounding layout to jump.
 */
const WRAPPER_STYLE: CSSProperties = {
  minHeight: "40vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

interface RetryProps {
  /** Optional retry handler. When provided, a "Try again" button renders. */
  onRetry?: () => void;
}

/**
 * Shown when the app cannot reach the backend: the browser is offline,
 * DNS failed, or the request timed out. The problem is usually transient,
 * so the primary action is "try again".
 */
export function OfflineEmpty({ onRetry }: RetryProps) {
  return (
    <div style={WRAPPER_STYLE}>
      <Empty
        image={<DisconnectOutlined style={ICON_STYLE} />}
        description={
          <div>
            <p className="font-medium">You're offline.</p>
            <p className="mt-1 text-sm text-(--ant-color-text-secondary)">
              Check your connection and try again.
            </p>
          </div>
        }
      >
        {onRetry && (
          <Button icon={<ReloadOutlined />} onClick={onRetry}>
            Try again
          </Button>
        )}
      </Empty>
    </div>
  );
}

/**
 * Shown for unexpected failures: 5xx responses, malformed payloads, or
 * any error the app cannot classify. The message from the backend is
 * surfaced when available, but the UI remains generic.
 */
export function ErrorEmpty({
  message,
  onRetry,
}: RetryProps & { message?: string }) {
  return (
    <div style={WRAPPER_STYLE}>
      <Empty
        image={<CloudServerOutlined style={ICON_STYLE} />}
        description={
          <div>
            <p className="font-medium">Something went wrong.</p>
            {message && (
              <p className="mt-1 text-sm text-(--ant-color-text-secondary)">
                {message}
              </p>
            )}
          </div>
        }
      >
        {onRetry && (
          <Button icon={<ReloadOutlined />} onClick={onRetry}>
            Try again
          </Button>
        )}
      </Empty>
    </div>
  );
}

/**
 * Shown when the requested resource does not exist (HTTP 404).
 *
 * The `action` prop lets the caller supply a contextual next step —
 * usually a <Link> back to a list page or a <Button> that resets a
 * filter. If omitted, only the message renders.
 */
export function NotFoundEmpty({
  message = "Not found.",
  action,
}: {
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div style={WRAPPER_STYLE}>
      <Empty
        image={<FileSearchOutlined style={ICON_STYLE} />}
        description={
          <div>
            <p className="font-medium">{message}</p>
            {action && <div className="mt-3">{action}</div>}
          </div>
        }
      />
    </div>
  );
}
