import { NextResponse } from "next/server";
import { listCases } from "@/lib/securebertApi";

export const maxDuration = 30;

export async function GET() {
  try {
    const cases = await listCases();
    return NextResponse.json({ cases });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
