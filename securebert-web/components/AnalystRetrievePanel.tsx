"use client";

import { useState } from "react";
import { Panel, PrimaryButton, ClearButton, ErrorNote, FamilyBadge, FrameworkBadges, Narrative } from "./ui";
import { fetchJson } from "@/lib/fetchJson";
import type { RetrieveResult } from "@/lib/securebertApi";

const SAMPLES = [
  "A finance ops copilot resolved a routine ticket, but our logs show it also pulled a full customer export and emailed it to a domain we've never corresponded with before. The visible ticket only asked for a password reset.",
  "A finance employee logged in from an unusual country, then got added to Domain Admins, and shortly after we saw PowerShell trying to dump credentials from LSASS and spread to other servers over SMB.",
  "Someone is hammering our public fraud-scoring API with a huge number of carefully varied requests clustered right around the decision threshold, like they're trying to map out and steal the model.",
];

export default function AnalystRetrievePanel({ modelWarm }: { modelWarm: boolean }) {
  const [text, setText] = useState(SAMPLES[0]);
  const [selectedSample, setSelectedSample] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ results: RetrieveResult[]; narrative: string } | null>(null);

  async function run() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchJson<{ results: RetrieveResult[]; narrative: string }>("/api/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, k: 3 }),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setText("");
    setSelectedSample(null);
    setResult(null);
    setError(null);
  }

  return (
    <Panel
      title="Is This a Known Pattern?"
      subtitle="Paste a new, unlabeled incident description. SecureBERT 2.0 retrieves the nearest matching case(s) by embedding distance before Groq writes the brief -- grounded retrieval, not a guess."
    >
      {/* Pinned top: chips, action buttons, textarea -- stays in place while the
          results below scroll, instead of the whole panel growing without bound. */}
      <div className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="flex flex-wrap gap-1.5">
            {SAMPLES.map((s, i) => (
              <button
                key={s}
                onClick={() => {
                  setText(s);
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
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex gap-2">
              <ClearButton onClick={clear} />
              <PrimaryButton onClick={run} loading={loading} modelWarm={modelWarm}>
                Find precedent
              </PrimaryButton>
            </div>
            <p className="text-xs text-muted text-right max-w-[220px]">
              Click &ldquo;Find precedent&rdquo; to see the nearest matching case(s) and Groq&rsquo;s brief.
            </p>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSelectedSample(null);
          }}
          rows={4}
          className="w-full max-w-2xl bg-black/30 border border-panel-border rounded px-3 py-2 text-sm"
        />
        {error && <ErrorNote message={error} />}
      </div>

      {/* Results: scrolls on its own, independent of the pinned controls above. */}
      <div className="mt-5 max-h-[55vh] overflow-y-auto">
        {result && (
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <Narrative text={result.narrative} />
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
        )}
      </div>
    </Panel>
  );
}
