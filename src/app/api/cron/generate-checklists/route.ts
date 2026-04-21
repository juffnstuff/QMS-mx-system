import { NextRequest, NextResponse } from "next/server";
import { generateChecklistCompletionsForDate } from "@/lib/pm-checklists/generate-completions";

// Cron endpoint: generate today's pending ChecklistCompletion rows for every
// active schedule that's due. Call nightly (or on-demand) via cron-scheduler.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
