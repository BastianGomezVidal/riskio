import { Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Per-route back navigation fallbacks.
 *
 * When the browser has history to go back to (window.history.length > 1),
 * the button behaves like the browser back button. When it doesn't —
 * because the user landed on this URL by pasting it or following an
 * external link — the button navigates to the fallback route for the
 * current path.
 *
 * The list is scanned in order; the first matching prefix wins. Add new
 * pages at the top if they need a specific fallback.
 */
const FALLBACKS: Array<{ prefix: string; fallback: string }> = [
  { prefix: "/storms/", fallback: "/history" },
  { prefix: "/advisories/", fallback: "/history" },
  { prefix: "/history", fallback: "/dashboard" },
  { prefix: "/settings", fallback: "/dashboard" },
];

const DEFAULT_FALLBACK = "/dashboard";

function resolveFallback(pathname: string): string {
  return (
    FALLBACKS.find(({ prefix }) => pathname.startsWith(prefix))?.fallback ??
    DEFAULT_FALLBACK
  );
}

/**
 * A back button for protected pages. Renders nothing on the dashboard,
 * which is the app's home and has no sensible "back" destination.
 *
 * Uses `window.history.length > 1` as a heuristic for "the browser has
 * history to go back to". It is not perfect — a user who arrived from
 * an external site has history but would leave the app on back — but it
 * covers the common cases without threading state through every Link.
 */
export function BackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // The dashboard is the home — no back destination.
  if (pathname === "/dashboard" || pathname === "/") {
    return null;
  }

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(resolveFallback(pathname));
    }
  };

  return (
    <Button
      type="link"
      icon={<ArrowLeftOutlined />}
      onClick={handleBack}
      style={{ paddingLeft: 0, marginBottom: 8 }}
    >
      Back
    </Button>
  );
}
