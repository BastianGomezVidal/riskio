interface Props {
  pacific: number;
  atlantic: number;
}

/**
 * Horizontal proportion bar showing storm counts per basin.
 * Purely informational (segments are not clickable).
 */
export function BasinBar({ pacific, atlantic }: Props) {
  const total = pacific + atlantic;

  if (total === 0) {
    return null;
  }

  const pacificPct = (pacific / total) * 100;
  const atlanticPct = (atlantic / total) * 100;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="img"
        aria-label={`${pacific} Pacific, ${atlantic} Atlantic`}
        className="flex h-2 w-full max-w-md overflow-hidden rounded-full bg-(--ant-color-fill-quaternary)"
      >
        {pacific > 0 && (
          <div
            className="h-full bg-blue-500"
            style={{ width: `${pacificPct}%` }}
          />
        )}
        {atlantic > 0 && (
          <div
            className="h-full bg-red-500"
            style={{ width: `${atlanticPct}%` }}
          />
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-(--ant-color-text-secondary)">
        {pacific > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-blue-500" />
            Pacific {pacific}
          </span>
        )}
        {atlantic > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full bg-red-500" />
            Atlantic {atlantic}
          </span>
        )}
      </div>
    </div>
  );
}
