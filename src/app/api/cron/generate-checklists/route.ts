import { NextRequest, NextResponse } from "next/server";
import { generateChecklistCompletionsForDate } from "@/lib/pm-checklists/generate-completions";

// Cron endpoint: generate today's pending ChecklistCompletion rows for every
// active schedule that's due. Call nightly (or on-demand) via cron-scheduler.
// Accepts either Authorization: Bearer <secret> (for server-to-server) or
// ?key=<secret> (for quick admin triggers from a browser).
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const keyParam = req.nextUrl.searchParams.get("key");

  const authorized =
    !cronSecret ||
    authHeader === `Bearer ${cronSecret}` ||
    keyParam === cronSecret;

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateChecklistCompletionsForDate();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[cron/generate-checklists] failed:", err);
    return NextResponse.json(
      { error: "Generation failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
