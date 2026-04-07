import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runUserScan } from "@/lib/m365/scan-orchestrator";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  // Check if this is a deep scan request
  let deep = false;
  try {
    const body = await req.json();
    deep = body.deep === true;
  } catch {
    // No body or invalid JSON — normal scan
  }

  try {
    const result = await runUserScan(session.user.id, { deep });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Scan] Failed:", error);
    return NextResponse.json(
      {
        error: "Scan failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
