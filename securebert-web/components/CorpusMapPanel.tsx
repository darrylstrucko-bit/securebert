"use client";

import { useMemo, useState } from "react";
import { ChartScatter } from "lucide-react";
import { Panel, PrimaryButton, ErrorNote, FamilyBadge, InfoButton } from "./ui";
import { ExamplePicker, type Sample } from "./ExamplePicker";
import { fetchJson } from "@/lib/fetchJson";
import type { MatchTier, NearestCase, ProjectResult } from "@/lib/securebertApi";
import staticData from "@/lib/data/static-pool.json";

type CaseMapPoint = { case_id: string; case_name: string; attack_family: string; x: number; y: number };
type AlertMapPoint = { id: string; title: string; ground_truth: string; attack_family: string | null; x: number; y: number };

const CASES: CaseMapPoint[] = staticData.corpusMap.cases;
const ALERTS: AlertMapPoint[] = staticData.corpusMap.alerts;

// Each reliably lands in its labeled tier against the live backend (verified
// directly, not assumed) -- buttons are named by scenario, not by the result,
// so the classification is something to discover, not a spoiler.
const SAMPLES: Sample[] = [
  {
    label: "Known Attack Pattern",
    text: "A user uploaded a large encrypted archive to a personal Dropbox account from a finance workstation, after bulk-accessing and copying a large number of files from restricted finance folders.",
  },
  {
    label: "Related Activity",
    text: "A contractor account retrieved several production secrets shortly after being granted an elevated role by an internal automation agent, though it's unclear whether the access itself was properly authorized.",
  },
  {
    label: "Unfamiliar Pattern",
    text: "An attacker manipulated GPS timing signals to disrupt synchronization between industrial control systems.",
  },
];

// Kept short enough that the whole panel fits a typical laptop viewport without
// a page-level scrollbar -- this map was still the tallest thing on the page.
const WIDTH = 380;
const HEIGHT = 196;
const PAD = 25;

function buildScale() {
  const allX = [...CASES.map((c) => c.x), ...ALERTS.map((a) => a.x)];
  const allY = [...CASES.map((c) => c.y), ...ALERTS.map((a) => a.y)];
  const xMin = Math.min(...allX);
  const xMax = Math.max(...allX);
  const yMin = Math.min(...allY);
  const yMax = Math.max(...allY);
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;
  return (x: number, y: number): [number, number] => [
    PAD + ((x - xMin) / xSpan) * (WIDTH - 2 * PAD),
    PAD + ((yMax - y) / ySpan) * (HEIGHT - 2 * PAD), // flip y: SVG grows downward
  ];
}

const caseById = new Map(CASES.map((c) => [c.case_id, c]));

// Likely/possible/no-strong-match get distinct colors (green/amber/gray)
// instead of a binary match-or-novel -- "no strong match" is a neutral gray,
// not alarming amber, since it isn't a warning, just an absence of evidence.
const TIER_META: Record<MatchTier, { label: string; color: string; textClass: string; badgeClass: string }> = {
  likely_match: {
    label: "Likely Match",
    color: "#4ade80",
    textClass: "text-green-300",
    badgeClass: "border-green-400/50 text-green-300 bg-green-400/10",
  },
  possible_match: {
    label: "Possible Match",
    color: "#f59e0b",
    textClass: "text-amber-300",
    badgeClass: "border-amber-400/50 text-amber-300 bg-amber-400/10",
  },
  no_strong_match: {
    label: "No Strong Match",
    color: "#8b98a9",
    textClass: "text-muted",
    badgeClass: "border-panel-border text-muted bg-white/5",
  },
};

