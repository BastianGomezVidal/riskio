import { Dropdown, type MenuProps } from "antd";
import { useSession } from "@/auth/session-context";
import { Link, useNavigate } from "react-router-dom";
import { semantic } from "@/design-system/tokens/semantic";
import { UserAvatar } from "@/features/settings";

export function UserMenu() {
  const { user, signOut } = useSession();
  const navigate = useNavigate();

  if (!user) return null;

  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const roleLabel = user.role === "admin" ? "Admin" : "Client";

  const menuItems: MenuProps["items"] = [
    {
      key: "header",
      type: "group",
      label: (
        <div className="flex items-start gap-3 px-2 py-2">
          <UserAvatar src={user.avatarUrl} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-900">
              {fullName}
            </div>
            <div className="truncate text-xs text-gray-500">{user.email}</div>
            <div className="truncate text-xs text-gray-500">
              {roleLabel}
              {user.phone ? ` · ${user.phone}` : ""}
            </div>
          </div>
        </div>
      ),
    },
    { type: "divider" },
    {
      key: "profile",
      label: <Link to="/settings#profile">Profile</Link>,
    },
    {
      key: "reset-password",
      label: <Link to="/settings#reset-password">Reset password</Link>,
    },
    { type: "divider" },
    {
      key: "delete-account",
      danger: true,
      label: <Link to="/settings#delete-account">Delete account</Link>,
    },
    { type: "divider" },
    {
      key: "sign-out",
      label: "Sign out",
      onClick: () => {
        signOut();
        navigate("/", { replace: true });
      },
    },
  ];

  return (
    <Dropdown
      menu={{ items: menuItems }}
      trigger={["click"]}
      placement="bottomRight"
      styles={{ root: { minWidth: 260 } }}
    >
      <button
        type="button"
        aria-label="Open user menu"
        className="inline-flex items-center gap-1 rounded-md p-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ background: "transparent" }}
      >
        <UserAvatar src={user.avatarUrl} size={32} />
        <span
          aria-hidden
          className="text-xs"
          style={{ color: semantic.colors.headerTextMuted }}
        >
          ▼
        </span>
      </button>
    </Dropdown>
  );
}
