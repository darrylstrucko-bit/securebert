import { NextResponse } from "next/server";

// Fire-and-forget ping to wake the Render-hosted SecureBERT service before the
// user actually clicks a button, so the ~50s+ free-tier cold start happens
// during page load instead of during their first real request. Same pattern as
// skill-scanner-web's /api/warm.
//
// `remote` tells the client whether a Render-style cold start is even a concept
// here -- false in local dev (no remote API configured), true in production.
export async function GET() {
  const apiUrl = process.env.SECUREBERT_API_URL;
  if (!apiUrl) return NextResponse.json({ remote: false, warmed: true });

  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/`, { signal: AbortSignal.timeout(5_000) });
    const data = await res.json().catch(() => null);
    return NextResponse.json({ remote: true, warmed: Boolean(data?.corpus_ready) });
  } catch {
    // Expected while it's waking up -- the point was just to start that process.
    return NextResponse.json({ remote: true, warmed: false });
  }
}