function MatchTierBadge({ tier }: { tier: MatchTier }) {
  const meta = TIER_META[tier];
  return (
    <span className={`inline-block text-xs font-mono-ui px-2 py-0.5 rounded border shrink-0 ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
}

// Matches the ring-and-dot marker drawn on the map so the result box visually
// points back at the same glyph instead of describing it in words alone.
function PlottedSnippetMarker({ tier }: { tier: MatchTier }) {
  const color = TIER_META[tier].color;
  return (
    <span
      className="inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full"
      style={{ border: `2px solid ${color}`, backgroundColor: "#0a0e14" }}
    >
      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}

// One short, consistent voice per tier -- the classification decision (here)
// is the headline; the specific case (shown separately, subordinated, below)
// is reference material, never restated at length so it can't compete with
// the decision for attention. mapNote feeds the (separate) Plotted Snippet
// box, which only needs to place the similarity relative to the thresholds,
// not re-explain what the tier means.
const TIER_COPY: Record<MatchTier, { primary: string; supporting: string; mapNote: string }> = {
  likely_match: {
    primary: "Strong similarity to a known attack pattern, but not a confirmed identification.",
    supporting:
      "This snippet scores above the calibrated threshold where unrelated text essentially never lands, making a genuine connection to this case plausible.",
    mapNote: "above the threshold for a strong match",
  },
  possible_match: {
    primary: "Some similarity to a known pattern, but insufficient evidence for a strong match.",
    supporting:
      "This snippet falls in a middle range where, in testing, both real matches and unrelated text occur -- worth investigating, not confirmed.",
    mapNote: "between the thresholds for a strong and a weak match",
  },
  no_strong_match: {
    primary: "No sufficiently similar known attack pattern found.",
    supporting:
      "This snippet doesn't closely match any of the 7 known cases. It may represent a different type of incident not covered by this demo.",
    mapNote: "below the threshold for a strong match",
  },
};

// Deliberately short: the full case description already lives in the Match
// Assessment box above, so this only places the similarity value relative to
// the calibrated thresholds and repeats the PCA-is-cosmetic caveat.
function PlottedSnippetExplanation({ nearest }: { nearest: NearestCase }) {
  return (
    <p className={TIER_META[nearest.match_tier].textClass}>
      This snippet&rsquo;s closest known case has a cosine similarity of{" "}
      {nearest.similarity.toFixed(3)}, {TIER_COPY[nearest.match_tier].mapNote}. Its position on the
      map shows relative similarity, not a confirmed classification.
    </p>
  );
}

export default function CorpusMapPanel({ modelWarm }: { modelWarm: boolean }) {
  const [text, setText] = useState(SAMPLES[0].text);
  const [selectedSample, setSelectedSample] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [point, setPoint] = useState<[number, number] | null>(null);
  // The actual semantic match, by cosine similarity against the real SecureBERT
  // embeddings (securebert-api's corpus.retrieve) -- NOT derived from where the
  // dot lands on the 2D plot below. PCA keeps only the two directions of
  // greatest spread across the whole corpus, so the visually closest centroid
  // on the map is not guaranteed to be this case.
  const [nearest, setNearest] = useState<NearestCase | null>(null);

  const scale = useMemo(() => buildScale(), []);

  async function run() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setPoint(null);
    setNearest(null);
    try {
      const data = await fetchJson<ProjectResult>("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setPoint(data.coords);
      setNearest(data.nearest);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel
      icon={<ChartScatter className="h-5 w-5 text-accent" aria-hidden />}
      title="Corpus Map"
      subtitle={
        <>
          Explore how SecureBERT 2.0 groups security cases and alerts based on their semantic
          similarity
          <InfoButton label="What is PCA?">
            <span className="font-medium text-foreground">PCA (Principal Component Analysis).</span>{" "}
            SecureBERT 2.0 turns each piece of text into a vector of hundreds of numbers. PCA finds
            the two directions where that data spreads out the most, and plots everything using just
            those two -- compressing hundreds of dimensions down to the flat chart below. The axes
            (PC1, PC2) have no built-in meaning like &ldquo;risk&rdquo; -- they&rsquo;re just whichever
            directions happened to capture the most spread in this data. The dots&rsquo; positions are
            for browsing the corpus by eye only -- the match classification below is computed
            separately, by cosine similarity on the real, un-squashed embeddings, so it can
            occasionally point to a case that isn&rsquo;t the visually closest dot.
          </InfoButton>
          . Related events appear closer together, helping reveal common patterns, clusters, and
          outliers.
        </>
      }
    >
      <div className="shrink-0">
        <ExamplePicker
          label="Choose an example or enter your own snippet"
          samples={SAMPLES}
          value={text}
          onChange={setText}
          selectedIndex={selectedSample}
          onSelectIndex={setSelectedSample}
          rows={2}
        />
        <div className="flex justify-start mt-3">
          <PrimaryButton onClick={run} loading={loading} modelWarm={modelWarm}>
            Plot this snippet
          </PrimaryButton>
        </div>
        {error && <ErrorNote message={error} />}
      </div>

      <div className="mt-4 max-h-[55vh] overflow-y-auto">
        <div className="grid md:grid-cols-2 gap-6 items-start">
          <div className="border border-panel-border rounded-md bg-black/20 p-2">
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
              {/* Spoke lines: each real alert back to its own case's centroid -- a
                  texture showing how tightly a case's own alerts actually cluster
                  around it. One color for every case: this plot isn't trying to say
                  anything about classic-vs-AI-native, so it doesn't color-code it. */}
              {ALERTS.filter((a) => a.ground_truth !== "noise").map((a) => {
                const c = caseById.get(a.ground_truth);
                if (!c) return null;
                const [ax, ay] = scale(a.x, a.y);
                const [cx, cy] = scale(c.x, c.y);
                return (
                  <line
                    key={`spoke-${a.id}`}
                    x1={ax}
                    y1={ay}
                    x2={cx}
                    y2={cy}
                    className="stroke-accent"
                    strokeWidth={0.5}
                    opacity={0.25}
                  />
                );
              })}

              {/* Every alert as a small dot -- noise muted gray with no home to point
                  to, real alerts a single color tied to their case. */}
              {ALERTS.map((a) => {
                const [ax, ay] = scale(a.x, a.y);
                const isNoise = a.ground_truth === "noise";
                return (
                  <circle
                    key={a.id}
                    cx={ax}
                    cy={ay}
                    r={isNoise ? 1.3 : 1.8}
                    className={isNoise ? "fill-muted" : "fill-accent"}
                    opacity={isNoise ? 0.35 : 0.8}
                  >
                    <title>{isNoise ? `Noise: ${a.title}` : `${a.ground_truth}: ${a.title}`}</title>
                  </circle>
                );
              })}

              {/* The 7 case centroids, on top of everything else. */}
              {CASES.map((c) => {
                const [cx, cy] = scale(c.x, c.y);
                return (
                  <g key={c.case_id}>
                    <circle cx={cx} cy={cy} r={5} className="fill-accent" stroke="#0a0e14" strokeWidth={1.2} />
                    <title>{`${c.case_id} -- ${c.case_name}`}</title>
                    <text x={cx} y={cy - 8} textAnchor="middle" className="fill-muted text-[7px] font-mono-ui">
                      {c.case_id}
                    </text>
                  </g>
                );
              })}

              {point && nearest && (
                <g>
                  <circle
                    cx={scale(point[0], point[1])[0]}
                    cy={scale(point[0], point[1])[1]}
                    r={6}
                    className="fill-background stroke-2"
                    stroke={TIER_META[nearest.match_tier].color}
                  />
                  <circle
                    cx={scale(point[0], point[1])[0]}
                    cy={scale(point[0], point[1])[1]}
                    r={2}
                    fill={TIER_META[nearest.match_tier].color}
                  />
                </g>
              )}

              {/* Axis labels: honest about having no inherent meaning (see info button). */}
              <text x={WIDTH - 4} y={HEIGHT - 4} textAnchor="end" className="fill-muted text-[7px] font-mono-ui">
                PC1 &rarr;
              </text>
              <text x={4} y={10} textAnchor="start" className="fill-muted text-[7px] font-mono-ui">
                PC2 &uarr;
              </text>
            </svg>
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent inline-block" /> Case alert
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted inline-block opacity-60" /> Noise
              </span>
              {point && nearest && (
                <span className="flex items-center gap-1.5">
                  <PlottedSnippetMarker tier={nearest.match_tier} /> Plotted snippet
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {nearest && (
              <div className="text-sm border border-panel-border rounded px-3 py-3 bg-black/20">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-medium">Match Assessment</span>
                  <MatchTierBadge tier={nearest.match_tier} />
                </div>
                <p className={`font-medium ${TIER_META[nearest.match_tier].textClass}`}>
                  {TIER_COPY[nearest.match_tier].primary}
                </p>
                <p className="text-muted mt-1">{TIER_COPY[nearest.match_tier].supporting}</p>

                {/* Subordinate to the classification above: smaller, muted, and
                    separated by a rule, so the nearest case reads as reference
                    material rather than the headline result -- a nearest
                    neighbor always exists even when nothing meaningfully matches. */}
                <div className="mt-3 pt-2 border-t border-panel-border/60">
                  <p className="text-xs text-muted mb-1">Closest known case (for reference only)</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-muted">
                      {nearest.case_id} -- {nearest.case_name}
                    </span>
                    <FamilyBadge family={nearest.attack_family} />
                  </div>
                  <div className="mt-1 font-mono-ui text-xs text-muted">
                    cosine similarity {nearest.similarity.toFixed(3)}
                  </div>
                </div>
              </div>
            )}

            {point && nearest && (
              <div className="text-sm border border-panel-border rounded px-3 py-3 bg-black/20 space-y-2">
                <div className="flex items-center gap-2">
                  <PlottedSnippetMarker tier={nearest.match_tier} />
                  <span className="font-medium">Plotted snippet</span>
                  <span className="font-mono-ui text-xs text-muted ml-auto">
                    PC1 {point[0].toFixed(2)} &middot; PC2 {point[1].toFixed(2)}
                  </span>
                </div>
                <PlottedSnippetExplanation nearest={nearest} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
