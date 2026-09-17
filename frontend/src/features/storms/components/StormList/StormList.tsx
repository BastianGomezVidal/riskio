import { useRef, type CSSProperties } from "react";
import { Empty } from "antd";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { StormSummary } from "@/domain/dashboard";
import { semantic } from "@/design-system/tokens/semantic";
import { StormCard } from "../StormCard/StormCard";

/**
 * Virtualized storm list.
 *
 * Only rows in (or near) the viewport are mounted, so this scales to
 * hundreds of storms without jank. The outer div is the scroll container;
 * an inner div is sized to the total estimated height so the scrollbar
 * reflects the full list.
 *
 * Accessibility: the outer element is a labeled region with role="list",
 * and every rendered row has role="listitem". Because virtualization
 * mounts only part of the list at a time, screen readers can't "see" the
 * whole list — the region's aria-label tells them how many items exist,
 * and keyboard users can Tab through rendered rows normally.
 */
export function StormList({
  storms,
  scrollRef,
}: {
  storms: StormSummary[];
  /** Optional external scroll container. When omitted, the list scrolls itself. */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const internalRef = useRef<HTMLDivElement>(null);
  const parentRef = scrollRef ?? internalRef;

  const estimateRowHeight = 260; // StormCard average height in px

  const virtualizer = useVirtualizer({
    count: storms.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 4, // render 4 rows above and below the viewport
    getItemKey: (index) => storms[index].storm.atcfId,
  });

  if (storms.length === 0) {
    return <Empty description="No storms stored yet." />;
  }

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      role="list"
      aria-label={`Storm list, ${storms.length} items`}
      className="overflow-auto"
      style={{
        // When no external scrollRef is provided, cap the height so the
        // container scrolls internally. When the parent owns scrolling,
        // this div grows to fit.
        maxHeight: scrollRef ? undefined : "70vh",
        // layout + paint containment (NOT size): size containment would
        // collapse this box to 0 height because it ignores its children.
        contain: "layout paint",
      }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {items.map((virtualRow) => {
          const summary = storms[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              role="listitem"
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                // Raised tile: subtly elevated surface that groups each
                // card while keeping gray-900/gray-600 text at AAA contrast.
                className="mb-3 rounded-lg border bg-(--tile-bg) p-3 transition-[background-color,box-shadow] duration-150 hover:bg-[var(--tile-bg-hover)] focus-within:ring-2 focus-within:ring-blue-600/70 focus-within:ring-offset-2 focus-within:ring-offset-white sm:p-4"
                style={
                  {
                    "--tile-bg": semantic.surface.raised,
                    "--tile-bg-hover": semantic.surface.raisedHover,
                    borderColor: semantic.surface.border,
                  } as CSSProperties
                }
              >
                <StormCard
                  storm={summary.storm}
                  advisoryId={summary.latestAdvisory?.id ?? null}
                  advisoryNumber={
                    summary.latestAdvisory?.advisoryNumber ?? null
                  }
                  advisoryIssuedAt={summary.latestAdvisory?.issuedAt ?? null}
                  points={summary.latestAdvisory?.forecastPoints ?? []}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
