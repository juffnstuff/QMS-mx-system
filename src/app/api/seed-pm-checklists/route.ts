import { NextRequest, NextResponse } from "next/server";
import { seedPmChecklists } from "@/lib/pm-checklists/seed";

// Idempotent seed for PM checklist templates, items, equipment, and schedules.
// Safe to re-run on every deploy.
export async function GET(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("key");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await seedPmChecklists();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[seed-pm-checklists] failed:", err);
    return NextResponse.json(
      { error: "Seed failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
