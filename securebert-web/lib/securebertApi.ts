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

export type ClusterItemLight = { id: string; title: string; ground_truth: string };

export type ClusterItemFull = ClusterItemLight & {
  description: string | null;
  why_it_matters: string | null;
  mitre_techniques: string[];
  mitre_atlas_techniques: string[];
  risk_score: number | null;
};

export type ClusterResult = {
  case_id: string;
  pool_size: number;
  real_alert_count: number;
  noise_count: number;
  detected_cluster: ClusterItemFull[];
  excluded: ClusterItemLight[];
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

export async function listCases(): Promise<{ case_id: string; case_name: string; attack_family: string }[]> {
  const res = await fetch(`${requireBaseUrl()}/cases`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`securebert-api /cases returned ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.cases;
}
