"use client";

import { useState } from "react";
import { Panel, PrimaryButton, ErrorNote, FamilyBadge, FrameworkBadges, Narrative } from "./ui";
import { ExamplePicker, type Sample } from "./ExamplePicker";
import { fetchJson } from "@/lib/fetchJson";
import type { RetrieveResult } from "@/lib/securebertApi";

const SAMPLES: Sample[] = [
  {
    label: "AI data exfiltration",
    text: "A finance ops copilot resolved a routine ticket, but our logs show it also pulled a full customer export and emailed it to a domain we've never corresponded with before. The visible ticket only asked for a password reset.",
  },
  {
    label: "Unusual employee login",
    text: "A finance employee logged in from an unusual country, then got added to Domain Admins, and shortly after we saw PowerShell trying to dump credentials from LSASS and spread to other servers over SMB.",
  },
  {
    label: "Fraud portal attack",
    text: "Someone is hammering our public fraud-scoring API with a huge number of carefully varied requests clustered right around the decision threshold, like they're trying to map out and steal the model.",
  },
];

export default function AnalystRetrievePanel({ modelWarm }: { modelWarm: boolean }) {
  const [text, setText] = useState(SAMPLES[0].text);
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
      subtitle="Describe a security incident or choose an example to see if SecureBERT 2.0 recognizes similar activity. Explore matching cases, understand their relevance, and get an AI-generated assessment."
    >
      {/* Pinned top: picker + action stay in place while results below scroll. */}
      <div className="shrink-0">
        <ExamplePicker
          label="Choose an example or enter your own incident"
          samples={SAMPLES}
          value={text}
          onChange={setText}
          selectedIndex={selectedSample}
          onSelectIndex={setSelectedSample}
          rows={4}
        />
        <div className="flex justify-start mt-3">
          <PrimaryButton onClick={run} loading={loading} modelWarm={modelWarm}>
            Find precedent
          </PrimaryButton>
        </div>
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
