"use client";

import { useEffect, useState } from "react";
import { Panel, FamilyBadge, PrimaryButton, ErrorNote, FrameworkBadges, loadingLabelFor } from "./ui";
import type { ClusterResult } from "@/lib/securebertApi";

type CaseOption = { case_id: string; case_name: string; attack_family: string };

export default function AnalystCorrelatePanel({ modelWarm }: { modelWarm: boolean }) {
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [caseId, setCaseId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ cluster: ClusterResult; narrative: string } | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    fetch("/api/cases")
      .then((r) => r.json())
      .then((d) => {
        if (d.cases) {
          setCases(d.cases);
          const aiFirst = d.cases.find((c: CaseOption) => c.attack_family === "ai_attack");
          setCaseId(aiFirst?.case_id ?? d.cases[0]?.case_id ?? "");
        }
      })
      .catch(() => setError("Could not reach securebert-api to load the case list."));
  }, []);

  async function run() {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setRevealed(false);
    try {
      const res = await fetch("/api/correlate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
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

  const selected = cases.find((c) => c.case_id === caseId);

  return (
    <Panel
      title="1. Correlate These Alerts"
      subtitle="Pick a case to simulate. We mix its real alerts into a pile of ~40 unlabeled noise fragments and ask SecureBERT to find the real sequence -- without ever telling it which is which."
    >
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          className="bg-black/30 border border-panel-border rounded px-3 py-2 text-sm"
        >
          {cases.map((c) => (
            <option key={c.case_id} value={c.case_id}>
              {c.case_id} -- {c.case_name}
            </option>
          ))}
        </select>
        {selected && <FamilyBadge family={selected.attack_family} />}
        <PrimaryButton onClick={run} loading={loading} loadingLabel={loadingLabelFor(modelWarm)}>
          Run correlation
        </PrimaryButton>
      </div>
      {error && <ErrorNote message={error} />}

      {result && (
        <div className="mt-5 space-y-4">
          <div className="text-sm text-muted">
            SecureBERT grouped {result.cluster.detected_cluster.length} fragments out of{" "}
            {result.cluster.pool_size} unlabeled alerts ({result.cluster.real_alert_count} real,{" "}
            {result.cluster.noise_count} noise) into one candidate attack sequence.
          </div>

          <div className="rounded border border-panel-border bg-black/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
            {result.narrative}
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Detected cluster</h3>
            <ul className="space-y-2">
              {result.cluster.detected_cluster.map((a) => (
                <li key={a.id} className="text-sm border border-panel-border rounded px-3 py-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{a.title}</span>
                    {revealed && (
                      <span
                        className={`text-xs font-mono-ui ${
                          a.ground_truth === caseId ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {a.ground_truth === caseId ? "real" : `noise (${a.ground_truth})`}
                      </span>
                    )}
                  </div>
                  <FrameworkBadges
                    attack={a.mitre_techniques.map((t) => ({ technique_id: t }))}
                    atlas={a.mitre_atlas_techniques.map((t) => ({ technique_id: t }))}
                  />
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => setRevealed((r) => !r)}
            className="text-sm text-accent underline cursor-pointer"
          >
            {revealed ? "Hide ground truth" : "Reveal ground truth"}
          </button>

          {revealed && (
            <div className="text-sm border border-panel-border rounded px-4 py-3 bg-black/20">
              <div>
                Correctly grouped: {result.cluster.ground_truth_reveal.correctly_grouped} /{" "}
                {result.cluster.ground_truth_reveal.real_alerts_in_case} real alerts from this case
              </div>
              <div>Missed: {result.cluster.ground_truth_reveal.missed}</div>
              <div>
                Noise fragments that leaked into the cluster:{" "}
                {result.cluster.ground_truth_reveal.noise_fragments_in_detected_cluster}
              </div>
              <div>
                Noise fragments correctly excluded:{" "}
                {result.cluster.ground_truth_reveal.noise_fragments_correctly_excluded}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
