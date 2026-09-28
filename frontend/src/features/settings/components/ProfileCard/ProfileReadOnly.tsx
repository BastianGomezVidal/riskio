import { Tag } from "antd";
import { formatUTC } from "@/domain/datetime";
import type { User } from "@/domain/users";

interface Props {
  user: User;
}

export function ProfileReadOnly({ user }: Props) {
  const roleLabel = user.role === "admin" ? "Admin" : "Client";
  const roleColor = user.role === "admin" ? "blue" : "default";

  const lastLoginParts: string[] = [];
  if (user.lastLoginAt) lastLoginParts.push(formatUTC(user.lastLoginAt));
  if (user.lastLoginBrowser) lastLoginParts.push(user.lastLoginBrowser);
  if (user.lastLoginOs) lastLoginParts.push(user.lastLoginOs);

  const lastLoginLabel =
    lastLoginParts.length > 0 ? lastLoginParts.join(" · ") : "—";

  return (
    <div className="mt-6 border-t border-(--ant-color-border) pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
        <Row label="Role">
          <Tag color={roleColor}>{roleLabel}</Tag>
        </Row>

        <Row label="Last login">
          <span className="text-sm text-(--ant-color-text-secondary)">
            {lastLoginLabel}
          </span>
        </Row>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-(--ant-color-text-secondary)">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}
