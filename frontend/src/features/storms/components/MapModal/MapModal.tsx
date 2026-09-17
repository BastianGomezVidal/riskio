import { Modal, Skeleton } from "antd";
import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import { CloseOutlined } from "@ant-design/icons";
import { preloadAdvisory } from "@/data/promises";
import { semantic } from "@/design-system/tokens/semantic";
import { StormMap } from "@/components/StormMap";

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
      {/*
        antd 6 doesn't expose the modal's content slot through `styles`, so
        we override its internal class via a scoped rule. The rule is local
        to this modal (.riskio-map-modal), which prevents it from leaking.
      */}
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
          <MapModalContent
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

function MapModalContent({
  advisoryId,
  stormName,
  onClose,
  offset,
  setOffset,
}: ContentProps) {
  const advisory = use(preloadAdvisory(advisoryId));

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
        className="flex items-start justify-between gap-4 px-5 pb-4 pt-5"
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
                background: "rgba(255, 255, 255, 0.18)",
                color: semantic.colors.secondary,
                fontWeight: semantic.typography.fontWeight.medium,
              }}
            >
              Advisory #{advisory.advisoryNumber}
            </span>
            <span style={{ color: "rgba(255, 255, 255, 0.85)" }}>
              <time dateTime={advisory.issuedAt}>
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(advisory.issuedAt))}
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
      className="inline-flex size-10 shrink-0 items-center justify-center rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white hover:bg-white/25"
      style={{
        background: "rgba(255, 255, 255, 0.12)",
        color: semantic.colors.background,
      }}
    >
      <CloseOutlined style={{ fontSize: 16 }} aria-hidden />
    </button>
  );
}

function MapFallback() {
  return (
    <div aria-busy="true" className="p-5">
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  );
}
