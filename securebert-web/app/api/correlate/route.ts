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
    // No seed passed: the backend's fixed default keeps this identical to the
    // /api/pool call the UI already made when the case was selected, so the
    // "Run" step only ever reveals/narrates a pool already on screen.
    cluster = await clusterCase(caseId, body?.noise_count ?? 80);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  const detected = cluster.pool.filter((a) => a.in_detected_cluster);
  const alertLines = detected
    .map((a, i) => {
      const tags = [...a.mitre_techniques.map((t) => `ATT&CK ${t}`), ...a.mitre_atlas_techniques.map((t) => `ATLAS ${t}`)];
      const tagStr = tags.length ? ` [tagged: ${tags.join(", ")}]` : " [untagged]";
      return `${i + 1}. [${a.id}]${tagStr} ${a.title} -- ${a.description ?? ""} (${a.why_it_matters ?? ""})`;
    })
    .join("\n");

  const system = [
    "You are a SOC correlation assistant. You are given a set of alert fragments that an",
    "embedding-similarity model (SecureBERT) grouped together out of a much larger, unlabeled pile",
    "of alerts and background noise. You do NOT know in advance whether this grouping is correct.",
    "Each alert is given with a [tagged: ...] list of the ONLY MITRE ATT&CK/ATLAS technique IDs you",
    "may cite for it -- never invent, guess, or substitute a different ID, even a plausible-sounding",
    "one; if an alert is [untagged], do not attribute any technique ID to it. Narrate the most likely",
    "attack sequence these fragments describe, in chronological/causal order as best you can infer it.",
    "Be direct about uncertainty if the alerts don't cohere well.",
    'Respond with a single JSON object with exactly these keys: "paragraph_1" (plain-prose string,',
    "no markdown, narrating the attack sequence itself -- what happened, in order), \"paragraph_2\"",
    "(plain-prose string, no markdown, covering why this reads as a real, connected sequence versus",
    'coincidental noise -- both paragraphs together under 220 words total), "risk_score" (an integer',
    "0-100, your overall risk score for whether this is a real, connected attack sequence versus",
    'unrelated noise that happened to cluster together), and "confidence" (one of "Low", "Medium",',
    '"High").',
  ].join(" ");

  const user = `Alert fragments SecureBERT grouped into one cluster (${detected.length} of ${cluster.pool_size} total, unlabeled pile):\n\n${alertLines}`;

  let narrative = "";
  let riskScore: number | null = null;
  let confidence: string | null = null;
  try {
    const raw = await askGroq(system, user, { jsonMode: true });
    const parsed = JSON.parse(raw);
    // Two separate string fields, joined with a REAL newline here in code --
    // not one field with an embedded "\n\n" escape sequence. Asking the model to
    // nest an escape sequence inside a JSON string value was unreliable: it would
    // sometimes echo the literal two-character sequence \n\n from the prompt's
    // own instructions into the output instead of producing an actual line break.
    const paragraph1 = typeof parsed.paragraph_1 === "string" ? parsed.paragraph_1 : "";
    const paragraph2 = typeof parsed.paragraph_2 === "string" ? parsed.paragraph_2 : "";
    narrative = [paragraph1, paragraph2].filter(Boolean).join("\n\n");
    riskScore = typeof parsed.risk_score === "number" ? parsed.risk_score : null;
    confidence = typeof parsed.confidence === "string" ? parsed.confidence : null;
    if (!narrative) throw new Error("Groq's JSON response was missing a narrative.");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  return NextResponse.json({ cluster, narrative, riskScore, confidence });
}
