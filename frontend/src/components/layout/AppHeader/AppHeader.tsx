import { Link, NavLink } from "react-router-dom";
import { UnorderedListOutlined, CloudOutlined } from "@ant-design/icons";
import { UserMenu } from "../UserMenu/UserMenu";
import { semantic } from "@/components/shared/tokens/semantic";

interface NavItem {
  to: string;
  label: string;
  Icon: React.ComponentType;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", Icon: UnorderedListOutlined },
  { to: "/storms", label: "Storms", Icon: CloudOutlined },
];

/**
 * Global header: logo on the left, nav + user menu on the right.
 *
 * Desktop: logo + nav + vertical divider + user menu.
 * Mobile:  logo + user menu only. The nav moves to the footer.
 */
export function AppHeader() {
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
          aria-label="Riskio home"
          className="flex shrink-0 items-center rounded-md focus-visible:outline focus-visible:outline-offset-4 focus-visible:outline-white"
          style={{ color: semantic.colors.headerText }}
        >
          <span className="text-base font-semibold tracking-tight">Riskio</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {/* Desktop nav — hidden below md */}
          <nav
            aria-label="Primary"
            className="hidden items-center gap-1 md:flex"
          >
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
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

          {/* Vertical divider — desktop only */}
          <div
            aria-hidden
            className="mx-2 hidden h-5 w-px md:block"
            style={{ background: semantic.colors.headerActive }}
          />

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
