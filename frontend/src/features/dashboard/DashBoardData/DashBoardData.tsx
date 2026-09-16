import { use } from 'react';
import { preloadHealth, preloadStorms } from '@/api/promises';
import { StatGrid } from '../StatGrid/StatGrid';
import { StormList } from '../StormList/StormList';

export function DashboardData() {
  const health = use(preloadHealth());
  const storms = use(preloadStorms());

  return (
    <>
      <section aria-label="API status" className="mt-6">
        <p className="text-sm text-[--ant-color-text-secondary)]">
          API:{' '}
          <code className="rounded bg-[--ant-color-fill-quaternary)] px-1.5 py-0.5">
            {health.status}
          </code>
        </p>
      </section>

      <StatGrid storms={storms.data} />

      <section aria-labelledby="storms-heading" className="mt-8">
        <h2 id="storms-heading" className="text-lg font-semibold">
          Active storms
        </h2>
        <div className="mt-3">
          <StormList storms={storms.data} />
        </div>
      </section>
    </>
  );
}