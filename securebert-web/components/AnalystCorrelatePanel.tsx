"use client";

import { useMemo, useState } from "react";
import { Panel, FamilyBadge, RiskBadge, PrimaryButton, ErrorNote, loadingLabelFor } from "./ui";
import AlertTable from "./AlertTable";
import Timeline from "./Timeline";
import { fetchJson } from "@/lib/fetchJson";
import type { ClusterResult } from "@/lib/securebertApi";
import staticData from "@/lib/data/static-pool.json";

type CaseOption = { case_id: string; case_name: string; attack_family: string };
type CorrelateResponse = { cluster: ClusterResult; narrative: string; riskScore: number | null; confidence: string | null };

// AI-native cases first -- that's the headline differentiator, lead with it. This
// (and everything else in staticData) is bundled with the web app, not fetched --
// see lib/data/static-pool.json's header comment. It never needs Render, so the
// case chips and the unlabeled haystack table render instantly, before the model
// service is even known to be awake. Only "Run correlation" below is a live call.
const CASES: CaseOption[] = [...staticData.cases].sort((a, b) =>
  a.attack_family === b.attack_family ? 0 : a.attack_family === "ai_attack" ? -1 : 1
);

function staticPoolFor(caseId: string): ClusterResult {
  const p = (staticData.pools as Record<string, { pool_size: number; real_alert_count: number; noise_count: number; pool: unknown[] }>)[caseId];
  return {
    case_id: caseId,
    pool_size: p.pool_size,
    real_alert_count: p.real_alert_count,
    noise_count: p.noise_count,
    detected_count: 0,
    pool: p.pool as ClusterResult["pool"],
    ground_truth_reveal: {
      real_alerts_in_case: 0,
      correctly_grouped: 0,
      missed: 0,
      noise_fragments_in_detected_cluster: 0,
      noise_fragments_correctly_excluded: 0,
    },
  };
}

export default function AnalystCorrelatePanel({ modelWarm }: { modelWarm: boolean }) {
  const [caseId, setCaseId] = useState<string>(CASES[0]?.case_id ?? "");
  const [pool, setPool] = useState<ClusterResult | null>(() => (caseId ? staticPoolFor(caseId) : null));

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [rightTab, setRightTab] = useState<"timeline" | "narrative">("timeline");

  // Switching cases resets back to that case's static (unanswered) pool -- a live
  // "Run correlation" result only applies to the case it was run for. Done directly
  // in the click handler (not an effect keyed on caseId): this isn't synchronizing
  // with an external system, it's resetting state in response to a user action.
  function selectCase(id: string) {
    setCaseId(id);
    setPool(staticPoolFor(id));
    setNarrative(null);
    setRiskScore(null);
    setConfidence(null);
    setHighlighted(false);
    setRevealed(false);
    setRunError(null);
    setRightTab("timeline");
  }

  async function run() {
    if (!caseId) return;
    setRunning(true);
    setRunError(null);
    try {
      const data = await fetchJson<CorrelateResponse>("/api/correlate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });
      setPool(data.cluster); // now carrying the real cluster assignment + ground truth
      setNarrative(data.narrative);
      setRiskScore(data.riskScore);
      setConfidence(data.confidence);
      setHighlighted(true);
      setRightTab("timeline");
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  const selected = useMemo(() => CASES.find((c) => c.case_id === caseId), [caseId]);
  const detected = pool?.pool.filter((a) => a.in_detected_cluster) ?? [];

  return (
    <Panel
      title="Correlate These Alerts"
      subtitle="Pick a case. The table shows the full unlabeled pile -- its real alerts mixed into ~40 noise fragments -- before SecureBERT ever runs. Run correlation to see which rows it picks out."
    >
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CASES.map((c) => (
          <button
            key={c.case_id}
            onClick={() => selectCase(c.case_id)}
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
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-sm font-medium">{selected.case_name}</span>
          <FamilyBadge family={selected.attack_family} />
          {highlighted && riskScore !== null && <RiskBadge score={riskScore} confidence={confidence} />}
        </div>
      )}

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
            {!highlighted && (
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
