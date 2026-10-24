"use client";

import { useState } from "react";
import { Panel, PrimaryButton, ErrorNote, ColdStartNote, FamilyBadge, FrameworkBadges } from "./ui";
import type { RetrieveResult } from "@/lib/securebertApi";

const SAMPLE =
  "A finance ops copilot resolved a routine ticket, but our logs show it also pulled a full customer export and emailed it to a domain we've never corresponded with before. The visible ticket only asked for a password reset.";

export default function AnalystRetrievePanel() {
  const [text, setText] = useState(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ results: RetrieveResult[]; narrative: string } | null>(null);

  async function run() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, k: 3 }),
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
      title="2. Is This a Known Pattern?"
      subtitle="Paste a new, unlabeled incident description. SecureBERT retrieves the nearest matching case(s) by embedding distance before Groq writes the brief -- grounded retrieval, not a guess."
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="w-full bg-black/30 border border-panel-border rounded px-3 py-2 text-sm"
      />
      <div className="mt-3">
        <PrimaryButton onClick={run} loading={loading}>
          Find precedent
        </PrimaryButton>
      </div>
      <ColdStartNote />
      {error && <ErrorNote message={error} />}

      {result && (
        <div className="mt-5 space-y-4">
          <div className="rounded border border-panel-border bg-black/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {result.narrative}
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
      )}
    </Panel>
  );
}
