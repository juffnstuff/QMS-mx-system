import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitCompletion, type ItemResultInput } from "@/lib/pm-checklists/submit-completion";

// GET /api/checklists/[id] — full completion with items + results.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const completion = await prisma.checklistCompletion.findUnique({
    where: { id },
    include: {
      template: {
        include: {
          items: { orderBy: { sortOrder: "asc" } },
        },
      },
      equipment: true,
      technician: { select: { id: true, name: true } },
      supervisor: { select: { id: true, name: true } },
      results: true,
      schedule: { select: { id: true, title: true } },
      supersededBy: { select: { id: true, templateId: true, completedAt: true } },
    },
  });
  if (!completion) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(completion);
}

// PATCH /api/checklists/[id] — two modes:
//   { action: "start" }              → status=in_progress, startedAt=now, technicianId=me
//   { action: "submit", results, supervisorId?, notes? }
//     → full submit via submit-completion lib (handles supersede + auto-WO).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  try {
    if (body.action === "start") {
      const completion = await prisma.checklistCompletion.findUnique({ where: { id } });
      if (!completion) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (completion.status !== "pending") {
        return NextResponse.json(
          { error: `Cannot start a ${completion.status} checklist` },
          { status: 400 },
        );
      }
      // Prefer an explicit technicianId from the form (admin may claim on
      // behalf of another tech); fall back to the existing assignment or
      // the current user.
      const technicianId =
        (typeof body.technicianId === "string" && body.technicianId) ||
        completion.technicianId ||
        session.user.id;
      const updated = await prisma.checklistCompletion.update({
        where: { id },
        data: {
          status: "in_progress",
          startedAt: new Date(),
          technicianId,
        },
      });
      return NextResponse.json(updated);
    }

    if (body.action === "submit") {
      if (!Array.isArray(body.results)) {
        return NextResponse.json({ error: "results array required" }, { status: 400 });
      }
      const results = body.results as ItemResultInput[];
      const technicianId =
        (typeof body.technicianId === "string" && body.technicianId) || session.user.id;
      const outcome = await submitCompletion({
        completionId: id,
        technicianId,
        supervisorId: body.supervisorId ?? null,
        notes: body.notes ?? null,
        results,
      });
      return NextResponse.json(outcome);
    }

    if (body.action === "unstart") {
      // Reset an in-progress checklist back to pending — for when Start was
      // clicked by mistake. Any authenticated user can reset; we intentionally
      // don't limit to the starter so a coworker can fix an accidental click.
      // Item results stay in the DB (cleared via form re-edit if needed);
      // only the status flip + startedAt are reset.
      const completion = await prisma.checklistCompletion.findUnique({ where: { id } });
      if (!completion) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (completion.status !== "in_progress") {
        return NextResponse.json(
          { error: `Cannot unstart a ${completion.status} checklist` },
          { status: 400 },
        );
      }
      const updated = await prisma.checklistCompletion.update({
        where: { id },
        data: {
          status: "pending",
          startedAt: null,
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[PATCH /api/checklists/[id]] failed:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed" },
      { status: 500 },
    );
  }
}
