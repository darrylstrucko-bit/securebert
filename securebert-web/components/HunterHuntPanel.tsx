"use client";

import { useState } from "react";
import { Panel, PrimaryButton, ErrorNote, FamilyBadge, FrameworkBadges } from "./ui";
import { fetchJson } from "@/lib/fetchJson";
import type { RetrieveResult } from "@/lib/securebertApi";

const SAMPLES = [
  "I think our support copilot might be exfiltrating ticket data through a crafted customer message.",
  "Office macros might be launching encoded PowerShell on finance workstations.",
  "Someone may be running systematic queries against our public inference API to clone the model.",
];

type HuntResponse = {
  results: RetrieveResult[];
  reasoning: string;
  techniques: string;
  dataSources: string;
  starterQuery: string;
};

// A small colored dot, consistently used to mark where a piece of information
// came from -- NOT reusing accent/accent-ai (blue/purple), since those already
// mean "classic vs AI-native attack" everywhere else in the app and reusing
// them here would make provenance look related to attack family when it isn't.
function ProvenanceRow({ source, label, children }: { source: "securebert" | "groq"; label: string; children: React.ReactNode }) {
  const dot = source === "securebert" ? "bg-emerald-400" : "bg-slate-400";
  return (
    <div className="flex gap-2.5">
      <span className={`h-2 w-2 rounded-full ${dot} shrink-0 mt-1.5`} />
      <div className="min-w-0">
        <div className="text-xs font-mono-ui text-muted uppercase tracking-wide">{label}</div>
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export default function HunterHuntPanel({ modelWarm }: { modelWarm: boolean }) {
  const [hypothesis, setHypothesis] = useState(SAMPLES[0]);
  const [selectedSample, setSelectedSample] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HuntResponse | null>(null);

  async function run() {
    if (!hypothesis.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchJson<HuntResponse>("/api/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hypothesis, k: 3 }),
      });
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
      subtitle="Type a plain-English hunting hypothesis, classic or AI-native. SecureBERT 2.0 grounds it against the nearest precedent before Groq turns it into a concrete hunt plan."
    >
      <div className="flex flex-wrap gap-1.5 mb-3">
        {SAMPLES.map((s, i) => (
          <button
            key={s}
            onClick={() => {
              setHypothesis(s);
              setSelectedSample(i);
            }}
            className={`text-xs px-2 py-1 rounded border cursor-pointer transition-colors ${
              selectedSample === i
                ? "border-accent bg-accent/15 text-accent"
                : "border-panel-border text-muted hover:text-foreground"
            }`}
          >
            {s.length > 42 ? s.slice(0, 42) + "..." : s}
          </button>
        ))}
      </div>
      <textarea
        value={hypothesis}
        onChange={(e) => {
          setHypothesis(e.target.value);
          setSelectedSample(null);
        }}
        rows={3}
        className="w-full bg-black/30 border border-panel-border rounded px-3 py-2 text-sm"
      />
      <div className="mt-3">
        <PrimaryButton onClick={run} loading={loading} modelWarm={modelWarm}>
          Build hunt plan
        </PrimaryButton>
      </div>
      {error && <ErrorNote message={error} />}

      {result && (
        <div className="mt-5 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <h3 className="text-sm font-semibold">What SecureBERT 2.0 retrieved</h3>
            </div>
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

          <div className="border-t border-panel-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              <h3 className="text-sm font-semibold">Groq&rsquo;s hunt plan</h3>
              <span className="text-xs text-muted">(built from the grounding above, not invented independently)</span>
            </div>
            <div className="rounded border border-panel-border bg-black/20 p-4 space-y-3">
              {result.reasoning && (
                <ProvenanceRow source="groq" label="Reasoning">
                  {result.reasoning}
                </ProvenanceRow>
              )}
              {result.techniques && (
                <ProvenanceRow source="groq" label="Techniques to hunt">
                  {result.techniques}
                </ProvenanceRow>
              )}
              {result.dataSources && (
                <ProvenanceRow source="groq" label="Data sources">
                  {result.dataSources}
                </ProvenanceRow>
              )}
              {result.starterQuery && (
                <ProvenanceRow source="groq" label="Starter query">
                  <code className="font-mono-ui text-xs bg-black/30 rounded px-2 py-1 block whitespace-pre-wrap">
                    {result.starterQuery}
                  </code>
                </ProvenanceRow>
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
