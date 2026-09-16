import { use } from "react";
import { Button } from "antd";
import { useSession } from "../../auth/session-context";
import { preloadHealth, preloadStorms } from "../../api/promises";

export function Dashboard() {
  const { user, signOut } = useSession();

  // `use()` unwraps the preloaded promises; the nearest <Suspense> boundary
  // renders its fallback while either request is still in flight.
  const health = use(preloadHealth());
  const storms = use(preloadStorms());

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Riskio</h1>
          <p className="mt-1 text-sm text-gray-600">
            {user?.email ?? "Signed in"} · <span className="capitalize">{user?.role}</span>
          </p>
        </div>
        <Button onClick={signOut}>Sign out</Button>
      </header>

      <section className="mt-8">
        <p className="text-sm text-gray-600">
          API: <code className="rounded bg-gray-100 px-1.5 py-0.5">{health.status}</code>
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Active storms</h2>
        {storms.data.length === 0 ? (
          <p className="mt-2 text-sm text-gray-600">No storms stored yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-200 rounded-lg border border-gray-200">
            {storms.data.map((storm) => (
              <li
                key={storm.atcfId}
                className="flex flex-col justify-between gap-1 py-2 sm:flex-row sm:items-center"
              >
                <strong>{storm.name ?? storm.atcfId}</strong>
                <span className="text-sm text-gray-500">
                  {storm.basin} · {storm.lastSeenAt}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}