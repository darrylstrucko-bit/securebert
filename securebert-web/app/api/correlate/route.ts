import { NextResponse } from "next/server";
import { clusterCase } from "@/lib/securebertApi";
import { askGroq } from "@/lib/groq";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const caseId = body?.case_id;
  if (typeof caseId !== "string" || !caseId) {
    return NextResponse.json({ error: "Missing case_id." }, { status: 400 });
  }

  let cluster;
  try {
    cluster = await clusterCase(caseId, body?.noise_count ?? 40, body?.seed);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  const alertLines = cluster.detected_cluster
    .map((a, i) => `${i + 1}. [${a.id}] ${a.title} -- ${a.description ?? ""} (${a.why_it_matters ?? ""})`)
    .join("\n");

  const system = [
    "You are a SOC correlation assistant. You are given a set of alert fragments that an",
    "embedding-similarity model (SecureBERT) grouped together out of a much larger, unlabeled pile",
    "of alerts and background noise. You do NOT know in advance whether this grouping is correct.",
    "Narrate the most likely attack sequence these fragments describe, in chronological/causal order",
    "as best you can infer it, citing MITRE ATT&CK and/or MITRE ATLAS technique IDs only where an",
    "alert's own content supports them. Give an overall risk score (0-100) and a confidence level",
    "(Low/Medium/High) for whether this is a real, connected attack sequence versus unrelated noise",
    "that happened to cluster together. Be direct about uncertainty if the alerts don't cohere well.",
    "Respond in under 220 words of plain prose, no markdown headers.",
  ].join(" ");

  const user = `Alert fragments SecureBERT grouped into one cluster (${cluster.detected_cluster.length} of ${cluster.pool_size} total, unlabeled pile):\n\n${alertLines}`;

  let narrative = "";
  try {
    narrative = await askGroq(system, user);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  return NextResponse.json({ cluster, narrative });
}
