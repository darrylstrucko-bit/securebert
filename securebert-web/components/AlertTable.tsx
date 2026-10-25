import type { PoolItem } from "@/lib/securebertApi";

// Multi-day cases (e.g. the supply-chain case) store "YYYY-MM-DD HH:MM"; same-day
// cases just "HH:MM". Every date here is 2026, so drop the year to keep the column
// narrow without losing the month/day that actually matters for ordering.
function formatTime(time: string | null): string {
  if (!time) return "--";
  return time.replace(/^2026-/, "");
}

function severityColor(severity: string | null): string {
  switch (severity) {
    case "Critical":
      return "text-red-300";
    case "High":
      return "text-orange-300";
    case "Medium":
      return "text-yellow-300";
    default:
      return "text-muted";
  }
}

const COLS = "grid-cols-[88px_16px_1fr_84px_60px]";

export default function AlertTable({
  pool,
  caseId,
  highlighted,
  revealed,
}: {
  pool: PoolItem[];
  caseId: string;
  highlighted: boolean;
  revealed: boolean;
}) {
  // Always chronological, past-to-present -- independent of whatever order the
  // backend (or the static pre-run bundle) happened to return items in, so the
  // row order never visibly changes when "Run correlation" swaps in the live,
  // highlighted data for the same pool.
  const sorted = [...pool].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  return (
    <div className="border border-panel-border rounded-md overflow-x-auto">
      <div className={`grid ${COLS} gap-1.5 px-3 py-2 text-xs font-mono-ui text-muted border-b border-panel-border bg-black/20`}>
        <span className="text-right">Time</span>
        <span />
        <span>Title</span>
        <span className="text-center">Category</span>
        <span className="text-center">Severity</span>
      </div>
      <div className="max-h-[480px] overflow-y-auto divide-y divide-panel-border/60">
        {sorted.map((a) => {
          const isDetected = highlighted && a.in_detected_cluster;
          const isReal = a.ground_truth === caseId;
          const missed = revealed && !a.in_detected_cluster && isReal;

          let rowClass = "bg-transparent";
          if (isDetected && revealed) {
            rowClass = isReal ? "bg-green-500/10 border-l-2 border-l-green-400" : "bg-red-500/10 border-l-2 border-l-red-400";
          } else if (isDetected) {
            rowClass = "bg-accent/10 border-l-2 border-l-accent";
          } else if (missed) {
            rowClass = "bg-amber-400/10 border-l-2 border-l-amber-400";
          }

          return (
            <div
              key={a.id}
              className={`grid ${COLS} gap-1.5 px-3 py-2 text-xs items-start ${rowClass}`}
              title={a.description ?? undefined}
            >
              <span className="font-mono-ui text-muted whitespace-nowrap text-right">{formatTime(a.time)}</span>
              <span />
              <span className="truncate min-w-0">{a.title}</span>
              <span className="text-muted truncate min-w-0 text-center">{a.category ?? "--"}</span>
              <span className={`text-center ${severityColor(a.severity)}`}>{a.severity ?? "--"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
