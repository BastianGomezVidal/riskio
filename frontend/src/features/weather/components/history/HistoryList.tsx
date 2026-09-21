import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { StormHistoryItem } from "@/domain/dashboard";
import { HistoryRow } from "./HistoryRow";

const ESTIMATED_ROW_HEIGHT = 72;

export function HistoryList({ storms }: { storms: StormHistoryItem[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: storms.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 8,
    getItemKey: (i) => storms[i].storm.atcfId,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      role="list"
      aria-label={`Storm history, ${storms.length} items`}
      className="max-h-[70vh] overflow-auto rounded-lg border border-(--ant-color-border)"
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {items.map((virtualRow) => {
          const item = storms[virtualRow.index];
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
              <HistoryRow item={item} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
