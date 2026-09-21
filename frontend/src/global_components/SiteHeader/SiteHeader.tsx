import { Link, NavLink } from "react-router-dom";
import {
  DashboardOutlined,
  HistoryOutlined,
  SettingOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useSession } from "@/auth/session-context";
import { semantic } from "@/design-system/tokens/semantic";

interface NavItem {
  to: string;
  label: string;
  Icon: React.ComponentType;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", Icon: DashboardOutlined, end: true },
  { to: "/history", label: "History", Icon: HistoryOutlined },
  { to: "/settings", label: "Settings", Icon: SettingOutlined },
];

export function SiteHeader() {
  const { signOut } = useSession();

  return (
    <header
      className="sticky top-0 z-30 w-full border-b"
      style={{
        background: semantic.colors.headerBackground,
        borderColor: semantic.colors.headerActive,
      }}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:px-6 lg:px-8">
        <Link
          to="/dashboard"
          aria-label="Rikio home"
          className="flex shrink-0 items-center rounded-md focus-visible:outline focus-visible:outline-offset-4 focus-visible:outline-white"
          style={{ color: semantic.colors.headerText }}
        >
          <span className="text-base font-semibold tracking-tight">Riskio</span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <nav aria-label="Primary" className="flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                    "transition-colors",
                    "focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-white",
                    isActive ? "font-medium" : "",
                  ].join(" ")
                }
                style={({ isActive }) => ({
                  background: isActive
                    ? semantic.colors.headerActive
                    : "transparent",
                  color: isActive
                    ? semantic.colors.headerText
                    : semantic.colors.headerTextMuted,
                })}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.matches('[aria-current="page"]')) {
                    e.currentTarget.style.background =
                      semantic.colors.headerHover;
                    e.currentTarget.style.color = semantic.colors.headerText;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!e.currentTarget.matches('[aria-current="page"]')) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color =
                      semantic.colors.headerTextMuted;
                  }
                }}
              >
                <Icon aria-hidden />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div
            aria-hidden
            className="mx-2 h-5 w-px"
            style={{ background: semantic.colors.headerActive }}
          />

          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{ color: semantic.colors.headerTextMuted }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = semantic.colors.headerHover;
              e.currentTarget.style.color = semantic.colors.headerText;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = semantic.colors.headerTextMuted;
            }}
          >
            <LogoutOutlined aria-hidden />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
