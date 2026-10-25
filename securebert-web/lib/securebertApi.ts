const BASE_URL = process.env.SECUREBERT_API_URL;

function requireBaseUrl(): string {
  if (!BASE_URL) {
    throw new Error("SECUREBERT_API_URL is not configured.");
  }
  return BASE_URL.replace(/\/$/, "");
}

export type RetrieveResult = {
  case_id: string;
  case_name: string;
  attack_family: "classic" | "ai_attack";
  similarity: number;
  mitre_attack_mapping: unknown[];
  mitre_atlas_mapping: unknown[];
  detection_recommendation: Record<string, unknown>;
};

export async function retrieveCases(text: string, k = 3): Promise<RetrieveResult[]> {
  const res = await fetch(`${requireBaseUrl()}/retrieve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, k }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`securebert-api /retrieve returned ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.results as RetrieveResult[];
}

export type PoolItem = {
  id: string;
  title: string;
  source: string | null;
  category: string | null;
  severity: string | null;
  time: string | null;
  description: string | null;
  why_it_matters: string | null;
  mitre_techniques: string[];
  mitre_atlas_techniques: string[];
  risk_score: number | null;
  // Absent in the statically-bundled pre-run pool (see lib/data/static-pool.json) --
  // only a live /api/correlate response reveals these, so they're optional here
  // rather than faked with a placeholder value that could look like a real answer.
  ground_truth?: string; // case_id this fragment really belongs to, or "noise"
  in_detected_cluster?: boolean;
};

export type ClusterResult = {
  case_id: string;
  pool_size: number;
  real_alert_count: number;
  noise_count: number;
  detected_count: number;
  pool: PoolItem[];
  ground_truth_reveal: {
    real_alerts_in_case: number;
    correctly_grouped: number;
    missed: number;
    noise_fragments_in_detected_cluster: number;
    noise_fragments_correctly_excluded: number;
  };
};

export async function clusterCase(caseId: string, noiseCount = 40, seed?: number): Promise<ClusterResult> {
  const res = await fetch(`${requireBaseUrl()}/cluster`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case_id: caseId, noise_count: noiseCount, seed }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`securebert-api /cluster returned ${res.status}: ${await res.text()}`);
  return res.json();
}

// [x, y] in the same fixed 2D space lib/data/static-pool.json's corpusMap was
// precomputed in (see securebert-api/app/corpus.py's project()).
export async function projectText(text: string): Promise<[number, number]> {
  const res = await fetch(`${requireBaseUrl()}/project`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`securebert-api /project returned ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.coords as [number, number];
}
