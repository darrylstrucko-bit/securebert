import { NextResponse } from "next/server";
import { retrieveCases } from "@/lib/securebertApi";
import { askGroq } from "@/lib/groq";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const hypothesis = body?.hypothesis;
  if (typeof hypothesis !== "string" || !hypothesis.trim()) {
    return NextResponse.json({ error: "Missing hypothesis." }, { status: 400 });
  }

  let results;
  try {
    results = await retrieveCases(hypothesis, body?.k ?? 2);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  const matchLines = results
    .map((r, i) => {
      const attack = (r.mitre_attack_mapping as { technique_id?: string }[])
        .map((m) => m.technique_id)
        .filter(Boolean)
        .join(", ");
      const atlas = (r.mitre_atlas_mapping as { technique_id?: string }[])
        .map((m) => m.technique_id)
        .filter(Boolean)
        .join(", ");
      return `${i + 1}. ${r.case_id} (${r.case_name}) -- similarity ${r.similarity.toFixed(3)}. ATT&CK: [${attack || "none"}]. ATLAS: [${atlas || "none"}].`;
    })
    .join("\n");

  const system = [
    "You are a threat hunting assistant. A hunter gave you a plain-English hunting hypothesis.",
    "SecureBERT embedding search grounded it against the nearest matching historical case(s) below",
    "(mapped to MITRE ATT&CK and, where relevant, MITRE ATLAS for AI-native attacks). Turn this into",
    "a concrete hunt plan: the relevant ATT&CK/ATLAS techniques to hunt for (only ones supported by",
    "the matches below), the data sources/log sources to query, and a short starter detection query",
    "or pseudocode. If the hypothesis describes an AI-system attack, say so explicitly and reference",
    "ATLAS, not just ATT&CK. Respond in under 220 words of plain prose with short labeled sections",
    "(Techniques:, Data sources:, Starter query:), no markdown headers.",
  ].join(" ");

  const user = `Hunting hypothesis:\n${hypothesis}\n\nGrounding matches from the case corpus:\n${matchLines}`;

  let huntPlan = "";
  try {
    huntPlan = await askGroq(system, user);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  return NextResponse.json({ results, huntPlan });
}
