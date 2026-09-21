import { Modal, Skeleton } from "antd";
import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import { CloseOutlined } from "@ant-design/icons";
import { preloadAdvisory, resetAdvisory } from "@/data/promises";
import { semantic } from "@/design-system/tokens/semantic";
import { StormMap } from "@/global_components/StormMap";
import { formatUTC } from "@/domain/format/datetime";

interface Props {
  open: boolean;
  onClose: () => void;
  advisoryId: string | null;
  stormName: string;
}

export function MapModal({ open, onClose, advisoryId, stormName }: Props) {
  const [offset, setOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    if (!open) setOffset({ x: 0, y: 0 });
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closeIcon={null}
      width={560}
      centered
      destroyOnHidden
      className="riskio-map-modal"
      style={{
        maxWidth: "94vw",
        paddingBottom: 0,
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
      styles={{
        body: { padding: 0 },
        mask: {
          backdropFilter: "blur(2px)",
          background: "rgba(15, 23, 42, 0.42)",
        },
      }}
    >
      <style>{`
        .riskio-map-modal .ant-modal-content {
          padding: 0;
          overflow: hidden;
          border-radius: 12px;
          box-shadow: 0 24px 48px -12px rgba(15, 23, 42, 0.35);
        }
      `}</style>

      {advisoryId ? (
        <Suspense fallback={<MapFallback />}>
          <MapModalLoader
            advisoryId={advisoryId}
            stormName={stormName}
            onClose={onClose}
            offset={offset}
            setOffset={setOffset}
          />
        </Suspense>
      ) : (
        <MapFallback />
      )}
    </Modal>
  );
}

interface ContentProps {
  advisoryId: string;
  stormName: string;
  onClose: () => void;
  offset: { x: number; y: number };
  setOffset: (o: { x: number; y: number }) => void;
}

function MapModalLoader({
  advisoryId,
  stormName,
  onClose,
  offset,
  setOffset,
}: ContentProps) {
  const result = use(preloadAdvisory(advisoryId));
  const [retryToken, setRetryToken] = useState(0);

  const retry = () => {
    resetAdvisory(advisoryId);
    setRetryToken((n) => n + 1);
  };

  if (result.status !== "ok") {
    const message =
      result.status === "offline"
        ? "You're offline."
        : result.status === "not-found"
          ? "Advisory not found."
          : result.message;

    return <ModalMessage message={message} onRetry={retry} onClose={onClose} />;
  }

  return (
    <MapModalView
      key={retryToken}
      advisory={result.data}
      stormName={stormName}
      onClose={onClose}
      offset={offset}
      setOffset={setOffset}
    />
  );
}

function MapModalView({
  advisory,
  stormName,
  onClose,
  offset,
  setOffset,
}: {
  advisory: import("@/domain/storm").AdvisoryDetail;
  stormName: string;
  onClose: () => void;
  offset: { x: number; y: number };
  setOffset: (o: { x: number; y: number }) => void;
}) {
  const dragState = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  }>({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button")) return;
      dragState.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        baseX: offset.x,
        baseY: offset.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [offset.x, offset.y],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragState.current.active) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      setOffset({
        x: dragState.current.baseX + dx,
        y: dragState.current.baseY + dy,
      });
    },
    [setOffset],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.current.active) return;
    dragState.current.active = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div>
      <header
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="presentation"
        className="flex items-start justify-between gap-4 px-5 pt-5 pb-4"
        style={{
          background: semantic.colors.background,
          color: semantic.colors.textPrimary,
          borderBottom: `1px solid ${semantic.surface.border}`,
          cursor: dragState.current.active ? "grabbing" : "grab",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <div className="min-w-0">
          <h2
            className="truncate"
            style={{
              margin: 0,
              fontSize: semantic.typography.fontSize.lg,
              fontWeight: semantic.typography.fontWeight.semibold,
              lineHeight: semantic.typography.lineHeight.tight,
              color: semantic.colors.textPrimary,
            }}
          >
            {stormName}
          </h2>

          <div
            className="mt-2 flex flex-wrap items-center gap-2"
            style={{ fontSize: semantic.typography.fontSize.sm }}
          >
            <span
              className="inline-flex items-center rounded px-2 py-0.5"
              style={{
                background: semantic.surface.raised,
                color: semantic.colors.textPrimary,
                fontWeight: semantic.typography.fontWeight.medium,
              }}
            >
              Advisory #{advisory.advisoryNumber}
            </span>
            <span style={{ color: semantic.colors.textSecondary }}>
              <time dateTime={advisory.issuedAt}>
                {formatUTC(advisory.issuedAt)}
              </time>
            </span>
          </div>
        </div>

        <CloseButton onClose={onClose} />
      </header>

      <StormMap track={advisory.track} cone={advisory.cone} height={340} />

      <footer
        className="px-5 py-3"
        style={{
          borderTop: `1px solid ${semantic.surface.border}`,
          background: semantic.gradient.footer,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: semantic.typography.fontSize.xs,
            lineHeight: semantic.typography.lineHeight.relaxed,
            color: semantic.colors.textSecondary,
          }}
        >
          Track and cone of uncertainty. The white marker is the storm's
          position at issue time; the filled marker is the last forecast point.
        </p>
      </footer>
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close map"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      style={{
        background: "transparent",
        color: semantic.colors.textSecondary,
        border: "none",
        cursor: "pointer",
      }}
    >
      <CloseOutlined style={{ fontSize: 16 }} aria-hidden />
    </button>
  );
}

function ModalMessage({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center">
      <p className="text-sm font-medium">{message}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function MapFallback() {
  return (
    <div aria-busy="true" className="p-5">
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );
}
