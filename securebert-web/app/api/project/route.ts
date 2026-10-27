import { NextResponse } from "next/server";
import { projectText } from "@/lib/securebertApi";

export const maxDuration = 30;

// No Groq call here -- just embeds the snippet, then both plots it (coords,
// display only) and finds its nearest case by cosine similarity against the
// real embeddings (nearest, the actual semantic claim). The only live step in
// the one use case that's pure SecureBERT.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = body?.text;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  try {
    const result = await projectText(text);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
