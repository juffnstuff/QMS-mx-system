import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const {
      title, description, keywords, status, priority, budget, dueDate,
      phase, projectJustification, designObjectives, designRequirements,
      potentialVendors, salesMarketingActions, engineeringActions,
      releaseChecklist, actualBudget, plannedSchedule, actualSchedule,
      isComplete, contingentDetails, projectLeadId, secondaryLeadId,
      parentProjectId,
    } = body;

    // Only validate the title when it's being changed — partial updates (like
    // just assigning a lead) leave it undefined so the existing value stays.
    if (title !== undefined && !title) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }

    // Handle completedAt based on status
    const existing = await prisma.project.findUnique({
      where: { id },
      include: { _count: { select: { children: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Enforce 2-level hierarchy.
    if (parentProjectId) {
      if (parentProjectId === id) {
        return NextResponse.json({ error: "Project cannot be its own parent" }, { status: 400 });
      }
      if (existing._count.children > 0) {
        return NextResponse.json(
          { error: "A project with sub-projects cannot itself become a sub-project" },
          { status: 400 },
        );
      }
      const parent = await prisma.project.findUnique({
        where: { id: parentProjectId },
        select: { parentProjectId: true },
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent project not found" }, { status: 400 });
      }
      if (parent.parentProjectId) {
        return NextResponse.json(
          { error: "Parent must be a top-level project" },
          { status: 400 },
        );
      }
    }

    // Build a partial-update payload: only touch fields the caller actually
    // sent. Previously missing fields (description, budget, dueDate, etc.)
    // were getting nulled on every request, which broke inline assignment
    // updates that only send one field like { projectLeadId }.
    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description || null;
    if (keywords !== undefined) data.keywords = keywords || null;
    if (status !== undefined) {
      data.status = status;
      if (status === "completed" && existing.status !== "completed") {
        data.completedAt = new Date();
      } else if (status !== "completed") {
        data.completedAt = null;
      }
    }
    if (priority !== undefined) data.priority = priority;
    if (budget !== undefined) data.budget = budget || null;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (projectLeadId !== undefined) data.projectLeadId = projectLeadId || null;
    if (secondaryLeadId !== undefined) data.secondaryLeadId = secondaryLeadId || null;
    if (parentProjectId !== undefined) data.parentProjectId = parentProjectId || null;
    if (phase !== undefined) data.phase = phase || existing.phase;
    if (projectJustification !== undefined) data.projectJustification = projectJustification || null;
    if (designObjectives !== undefined) data.designObjectives = designObjectives || null;
    if (designRequirements !== undefined) data.designRequirements = designRequirements || null;
    if (potentialVendors !== undefined) data.potentialVendors = potentialVendors || null;
    if (salesMarketingActions !== undefined) data.salesMarketingActions = salesMarketingActions || null;
    if (engineeringActions !== undefined) data.engineeringActions = engineeringActions || null;
    if (releaseChecklist !== undefined) data.releaseChecklist = releaseChecklist || null;
    if (actualBudget !== undefined) data.actualBudget = actualBudget || null;
    if (plannedSchedule !== undefined) data.plannedSchedule = plannedSchedule || null;
    if (actualSchedule !== undefined) data.actualSchedule = actualSchedule || null;
    if (isComplete !== undefined) data.isComplete = isComplete || null;
    if (contingentDetails !== undefined) data.contingentDetails = contingentDetails || null;

    const project = await prisma.project.update({
      where: { id },
      data,
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.project.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
