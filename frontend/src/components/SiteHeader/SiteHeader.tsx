import { Link, NavLink } from "react-router-dom";
import {
  DashboardOutlined,
  HistoryOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { semantic } from "@/design-system/tokens/semantic";
import { primitives } from "@/design-system/tokens/primitives";
import { SwirlMark } from "@/assets/svgs/SwirlMark";

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
  console.log("[SiteHeader] render");
  return (
    <header
      className="sticky top-0 z-30 w-full border-b"
      style={{
        background: semantic.colors.background,
        borderColor: semantic.surface.border,
      }}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          aria-label="Rikio home"
          className="flex shrink-0 items-center gap-2 rounded-md focus-visible:outline focus-visible:outline-offset-4 focus-visible:outline-blue-500"
          style={{ color: semantic.colors.textPrimary }}
        >
          <SwirlMark />
          <span
            className="text-base font-semibold tracking-tight"
            style={{ letterSpacing: "-0.01em" }}
          >
            Rikio
          </span>
        </Link>

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
                  "focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-500",
                  isActive ? "font-medium" : "",
                ].join(" ")
              }
              style={({ isActive }) => ({
                background: isActive
                  ? primitives.colors.gray[100]
                  : "transparent",
                color: isActive
                  ? semantic.colors.textPrimary
                  : semantic.colors.textSecondary,
              })}
            >
              <Icon aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
