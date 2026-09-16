import { Button } from "antd";
import { useSession } from "../../../auth/session-context";

export function DashboardHeader() {
  const { user, signOut } = useSession();

  return (
    <header className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Riskio</h1>
        <p className="mt-1 text-sm text-[--ant-color-text-secondary)]">
          {user?.email ?? "Signed in"} ·{" "}
          <span className="capitalize">{user?.role}</span>
        </p>
      </div>
      <Button onClick={signOut}>Sign out</Button>
    </header>
  );
}
