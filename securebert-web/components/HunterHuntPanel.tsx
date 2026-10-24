"use client";

import { useState } from "react";
import { Panel, PrimaryButton, ErrorNote, FamilyBadge, FrameworkBadges, loadingLabelFor } from "./ui";
import type { RetrieveResult } from "@/lib/securebertApi";

const SAMPLES = [
  "I think our support copilot might be exfiltrating ticket data through a crafted customer message.",
  "Office macros might be launching encoded PowerShell on finance workstations.",
  "Someone may be running systematic queries against our public inference API to clone the model.",
];

export default function HunterHuntPanel({ modelWarm }: { modelWarm: boolean }) {
  const [hypothesis, setHypothesis] = useState(SAMPLES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ results: RetrieveResult[]; huntPlan: string } | null>(null);

  async function run() {
    if (!hypothesis.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hypothesis, k: 3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel
      title="Hypothesis -> Hunt Plan"
      subtitle="Type a plain-English hunting hypothesis, classic or AI-native. SecureBERT grounds it against the nearest precedent before Groq turns it into a concrete hunt plan."
    >
      <div className="flex flex-wrap gap-1.5 mb-3">
        {SAMPLES.map((s) => (
          <button
            key={s}
            onClick={() => setHypothesis(s)}
            className="text-xs px-2 py-1 rounded border border-panel-border text-muted hover:text-foreground cursor-pointer"
          >
            {s.length > 42 ? s.slice(0, 42) + "..." : s}
          </button>
        ))}
      </div>
      <textarea
        value={hypothesis}
        onChange={(e) => setHypothesis(e.target.value)}
        rows={3}
        className="w-full bg-black/30 border border-panel-border rounded px-3 py-2 text-sm"
      />
      <div className="mt-3">
        <PrimaryButton onClick={run} loading={loading} loadingLabel={loadingLabelFor(modelWarm)}>
          Build hunt plan
        </PrimaryButton>
      </div>
      {error && <ErrorNote message={error} />}

      {result && (
        <div className="mt-5 space-y-4">
          <div className="rounded border border-panel-border bg-black/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {result.huntPlan}
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Grounded against</h3>
            <ul className="space-y-2">
              {result.results.map((r) => (
                <li key={r.case_id} className="text-sm border border-panel-border rounded px-3 py-2">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-medium">
                      {r.case_id} -- {r.case_name}
                    </span>
                    <span className="font-mono-ui text-xs text-muted">
                      similarity {r.similarity.toFixed(3)}
                    </span>
                  </div>
                  <div className="mt-1">
                    <FamilyBadge family={r.attack_family} />
                  </div>
                  <FrameworkBadges
                    attack={r.mitre_attack_mapping as { technique_id?: string }[]}
                    atlas={r.mitre_atlas_mapping as { technique_id?: string }[]}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Panel>
  );
}
