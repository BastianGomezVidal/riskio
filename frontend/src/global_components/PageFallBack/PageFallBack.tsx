import { useEffect, useState } from "react";
import { Spin } from "antd";

/**
 * Neutral loading placeholder, deliberately without any layout chrome.
 *
 * Used in two places: around a lazily loaded page inside `AppLayout`, and as the
 * root Suspense fallback in main.tsx. It has to be chrome-free in both, and for
 * the root one that is not a style choice: the root Suspense sits above the
 * router, so nothing knows yet whether the route is public or protected. An
 * earlier `AppFallback` wrapped this in `AppLayout`, which meant a cold-cache
 * visit to /signin flashed the authenticated header and footer before the
 * sign-in card arrived.
 *
 * The 150ms delay is why a cached route chunk does not flash a spinner: it
 * resolves in a few milliseconds, and showing a spinner for that is a flash of
 * its own. Past 150ms the wait is real.
 */
export function PageFallback() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: "40vh" }}
    >
      <Spin size="large" />
    </div>
  );
}
