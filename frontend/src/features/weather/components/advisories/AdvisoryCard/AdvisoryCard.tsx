import { Suspense, useState } from "react";
import { DownOutlined } from "@ant-design/icons";
import { formatUTC } from "@/domain/format/datetime";

import type { AdvisoryRef } from "@/domain/storm";
import { AdvisoryInline } from "../AdvisoryInline/AdvisoryInline";

interface Props {
  advisory: AdvisoryRef;
}

/**
 * One collapsible advisory card.
 *
 * Collapsed: number + issued date + "View details" button.
 * Expanded: fetches the full advisory (forecastPoints, warnings, track,
 * cone, rawText) from GET /advisories/:id and renders it inline.
 *
 * State is local, so multiple cards can be open at once.
 */
export function AdvisoryCard({ advisory }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border border-(--ant-color-border) bg-(--ant-color-bg-container)">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="font-medium">Advisory #{advisory.advisoryNumber}</div>
          <div className="mt-0.5 text-xs text-(--ant-color-text-secondary)">
            Issued{" "}
            <time dateTime={advisory.issuedAt}>
              {formatUTC(advisory.issuedAt)}
            </time>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          aria-expanded={isOpen}
          className="inline-flex shrink-0 items-center gap-1 rounded border border-(--ant-color-border) px-3 py-1 text-sm transition-colors hover:bg-(--ant-color-fill-quaternary) focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          {isOpen ? "Hide details" : "View details"}
          <DownOutlined
            aria-hidden
            className="transition-transform duration-150"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-(--ant-color-border) p-4">
          <Suspense fallback={<AdvisorySkeleton />}>
            <AdvisoryInline advisoryId={advisory.id} />
          </Suspense>
        </div>
      )}
    </div>
  );
}

function AdvisorySkeleton() {
  return (
    <div aria-busy="true" className="animate-pulse space-y-4">
      <div className="h-6 w-24 rounded bg-(--ant-color-fill-quaternary)" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-(--ant-color-fill-quaternary)"
          />
        ))}
      </div>
      <div className="h-80 rounded-lg bg-(--ant-color-fill-quaternary)" />
      <div className="h-40 rounded-lg bg-(--ant-color-fill-quaternary)" />
    </div>
  );
}
