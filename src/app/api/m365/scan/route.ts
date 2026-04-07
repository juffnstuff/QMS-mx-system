import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runFullScan } from "@/lib/m365/scan-orchestrator";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const result = await runFullScan({ source: "manual" });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Scan All] Failed:", error);
    return NextResponse.json(
      {
        error: "Scan failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
