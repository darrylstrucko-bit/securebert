"use client";

import { useMemo, useState } from "react";
import { Panel, PrimaryButton, ErrorNote, FamilyBadge, InfoButton } from "./ui";
import { ExamplePicker, type Sample } from "./ExamplePicker";
import { fetchJson } from "@/lib/fetchJson";
import staticData from "@/lib/data/static-pool.json";

type CaseMapPoint = { case_id: string; case_name: string; attack_family: string; x: number; y: number };
type AlertMapPoint = { id: string; title: string; ground_truth: string; attack_family: string | null; x: number; y: number };

const CASES: CaseMapPoint[] = staticData.corpusMap.cases;
const ALERTS: AlertMapPoint[] = staticData.corpusMap.alerts;

const SAMPLES: Sample[] = [
  {
    label: "Unusual employee login",
    text: "A finance employee logged in from an unusual country, then got added to Domain Admins, and shortly after we saw PowerShell trying to dump credentials from LSASS.",
  },
  {
    label: "Fraud portal attack",
    text: "Someone is hammering our public fraud-scoring API with a huge number of carefully varied requests clustered right around the decision threshold.",
  },
  {
    label: "AI data exfiltration",
    text: "Our new vendor's quarterly report generator just emailed itself a copy of the customer list, which nobody asked it to do.",
  },
];

// 75% of the original 440x300 -- the map was taking more vertical room than it
// needed, crowding out everything below it.
const WIDTH = 330;
const HEIGHT = 225;
const PAD = 28;

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

function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

const caseById = new Map(CASES.map((c) => [c.case_id, c]));

// A snippet's nearest case counts as "close" if it's no further than the cases'
// own typical nearest-neighbor spacing -- a simple, visible-on-the-plot
// definition of "resembles something we've seen," not a precision claim.
const NOVELTY_THRESHOLD = (() => {
  const nearest = CASES.map((c) =>
    Math.min(...CASES.filter((o) => o.case_id !== c.case_id).map((o) => dist(c.x, c.y, o.x, o.y)))
  );
  return Math.max(...nearest) * 1.3;
})();

export default function CorpusMapPanel({ modelWarm }: { modelWarm: boolean }) {
  const [text, setText] = useState(SAMPLES[0].text);
  const [selectedSample, setSelectedSample] = useState<number | null>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [point, setPoint] = useState<[number, number] | null>(null);

  const scale = useMemo(() => buildScale(), []);

  async function run() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setPoint(null);
    try {
      const data = await fetchJson<{ coords: [number, number] }>("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      setPoint(data.coords);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const nearest = point
    ? [...CASES]
        .map((c) => ({ ...c, d: dist(point[0], point[1], c.x, c.y) }))
        .sort((a, b) => a.d - b.d)[0]
    : null;
  const isNovel = nearest ? nearest.d > NOVELTY_THRESHOLD : false;

  return (
    <Panel
      title="Corpus Map"
      subtitle={
        <>
          Every case and alert, placed by SecureBERT 2.0&rsquo;s embedding and squashed to 2D with
          PCA
          <InfoButton label="What is PCA?">
            <span className="font-medium text-foreground">PCA (Principal Component Analysis).</span>{" "}
            SecureBERT 2.0 turns each piece of text into a vector of hundreds of numbers. PCA finds
            the two directions where that data spreads out the most, and plots everything using just
            those two -- compressing hundreds of dimensions down to the flat chart below. The axes
            (PC1, PC2) have no built-in meaning like &ldquo;risk&rdquo; -- they&rsquo;re just whichever
            directions happened to capture the most spread in this data.
          </InfoButton>
          . No Groq call: the only use case that&rsquo;s pure SecureBERT 2.0, nothing narrated on top.
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
          rows={3}
        />
        <div className="flex justify-end mt-3">
          <PrimaryButton onClick={run} loading={loading} modelWarm={modelWarm}>
            Plot this snippet
          </PrimaryButton>
        </div>
        {error && <ErrorNote message={error} />}
      </div>

      <div className="mt-5 max-h-[55vh] overflow-y-auto">
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

              {point && (
                <g>
                  <circle
                    cx={scale(point[0], point[1])[0]}
                    cy={scale(point[0], point[1])[1]}
                    r={6}
                    className="fill-background stroke-2"
                    stroke={isNovel ? "#f59e0b" : "#ffffff"}
                  />
                  <circle
                    cx={scale(point[0], point[1])[0]}
                    cy={scale(point[0], point[1])[1]}
                    r={2}
                    fill={isNovel ? "#f59e0b" : "#ffffff"}
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
              {point && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-white inline-block" /> Your snippet
                </span>
              )}
            </div>
          </div>

          <div>
            {nearest && (
              <div className="text-sm border border-panel-border rounded px-3 py-3 bg-black/20">
                {isNovel ? (
                  <p className="text-amber-300">
                    No close precedent -- this lands further from every case than the cases typically
                    sit from each other. Possibly novel.
                  </p>
                ) : (
                  <>
                    <p className="text-muted mb-1">Nearest on the map:</p>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {nearest.case_id} -- {nearest.case_name}
                      </span>
                    </div>
                    <div className="mt-1">
                      <FamilyBadge family={nearest.attack_family} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
