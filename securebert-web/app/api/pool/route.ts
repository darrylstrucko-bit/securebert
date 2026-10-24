import { NextResponse } from "next/server";
import { clusterCase } from "@/lib/securebertApi";

export const maxDuration = 30;

// Cluster-only, no Groq call: lets the UI show the full unlabeled pool (the
// "haystack") the moment a case is picked, before the user clicks Run. The
// clustering itself is just numpy over precomputed vectors -- no model
// inference -- so this is fast even on a cold Render instance.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const caseId = body?.case_id;
  if (typeof caseId !== "string" || !caseId) {
    return NextResponse.json({ error: "Missing case_id." }, { status: 400 });
  }

  try {
    const cluster = await clusterCase(caseId, body?.noise_count ?? 40);
    return NextResponse.json({ cluster });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
