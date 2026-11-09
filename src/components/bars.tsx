export function Bars({ rows }: { rows: { label: string; value: number; max?: number; suffix?: string }[] }) {
  const peak = Math.max(1, ...rows.map((row) => row.max ?? row.value));
  return (
    <ul className="space-y-4">
      {rows.map((row) => {
        const cap = row.max ?? peak;
        const width = Math.max(0, Math.min(100, Math.round((row.value / cap) * 100)));
        const shown = row.suffix ?? String(row.value);
        return (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3 text-[14px]">
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="shrink-0 tabular-nums text-muted">{shown}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-soft">
              <div className="h-full rounded-full bg-ink" style={{ width: `${width}%` }} />
            </div>
            <meter className="sr-only" min={0} max={cap} value={row.value}>
              {row.label} {shown}
            </meter>
          </li>
        );
      })}
    </ul>
  );
}
