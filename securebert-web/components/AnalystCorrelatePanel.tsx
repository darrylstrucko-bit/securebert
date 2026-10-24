"use client";

import { useEffect, useState } from "react";
import { Panel, FamilyBadge, PrimaryButton, ErrorNote, loadingLabelFor } from "./ui";
import AlertTable from "./AlertTable";
import Timeline from "./Timeline";
import type { ClusterResult } from "@/lib/securebertApi";

type CaseOption = { case_id: string; case_name: string; attack_family: string };

export default function AnalystCorrelatePanel({ modelWarm }: { modelWarm: boolean }) {
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [caseId, setCaseId] = useState<string>("");
  const [pool, setPool] = useState<ClusterResult | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);
  const [poolError, setPoolError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [rightTab, setRightTab] = useState<"timeline" | "narrative">("timeline");

  useEffect(() => {
    fetch("/api/cases")
      .then((r) => r.json())
      .then((d) => {
        if (d.cases) {
          // AI-native cases first -- that's the headline differentiator, lead with it.
          const sorted = [...d.cases].sort((a: CaseOption, b: CaseOption) =>
            a.attack_family === b.attack_family ? 0 : a.attack_family === "ai_attack" ? -1 : 1
          );
          setCases(sorted);
          const aiFirst = sorted.find((c: CaseOption) => c.attack_family === "ai_attack");
          setCaseId(aiFirst?.case_id ?? sorted[0]?.case_id ?? "");
        }
      })
      .catch(() => setPoolError("Could not reach securebert-api to load the case list."));
  }, []);

  // Fetch the unlabeled pool (the "haystack") the moment a case is picked -- this is
  // pure numpy over precomputed vectors server-side, no model call, so it's fast even
  // on a cold Render instance. Highlighting stays off until "Run correlation" is clicked.
  useEffect(() => {
    if (!caseId) return;
    // Intentional: resetting this panel's local state when the selected case changes,
    // right before kicking off the fetch for the new case. Not a cascading-render
    // concern in practice -- there's no circular dependency back onto caseId.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPoolLoading(true);
    setPoolError(null);
    setPool(null);
    setNarrative(null);
    setHighlighted(false);
    setRevealed(false);
    setRunError(null);
    setRightTab("timeline");

    fetch("/api/pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ case_id: caseId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Request failed.");
        setPool(data.cluster);
      })
      .catch((err) => setPoolError(err instanceof Error ? err.message : String(err)))
      .finally(() => setPoolLoading(false));
  }, [caseId]);

  async function run() {
    if (!caseId) return;
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch("/api/correlate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      setPool(data.cluster); // identical pool, now carrying the same cluster assignment
      setNarrative(data.narrative);
      setHighlighted(true);
      setRightTab("timeline");
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const selected = cases.find((c) => c.case_id === caseId);
  const detected = pool?.pool.filter((a) => a.in_detected_cluster) ?? [];

  return (
    <Panel
      title="1. Correlate These Alerts"
      subtitle="Pick a case. The table shows the full unlabeled pile -- its real alerts mixed into ~40 noise fragments -- before SecureBERT ever runs. Run correlation to see which rows it picks out."
    >
      <div className="flex flex-wrap gap-1.5 mb-4">
        {cases.map((c) => (
          <button
            key={c.case_id}
            onClick={() => setCaseId(c.case_id)}
            className={`text-xs px-2.5 py-1.5 rounded-full border transition-colors cursor-pointer ${
              c.case_id === caseId
                ? c.attack_family === "ai_attack"
                  ? "border-accent-ai bg-accent-ai/15 text-accent-ai"
                  : "border-accent bg-accent/15 text-accent"
                : "border-panel-border text-muted hover:text-foreground"
            }`}
          >
            {c.case_id}
          </button>
        ))}
      </div>

      {selected && (
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm font-medium">{selected.case_name}</span>
          <FamilyBadge family={selected.attack_family} />
        </div>
      )}

      {poolError && <ErrorNote message={poolError} />}

      {pool && (
        <div className="grid md:grid-cols-[3fr_2fr] gap-6 items-start">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted">
                {pool.pool_size} unlabeled alerts ({pool.real_alert_count} real, {pool.noise_count} noise)
              </span>
              <PrimaryButton onClick={run} loading={running} loadingLabel={loadingLabelFor(modelWarm)}>
                Run correlation
              </PrimaryButton>
            </div>
            <AlertTable pool={pool.pool} caseId={caseId} highlighted={highlighted} revealed={revealed} />
            {runError && <ErrorNote message={runError} />}
            {highlighted && (
              <button
                onClick={() => setRevealed((r) => !r)}
                className="text-sm text-accent underline cursor-pointer mt-3"
              >
                {revealed ? "Hide ground truth" : "Reveal ground truth"}
              </button>
            )}
            {revealed && (
              <div className="text-sm border border-panel-border rounded px-4 py-3 bg-black/20 mt-3">
                <div>
                  Correctly grouped: {pool.ground_truth_reveal.correctly_grouped} /{" "}
                  {pool.ground_truth_reveal.real_alerts_in_case} real alerts
                </div>
                <div>Missed (amber rows): {pool.ground_truth_reveal.missed}</div>
                <div>Noise that leaked in (red rows): {pool.ground_truth_reveal.noise_fragments_in_detected_cluster}</div>
                <div>Noise correctly excluded: {pool.ground_truth_reveal.noise_fragments_correctly_excluded}</div>
              </div>
            )}
          </div>

          <div>
            {!highlighted && !poolLoading && (
              <p className="text-sm text-muted border border-dashed border-panel-border rounded-md p-4">
                Click &ldquo;Run correlation&rdquo; to see a timeline reconstructed directly from
                SecureBERT&rsquo;s detected alerts, plus Groq&rsquo;s narrative read of the same sequence.
              </p>
            )}
            {highlighted && (
              <>
                <div className="flex gap-1 mb-3 border-b border-panel-border">
                  {(["timeline", "narrative"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setRightTab(t)}
                      className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                        rightTab === t
                          ? "border-accent text-foreground"
                          : "border-transparent text-muted hover:text-foreground"
                      }`}
                    >
                      {t === "timeline" ? "Timeline" : "Narrative"}
                    </button>
                  ))}
                </div>
                {rightTab === "timeline" && detected.length > 0 && <Timeline items={detected} />}
                {rightTab === "narrative" && narrative && (
                  <div className="rounded border border-panel-border bg-black/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                    {narrative}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
