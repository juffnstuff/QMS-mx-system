import { NextRequest, NextResponse } from "next/server";
import { runFullScan } from "@/lib/m365/scan-orchestrator";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret =
    req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("key");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runFullScan({ source: "cron" });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Cron] Full scan failed:", error);
    return NextResponse.json(
      { error: "Scan failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
