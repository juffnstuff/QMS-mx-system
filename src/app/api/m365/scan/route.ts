import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runUserScan } from "@/lib/m365/scan-orchestrator";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  try {
    const result = await runUserScan(session.user.id);
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
