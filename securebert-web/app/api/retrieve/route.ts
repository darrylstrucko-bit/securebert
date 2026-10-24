import { NextResponse } from "next/server";
import { retrieveCases } from "@/lib/securebertApi";
import { askGroq } from "@/lib/groq";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = body?.text;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  let results;
  try {
    results = await retrieveCases(text, body?.k ?? 3);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  const matchLines = results
    .map((r, i) => {
      const attack = (r.mitre_attack_mapping as { technique_id?: string }[]).map((m) => m.technique_id).filter(Boolean);
      const atlas = (r.mitre_atlas_mapping as { technique_id?: string }[]).map((m) => m.technique_id).filter(Boolean);
      const tags = [...attack.map((t) => `ATT&CK ${t}`), ...atlas.map((t) => `ATLAS ${t}`)];
      return `${i + 1}. ${r.case_id} (${r.case_name}) -- cosine similarity ${r.similarity.toFixed(3)}, family: ${r.attack_family}, tagged techniques: [${tags.join(", ") || "none"}]`;
    })
    .join("\n");

  const system = [
    "You are a SOC analyst assistant. You are given a new, unlabeled incident description and the",
    "top matching historical cases a SecureBERT embedding search retrieved by cosine similarity.",
    "Write a short analyst brief: which historical case(s) this most closely resembles, what shared",
    "techniques or behaviors justify that, and a confidence level derived from the similarity scores",
    "you were given (do not invent your own score). Recommend one concrete next step.",
    "Ground every claim in the retrieved matches below -- do not assert a connection to a case that",
    "is not in the list, and only cite a technique ID that appears in that case's own 'tagged",
    "techniques' list -- never invent or guess one. Respond in under 180 words of plain prose, no",
    "markdown headers.",
  ].join(" ");

  const user = `New incident description:\n${text}\n\nTop retrieved matches:\n${matchLines}`;

  let narrative = "";
  try {
    narrative = await askGroq(system, user);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  return NextResponse.json({ results, narrative });
}
