"use client";

import { useState } from "react";
import { Panel, PrimaryButton, ErrorNote, FamilyBadge, FrameworkBadges, Narrative } from "./ui";
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

  return (
    <Panel
      title="Is This a Known Pattern?"
      subtitle="Paste a new, unlabeled incident description. SecureBERT 2.0 retrieves the nearest matching case(s) by embedding distance before Groq writes the brief -- grounded retrieval, not a guess."
    >
      <div className="grid md:grid-cols-[3fr_2fr] gap-6 items-start">
        <div>
          <div className="flex flex-wrap gap-1.5 mb-3">
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
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSelectedSample(null);
            }}
            rows={5}
            className="w-full bg-black/30 border border-panel-border rounded px-3 py-2 text-sm"
          />
          <div className="mt-3">
            <PrimaryButton onClick={run} loading={loading} modelWarm={modelWarm}>
              Find precedent
            </PrimaryButton>
          </div>
          {error && <ErrorNote message={error} />}
        </div>

        <div>
          {!result && (
            <p className="text-sm text-muted border border-dashed border-panel-border rounded-md p-4">
              Click &ldquo;Find precedent&rdquo; to see the nearest matching case(s) and Groq&rsquo;s brief.
            </p>
          )}
          {result && (
            <div className="space-y-4">
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
      </div>
    </Panel>
  );
}
