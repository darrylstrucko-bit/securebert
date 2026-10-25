import { NextResponse } from "next/server";
import { projectText } from "@/lib/securebertApi";

export const maxDuration = 30;

// No Groq call here -- just embeds the snippet and projects it into the Corpus
// Map's fixed 2D space. The only live step in the one use case that's pure
// SecureBERT.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = body?.text;
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  try {
    const coords = await projectText(text);
    return NextResponse.json({ coords });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
