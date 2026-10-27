"use client";

import { useState } from "react";
import { Panel, PrimaryButton, ErrorNote, FamilyBadge, FrameworkBadges, LinkedText } from "./ui";
import { ExamplePicker, type Sample } from "./ExamplePicker";
import { fetchJson } from "@/lib/fetchJson";
import type { RetrieveResult } from "@/lib/securebertApi";

const SAMPLES: Sample[] = [
  {
    label: "AI data exfiltration",
    text: "I think our support copilot might be exfiltrating ticket data through a crafted customer message.",
  },
  {
    label: "Macro-launched PowerShell",
    text: "Office macros might be launching encoded PowerShell on finance workstations.",
  },
  {
    label: "Model extraction attempt",
    text: "Someone may be running systematic queries against our public inference API to clone the model.",
  },
];

type HuntResponse = {
  results: RetrieveResult[];
  reasoning: string;
  techniques: string;
  dataSources: string;
  starterQuery: string;
};

// A small colored dot marking where a piece of information came from -- NOT
// reusing accent/accent-ai (blue/purple), since those already mean "classic vs
// AI-native attack" everywhere else and reusing them here would make
// provenance look related to attack family when it isn't.
function ProvenanceRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0 mt-1.5" />
      <div className="min-w-0">
        <div className="text-xs font-mono-ui text-muted uppercase tracking-wide">{label}</div>
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export default function HunterHuntPanel({ modelWarm }: { modelWarm: boolean }) {
  const [hypothesis, setHypothesis] = useState(SAMPLES[0].text);
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
      <div className="shrink-0">
        <ExamplePicker
          label="Choose an example or enter your own hypothesis"
          samples={SAMPLES}
          value={hypothesis}
          onChange={setHypothesis}
          selectedIndex={selectedSample}
          onSelectIndex={setSelectedSample}
          rows={3}
        />
        <div className="flex justify-start mt-3">
          <PrimaryButton onClick={run} loading={loading} modelWarm={modelWarm}>
            Build hunt plan
          </PrimaryButton>
        </div>
        {error && <ErrorNote message={error} />}
      </div>

      <div className="mt-5 max-h-[55vh] overflow-y-auto">
        {result && (
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <h3 className="text-sm font-semibold">Groq&rsquo;s hunt plan</h3>
              </div>
              <div className="rounded border border-panel-border bg-black/20 p-4 space-y-3">
                {result.reasoning && <ProvenanceRow label="Reasoning">{result.reasoning}</ProvenanceRow>}
                {result.techniques && (
                  <ProvenanceRow label="Techniques to hunt">
                    <LinkedText text={result.techniques} />
                  </ProvenanceRow>
                )}
                {result.dataSources && <ProvenanceRow label="Data sources">{result.dataSources}</ProvenanceRow>}
                {result.starterQuery && (
                  <ProvenanceRow label="Starter query">
                    <code className="font-mono-ui text-xs bg-black/30 rounded px-2 py-1 block whitespace-pre-wrap">
                      {result.starterQuery}
                    </code>
                  </ProvenanceRow>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
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
          </div>
        )}
      </div>
    </Panel>
  );
}
