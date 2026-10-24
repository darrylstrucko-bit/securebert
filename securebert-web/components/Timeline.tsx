import type { PoolItem } from "@/lib/securebertApi";
import { FrameworkBadges } from "./ui";

// Sorted directly off each alert's own `time` field, not Groq's narrated order --
// an objective, data-derived sequence to sit next to the LLM's prose interpretation
// of the same alerts. Both "HH:MM" and "YYYY-MM-DD HH:MM" sort correctly as plain
// strings since they're already zero-padded/ISO-ordered.
export default function Timeline({ items }: { items: PoolItem[] }) {
  const sorted = [...items].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  return (
    <div className="space-y-0">
      {sorted.map((a, i) => (
        <div key={a.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="h-2.5 w-2.5 rounded-full bg-accent shrink-0 mt-1" />
            {i < sorted.length - 1 && <span className="w-px flex-1 bg-panel-border" />}
          </div>
          <div className="pb-4 min-w-0">
            <div className="text-xs font-mono-ui text-muted">{a.time ?? "--"}</div>
            <div className="text-sm font-medium">{a.title}</div>
            {a.why_it_matters && <p className="text-xs text-muted mt-0.5">{a.why_it_matters}</p>}
            <FrameworkBadges
              attack={a.mitre_techniques.map((t) => ({ technique_id: t }))}
              atlas={a.mitre_atlas_techniques.map((t) => ({ technique_id: t }))}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
