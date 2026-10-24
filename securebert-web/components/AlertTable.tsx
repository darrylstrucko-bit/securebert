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
  return (
    <div className="border border-panel-border rounded-md overflow-hidden">
      <div className="grid grid-cols-[92px_1fr_90px_64px] gap-1.5 px-3 py-2 text-xs font-mono-ui text-muted border-b border-panel-border bg-black/20">
        <span>Time</span>
        <span>Title</span>
        <span>Category</span>
        <span>Severity</span>
      </div>
      <div className="max-h-[480px] overflow-y-auto divide-y divide-panel-border/60">
        {pool.map((a) => {
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
              className={`grid grid-cols-[92px_1fr_90px_64px] gap-1.5 px-3 py-2 text-xs items-start ${rowClass}`}
              title={a.description ?? undefined}
            >
              <span className="font-mono-ui text-muted whitespace-nowrap">{formatTime(a.time)}</span>
              <span className="truncate">{a.title}</span>
              <span className="text-muted truncate">{a.category ?? "--"}</span>
              <span className={severityColor(a.severity)}>{a.severity ?? "--"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
