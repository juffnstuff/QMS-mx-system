import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeMessage } from "@/lib/ai/analyze-message";

// Re-runs the AI on a pending suggestion using the email body plus only the
// non-excluded attachments (with reviewer-edited text where applicable). The
// suggestion's payload + proposedFields are overwritten with the new analysis.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  const { id } = await params;

  const suggestion = await prisma.aISuggestion.findUnique({
    where: { id },
    include: {
      processedMessage: {
        include: { attachments: true },
      },
    },
  });

  if (!suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }
  if (suggestion.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending suggestions can be re-analyzed" },
      { status: 400 },
    );
  }

  // Gather context the same way the scanner does so the AI can match against
  // existing equipment / projects / work orders / schedules.
  const [equipment, openWorkOrders, activeProjects, activeSchedules] = await Promise.all([
    prisma.equipment.findMany({
      select: {
        id: true, name: true, type: true, location: true,
        serialNumber: true, status: true, parentId: true,
      },
    }),
    prisma.workOrder.findMany({
      where: { status: { in: ["open", "in_progress"] } },
      select: {
        id: true, title: true, status: true, priority: true,
        equipment: { select: { name: true } },
      },
    }),
    prisma.project.findMany({
      where: { status: { in: ["planning", "in_progress", "on_hold"] } },
      select: {
        id: true, title: true, status: true, phase: true,
        keywords: true, parentProjectId: true,
      },
    }),
    prisma.maintenanceSchedule.findMany({
      where: { boardStatus: { not: "done" } },
      select: {
        id: true, title: true, frequency: true, nextDue: true,
        equipment: { select: { name: true } },
      },
    }),
  ]);

  const pm = suggestion.processedMessage;
  const attachments = (pm.attachments || [])
    .filter((a) => !a.excluded)
    .map((a) => ({
      filename: a.filename,
      text: a.userEditedText ?? a.extractedText ?? "",
    }))
    .filter((a) => a.text.trim().length > 0);

  const analysis = await analyzeMessage(
    {
      subject: pm.subject ?? undefined,
      // We only stored bodyPreview (~500 chars). Better than nothing — the
      // attachments now carry the substance for re-analyze.
      body: pm.bodyPreview,
      senderName: pm.senderName ?? "Unknown",
      senderEmail: pm.senderEmail ?? "",
      attachments,
    },
    {
      equipment,
      workOrders: openWorkOrders.map((w) => ({
        id: w.id, title: w.title, equipmentName: w.equipment.name,
        status: w.status, priority: w.priority,
      })),
      projects: activeProjects,
      schedules: activeSchedules.map((s) => ({
        id: s.id, title: s.title, equipmentName: s.equipment.name,
        frequency: s.frequency, nextDue: s.nextDue,
      })),
    },
  );

  // Pick the first action that matches the existing suggestion's kind, or fall
  // back to the first action overall, so we update this suggestion in place.
  const matched =
    analysis.suggestedActions.find((a) => a.kind === suggestion.kind) ??
    analysis.suggestedActions[0];

  if (!matched) {
    return NextResponse.json(
      { error: "AI returned no actionable suggestions for the new content" },
      { status: 422 },
    );
  }

  const updated = await prisma.aISuggestion.update({
    where: { id },
    data: {
      suggestionType: matched.type,
      kind: matched.kind ?? suggestion.kind,
      payload: JSON.stringify(matched),
      proposedFields: matched.proposedFields
        ? (matched.proposedFields as object)
        : undefined,
    },
  });

  // Refresh the stored AI summary on the parent ProcessedMessage too.
  await prisma.processedMessage.update({
    where: { id: pm.id },
    data: { aiAnalysis: JSON.stringify(analysis), confidence: analysis.confidence },
  });

  return NextResponse.json({
    success: true,
    suggestion: updated,
    actionsReturned: analysis.suggestedActions.length,
  });
}
