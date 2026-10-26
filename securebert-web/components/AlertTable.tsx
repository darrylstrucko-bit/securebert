"use client";

import { useState } from "react";
import type { PoolItem } from "@/lib/securebertApi";
import { formatDateTime, sortByMinutesAgo, isHistoric, type SortDir } from "@/lib/resolveTime";

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

const COLS = "grid-cols-[112px_12px_1fr_104px_72px]";

export default function AlertTable({
  pool,
  caseId,
  highlighted,
  revealed,
  nowMs,
}: {
  pool: PoolItem[];
  caseId: string;
  highlighted: boolean;
  revealed: boolean;
  nowMs: number | null;
}) {
  // Date/Time is the only sortable column -- defaults to oldest-first.
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Historic/slow-burn real alerts (e.g. a prior near-miss nine days earlier)
  // stay out of the pile until a correlation run actually surfaces them --
  // showing a lone far-away row before any context is given just reads as a
  // confusing outlier, not as "the complete haystack." Noise never qualifies
  // as historic by construction, so this only ever hides real alerts.
  const visible = highlighted ? pool : pool.filter((a) => !isHistoric(a.minutes_ago));
  const sorted = sortByMinutesAgo(visible, sortDir);

  return (
    <div className="border border-panel-border rounded-md overflow-x-auto">
      <div className={`grid ${COLS} gap-1.5 px-3 py-2 text-xs font-mono-ui text-muted border-b border-panel-border bg-black/20`}>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="text-right hover:text-foreground cursor-pointer flex items-center justify-end gap-1"
          title="Sort by date/time"
        >
          Date / Time {sortDir === "asc" ? "↑" : "↓"}
        </button>
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
          const historic = highlighted && isHistoric(a.minutes_ago);

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
              <span className="font-mono-ui text-muted whitespace-nowrap text-right">
                {formatDateTime(a.minutes_ago, nowMs)}
              </span>
              <span />
              <span className="truncate min-w-0 flex items-center gap-1.5">
                <span className="truncate">{a.title}</span>
                {historic && (
                  <span className="shrink-0 text-[10px] font-mono-ui px-1.5 py-0.5 rounded border border-amber-400/40 text-amber-300 bg-amber-400/10">
                    Historic finding
                  </span>
                )}
              </span>
              <span className="text-muted truncate min-w-0 text-center">{a.category ?? "--"}</span>
              <span className={`text-center ${severityColor(a.severity)}`}>{a.severity ?? "--"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
