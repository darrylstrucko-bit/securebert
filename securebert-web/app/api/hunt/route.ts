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
    "a concrete hunt plan. If the hypothesis describes an AI-system attack, say so explicitly and",
    "reference ATLAS, not just ATT&CK.",
    "You MUST fill in all four fields below -- none may be left blank, every hunt plan needs all four",
    "to be usable.",
    'Respond with a single JSON object with exactly these keys, each a short plain-prose string (no',
    'markdown, each REQUIRED and non-empty): "reasoning" (1-2 sentences on how the hypothesis connects',
    'to the grounding matches below), "techniques" (REQUIRED -- list the specific ATT&CK/ATLAS',
    "technique IDs to hunt for, cited ONLY from the grounding matches below, never invented --",
    'e.g. "AML.T0040, T1071.001"), "data_sources" (REQUIRED -- name the specific log/data sources to',
    'query, e.g. "API gateway access logs, inference request logs"), and "starter_query" (a short',
    "starter detection query or pseudocode).",
  ].join(" ");

  const user = `Hunting hypothesis:\n${hypothesis}\n\nGrounding matches from the case corpus:\n${matchLines}`;

  let reasoning = "";
  let techniques = "";
  let dataSources = "";
  let starterQuery = "";
  try {
    const raw = await askGroq(system, user, { jsonMode: true });
    const parsed = JSON.parse(raw);
    reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "";
    techniques = typeof parsed.techniques === "string" ? parsed.techniques : "";
    dataSources = typeof parsed.data_sources === "string" ? parsed.data_sources : "";
    starterQuery = typeof parsed.starter_query === "string" ? parsed.starter_query : "";
    if (!reasoning && !techniques) throw new Error("Groq's JSON response was missing hunt plan content.");

    // Groq doesn't always reliably fill every requested JSON field (observed: it
    // sometimes leaves "techniques" and/or "data_sources" blank despite the prompt
    // marking them required). Rather than show an empty "required" section, fall
    // back to deriving it directly from the grounding data we already have --
    // this is literally what "techniques" is supposed to reflect anyway.
    if (!techniques.trim()) {
      const ids = new Set<string>();
      for (const r of results) {
        for (const m of r.mitre_attack_mapping as { technique_id?: string }[]) if (m.technique_id) ids.add(m.technique_id);
        for (const m of r.mitre_atlas_mapping as { technique_id?: string }[]) if (m.technique_id) ids.add(m.technique_id);
      }
      techniques = [...ids].join(", ");
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  return NextResponse.json({ results, reasoning, techniques, dataSources, starterQuery });
}
