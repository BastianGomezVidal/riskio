import { Link, NavLink } from "react-router-dom";
import {
  UnorderedListOutlined,
  CloudOutlined,
  ApiOutlined,
  GithubOutlined,
} from "@ant-design/icons";
import { semantic } from "@/design-system/tokens/semantic";

interface FooterNavItem {
  to: string;
  label: string;
  Icon: React.FC<{ style?: React.CSSProperties }>;
}

const FOOTER_NAV_ITEMS: FooterNavItem[] = [
  { to: "/dashboard", label: "Dashboard", Icon: UnorderedListOutlined },
  { to: "/storms", label: "Storms", Icon: CloudOutlined },
];

const AUTHOR = "Juan Sebastián Gómez Vidal";
const AUTHOR_SHORT = "J.S.G.V.";
const VERSION = "v1.0.0";
const YEAR = new Date().getFullYear();

const SWAGGER_URL = "http://localhost:3000/docs";
const GITHUB_URL = "https://github.com/JuanseGomez/riskio";

/**
 * Global footer.
 *
 * Desktop/iPad: static at the end of the page. Author, version, and
 * external links in a single centered line over a subtle background.
 *
 * Mobile: sticky at the bottom, fused with the primary navigation.
 */
export function AppFooter() {
  return (
    <footer
      className="w-full border-t"
      style={{
        borderColor: "var(--ant-color-border-secondary)",
        background: "var(--ant-color-bg-layout)",
      }}
    >
      {/* ── Mobile: sticky nav + info strip ───────────────────────── */}
      <div
        className="sticky bottom-0 z-20 border-t md:hidden"
        style={{
          background: semantic.colors.headerBackground,
          borderColor: semantic.colors.headerActive,
        }}
      >
        <nav aria-label="Primary mobile" className="flex justify-around">
          {FOOTER_NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                  "transition-colors",
                  isActive ? "font-medium" : "",
                ].join(" ")
              }
              style={({ isActive }) => ({
                color: isActive
                  ? semantic.colors.headerText
                  : semantic.colors.headerTextMuted,
              })}
            >
              <Icon aria-hidden style={{ fontSize: 18 }} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div
          className="border-t px-4 py-1 text-center text-[10px]"
          style={{
            borderColor: semantic.colors.headerActive,
            color: semantic.colors.headerTextMuted,
          }}
        >
          © {YEAR} · {AUTHOR_SHORT} · {VERSION}
        </div>
      </div>

      {/* ── Desktop/iPad: static single-line footer ───────────────── */}
      <div className="hidden md:block">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <div
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs"
            style={{ color: "var(--ant-color-text-secondary)" }}
          >
            <span>{AUTHOR}</span>
            <span aria-hidden>·</span>
            <span>{VERSION}</span>
            <span aria-hidden>·</span>

            <Link
              to={SWAGGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open API documentation (Swagger)"
              className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
              style={{ color: "inherit" }}
            >
              <ApiOutlined aria-hidden />
              <span>Swagger</span>
            </Link>

            <span aria-hidden>·</span>

            <Link
              to={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open GitHub repository"
              className="inline-flex items-center gap-1.5 transition-opacity hover:opacity-70"
              style={{ color: "inherit" }}
            >
              <GithubOutlined aria-hidden />
              <span>GitHub</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
